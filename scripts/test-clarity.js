var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var api = require('../js/clarity.js');

var root = path.join(__dirname, '..');
var PAGES = [
  'index.html',
  'about.html',
  'disclosure.html',
  'privacy.html',
  'grocery/index.html',
  'joint-genesis-review/index.html',
  'joint-genesis-ingredients/index.html'
];

function store(initial) {
  var data = Object.assign({}, initial || {});
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); },
    data: data
  };
}

function loc(hostname, search) {
  return { hostname: hostname, search: search || '' };
}

test('Clarity loads only on the production host, unless this tab opted in', function () {
  assert.equal(api.PROJECT, 'zg3rp3z5pq');
  assert.equal(api.TAG, 'https://www.clarity.ms/tag/zg3rp3z5pq');

  assert.equal(api.shouldLoad(loc('healthyjointsdaily.vercel.app'), store()), true);
  assert.equal(api.shouldLoad(loc('HealthyJointsDaily.vercel.app', '?src=yt'), store()), true);

  assert.equal(api.shouldLoad(loc('localhost'), store()), false);
  assert.equal(api.shouldLoad(loc('127.0.0.1'), store()), false);
  assert.equal(api.shouldLoad(loc('healthyjointsdaily-git-cursor-clarity-heatmap.vercel.app'), store()), false);
  assert.equal(api.shouldLoad(loc('preview.healthyjointsdaily.vercel.app'), store()), false);
  assert.equal(api.shouldLoad(loc('nothealthyjointsdaily.vercel.app'), store()), false);

  var fresh = store();
  assert.equal(api.shouldLoad(loc('localhost', '?clarity=test'), fresh), true);
  assert.equal(fresh.data[api.KEY], '1');
  assert.equal(api.shouldLoad(loc('localhost', ''), fresh), true);
  assert.equal(api.shouldLoad(loc('healthyjointsdaily-git-foo.vercel.app', '?src=yt'), fresh), true);

  var otherTab = store();
  assert.equal(api.shouldLoad(loc('localhost', '?src=yt'), otherTab), false);
  assert.equal(otherTab.data[api.KEY], undefined);

  ['', '1', 'true', 'TEST', 'test ', ' test', 'test2', 'zg3rp3z5pq', 'https://evil.example/tag'].forEach(function (value) {
    var memory = store();
    assert.equal(api.shouldLoad(loc('localhost', '?clarity=' + encodeURIComponent(value)), memory), false, value);
    assert.equal(memory.data[api.KEY], undefined);
  });

  var poisoned = store();
  poisoned.setItem(api.KEY, 'https://evil.example/tag');
  assert.equal(api.shouldLoad(loc('localhost'), poisoned), false);

  var broken = {
    getItem: function () { throw new Error('blocked'); },
    setItem: function () { throw new Error('blocked'); }
  };
  assert.equal(api.shouldLoad(loc('healthyjointsdaily.vercel.app', '?clarity=test'), broken), true);
  assert.equal(api.shouldLoad(loc('localhost', '?clarity=test'), broken), true);
  assert.equal(api.shouldLoad(loc('localhost'), broken), false);
});

test('the tag URL is the fixed project id and ignores the query string', function () {
  var inserted = [];
  var doc = {
    createElement: function () { return { async: 0, src: '' }; },
    getElementsByTagName: function () {
      return [{ parentNode: { insertBefore: function (node) { inserted.push(node); } } }];
    }
  };
  var win = {};
  api.install(win, doc);
  api.install(win, doc);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].src, 'https://www.clarity.ms/tag/zg3rp3z5pq');
  assert.equal(inserted[0].async, 1);
  assert.equal(typeof win.clarity, 'function');
  assert.equal(inserted[0].src.indexOf('clarity=test'), -1);
  assert.equal(inserted[0].src.indexOf('vercel.app'), -1);
});

test('every page includes the shared script, and every email form is masked', function () {
  PAGES.forEach(function (rel) {
    var html = fs.readFileSync(path.join(root, rel), 'utf8');
    var tags = html.match(/<script src="\/js\/clarity\.js"><\/script>/g) || [];
    assert.equal(tags.length, 1, rel);
    assert.ok(html.indexOf('<script src="/js/track.js"></script>\n<script src="/js/clarity.js"></script>') !== -1, rel);
    var forms = html.match(/<form class="optin-form"/g) || [];
    var masked = html.match(/<form class="optin-form"[^>]*data-clarity-mask="true"/g) || [];
    assert.equal(masked.length, forms.length, rel);
    assert.equal(html.indexOf('www.clarity.ms/tag/'), -1, rel);
  });

  var bridge = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal((bridge.match(/data-clarity-mask="true"/g) || []).length, 2);
  var grocery = fs.readFileSync(path.join(root, 'grocery/index.html'), 'utf8');
  var review = fs.readFileSync(path.join(root, 'joint-genesis-review/index.html'), 'utf8');
  var ingredients = fs.readFileSync(path.join(root, 'joint-genesis-ingredients/index.html'), 'utf8');
  [grocery, review, ingredients].forEach(function (html) {
    assert.equal((html.match(/data-clarity-mask="true"/g) || []).length, 1);
  });
});

test('the privacy page names Clarity, masks, cookies, and the Microsoft statement', function () {
  var html = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
  assert.match(html, /Last updated: November 19, 2026/);
  assert.match(html, /Microsoft Clarity/);
  assert.match(html, /heatmaps and session replays/);
  assert.match(html, /Form inputs are masked/);
  assert.match(html, /cookies and similar technologies/);
  assert.match(html, /https:\/\/www\.microsoft\.com\/privacy\/privacystatement/);
  assert.equal(html.indexOf('does not set its own cookies'), -1);
});
