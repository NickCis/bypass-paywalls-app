import React, { useState } from 'react';
import { AppLoading } from 'expo';
import { SafeAreaView, StyleSheet, View, TextInput } from 'react-native';
// import { WebView } from 'react-native-webview';
import WebView from './ManagedWebView';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import cacheResources from './cacheResources';

const injectedJavaScript = 'injectedJavaScript';

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

const googleUserAgent =
  'Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible ; Googlebot/2.1 ; +http://www.google.com/bot.html)';

const patchFetch = `
<script>
alert('Hijack v2');
(function (window) {
  window.fetch = function (url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fetch', url }));
    return new Promise(rs => {});
  };

  window.XMLHttpRequest.prototype.open = function(method, url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open', method, url }));
  };

  window.XMLHttpRequest.prototype.send = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'send' }));
  };
})(window);
</script>
`;

const headers = {
  'Upgrade-Insecure-Requests': '1',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10; Nokia 6.1 Build/QKQ1.190828.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.162 Mobile Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7',
};

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
            [`try { ${content}; } catch(e) { }`, 'true;'].join('\n'),
          );
        }}
        onFinish={() => setState('loaded')}
        onError={console.warn}
      />
    );
  }

  const props = {
    source: {
      uri,
      // headers: {
      //   Cookies: '',
      //   'X-Forwarded-For': '66.249.66.1',
      //   Referer: uri.includes('wsj.com')
      //     ? 'https://www.facebook.com/'
      //     : 'https://www.google.com/',
      // },
    },
    // injectedJavaScript: `alert('injectedJavaScript'); true;`,
    // injectedJavaScriptBeforeContentLoaded: `alert('injectedJavaScriptBeforeContentLoaded'); true;`,
    /*[injectedJavaScript]: `
(function(xhr) {
  function postMessage(xhrInstance) { // Example
    window.ReactNativeWebView.postMessage('TODO: send data');
  }

  // Capture request before any network activity occurs:
  var send = xhr.send;
  xhr.send = function(data) {
    var rsc = this.onreadystatechange;
    if (rsc) {
        // "onreadystatechange" exists. Monkey-patch it
        this.onreadystatechange = function() {
            postMessage(this);
            // return rsc.apply(this, arguments);
        };
    }
    // return send.apply(this, arguments);
  };
})(XMLHttpRequest.prototype);
(function (w) {
  w.fetch = (...args) => window.ReactNativeWebView.postMessage(JSON.stringify(args));
})(window);
true;`,*/
  };

  /*
  if (shouldDisableJavascript.some(r => uri.match(r))) {
    props.javaScriptEnabled = false;
  } else if (shouldAddContentScript.some(r => uri.match(r))) {
    console.log('----- injected javascript --------');
    // props.injectedJavaScript = contentScript;
    props[injectedJavaScript] += `\n${contentScript}`;
    // props.injectedJavaScript = `
    //   document.body.style.backgroundColor = 'red';
    //   setTimeout(function() { window.alert('hi') }, 2000);
    //   true; // note: this is required, or you'll sometimes get silent failures
    // `;
  }

  if (useGoogleBot.some(s => uri.includes(s))) {
    props.userAgent = googleUserAgent;
  } */

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
        source={{ uri }}
        onRequest={(req) => {
          console.log('[I] onRequest', req);
          // req.headers.cookies = '';
          req.headers['x-forwarded-for'] = '66.249.66.1';
          req.headers.referer = req.url.includes('wsj.com')
            ? 'https://www.facebook.com/'
            : 'https://www.google.com/';
        }}
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
