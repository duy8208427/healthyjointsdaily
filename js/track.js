/* First-touch source for this visit: sessionStorage, with localStorage as a
   fallback, and ?src= copied onto in-site links. The bridge href already has
   tid=web, so a click with JavaScript off stays tagged. */
(function () {
  if (typeof document === 'undefined' || !window.HjdTid) return;
  var api = window.HjdTid;
  var K = 'hjd_utm';
  var KT = 'hjd_team';
  var params = new URLSearchParams(location.search || '');
  var query = {
    tid: params.get('tid'),
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    src: params.get('src'),
    s: params.get('s'),
    hjdteam: params.get('hjdteam')
  };

  function readJson(store, key) {
    try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJson(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function writeBoth(value) {
    try { writeJson(sessionStorage, K, value); } catch (e) {}
    try { writeJson(localStorage, K, value); } catch (e) {}
  }

  var sessionTouch = null;
  var localTouch = null;
  try { sessionTouch = readJson(sessionStorage, K); } catch (e) { sessionTouch = null; }
  try { localTouch = readJson(localStorage, K); } catch (e) { localTouch = null; }
  var selected = api.selectTouch(sessionTouch, localTouch, query);
  if (selected.write === 'both') writeBoth(selected.touch);
  else if (selected.write === 'session' && selected.touch) {
    try { writeJson(sessionStorage, K, selected.touch); } catch (e) {}
  }
  var stored = selected.touch;

  var explicit = api.alnum(query.tid);
  if (explicit === 'teamtest') {
    try { localStorage.setItem(KT, '1'); } catch (e) {}
  }
  if (query.hjdteam === 'off') {
    try { localStorage.removeItem(KT); } catch (e) {}
    if (stored && api.alnum(stored.tid) === 'teamtest') {
      delete stored.tid;
      writeBoth(stored);
    }
  }
  var teamMode = false;
  try { teamMode = localStorage.getItem(KT) === '1'; } catch (e) {}

  var tid = api.resolveOutboundTid(query, stored, teamMode);
  if (!/^[a-z0-9]{1,24}$/.test(tid)) tid = 'web';

  document.querySelectorAll('a[href*="hop.clickbank.net"]').forEach(function (a) {
    try {
      var hop = new URL(a.href, location.href);
      hop.searchParams.set('tid', tid);
      a.href = hop.toString();
    } catch (e) {}
  });

  var src = api.persistedSrc(stored);
  var legacy = api.legacyQueryTid(query, stored);
  if (src || legacy) {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var raw = a.getAttribute ? a.getAttribute('href') : a.href;
      var next = api.decorateInternalHref(raw, location.href, src, legacy);
      if (!next || next === raw) return;
      if (a.setAttribute) a.setAttribute('href', next);
      else a.href = next;
    });
  }

  var touch = stored || {};
  if (tid === 'teamtest') {
    [['UTM_SOURCE', 'team'], ['UTM_MEDIUM', 'test'], ['UTM_CONTENT', 'teamtest']].forEach(function (pair) {
      document.querySelectorAll('input[name=' + pair[0] + ']').forEach(function (input) {
        input.value = pair[1];
      });
    });
    return;
  }
  [['UTM_SOURCE', 'utm_source'], ['UTM_MEDIUM', 'utm_medium'], ['UTM_CONTENT', 'utm_content']].forEach(function (pair) {
    document.querySelectorAll('input[name=' + pair[0] + ']').forEach(function (input) {
      input.value = String(touch[pair[1]] || '').slice(0, 100);
    });
  });
})();
