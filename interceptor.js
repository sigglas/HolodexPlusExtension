// HolodexPlusExtension — interceptor.js
// Runs in the PAGE's JavaScript context (world: "MAIN") at document_start.
// Wraps window.fetch and XMLHttpRequest to intercept Holodex API responses
// and relay them to the extension via window.postMessage.

(() => {
  const TARGET_PATH = '/api/v2/live';
  const MSG_KEY     = '__holodexPlusExtensionData';

  // ── Intercept fetch ────────────────────────────────────────────────────────

  const _fetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const response = await _fetch(...args);

    const url = typeof args[0] === 'string'
      ? args[0]
      : (args[0] instanceof Request ? args[0].url : '');

    if (url.includes(TARGET_PATH)) {
      response.clone().json().then((data) => {
        window.postMessage({ [MSG_KEY]: true, data }, '*');
      }).catch(() => {});
    }

    return response;
  };

  // ── Intercept XMLHttpRequest (fallback) ───────────────────────────────────

  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__holodexUrl = String(url);
    return _open.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__holodexUrl?.includes(TARGET_PATH)) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          window.postMessage({ [MSG_KEY]: true, data }, '*');
        } catch (_) {}
      });
    }
    return _send.apply(this, args);
  };
})();
