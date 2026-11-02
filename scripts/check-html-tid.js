/* Scan built HTML. Every ClickBank hop link must carry a valid tid.
   Hop links are allowed only on the bridge page (dist/index.html). */
var fs = require('fs');
var path = require('path');

var dist = path.join(__dirname, '..', 'dist');
var HOP_HOST = '72c658wr0hc2uu35weylo2xt65.hop.clickbank.net';
var failures = [];

function walk(dir, found) {
  if (!fs.existsSync(dir)) return found;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  });
  return found;
}

if (!fs.existsSync(dist)) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

var files = walk(dist, []);
if (!files.length) {
  console.error('No HTML files in dist/.');
  process.exit(1);
}

files.forEach(function (file) {
  var html = fs.readFileSync(file, 'utf8');
  var rel = path.relative(dist, file).split(path.sep).join('/');
  var isBridge = rel === 'index.html';
  if (html.indexOf('/js/tid.js') === -1 || html.indexOf('/js/track.js') === -1) {
    failures.push(rel + ': missing /js/tid.js or /js/track.js');
  }
  var match;
  var hrefRe = /href\s*=\s*["']([^"']*clickbank\.net[^"']*)["']/gi;
  while ((match = hrefRe.exec(html))) {
    var raw = match[1].replace(/&amp;/g, '&');
    var url;
    try { url = new URL(raw); } catch (e) {
      failures.push(rel + ': unparseable ClickBank href ' + raw);
      continue;
    }
    if (!isBridge) {
      failures.push(rel + ': ClickBank hop link is outside the bridge page: ' + raw);
    }
    if (url.hostname !== HOP_HOST) {
      failures.push(rel + ': hop host is ' + url.hostname + ', expected ' + HOP_HOST);
    }
    var tid = url.searchParams.get('tid');
    if (tid == null || tid === '') {
      failures.push(rel + ': ClickBank link has no tid: ' + raw);
    } else if (!/^[a-z0-9]{1,24}$/.test(tid)) {
      failures.push(rel + ': tid is missing or not alphanumeric 1-24: ' + JSON.stringify(tid));
    } else if (isBridge && tid !== 'web') {
      failures.push(rel + ': no-JS default tid must be web, found ' + tid);
    }
  }
});

var bridge = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
var hops = bridge.match(/href\s*=\s*["'][^"']*hop\.clickbank\.net[^"']*["']/gi) || [];
if (hops.length < 1) failures.push('index.html: bridge page has no ClickBank hop link');

if (failures.length) {
  console.error('ClickBank tid check failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('html tid check ok: ' + files.length + ' pages, ' + hops.length + ' bridge hop link(s), each with tid=web');
