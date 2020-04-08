import React, { useState } from 'react';
import { AppLoading } from 'expo';
import { SafeAreaView, StyleSheet, View, TextInput } from 'react-native';
// import { WebView } from 'react-native-webview';
import WebView, {
  Request,
  Response,
  ResponseSuccess,
  CookieJar,
} from './ManagedWebView';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import cacheResources from './cacheResources';

const shouldAddContentScript = [
  /^https?:\/\/.*?\.bizjournals\.com\//,
  /^https?:\/\/.*?\.bloomberg\.com\//,
  /^https?:\/\/.*?\.businessinsider\.com\//,
  /^https?:\/\/.*?\.caixinglobal\.com\//,
  /^https?:\/\/.*?\.ad\.nl\//,
  /^https?:\/\/.*?\.ed\.nl\//,
  /^https?:\/\/.*?\.haaretz.co\.il\//,
  /^https?:\/\/.*?\.lemonde\.fr\//,
  /^https?:\/\/.*?\.nytimes\.com\//,
  /^https?:\/\/.*?\.nzherald\.co\.nz\//,
  /^https?:\/\/.*?\.parool\.nl\//,
  /^https?:\/\/.*?\.repubblica\.it\//,
  /^https?:\/\/.*?\.telegraaf\.nl\//,
  /^https?:\/\/.*?\.trouw\.nl\//,
  /^https?:\/\/.*?\.volkskrant\.nl\//,
  /^https?:\/\/.*?\.washingtonpost\.com\//,
  /^https?:\/\/.*?\.economist\.com\//,
  /^https?:\/\/.*?\.the-tls\.co\.uk\//,
  /^https?:\/\/.*?\.leparisien\.fr\//,
  /^https?:\/\/.*?\.techinasia\.com\//,
  /^https?:\/\/.*?\.bloombergquint\.com\//,
];

const shouldDisableJavascript = [
  /^https?:\/\/.*?\.newstatesman\.com\//,
  /^https?:\/\/.*?\.tinypass\.com\//,
  /^https?:\/\/.*?\.poool\.fr\//,
  /^https?:\/\/.*?\.piano\.io\//,
  /^https?:\/\/.*?\.outbrain\.com\//,
];

const useGoogleBot = [
  'barrons.com',
  'lemonde.fr',
  'nytimes.com',
  'quora.com',
  'telegraph.co.uk',
  'theaustralian.com.au',
  'themercury.com.au',
  'thetimes.co.uk',
  'wsj.com',
  'haaretz.co.il',
  'haaretz.com',
  'themarker.com',
  'prime.economictimes.indiatimes.com',
  'dailytelegraph.com.au',
  'theathletic.com',
];

const blockedRegexes = [
  /.+:\/\/.+\.tribdss\.com\//,
  /thenation\.com\/.+\/paywall-script\.php/,
  /haaretz\.co\.il\/htz\/js\/inter\.js/,
  /nzherald\.co\.nz\/.+\/headjs\/.+\.js/,
  /(.+\.tinypass\.com\/.+|economist\.com\/_next\/static\/runtime\/main.+\.js)/,
  /.+\.tinypass\.com\/.+/,
  /meter\.bostonglobe\.com\/js\/.+/,
  /.+\.tinypass\.com\/.+/,
  /.+\.tinypass\.com\/.+/,
  /.+\.tinypass\.com\/.+/,
  /afr\.com\/assets\/vendorsReactRedux_client.+\.js/,
  /theglobeandmail\.com\/pb\/resources\/scripts\/build\/chunk-bootstraps\/.+\.js/,
  /.+\.repstatic\.it\/minify\/sites\/lastampa\/.+\/config\.cache\.php\?name=social_js/,
  /.+cdn-au\.piano\.io\/api\/tinypass.+\.js/,
  /scripts\.repubblica\.it\/pw\/pw\.js.+/,
];

// Don't remove cookies before page load
const allowCookies = [
  'ad.nl',
  'asia.nikkei.com',
  'bostonglobe.com',
  'cen.acs.org',
  'chicagobusiness.com',
  'demorgen.be',
  'denverpost.com',
  'economist.com',
  'ed.nl',
  'examiner.com.au',
  'ft.com',
  'hacked.com',
  'harpers.org',
  'hbr.org',
  'lemonde.fr',
  'medium.com',
  'mercurynews.com',
  'newstatesman.com',
  'nymag.com',
  'nytimes.com',
  'ocregister.com',
  'parool.nl',
  'qz.com',
  'scientificamerican.com',
  'spectator.co.uk',
  'telegraaf.nl',
  'theadvocate.com.au',
  'theage.com.au',
  'theatlantic.com',
  'theaustralian.com.au',
  'thediplomat.com',
  'themercury.com.au',
  'thestar.com',
  'towardsdatascience.com',
  'trouw.nl',
  'vn.nl',
  'volkskrant.nl',
  'washingtonpost.com',
  'lrb.co.uk',
  'theathletic.com',
];

