import React, { useState } from 'react';
import { AppLoading } from 'expo';
import { SafeAreaView, StyleSheet, View, TextInput } from 'react-native';
// import { WebView } from 'react-native-webview';
import WebView from './ManagedWebView';
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

const injectedJavaScript = 'injectedJavaScript';
const googleUserAgent =
  'Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible ; Googlebot/2.1 ; +http://www.google.com/bot.html)';

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
        onNavigate={request => setURI(request.url)}
        onRequest={(req) => {
          // console.log('[I] onRequest', req);
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
