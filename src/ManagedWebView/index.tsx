import React, { useRef, useState, useEffect } from 'react';
import { WebView, WebViewProps } from 'react-native-webview';
import tough from 'tough-cookie';
import hijack from './hijack';
import * as FileSystem from 'expo-file-system';
import { resolve } from 'url';
import normalize from '../normalize-url';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type CookieJar = typeof tough.CookieJar;

export interface Request {
  url: string;
  headers: Record<string, string>;
  method: Method;
  body?: string;
}

export interface ResponseCancel {
  cancel: true;
}

export interface ResponseSuccess {
  url: string;
  status: number;
  data: string;
  headers: Record<string, string>;
}

export type Response = ResponseSuccess | ResponseCancel;

function isResponseCancel(res: Response): res is ResponseCancel {
  return (res as ResponseCancel).cancel;
}

export interface OnRequestOptions {
  signal?: AbortSignal;
}

export interface ManagedWebViewProps {
  uri: string;
  onNavigate: WebViewProps['onShouldStartLoadWithRequest'];
  onBeforeRequest?: (
    req: Request,
    opts: OnRequestOptions,
  ) => Promise<void | Response> | void | Response;
  onCompletedRequest?: (
    req: Request,
    res: ResponseSuccess,
    cookies: CookieJar,
  ) => Promise<void> | void;
}

interface PerformFetchOptions {
  method?: Method;
  body?: string;
  signal?: AbortSignal;
  headers: Record<string, string>;
}

export const DefaultUserAgent =
  'Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.157 Mobile Safari/537.36';
const useFs = false;

async function download(url: string, opts): Promise<Response> {
  const res = await fetch(url, opts);

  return {
    url: res.url,
    status: res.status,
    data: await res.text(),
    headers: { ...res.headers.map },
  };
}

function ManagedWebView({
  uri,
  onBeforeRequest = (): void => {},
  onCompletedRequest,
  userAgent = DefaultUserAgent,
  onMessage,
  onNavigate,
  ...props
}: ManagedWebViewProps & WebViewProps) {
  const webViewRef = useRef();
  const cookiejarRef = useRef();
  const cacheSourceRef = useRef({});
  const [source, setSource] = useState({});

  if (!cookiejarRef.current) cookiejarRef.current = new tough.CookieJar();

  async function performFetch(
    url: string,
    { method = 'GET', body, signal, headers }: PerformFetchOptions = {},
  ): Promise<Response> {
    const cookies = await new Promise((rs, rj) => {
      cookiejarRef.current.getCookies(url, (err, cookies) => {
        if (err) {
          rj(err);
          return;
        }

        rs(cookies || []);
      });
    });

    const request: Request = {
      url,
      body,
      method,
      headers: {
        ...headers,
        cookie: cookies.join('; '),
        'user-agent': userAgent,
        'upgrade-insecure-requests': '1',
        'accept-language': 'en-US,en;q=0.9',
      },
    };
    const response =
      (await onBeforeRequest(request, { signal })) ||
      (await download(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        ...(signal && {signal}),
        credentials: 'omit',
      }));

    if (response?.headers['set-cookie']) {
      await new Promise((rs, rj) => {
        cookiejarRef.current.setCookie(
          response.headers['set-cookie'],
          request.url,
          (e, s) => {
            if (e) {
              rj(e);
              return;
            }

            rs(s);
          },
        );
      });
    }

    if (onCompletedRequest && !isResponseCancel(request))
      await onCompletedRequest(
        request,
        response as ResponseSuccess,
        cookiejarRef.current,
      );

    return response;
  }

  async function navigate(url: string, opts: OnRequestOptions): Promise<void> {
    const response = await performFetch(url, opts);

    if (isResponseCancel(response)) return;

    const hijackScript = `<script>(function(w){(${hijack.toString()})(w)})(window)</script>`;

    cacheSourceRef.current = {
      baseUrl: response.url,
      html: response.data.replace('<head>', `<head>\n${hijackScript}`),
    };

    if (normalize(url) === normalize(response.url))
      setSource(cacheSourceRef.current);
    else
      onNavigate({ url: response.url });
  }

  useEffect(() => {
    if (uri === cacheSourceRef.current.baseUrl) {
      setSource(cacheSourceRef.current);
      cacheSourceRef.current = {};
      return;
    }

    const controller = new AbortController();
    navigate(uri, { signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [uri]);

  const handleMessage = async (event) => {
    const { nativeEvent } = event;

    try {
      const msg = JSON.parse(nativeEvent.data);

      if (msg.type === 'fetch') {
        const url = resolve(source.baseUrl, msg.payload.url);
        try {
          // remove signal
          const { signal, ...opts } = msg.payload.opts;
          console.log(' ->', opts.method, '::', url);
          const response = await performFetch(url, opts);

          // For canceled request, just do not trigger it
          if (!isResponseCancel(response)) {
            const serialized = JSON.stringify(response);
            const run = `(function(){window['${msg.key}'](null, ${serialized});})(); true;`;
            webViewRef.current.injectJavaScript(run);
          }
        } catch (e) {
          console.warn('[E] While fetch', e, nativeEvent.data);
        }
      } else if (msg.type === 'console') {
        const args = JSON.parse(msg.args);
        console.log(`[WV] (${msg.method}):`, ...args);
      }
    } catch (e) {
      console.warn('[E] While parsing event', e, nativeEvent.data);
    }
    if (onMessage) onMessage(event);
  };

  return (
    <WebView
      ref={webViewRef}
      source={source}
      originWhitelist={['*']}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={(request): void => {
        console.log('[I] onShouldStartLoadWithRequest', request);
        if (normalize(uri) === normalize(request.url)) return true;
        onNavigate(request);
        return false;
      }}
      {...props}
    />
  );
}

export default ManagedWebView;
