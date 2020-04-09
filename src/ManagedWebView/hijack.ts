function hijack(window: any, debug: boolean): void {
  if (debug) {
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
  }

  const windowHistory = window.history;
  const history = {
    get state() {
      return window.History.getState();
    },
    pushState: (data, title, url) => window.History.pushState(data, title, url),
    replaceState: (data, title, url) => window.History.replaceState(data, title, url),
    back: () => window.History.back(),
    forward: () => window.History.forward(),
    go: delta => window.History.go(delta),
  };

  Object.defineProperty(window, 'history', {
    get: () => history,
  });

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

      if (url.endsWith('_/graphql'))
        console.log('--- seding request to graph ql', key);

      window[key] = (err, data) => {
        if (url.endsWith('_/graphql'))
          console.log('<=== received request to graph ql', key);
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
          json: () => {
            console.log('getting json');
            try {
              return JSON.parse(data.data);
            } catch (e) {
              console.log('failed json', e.toString());
            }
          },
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

  if (debug) {
    function run(code) {
      (0,eval)(`with(window.__global_ctx__){${code}}`);
    }

    window.__global_ctx__ = {
      location: new Proxy(window.location, {
        get: (target, key, receiver) => {
          console.log('location :: get ::', key, target[key].toString());

          if (target.href.includes('#'))
            console.log('    :: pathname', target.pathname);

          switch (key) {
            case 'origin':
              return `${window.location.protocol}//${window.location.host}`;
            default:
              return target[key];
          }
        },
        set: (target, key, value) => {
          console.log('location :: set ::', key, value.toString());
          target[key] = value;
          return true;
        }
      }),
      document: new Proxy(window.document, {
        get: (target, key, receiver) => {
          // console.log('document :: get ::', key);
          if ('function' === typeof target[key])
            return target[key].bind(target);
          switch (key) {
            case 'location':
              return window.__global_ctx__[key];
            default:
              return target[key];
          }
        },
      }),
      history: new Proxy(window.history, {
        get: (target, key) => {
          console.log('history :: get ::', key);
          if (key === 'pushState') {
            return (state, title, url) => {
              console.log('PUSH STATE', JSON.stringify(state));
              console.log('title', title);
              console.log('url', url);
              try {
                target.pushState(state, title, url);
              } catch (e) {
                console.log('Push State error', e.toString());
              }
            };
          }
          if (key === 'go') {
            // Hay que ponerse a contar, por que si va al del ppcio explota
            return (delta) => {
              console.log('GO', delta);
              target.go(delta);
            };
          }
          if ('function' === typeof target[key])
            return target[key].bind(target);

          return target[key];
        },
      }),
      window: new Proxy(window, {
        get: (target, key, receiver) => {
          // console.log('window :: get ::', key);
          switch (key) {
            case 'origin':
              return window.__global_ctx__.location.origin;
            case 'location':
            case 'document':
            case 'history':
              return window.__global_ctx__[key];
            case 'addEventListener':
            case 'setTimeout':
            case 'setInterval':
            case 'clearTimeout':
            case 'clearInterval':
              return target[key].bind(target);
            default:
              return target[key];
          }
        },
      }),
    };

    const documentCreateElement = window.document.createElement;
    window.document.createElement = (tag, options) => {
      if (tag.toLowerCase() === 'script') {
        const script = documentCreateElement.call(window.document, 'script');

        Object.defineProperty(script, 'src', {
          get: () => undefined,
          set: src => {
            setTimeout(() => {
              performFetch(src, { method: 'GET' })
                .then(res => res.text())
                .then(text => {
                  try {
                    run(text);
                  } catch (e) {
                    console.log('Failed running', src);
                    console.log(e.toString());
                    console.log(e.stack);
                  }

                  script.dispatchEvent(new Event('load'));
                });
            }, 10);
          },
        });

        return script;
      }

      return documentCreateElement.call(window.document, tag, options);
    };
  }
}

export default hijack;
