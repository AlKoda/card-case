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
var activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/alkoda/casefile/MainActivity.java'), 'utf8');
assert.ok(/CF\.UI\.back/.test(activity), 'Back is wired to the game');
assert.ok(/OnBackPressedCallback/.test(activity) && !/void onBackPressed\(/.test(activity), 'Back goes through the dispatcher (predictive back)');
assert.ok(/onRenderProcessGone/.test(activity), 'a killed renderer is rebuilt');
assert.ok(/CF\.Audio\.suspend/.test(activity) && /CF\.UI\.onBackground/.test(activity), 'the background silences and saves the game');
assert.ok(/CF\.UI\.setInsets/.test(activity), 'the cutout reaches the page');
var mf = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
assert.ok(/enableOnBackInvokedCallback="true"/.test(mf) && /dataExtractionRules/.test(mf) && /fullBackupContent/.test(mf) && /localeConfig/.test(mf) && /appCategory="game"/.test(mf), 'manifest: back, backup, languages, category');
assert.ok(!/INTERNET/.test(mf), 'the game needs no network');
['android/app/src/main/res/xml/data_extraction_rules.xml', 'android/app/src/main/res/xml/backup_rules.xml', 'android/app/src/main/res/xml/locales_config.xml',
  'android/app/src/main/res/values-ar/strings.xml', 'android/keystore/sideload.jks.b64', 'docs/ANDROID.md'].forEach(function (f) { assert.ok(fs.existsSync(path.join(root, f)), f); });
var gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
assert.ok(/targetSdk 35/.test(gradle) && /CF_VERSION_CODE/.test(gradle) && /signingConfigs/.test(gradle), 'gradle: current SDK, CI version code, a signing key');
var wf = fs.readFileSync(path.join(root, '.github/workflows/android.yml'), 'utf8');
assert.ok(/assembleRelease/.test(wf) && /CF_VERSION_CODE/.test(wf) && /apk-latest/.test(wf), 'CI builds a signed release with a rising version');
assert.ok(/--inset-l/.test(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')) && /s-haptics/.test(html), 'the page pads for the cutout and offers haptics');
console.log('pwa: service worker list, manifest, android inputs OK');
