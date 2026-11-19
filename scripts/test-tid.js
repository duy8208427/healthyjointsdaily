var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var api = require('../js/tid.js');

var NETWORKS = ['pinterest', 'tiktok', 'youtube', 'facebook', 'instagram', 'reddit', 'quora', 'web'];
var CHANNELS = ['yt', 'pin', 'fb', 'email'];
var ALLOWED = NETWORKS.concat(CHANNELS, ['yts', 'bridge', 'teamtest']);

function assertTid(actual, expected) {
  assert.equal(actual, expected);
  assert.match(actual, /^[a-z0-9]{1,24}$/);
  assert.ok(ALLOWED.indexOf(actual) !== -1);
}

test('each network maps to its exact tid, not the post code', function () {
  assertTid(api.deriveTid({ utm_source: 'pinterest', utm_content: 'pn261112a' }), 'pinterest');
  assertTid(api.deriveTid({ utm_source: 'Pinterest', utm_content: 'pn261121a' }), 'pinterest');
  assertTid(api.deriveTid({ s: 'pn261126b' }), 'pinterest');
  assertTid(api.deriveTid({ src: 'pn' }), 'pinterest');

  assertTid(api.deriveTid({ utm_source: 'tiktok', utm_content: 'tt261102a' }), 'tiktok');
  assertTid(api.deriveTid({ s: 'tt261102a' }), 'tiktok');
  assertTid(api.deriveTid({ src: 'tt' }), 'tiktok');

  assertTid(api.deriveTid({ utm_source: 'youtube', utm_content: 'yt261102a' }), 'youtube');
  assertTid(api.deriveTid({ utm_source: 'YouTube' }), 'youtube');
  assertTid(api.deriveTid({ s: 'yt261102a' }), 'youtube');

  assertTid(api.deriveTid({ utm_source: 'facebook', utm_content: 'fb261102a' }), 'facebook');
  assertTid(api.deriveTid({ s: 'fb261102a' }), 'facebook');

  assertTid(api.deriveTid({ utm_source: 'instagram', utm_content: 'ig261102a' }), 'instagram');
  assertTid(api.deriveTid({ s: 'ig261102a' }), 'instagram');
  assertTid(api.deriveTid({ src: 'ig' }), 'instagram');

  assertTid(api.deriveTid({ utm_source: 'reddit', utm_content: 'rd261102a' }), 'reddit');
  assertTid(api.deriveTid({ s: 'rd261102a' }), 'reddit');
  assertTid(api.deriveTid({ src: 'rd' }), 'reddit');

  assertTid(api.deriveTid({ utm_source: 'quora', utm_content: 'qr261102a' }), 'quora');
  assertTid(api.deriveTid({ s: 'qr261102a' }), 'quora');
  assertTid(api.deriveTid({ s: 'qa261102a' }), 'quora');
  assertTid(api.deriveTid({ src: 'qa' }), 'quora');
  assertTid(api.deriveTid({ src: 'qr' }), 'quora');
});

test('direct, SEO, email, and unknown are web, and the post code is not the tid', function () {
  assertTid(api.deriveTid({}), 'web');
  assertTid(api.deriveTid({ utm_source: 'hjd_seo', utm_medium: 'organic', utm_content: 'sr261120a' }), 'web');
  assertTid(api.deriveTid({ utm_source: 'hjd_seo', utm_content: 'si261120a' }), 'web');
  assertTid(api.deriveTid({ utm_source: 'brevo', utm_medium: 'email', utm_content: 'em261102a' }), 'web');
  assertTid(api.deriveTid({ s: 'em261102a' }), 'web');
  assertTid(api.deriveTid({ s: 'sr261120a' }), 'web');
  assertTid(api.deriveTid({ s: 'si261120a' }), 'web');
  assertTid(api.deriveTid({ utm_source: 'team', utm_content: 'not-a-network' }), 'web');
  assertTid(api.deriveTid({ utm_content: 'this_is_a_very_long_utm_content_value_over_24' }), 'web');
  assertTid(api.deriveTid({ tid: 'this_is_a_very_long_utm_content_value_over_24' }), 'web');
  assert.notEqual(api.deriveTid({ utm_source: 'pinterest', utm_content: 'pn261112a' }), 'pn261112a');
  assert.equal(api.deriveTid({ tid: 'pn261112a' }), 'pinterest');
});

