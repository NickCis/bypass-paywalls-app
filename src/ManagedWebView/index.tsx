import React, { useRef, useState, useEffect } from 'react';
import { WebView, WebViewProps } from 'react-native-webview';
import tough from 'tough-cookie';
import hijack from './hijack';
import * as FileSystem from 'expo-file-system';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Request {
  url: string;
  headers: Record<string, string>;
  method: Method;
  body?: string;
}

export interface Response {
  status: number;
  data: string;
  headers: Record<string, string>;
}

export interface OnRequestOptions {
  signal?: AbortSignal;
}

export interface ManagedWebView {
  onRequest: (req: Request, opts: OnRequestOptions) => Promise<void | Response>;
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
    status: res.status,
    data: await res.text(),
    headers: { ...res.headers.map },
  };
}

function ManagedWebView({
  source: initialSource,
  onRequest,
  userAgent = DefaultUserAgent,
  onMessage,
  ...props
}: ManagedWebView & WebViewProps) {
  const webViewRef = useRef();
  const cookiejarRef = useRef();
  const [uri, setURI] = useState(initialSource.uri);
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
      (await onRequest(request, { signal })) ||
      (await download(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal,
        credentials: 'omit',
      }));

    if (response.headers['set-cookie']) {
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

    return response;
  }

  async function navigate(url: string, opts: OnRequestOptions) {
    const response = await performFetch(url, opts);
    const hijackScript = `<script>(function(w){(${hijack.toString()})(w)})(window)</script>`;

    setSource({
      baseUrl: url,
      html: response.data.replace('<head>', `<head>\n${hijackScript}`),
    });
  }

  useEffect(() => {
    setURI(initialSource.uri);
  }, [initialSource.uri]);

  useEffect(() => {
    console.log('[I] navigating');
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
        const url = new URL(msg.payload.url, source.baseUrl);
        const response = await performFetch(url.toString(), msg.payload.opts);
        console.log('[I] response.headers', response.headers);
        const serialized = JSON.stringify(response);
        const run = `(function(){window['${msg.key}'](null, ${serialized});})(); true;`;
        webViewRef.current.injectJavaScript(run);
      } else if (msg.type === 'console') {
        const args = JSON.parse(msg.args);
        console.log(`[WV] (${msg.method}):`, ...args);
      }
    } catch (e) {
      console.warn('[E] While parsing event', e, nativeEvent.data);
    }
    // do work
    if (onMessage) onMessage(event);
  };

  return (
    <WebView
      ref={webViewRef}
      source={source}
      originWhitelist={['*']}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={(request) => {
        console.log('[I] onShouldStartLoadWithRequest', request);
        if (request.url === uri) return true;
        setURI(request.url);
        return false;
      }}
      {...props}
    />
  );
}

export default ManagedWebView;
