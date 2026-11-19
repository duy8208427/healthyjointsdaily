/* Microsoft Clarity, project zg3rp3z5pq.
   The tag loads on the production hostname only.
   A preview tab can opt in with ?clarity=test, remembered for this tab.
   The project id is a constant. The query string is never copied into the tag URL.
   This file does not read or write the hjd_utm first-touch record. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HjdClarity = api;
  if (!root || !root.document || !root.location) return;
  var store = null;
  try { store = root.sessionStorage; } catch (e) { store = null; }
  if (api.shouldLoad(root.location, store)) api.install(root, root.document);
})(typeof window !== 'undefined' ? window : null, function () {
  var PROJECT = 'zg3rp3z5pq';
  var TAG = 'https://www.clarity.ms/tag/' + PROJECT;
  var KEY = 'hjd_clarity_test';
  var PRODUCTION = { 'healthyjointsdaily.vercel.app': 1 };

  function isProduction(hostname) {
    return Object.prototype.hasOwnProperty.call(PRODUCTION, String(hostname || '').toLowerCase());
  }

  function clarityParam(search) {
    try {
      return new URLSearchParams(String(search || '')).get('clarity') === 'test';
    } catch (e) {
      return false;
    }
  }

  function remember(store) {
    try { if (store) store.setItem(KEY, '1'); } catch (e) {}
  }

  function remembered(store) {
    try { return !!(store && store.getItem(KEY) === '1'); } catch (e) { return false; }
  }

  function shouldLoad(location, store) {
    location = location || {};
    var test = clarityParam(location.search);
    if (test) remember(store);
    if (isProduction(location.hostname)) return true;
    return test || remembered(store);
  }

  /* The standard Clarity snippet. i is the constant project id. */
  function install(win, doc) {
    if (!win || !doc || win.__hjdClarity) return;
    win.__hjdClarity = 1;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      if (y && y.parentNode) y.parentNode.insertBefore(t, y);
      else (l.head || l.documentElement).appendChild(t);
    })(win, doc, 'clarity', 'script', PROJECT);
  }

  return {
    PROJECT: PROJECT,
    TAG: TAG,
    KEY: KEY,
    shouldLoad: shouldLoad,
    install: install
  };
});