// Removes cookies after page load
const removeCookies = [
  'ad.nl',
  'asia.nikkei.com',
  'bloombergquint.com',
  'bostonglobe.com',
  'cen.acs.org',
  'chicagobusiness.com',
  'demorgen.be',
  'denverpost.com',
  'economist.com',
  'ed.nl',
  'examiner.com.au',
  'ft.com',
  'hacked.com',
  'harpers.org',
  'hbr.org',
  'medium.com',
  'mercurynews.com',
  'newstatesman.com',
  'nymag.com',
  'nytimes.com',
  'ocregister.com',
  'qz.com',
  'scientificamerican.com',
  'spectator.co.uk',
  'telegraaf.nl',
  'theadvocate.com.au',
  'theage.com.au',
  'theatlantic.com',
  'thediplomat.com',
  'thestar.com',
  'towardsdatascience.com',
  'vn.nl',
  'washingtonpost.com',
];

// select specific cookie(s) to hold from remove_cookies domains
const removeCookiesSelectHold = {
  'washingtonpost.com': ['wp_gdpr'],
  'qz.com': ['gdpr'],
  'wsj.com': ['wsjregion'],
};

// select only specific cookie(s) to drop from remove_cookies domains
const removeCookiesSelectDrop = {
  'ad.nl': ['temptationTrackingId'],
  'bostonglobe.com': ['FMPaywall'],
  'demorgen.be': ['TID_ID'],
  'economist.com': ['rvuuid'],
  'ed.nl': ['temptationTrackingId'],
  'nrc.nl': ['counter'],
};

const injectedJavaScript = 'injectedJavaScript';
const googleUserAgent =
  'Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible ; Googlebot/2.1 ; +http://www.google.com/bot.html)';

function handleBeforeRequest(request: Request): void | Response {
  // console.log('[I] handleBeforeRequest', request);
  // handleBeforeRequest.headers.cookies = '';
  const hasToBlock = blockedRegexes.some((reg: RegExp): boolean => {
    return !!request.url.match(reg);
  });
  if (hasToBlock) return { cancel: true };

  request.headers['x-forwarded-for'] = '66.249.66.1';

  if (request.url.includes('cooking.nytimes.com/api/v1/users/bootstrap')) {
    request.headers.referer = 'https://cooking.nytimes.com';
  } else if (
    request.url.includes('wsj.com') ||
    request.url.includes('ft.com')
  ) {
    request.headers.referer = 'https://www.facebook.com/';
  } else {
    request.headers.referer = 'https://www.google.com/';
  }

  const allowCookie = allowCookies.some((site: string): boolean =>
    request.url.includes(site),
  );
  if (!allowCookies) request.headers.cookie = '';
}

async function handleCompletedRequest(
  request: Request,
  response: ResponseSuccess,
  cookiejar: CookieJar,
): Promise<void> {
  const store = cookiejar.store;

  for (const domain of removeCookies) {
    if (!request.url.includes(domain)) continue;

    const cookies = await new Promise((rs, rj): void => {
      store.findCookies(domain, null, (err, cookies) => {
        if (err) {
          rj(err);
          return;
        }
        rs(cookies);
      });
    });

    for (const cookie of cookies) {
      const cookieDomain = cookie.domain;
      const rcDomain = cookieDomain.replace(/^(\.?www\.|\.)/, '');

      if (
        rcDomain in removeCookiesSelectHold &&
        removeCookiesSelectHold[rcDomain].includes(cookie.key)
      )
        continue; // don't remove specific cookie

      // drop only specific cookie(s) from remove_cookies domains
      if (
        rcDomain in removeCookiesSelectDrop &&
        !removeCookiesSelectDrop[rcDomain].includes(cookie.key)
      )
        continue; // only remove specific cookie

      await new Promise((rs, rj): void => {
        store.removeCookie(
          cookie.domain,
          cookie.path,
          cookie.key,
          (e): void => {
            if (e) {
              rj(e);
              return;
            }
            rs();
          },
        );
      });
    }
  }
}

export default function App() {
  const [state, setState] = useState('loading');
  const [text, setText] = useState('url');
  const [contentScript, setContentScript] = useState('url');
  const [uri, setURI] = useState('https://www.google.com/');

  if (state === 'loading') {
    return (
      <AppLoading
        startAsync={async () => {
          await cacheResources();
          const asset = Asset.fromModule(
            require('../assets/contentScript.txt'),
          );
          const content = await FileSystem.readAsStringAsync(asset.localUri);
          setContentScript(
            `(function(){try {${content};}catch(e){console.log('hijack error', e.toString());}})(); true`,
          );
        }}
        onFinish={() => setState('loaded')}
        onError={console.warn}
      />
    );
  }

  const props = {};

  if (shouldDisableJavascript.some((r) => uri.match(r))) {
    props.javaScriptEnabled = false;
  } else if (shouldAddContentScript.some((r) => uri.match(r))) {
    props[injectedJavaScript] = contentScript;
  }

  if (useGoogleBot.some((s) => uri.includes(s))) {
    props.userAgent = googleUserAgent;
  }

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        placeholder="Url"
        autoCorrect={false}
        onChangeText={(text) => setText(text)}
        onSubmitEditing={() => setURI(text.toLowerCase())}
        value={text}
      />
      <WebView
        {...props}
        uri={uri}
        onNavigate={(request) => setURI(request.url)}
        onBeforeRequest={handleBeforeRequest}
        onCompletedRequest={handleCompletedRequest}
        onLoad={({ nativeEvent }) => {
          console.log('Webkit Load:', nativeEvent);
        }}
        onError={({ nativeEvent }) => {
          console.log('Webkit Error:', nativeEvent);
        }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  input: {
    height: 80,
    borderColor: 'grey',
    borderWidth: 1,
  },
  webview: {},
});
