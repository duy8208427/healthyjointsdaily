var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var tidCode = fs.readFileSync(path.join(root, 'js/tid.js'), 'utf8');
var trackCode = fs.readFileSync(path.join(root, 'js/track.js'), 'utf8');
var HOP = 'https://72c658wr0hc2uu35weylo2xt65.hop.clickbank.net/?tid=web';

function memoryStore() {
  var data = new Map();
  return {
    getItem: function (key) { return data.has(key) ? data.get(key) : null; },
    setItem: function (key, value) { data.set(key, String(value)); },
    removeItem: function (key) { data.delete(key); }
  };
}

function runPage(options) {
  var links = (options.hrefs || [HOP]).map(function (href) {
    return { href: href };
  });
  var anchors = options.anchors || [];
  var inputs = [
    { name: 'UTM_SOURCE', value: '' },
    { name: 'UTM_MEDIUM', value: '' },
    { name: 'UTM_CONTENT', value: '' }
  ];
  var search = options.search || '';
  var context = {
    URL: URL,
    URLSearchParams: URLSearchParams,
    sessionStorage: options.session,
    localStorage: options.local,
    location: {
      href: 'https://healthyjointsdaily.vercel.app/' + search,
      search: search,
      origin: 'https://healthyjointsdaily.vercel.app'
    },
    document: {
      querySelectorAll: function (selector) {
        if (selector.indexOf('hop.clickbank.net') !== -1) return links;
        if (selector === 'a[href]') return anchors;
        var name = String(selector).split('name=')[1];
        if (!name) return [];
        name = name.replace(']', '');
        return inputs.filter(function (input) { return input.name === name; });
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(tidCode + '\n' + trackCode, context);
  return { links: links, inputs: inputs, anchors: anchors };
}

function tidOf(link) {
  return new URL(link.href).searchParams.get('tid');
}

test('the bridge script rewrites tid from the entry source and keeps the new hop host', function () {
  var session = memoryStore();
  var local = memoryStore();
  var first = runPage({
    search: '?utm_source=pinterest&utm_medium=pin&utm_campaign=hjd_pinterest&utm_content=pn261112a',
    session: session,
    local: local
  });
  assert.equal(tidOf(first.links[0]), 'pinterest');
  assert.equal(new URL(first.links[0].href).hostname, '72c658wr0hc2uu35weylo2xt65.hop.clickbank.net');
  assert.equal(first.inputs[0].value, 'pinterest');
  assert.equal(first.inputs[2].value, 'pn261112a');
  assert.match(first.links[0].href, /^[^\s]+$/);
  assert.equal(first.links[0].href.indexOf('?&'), -1);

  var home = runPage({ search: '', session: session, local: local });
  assert.equal(tidOf(home.links[0]), 'pinterest');
  assert.equal(home.inputs[2].value, 'pn261112a');
});

test('no stored source leaves the static web tid, including when JavaScript finds the link', function () {
  var page = runPage({ search: '', session: memoryStore(), local: memoryStore() });
  assert.equal(tidOf(page.links[0]), 'web');
  assert.equal(page.inputs[0].value, '');
});

test('yts and bridge on the landing URL are not rewritten', function () {
  var yts = runPage({
    search: '?tid=yts&utm_source=youtube',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(yts.links[0]), 'yts');

  var bridge = runPage({
    search: '?tid=bridge&utm_source=pinterest&utm_content=pn261112a',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(bridge.links[0]), 'bridge');
});

test('a later page in the same tab keeps yts from the first touch', function () {
  var session = memoryStore();
  var local = memoryStore();
  runPage({ search: '?tid=yts', session: session, local: local });
  var next = runPage({ search: '', session: session, local: local });
  assert.equal(tidOf(next.links[0]), 'yts');
});

test('SEO, email, and a too-long content value stay on web', function () {
  var seo = runPage({
    search: '?utm_source=hjd_seo&utm_medium=organic&utm_campaign=seo_jg_review&utm_content=sr261120a',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(seo.links[0]), 'web');
  assert.equal(seo.inputs[2].value, 'sr261120a');

  var email = runPage({
    search: '?utm_source=brevo&utm_medium=email&utm_content=em261102a',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(email.links[0]), 'web');

  var longTid = runPage({
    search: '?utm_content=this_is_a_very_long_utm_content_value_over_24',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(longTid.links[0]), 'web');
});

test('?s= and ?src= select the network and keep the code in the content field', function () {
  var tiktok = runPage({
    search: '?s=tt261102a',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(tiktok.links[0]), 'tiktok');
  assert.equal(tiktok.inputs[0].value, 'tiktok');
  assert.equal(tiktok.inputs[2].value, 'tt261102a');

  var quora = runPage({
    search: '?src=quora',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(quora.links[0]), 'quora');
});

test('?src= on any page is case-insensitive, sticks, and is copied onto in-site links', function () {
  var session = memoryStore();
  var local = memoryStore();
  var review = runPage({
    search: '?src=YouTube',
    session: session,
    local: local,
    anchors: [
      { href: '/about' },
      { href: '/grocery' },
      { href: '/free/7-morning-moves.pdf' },
      { href: 'https://www.nccih.nih.gov/health/ginger' }
    ]
  });
  assert.equal(tidOf(review.links[0]), 'youtube');
  assert.equal(review.anchors[0].href, '/about?src=youtube');
  assert.equal(review.anchors[1].href, '/grocery?src=youtube');
  assert.equal(review.anchors[2].href, '/free/7-morning-moves.pdf');
  assert.equal(review.anchors[3].href, 'https://www.nccih.nih.gov/health/ginger');

  var home = runPage({
    search: '',
    session: session,
    local: local,
    anchors: [{ href: '/privacy' }]
  });
  assert.equal(tidOf(home.links[0]), 'youtube');
  assert.equal(home.anchors[0].href, '/privacy?src=youtube');

  var freshSession = memoryStore();
  var restored = runPage({
    search: '',
    session: freshSession,
    local: local,
    anchors: [{ href: '/' }]
  });
  assert.equal(tidOf(restored.links[0]), 'youtube');
  assert.equal(restored.anchors[0].href, '/?src=youtube');

  var unknown = runPage({
    search: '?src=MySpace',
    session: memoryStore(),
    local: memoryStore()
  });
  assert.equal(tidOf(unknown.links[0]), 'web');
});

test('a new ?src= does not replace the first touch already stored this tab', function () {
  var session = memoryStore();
  var local = memoryStore();
  runPage({ search: '?src=pinterest', session: session, local: local });
  var next = runPage({ search: '?src=tiktok', session: session, local: local });
  assert.equal(tidOf(next.links[0]), 'pinterest');
});

test('legacy yts is copied onto the next in-site link and still wins', function () {
  var session = memoryStore();
  var local = memoryStore();
  var first = runPage({
    search: '?tid=yts&utm_source=youtube',
    session: session,
    local: local,
    anchors: [{ href: '/about' }]
  });
  assert.equal(tidOf(first.links[0]), 'yts');
  assert.equal(first.anchors[0].href, '/about?src=youtube&tid=yts');
  var next = runPage({ search: '', session: session, local: local });
  assert.equal(tidOf(next.links[0]), 'yts');
});

test('teamtest still overrides, and teamoff returns to the session source', function () {
  var session = memoryStore();
  var local = memoryStore();
  runPage({
    search: '?utm_source=instagram&utm_content=ig261102a',
    session: session,
    local: local
  });
  var team = runPage({
    search: '?tid=teamtest&utm_source=team&utm_medium=test&utm_campaign=hjd_test&utm_content=teamtest',
    session: session,
    local: local
  });
  assert.equal(tidOf(team.links[0]), 'teamtest');
  assert.equal(team.inputs[0].value, 'team');
  var off = runPage({ search: '?hjdteam=off', session: session, local: local });
  assert.equal(tidOf(off.links[0]), 'instagram');
  assert.equal(local.getItem('hjd_team'), null);
});