test('old tids yts and bridge pass through unchanged, ahead of the network', function () {
  assertTid(api.deriveTid({ tid: 'yts', utm_source: 'youtube', utm_content: 'yt261102a' }), 'yts');
  assertTid(api.deriveTid({ tid: 'YTS' }), 'yts');
  assertTid(api.deriveTid({ tid: 'bridge', utm_source: 'pinterest' }), 'bridge');
  assertTid(api.deriveTid({ tid: 'Bridge' }), 'bridge');
  assertTid(api.deriveTid({ tid: 'teamtest', utm_source: 'team' }), 'teamtest');
  assertTid(api.resolveOutboundTid({ tid: 'yts' }, { utm_source: 'tiktok', utm_content: 'tt261102a' }, true), 'yts');
  assertTid(api.resolveOutboundTid({ tid: 'bridge' }, { utm_source: 'youtube' }, true), 'bridge');
});

test('first-touch sticks for the session and hyphens do not leak into the tid', function () {
  var first = api.captureTouch(null, {
    utm_source: 'tik_tok',
    utm_medium: 'social',
    utm_content: 'tt261102a'
  });
  assert.equal(first.first, false);
  assert.equal(first.touch.utm_content, 'tt261102a');
  assertTid(api.resolveOutboundTid({}, first.touch, false), 'tiktok');

  var second = api.captureTouch(first.touch, { utm_source: 'pinterest', utm_content: 'pn261112a' });
  assert.equal(second.first, true);
  assert.equal(second.touch.utm_source, 'tik_tok');
  assertTid(api.resolveOutboundTid({}, second.touch, false), 'tiktok');

  assert.equal(api.captureTouch(null, {}).touch, null);
  assertTid(api.resolveOutboundTid({}, null, false), 'web');
  assertTid(api.deriveTid({ utm_source: 'face-book' }), 'facebook');
  assertTid(api.deriveTid({ src: 'you-tube', utm_content: 'a-long_value' }), 'youtube');
});

test('bare ?s= or ?src= codes fill utm_content without becoming the tid', function () {
  var touch = api.buildTouch({ s: 'rd261102a' });
  assert.equal(touch.utm_source, 'reddit');
  assert.equal(touch.utm_content, 'rd261102a');
  assertTid(api.deriveTid(touch), 'reddit');

  var pin = api.buildTouch({ src: 'pinterest' });
  assert.equal(pin.utm_source, 'pinterest');
  assertTid(api.deriveTid(pin), 'pinterest');
});

test('?src= is case-insensitive and unknown values are web', function () {
  ['pinterest', 'tiktok', 'youtube', 'facebook', 'instagram', 'reddit', 'quora', 'web'].forEach(function (network) {
    assertTid(api.deriveTid({ src: network.toUpperCase() }), network);
    assertTid(api.deriveTid({ src: network }), network);
  });
  assertTid(api.deriveTid({ src: 'YouTube' }), 'youtube');
  assertTid(api.deriveTid({ src: 'TikTok' }), 'tiktok');
  assertTid(api.deriveTid({ src: 'FaceBook' }), 'facebook');
  assertTid(api.deriveTid({ src: 'myspace' }), 'web');
  assertTid(api.deriveTid({ src: '' }), 'web');
  assertTid(api.deriveTid({ src: 'web', utm_content: 'pn261112a' }), 'web');
  assertTid(api.deriveTid({ utm_source: 'pinterest', src: 'web' }), 'pinterest');
  assertTid(api.resolveOutboundTid({ src: 'Quora' }, null, false), 'quora');
});

test('first-touch prefers this tab, then the URL, then localStorage', function () {
  var session = { utm_source: 'youtube', utm_content: 'yt261102a' };
  var kept = api.selectTouch(session, { utm_source: 'pinterest' }, { src: 'reddit' });
  assert.equal(kept.write, 'none');
  assertTid(api.resolveOutboundTid({}, kept.touch, false), 'youtube');

  var fromUrl = api.selectTouch(null, { utm_source: 'youtube' }, { src: 'TikTok' });
  assert.equal(fromUrl.write, 'both');
  assert.equal(fromUrl.touch.utm_source, 'tiktok');
  assertTid(api.deriveTid(fromUrl.touch), 'tiktok');

  var fromLocal = api.selectTouch(null, { utm_source: 'instagram', utm_content: 'ig261102a' }, {});
  assert.equal(fromLocal.write, 'session');
  assertTid(api.resolveOutboundTid({}, fromLocal.touch, false), 'instagram');
});

