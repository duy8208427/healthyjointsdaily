/* ClickBank tid for the bridge-page HopLink.
   One tid per network (never the post code). Post codes stay in utm_content.
   Allowed outbound tids: pinterest, tiktok, youtube, facebook, instagram,
   reddit, quora, web, plus the exact bridge channel codes yt, pin, fb, email.
   Old links keep yts and bridge. teamtest stays for /s/teamtest.
   Exact ?src= tokens (trim + case only, never a prefix or a raw passthrough):
     yt -> tid=yt, pin -> tid=pin, fb -> tid=fb, email -> tid=email.
   A missing or unrecognized src does not invent a tid. Unknown sources stay web.
   /s/ codes (vercel.json), in addition to the existing yt/pn/ig/em/sr/si rules:
     tt[0-9]{6}[a-z]  tiktok
     fb[0-9]{6}[a-z]  facebook
     rd[0-9]{6}[a-z]  reddit
     qr[0-9]{6}[a-z]  quora
     qa[0-9]{6}[a-z]  quora (alias; qr is the primary code)
   SEO (sr/si), email post codes (em), direct, and unknown map to web.
   ?src=email is the channel tid above. An em post code is not that tid.
   HopLink base (encrypted id, not the old affiliate=duyspace query form):
     https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/?tid=<tid>
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HjdTid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var HOP_BASE = 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/';
  var PRESERVE = { yts: 1, bridge: 1, teamtest: 1 };
  var TOKEN = {
    pinterest: 'pinterest', pn: 'pinterest',
    tiktok: 'tiktok', tt: 'tiktok',
    youtube: 'youtube', yt: 'youtube',
    facebook: 'facebook', fb: 'facebook',
    instagram: 'instagram', ig: 'instagram',
    reddit: 'reddit', rd: 'reddit',
    quora: 'quora', qr: 'quora', qa: 'quora',
    web: 'web'
  };
  var CODE = /^(pn|tt|yt|fb|ig|rd|qr|qa|em|sr|si)[0-9]{6}[a-z]$/;
  var SHORT = /^(pn|tt|yt|fb|ig|rd|qr|qa)$/;
  /* Exact bridge ?src= values. Not derived from alnum(), so extra characters cannot match. */
  var CHANNEL_SRC = { yt: 'yt', pin: 'pin', fb: 'fb', email: 'email' };
  var NETWORKS = {
    pinterest: 1, tiktok: 1, youtube: 1, facebook: 1,
    instagram: 1, reddit: 1, quora: 1, web: 1,
    yt: 1, pin: 1, fb: 1, email: 1,
    yts: 1, bridge: 1, teamtest: 1
  };

  function channelFromSrc(value) {
    if (typeof value !== 'string') return '';
    var key = value.trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(CHANNEL_SRC, key)) return '';
    return CHANNEL_SRC[key];
  }

  function alnum(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function networkFromToken(token) {
    return TOKEN[token] || '';
  }

  /* Full names and xx######a codes. sr/si/em are tracked, but their tid is web. */
  function networkFromCode(code) {
    if (!code) return '';
    if (SHORT.test(code)) return TOKEN[code] || '';
    var matched = CODE.exec(code);
    if (!matched) return '';
    var prefix = matched[1];
    if (prefix === 'em' || prefix === 'sr' || prefix === 'si') return '';
    return TOKEN[prefix] || '';
  }

  function deriveTid(input) {
    input = input || {};
    var explicit = alnum(input.tid);
    if (PRESERVE[explicit]) return explicit;

    var channel = channelFromSrc(input.src);
    if (channel) return channel;

    var source = alnum(input.utm_source || '');
    var fromSource = networkFromToken(source) || networkFromCode(source);
    if (fromSource) return fromSource;

    var src = alnum(input.src || '');
    var fromSrc = networkFromToken(src) || networkFromCode(src);
    if (fromSrc) return fromSrc;

    var code = alnum(input.s || input.code || input.utm_content || '');
    var fromCode = networkFromCode(code);
    if (fromCode) return fromCode;

    var fromTid = networkFromToken(explicit) || networkFromCode(explicit);
    if (fromTid) return fromTid;

    return 'web';
  }

  function pick(value, max) {
    if (value == null) return '';
    var text = String(value).trim();
    if (!text) return '';
    return text.slice(0, max || 100);
  }

  /* First-touch record. Does not put the post code into the tid. */
  function buildTouch(query) {
    query = query || {};
    var touch = {};
    function put(key, value) {
      var text = pick(value, 100);
      if (text) touch[key] = text;
    }
    put('utm_source', query.utm_source);
    put('utm_medium', query.utm_medium);
    put('utm_campaign', query.utm_campaign);
    put('utm_content', query.utm_content);
    put('src', query.src);
    put('s', query.s);
    put('tid', query.tid);

    if (!touch.utm_source) {
      var srcNet = networkFromToken(alnum(touch.src)) || networkFromCode(alnum(touch.src));
      var sNet = networkFromCode(alnum(touch.s));
      var contentNet = networkFromCode(alnum(touch.utm_content));
      if (srcNet) touch.utm_source = srcNet;
      else if (sNet) touch.utm_source = sNet;
      else if (contentNet) touch.utm_source = contentNet;
    }
    if (!touch.utm_content) {
      var code = alnum(touch.s || touch.src || '');
      if (CODE.test(code)) touch.utm_content = code;
    }
    if (!Object.keys(touch).length) return null;
    return touch;
  }

  function captureTouch(existing, query) {
    if (existing && typeof existing === 'object' && Object.keys(existing).length) {
      return { touch: existing, first: true };
    }
    return { touch: buildTouch(query), first: false };
  }

  function resolveOutboundTid(query, stored, teamMode) {
    query = query || {};
    var current = alnum(query.tid);
    if (current === 'yts' || current === 'bridge') return current;
    var saved = alnum(stored && stored.tid);
    if (saved === 'yts' || saved === 'bridge') return saved;
    if (teamMode || current === 'teamtest' || saved === 'teamtest') return 'teamtest';
    var signals = stored && typeof stored === 'object' && Object.keys(stored).length ? stored : query;
    var tid = deriveTid(signals);
    if (!allowedTid(tid)) return 'web';
    return tid;
  }

  function allowedTid(tid) {
    return typeof tid === 'string' && NETWORKS[tid] === 1 && /^[a-z0-9]{1,24}$/.test(tid);
  }

  function hopUrl(tid) {
    if (!allowedTid(tid)) tid = 'web';
    return HOP_BASE + '?tid=' + tid;
  }

  /* Rewrite tid on an existing HopLink and keep every other query param. */
  function withTid(href, tid, base) {
    if (!allowedTid(tid)) tid = 'web';
    var url = base ? new URL(href, base) : new URL(href);
    if (url.hostname.indexOf('hop.clickbank.net') === -1) return String(href);
    url.searchParams.set('tid', tid);
    return url.toString();
  }

  function isTouch(value) {
    return !!(value && typeof value === 'object' && Object.keys(value).length);
  }

  /* Session first-touch wins. A new visit URL beats stale localStorage.
     localStorage is only the fallback when this tab has no session and no source params. */
  function selectTouch(sessionTouch, localTouch, query) {
    if (isTouch(sessionTouch)) return { touch: sessionTouch, write: 'none' };
    var fromUrl = buildTouch(query);
    if (fromUrl) return { touch: fromUrl, write: 'both' };
    if (isTouch(localTouch)) return { touch: localTouch, write: 'session' };
    return { touch: null, write: 'none' };
  }

  function hasSourceSignal(touch) {
    if (!touch) return false;
    return !!(pick(touch.utm_source) || pick(touch.src) || pick(touch.s) || pick(touch.code) || pick(touch.utm_content));
  }

  /* Network name to copy onto in-site links. Empty when there was no real signal. */
  function persistedSrc(touch) {
    if (!hasSourceSignal(touch)) return '';
    var rest = {};
    Object.keys(touch).forEach(function (key) {
      if (key !== 'tid') rest[key] = touch[key];
    });
    var net = deriveTid(rest);
    if (net === 'yts' || net === 'bridge' || net === 'teamtest') return '';
    return net || '';
  }

  function legacyQueryTid(query, touch) {
    var current = alnum(query && query.tid);
    if (current === 'yts' || current === 'bridge') return current;
    var saved = alnum(touch && touch.tid);
    if (saved === 'yts' || saved === 'bridge') return saved;
    return '';
  }

  var ASSET = /\.(pdf|jpe?g|png|gif|webp|svg|mp4|css|js|xml|txt|ico|woff2?|map)$/i;

  function decorateInternalHref(href, pageUrl, src, legacyTid) {
    if (!href || (!src && !legacyTid)) return href;
    var trimmed = String(href).trim();
    if (!trimmed || /^(mailto:|tel:|javascript:)/i.test(trimmed)) return href;
    var page;
    try { page = new URL(pageUrl); } catch (e) { return href; }
    var url;
    try { url = new URL(trimmed, page); } catch (e) { return href; }
    if (url.origin !== page.origin) return href;
    if (url.hostname.indexOf('clickbank.net') !== -1) return href;
    if (ASSET.test(url.pathname)) return href;
    if (src) url.searchParams.set('src', src);
    if (legacyTid === 'yts' || legacyTid === 'bridge') url.searchParams.set('tid', legacyTid);
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return url.toString();
    return url.pathname + url.search + url.hash;
  }

  return {
    HOP_BASE: HOP_BASE,
    alnum: alnum,
    deriveTid: deriveTid,
    buildTouch: buildTouch,
    captureTouch: captureTouch,
    selectTouch: selectTouch,
    persistedSrc: persistedSrc,
    legacyQueryTid: legacyQueryTid,
    decorateInternalHref: decorateInternalHref,
    resolveOutboundTid: resolveOutboundTid,
    hopUrl: hopUrl,
    withTid: withTid,
    channelFromSrc: channelFromSrc,
    networkFromCode: networkFromCode
  };
});
