/* Copy the pages Vercel serves into dist/ so the HTML tid scan checks the build. */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '..');
var dist = path.join(root, 'dist');
var files = [
  'index.html',
  'about.html',
  'disclosure.html',
  'privacy.html',
  'grocery/index.html',
  'joint-genesis-review/index.html',
  'joint-genesis-ingredients/index.html',
  'js/tid.js',
  'js/track.js',
  'vercel.json'
];

fs.rmSync(dist, { recursive: true, force: true });
files.forEach(function (rel) {
  var dest = path.join(dist, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, rel), dest);
});
console.log('build ok: ' + files.length + ' files -> dist/');
