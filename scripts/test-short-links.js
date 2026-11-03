var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var api = require('../js/tid.js');

var root = path.join(__dirname, '..');

/* Exact paths only. /s/tt######a and the other code rules stay separate. */
var SHORT = [
  ['tt', 'tiktok'],
  ['yt', 'youtube'],
  ['fb', 'facebook'],
  ['ig', 'instagram'],
  ['pin', 'pinterest'],
  ['rd', 'reddit'],
  ['qr', 'quora']
];

function loadRedirects() {
  var config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  return config.redirects;
}

function findRule(redirects, source) {
  return redirects.filter(function (rule) { return rule.source === source; });
}

test('seven short paths 308 to /?src=<network>, including the trailing slash', function () {
  var redirects = loadRedirects();
  assert.equal(redirects[redirects.length - 1].source, '/s/:rest*');
  assert.equal(redirects[redirects.length - 1].destination, '/');
  assert.equal(redirects[redirects.length - 1].permanent, false);

  SHORT.forEach(function (pair) {
    var slug = pair[0];
    var network = pair[1];
    ['/' + slug, '/' + slug + '/'].forEach(function (source) {
      var found = findRule(redirects, source);
      assert.equal(found.length, 1, source);
      assert.equal(found[0].destination, '/?src=' + network);
      assert.equal(found[0].permanent, true);
      assert.equal(JSON.stringify(found[0]).indexOf('*'), -1);
      var src = new URL('https://healthyjointsdaily.vercel.app' + found[0].destination).searchParams.get('src');
      assert.equal(api.deriveTid({ src: src }), network);
      assert.equal(api.resolveOutboundTid({ src: src }, null, false), network);
      assert.match(network, /^[a-z0-9]{1,24}$/);
    });
  });
});

test('short paths do not replace a page or an existing /s/ rule', function () {
  var redirects = loadRedirects();
  var sources = redirects.map(function (rule) { return rule.source; });

  SHORT.forEach(function (pair) {
    var slug = pair[0];
    assert.equal(fs.existsSync(path.join(root, slug)), false, slug);
    assert.equal(fs.existsSync(path.join(root, slug + '.html')), false, slug + '.html');
    assert.equal(fs.existsSync(path.join(root, slug, 'index.html')), false, slug + '/index.html');
    assert.equal(sources.filter(function (source) { return source === '/' + slug; }).length, 1);
  });

  [
    '/s/teamtest',
    '/s/teamoff',
    '/s/:code(pn261112a|pn261121a|pn261126b)',
    '/s/:code(pn261119b|pn261124a|pn261130a)',
    '/s/:code(yt[0-9]{6}[a-z])',
    '/s/:code(pn[0-9]{6}[a-z])',
    '/s/:code(ig[0-9]{6}[a-z])',
    '/s/:code(em[0-9]{6}[a-z])',
    '/s/:code(sr[0-9]{6}[a-z])',
    '/s/:code(si[0-9]{6}[a-z])',
    '/s/:code(tt[0-9]{6}[a-z])',
    '/s/:code(fb[0-9]{6}[a-z])',
    '/s/:code(rd[0-9]{6}[a-z])',
    '/s/:code(qr[0-9]{6}[a-z])',
    '/s/:code(qa[0-9]{6}[a-z])',
    '/s/:rest*'
  ].forEach(function (source) {
    assert.equal(findRule(redirects, source).length, 1, source);
  });

  assert.notEqual(findRule(redirects, '/tt')[0].destination, findRule(redirects, '/s/:code(tt[0-9]{6}[a-z])')[0].destination);
  assert.match(findRule(redirects, '/s/teamtest')[0].destination, /tid=teamtest/);
  redirects.forEach(function (rule) {
    assert.equal(JSON.stringify(rule.destination).indexOf('clickbank'), -1);
  });
});
