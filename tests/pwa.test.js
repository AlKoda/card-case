// The offline/install layer: the service worker caches every file the page
// loads, the manifest is sane, and the Android wrapper's inputs exist.
// Run: node tests/pwa.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
var cached = JSON.parse(sw.match(/var FILES = (\[[\s\S]*?\]);/)[1]);
var needed = ['index.html', 'manifest.webmanifest', 'icons/icon.svg']
  .concat(html.match(/href="(css\/[^"]+)"/g).map(function (m) { return m.slice(6, -1); }))
  .concat(html.match(/<script src="([^"]+)"/g).map(function (m) { return m.slice(13, -1); }));
needed.forEach(function (f) {
  assert.ok(cached.indexOf(f) >= 0, 'service worker caches ' + f);
  assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
});
cached.forEach(function (f) { assert.ok(fs.existsSync(path.join(root, f)), 'cached file exists: ' + f); });
var manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.strictEqual(manifest.display, 'fullscreen');
assert.ok(manifest.icons.length >= 2 && manifest.start_url);
assert.ok(/rel="manifest"/.test(html) && /serviceWorker/.test(html));
['android/settings.gradle', 'android/build.gradle', 'android/app/build.gradle', 'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/alkoda/casefile/MainActivity.java', 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  '.github/workflows/android.yml'].forEach(function (f) { assert.ok(fs.existsSync(path.join(root, f)), f); });
assert.ok(/CF\.UI\.back/.test(fs.readFileSync(path.join(root, 'android/app/src/main/java/com/alkoda/casefile/MainActivity.java'), 'utf8')), 'Back is wired to the game');
console.log('pwa: service worker list, manifest, android inputs OK');
