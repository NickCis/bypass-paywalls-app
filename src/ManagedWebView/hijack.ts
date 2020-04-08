function hijack(window: any): void {
  function log(method) {
    return (...args) =>
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'console',
          method,
          args: JSON.stringify(args),
        }),
      );
  }
  console.log = log('L');
  console.warn = log('W');
  console.error = log('E');

  function performFetch(url, opts) {
    return new Promise(function (rs, rj) {
      let aborted = false;
      const key = `___MWV___${Math.round(Math.random() * 10000)}`;
      const handleAbort = () => {
        rj({ name: 'AbortError' })
        aborted = true;
      };

      if (opts && opts.signal)
        opts.signal.addEventListener('abort', handleAbort);

      window[key] = (err, data) => {
        delete window[key];

        if (opts && opts.signal)
          opts.signal.removeEventListener('abort', handleAbort);

        if (aborted)
          return;

        if (err) {
          rj(err);
          return;
        }

        rs({
          ok: true,
          headers: data.headers,
          url: data.url,
          status: data.status,
          text: () => data.data,
          json: () => JSON.parse(data.data || '""'),
        });
      };

      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'fetch',
          payload: {
            url,
            opts,
          },
          key,
        }),
      );
    });
  }

  window.fetch = function (url, opts) {
    return performFetch(url, opts);
  };

  const OriginalXMLHttpRequest = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = {
      _abort: false,
      readyState: 0,
      status: 0,
      responseType: '',
      responseText: '',
      response: null,
      onreadystatechange: () => {},
      responseHeaders: {},
      headers: {},
      abort: () => {
        xhr._abort = true;
        xhr.onerror({ name: 'AbortError' });
      },
      setRequestHeader: (name, value) => {
        xhr.headers[`${name}`.toLowerCase()] = `${value}`;
      },
      open: (method, url) => {
        xhr.method = method;
        xhr.url = url;
      },
      send: (body) => {
        performFetch(xhr.url, {
          method: xhr.method,
          headers: xhr.headers,
          body,
        }).then((res) => {
          if (xhr._abort) return;

          switch ((xhr.responseType || 'text').toLowerCase()) {
            case 'json':
              xhr.response = res.json();
              break;

            case 'text':
            default:
              xhr.response = res.text();
              break;
          }

          xhr.readyState = OriginalXMLHttpRequest.DONE;
          xhr.status = res.status;
          xhr.statusText = 'OK';
          xhr.responseText = res.text();
          xhr.responseHeaders = res.headers;
          xhr.responseURL = res.url;
          xhr.onreadystatechange({ target: xhr });
        });
      },
      getAllResponseHeaders: () => {
        const lines = [];
        for (const key of Object.keys(xhr.responseHeaders)) {
          lines.push(`${key}: ${xhr.responseHeaders[key]}`);
        }
        return lines.join('\r\n');
      },
      getResponseHeader: (header) => xhr.responseHeaders[header],
    };

    return new Proxy(xhr, {
      set: (target, prop, value) => {
        if (prop in target) target[prop] = value;
        else console.log('Setting unknown:', prop);

        return true;
      },
      get(target, prop) {
        if (prop in target) return target[prop];
        else console.log('Getting unknown:', prop);
      },
    });
  };

  window.XMLHttpRequest.DONE = OriginalXMLHttpRequest.DONE;
}

export default hijack;