test('in-site links copy src, and yts or bridge is kept on those links', function () {
  var page = 'https://healthyjointsdaily.vercel.app/joint-genesis-review';
  assert.equal(
    api.decorateInternalHref('/about', page, 'pinterest', ''),
    '/about?src=pinterest'
  );
  assert.equal(
    api.decorateInternalHref('/#contact', page, 'youtube', ''),
    '/?src=youtube#contact'
  );
  assert.equal(
    api.decorateInternalHref('/free/7-morning-moves.pdf', page, 'tiktok', ''),
    '/free/7-morning-moves.pdf'
  );
  assert.equal(
    api.decorateInternalHref('https://www.fda.gov/consumers/consumer-updates/mixing-medications-and-dietary-supplements-can-endanger-your-health', page, 'web', ''),
    'https://www.fda.gov/consumers/consumer-updates/mixing-medications-and-dietary-supplements-can-endanger-your-health'
  );
  assert.equal(
    api.decorateInternalHref('/about', page, 'youtube', 'yts'),
    '/about?src=youtube&tid=yts'
  );
  assert.equal(api.persistedSrc({ src: 'Reddit' }), 'reddit');
  assert.equal(api.persistedSrc({ utm_source: 'hjd_seo', utm_content: 'sr261120a' }), 'web');
  assert.equal(api.persistedSrc(null), '');
  assert.equal(api.legacyQueryTid({ tid: 'yts' }, { utm_source: 'youtube' }), 'yts');
  assert.equal(api.legacyQueryTid({}, { tid: 'bridge', utm_source: 'pinterest' }), 'bridge');
});

test('bridge ?src= is an exact yt pin fb email whitelist', function () {
  CHANNELS.forEach(function (src) {
    assert.equal(api.channelFromSrc(src), src);
    assert.equal(api.channelFromSrc(src.toUpperCase()), src);
    assert.equal(api.channelFromSrc('  ' + src + '  '), src);
    assertTid(api.deriveTid({ src: src }), src);
    assertTid(api.resolveOutboundTid({ src: src }, null, false), src);
    assert.equal(api.hopUrl(src), api.HOP_BASE + '?tid=' + src);
    var touch = api.buildTouch({ src: src });
    assertTid(api.deriveTid(touch), src);
    assert.equal(api.persistedSrc(touch), src);
  });

  assert.equal(api.channelFromSrc('youtube'), '');
  assertTid(api.deriveTid({ src: 'youtube' }), 'youtube');
  assertTid(api.deriveTid({ src: 'pinterest' }), 'pinterest');
  assertTid(api.deriveTid({ src: 'facebook' }), 'facebook');
  assertTid(api.deriveTid({ src: 'yt', utm_source: 'pinterest' }), 'yt');
  assertTid(api.deriveTid({}), 'web');
  assertTid(api.deriveTid({ src: '' }), 'web');
  assertTid(api.deriveTid({ src: 'yt extra' }), 'web');
  assertTid(api.deriveTid({ src: 'emailer' }), 'web');
  assertTid(api.deriveTid({ src: 'fb;drop table' }), 'web');
  assertTid(api.deriveTid({ src: 'yt<script>alert(1)</script>' }), 'web');
  assertTid(api.deriveTid({ src: 'pin\nfb' }), 'web');
  assertTid(api.deriveTid({ src: 'yt', tid: '"><img src=x>' }), 'yt');
  assert.equal(api.resolveOutboundTid({ src: 'email', tid: 'pwned' }, null, false), 'email');
  assert.equal(api.resolveOutboundTid({ src: 'yt', tid: 'yts' }, null, false), 'yts');
  assert.equal(api.resolveOutboundTid({ src: 'pin', tid: 'teamtest' }, null, false), 'teamtest');
  assert.equal(api.hopUrl('not-a-tid'), api.hopUrl('web'));
  assert.equal(api.hopUrl('yt<script>'), api.hopUrl('web'));
  assert.equal(api.persistedSrc({ src: 'yt<script>' }), 'web');

  var preserved = api.HOP_BASE + '?cbpage=tsl&tid=web&hop=duyspace';
  var next = new URL(api.withTid(preserved, 'pin'));
  assert.equal(next.searchParams.get('tid'), 'pin');
  assert.equal(next.searchParams.get('cbpage'), 'tsl');
  assert.equal(next.searchParams.get('hop'), 'duyspace');
  assert.equal(next.hostname, '72c658wr0hc2uu35weylo2xt65.hop.clickbank.net');
  var blocked = new URL(api.withTid(preserved, 'pin&tid=admin'));
  assert.equal(blocked.searchParams.get('tid'), 'web');
  assert.equal(blocked.searchParams.get('hop'), 'duyspace');
  assert.equal(blocked.searchParams.get('cbpage'), 'tsl');

  var page = 'https://healthyjointsdaily.vercel.app/joint-genesis-review';
  assert.equal(api.decorateInternalHref('/', page, 'yt', ''), '/?src=yt');
  assert.equal(api.decorateInternalHref('/#joint-genesis', page, 'pin', ''), '/?src=pin#joint-genesis');
  assert.equal(api.decorateInternalHref('/#signup', page, 'fb', ''), '/?src=fb#signup');
  assert.equal(api.decorateInternalHref('/#contact', page, 'email', ''), '/?src=email#contact');
  assert.equal(api.decorateInternalHref('/free/7-morning-moves.pdf', page, 'email', ''), '/free/7-morning-moves.pdf');
});

test('the bridge PDF form sits above the first Joint Genesis button', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var formAt = html.indexOf('id="signup"');
  var ctaAt = html.indexOf('>See Joint Genesis on the official site');
  var disclosure = '<strong>Disclosure:</strong> I earn a commission if you buy. The next page is the company\'s own video presentation, not a short quiz. These statements have not been evaluated by the Food and Drug Administration.';
  var disclosureAt = html.indexOf(disclosure);
  assert.ok(formAt > 0 && ctaAt > formAt);
  assert.ok(disclosureAt > ctaAt && disclosureAt - ctaAt < 500);
  assert.equal((html.match(/id="signup"/g) || []).length, 1);
  assert.equal((html.match(/class="optin-form"/g) || []).length, 2);
  var actions = html.match(/<form class="optin-form" action="([^"]+)"/g);
  assert.equal(actions.length, 2);
  assert.equal(actions[0], actions[1]);
  assert.match(actions[0], /sibforms\.com/);
});

test('HopLink base is the encrypted id and the tid query is clean', function () {
  assert.equal(api.HOP_BASE, 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/');
  assert.equal(api.hopUrl('web'), 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/?tid=web');
  assert.equal(api.hopUrl('pinterest'), 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/?tid=pinterest');
  assert.equal(api.hopUrl('!!!'), 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/?tid=web');
  var url = new URL(api.hopUrl('youtube'));
  assert.equal(url.hostname, '72c658wr0hc2uu35weylo2xt65.hop.clickbank.net');
  assert.notEqual(url.hostname, 'hop.clickbank.net');
  assert.equal(url.search, '?tid=youtube');
  assert.equal(url.searchParams.get('affiliate'), null);
  assert.equal(url.searchParams.get('vendor'), null);
});

test('vercel /s/ rules keep the old patterns and add tt, fb, rd, qr, and qa', function () {
  var config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  var redirects = config.redirects;
  assert.equal(redirects[redirects.length - 1].source, '/s/:rest*');
  assert.equal(redirects[redirects.length - 1].destination, '/');

  function dest(source) {
    var found = redirects.filter(function (rule) { return rule.source === source; });
    assert.equal(found.length, 1, source);
    return found[0].destination;
  }

  assert.equal(dest('/s/teamtest'), '/?tid=teamtest&utm_source=team&utm_medium=test&utm_campaign=hjd_test&utm_content=teamtest');
  assert.equal(dest('/s/teamoff'), '/?hjdteam=off');
  assert.match(dest('/s/:code(pn261112a|pn261121a|pn261126b)'), /^\/grocery\?/);
  assert.match(dest('/s/:code(pn261119b|pn261124a|pn261130a)'), /^\/joint-genesis-review\?/);
  assert.match(dest('/s/:code(yt[0-9]{6}[a-z])'), /utm_source=youtube/);
  assert.match(dest('/s/:code(pn[0-9]{6}[a-z])'), /utm_source=pinterest/);
  assert.match(dest('/s/:code(ig[0-9]{6}[a-z])'), /utm_source=instagram/);
  assert.match(dest('/s/:code(em[0-9]{6}[a-z])'), /utm_source=brevo/);
  assert.match(dest('/s/:code(sr[0-9]{6}[a-z])'), /utm_campaign=seo_jg_review/);
  assert.match(dest('/s/:code(si[0-9]{6}[a-z])'), /utm_campaign=seo_jg_ingredients/);

  assert.equal(
    dest('/s/:code(tt[0-9]{6}[a-z])'),
    '/?utm_source=tiktok&utm_medium=social&utm_campaign=hjd_tiktok&utm_content=:code'
  );
  assert.equal(
    dest('/s/:code(fb[0-9]{6}[a-z])'),
    '/?utm_source=facebook&utm_medium=social&utm_campaign=hjd_facebook&utm_content=:code'
  );
  assert.equal(
    dest('/s/:code(rd[0-9]{6}[a-z])'),
    '/?utm_source=reddit&utm_medium=social&utm_campaign=hjd_reddit&utm_content=:code'
  );
  assert.equal(
    dest('/s/:code(qr[0-9]{6}[a-z])'),
    '/?utm_source=quora&utm_medium=social&utm_campaign=hjd_quora&utm_content=:code'
  );
  assert.equal(
    dest('/s/:code(qa[0-9]{6}[a-z])'),
    '/?utm_source=quora&utm_medium=social&utm_campaign=hjd_quora&utm_content=:code'
  );

  redirects.forEach(function (rule) {
    assert.equal(JSON.stringify(rule.destination).indexOf('clickbank'), -1);
  });
});
