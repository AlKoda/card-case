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
// The home-screen icons are PNGs rasterised by tools/build_icons.py at deploy
// time (the repository holds no binaries): they count as existing when the
// script produces them at that size.
var buildIcons = fs.readFileSync(path.join(root, 'tools/build_icons.py'), 'utf8');
var iconSizes = buildIcons.match(/SIZES = \(([\d, ]+)\)/)[1].split(',').map(function (x) { return +x.trim(); });
assert.ok(/icon-%d\.png/.test(buildIcons) && iconSizes.indexOf(192) >= 0 && iconSizes.indexOf(512) >= 0, 'build_icons.py writes icon-192.png and icon-512.png');
function built(f) { var m = /^icons\/icon-(\d+)\.png$/.exec(f); return !!m && iconSizes.indexOf(+m[1]) >= 0; }
function exists(f) { return fs.existsSync(path.join(root, f)) || built(f); }
var needed = ['index.html', 'manifest.webmanifest', 'icons/icon.svg']
  .concat(html.match(/href="(css\/[^"]+)"/g).map(function (m) { return m.slice(6, -1); }))
  .concat(html.match(/<script src="([^"]+)"/g).map(function (m) { return m.slice(13, -1); }));
needed.forEach(function (f) {
  assert.ok(cached.indexOf(f) >= 0, 'service worker caches ' + f);
  assert.ok(exists(f), f + ' exists');
});
cached.forEach(function (f) { assert.ok(exists(f), 'cached file exists or is built at deploy: ' + f); });
var manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.strictEqual(manifest.display, 'fullscreen');
assert.ok(manifest.icons.length >= 2 && manifest.start_url);
manifest.icons.forEach(function (ic) { assert.ok(exists(ic.src), 'manifest icon exists on disk or is built: ' + ic.src); assert.ok(cached.indexOf(ic.src) >= 0, 'and is cached: ' + ic.src); });
assert.ok(/rel="manifest"/.test(html) && /serviceWorker/.test(html));
var deploy = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
assert.ok(/python tools\/build_icons\.py _site\/icons/.test(deploy), 'the deploy builds the icons into the site');

// ---- Releases are atomic: one cache per edition, named after the commit.
var versionLine = sw.match(/^var VERSION = '([^']*)';$/m);
assert.ok(versionLine && /^casefile-[\w.-]+$/.test(versionLine[1]), 'sw.js names its edition on one line');
var stamp = deploy.match(/sed -i "s\/(\^var VERSION = '\[\^'\]\*';)\/var VERSION = 'casefile-\$\{GITHUB_SHA::7\}';\/"/);
assert.ok(stamp, 'the deploy stamps VERSION with the commit');
assert.ok(new RegExp(stamp[1], 'm').test(sw), 'and its pattern matches the line in sw.js');
assert.ok(/rm -f _site\/css\/art\/cm-spare\.css/.test(deploy), 'the spare art is not shipped');
assert.ok(!/c\.put\(ev\.request/.test(sw) && !/caches\.match\(ev\.request\)/.test(sw), 'the fetch handler never writes a listed file to the cache and serves the edition only');
assert.ok(/caches\.open\(VERSION\)\.then\(function \(c\) \{\s*return c\.match\(p\)/.test(sw) && /if \(lazy && res && res\.ok\) c\.put\(p, res\.clone\(\)\)/.test(sw), 'files come from the VERSION cache alone; a lazy file is put there on its first fetch');
assert.ok(/addEventListener\('message'/.test(sw) && /ev\.data === 'skip'/.test(sw) && /skipWaiting\(\)/.test(sw), 'a message of skip lets the new edition take over');
assert.ok(!/addAll\(FILES\)\.then\(function \(\) \{ return self\.skipWaiting/.test(sw) && !/install[\s\S]*?skipWaiting[\s\S]*?\}\);\n\/\/ A new edition/.test(sw), 'the install itself does not skip waiting');
// An edition is fetched past the HTTP cache, so two pushes ten minutes apart never mix their files.
assert.ok(/function fresh\(f\) \{ return new Request\(f, \{ cache: 'reload' \}\); \}/.test(sw) && /c\.addAll\(FILES\.filter\([^\n]*\)\.map\(fresh\)\)/.test(sw) && /fetch\(fresh\(f\)\)/.test(sw) && /fetch\(lazy \? fresh\(p\) : ev\.request\)/.test(sw), 'the install, the icons and the lazy file use cache: \'reload\'');
var reg = html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.ok(/visibilitychange/.test(reg) && /reg\.update\(\)/.test(reg) && /3600000/.test(reg), 'a page come back into view looks for a new edition, once an hour at most');
['updatefound', 'statechange', "w.state === 'installed'", 'navigator.serviceWorker.controller', 'CF.onUpdate(reg)', 'controllerchange', 'CF.updateAsked', 'location.reload()', 'reg.waiting'].forEach(function (k) {
  assert.ok(reg.indexOf(k) >= 0, 'the registration script handles the update: ' + k);
});
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(/CF\.onUpdate = function \(reg\)/.test(main) && /A new edition is ready/.test(main) && /Tap to reload\./.test(main) && /postMessage\('skip'\)/.test(main), 'main.js shows the update toast and posts skip');

// ---- The art payload: every key the code refers to is in a linked sheet, and
// the list the build reads is the one the code gives.
var artUsed = require('../tools/art_used.js');
var scan = artUsed.scan();
var linked = html.match(/href="(css\/[^"]+\.css)"/g).map(function (m) { return m.slice(6, -1); });
var definedLinked = {};
linked.forEach(function (f) {
  var src = fs.readFileSync(path.join(root, f), 'utf8'), re = /--art-([a-z0-9-]+):/g, m;
  while ((m = re.exec(src))) definedLinked[m[1]] = f;
});
assert.ok(linked.indexOf('css/art/cm-spare.css') < 0 && cached.indexOf('css/art/cm-spare.css') < 0, 'the spare art is neither linked nor cached');
assert.ok(scan.used.length > 0 && scan.used.length < Object.keys(scan.defined).length, 'some tiles are spare');
scan.used.forEach(function (k) { assert.ok(definedLinked[k], 'referenced art key is defined in a linked stylesheet: ' + k); });
var sources = fs.readdirSync(path.join(root, 'js')).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return 'js/' + f; })
  .concat(['css/style.css', 'index.html']);
sources.forEach(function (f) {
  var src = fs.readFileSync(path.join(root, f), 'utf8'), re = /--art-([a-z0-9-]+)\)/g, m;
  while ((m = re.exec(src))) assert.ok(definedLinked[m[1]], f + ' refers to --art-' + m[1] + ', which no linked stylesheet defines');
});
var listed = fs.readFileSync(artUsed.file, 'utf8').split('\n').filter(Boolean);
assert.deepStrictEqual(listed, scan.used, 'tools/art_used.txt is current (run node tools/art_used.js, then the art build with --used)');
var spare = fs.readFileSync(path.join(root, 'css/art/cm-spare.css'), 'utf8');
scan.used.forEach(function (k) { assert.ok(spare.indexOf('--art-' + k + ':') < 0, 'a used key is not in the spare sheet: ' + k); });

// ---- Fonts: no dead weight; the Arabic face loads with the language.
var fonts = fs.readFileSync(path.join(root, 'css/fonts.css'), 'utf8');
assert.strictEqual((fonts.match(/font-family: 'Cinzel'/g) || []).length, 1, 'one Cinzel face');
assert.ok(/font-weight: 600 700;/.test(fonts), 'serving 600 and 700');
assert.ok(fonts.indexOf('IM Fell English SC') < 0 && fonts.indexOf('Amiri') < 0, 'no small-caps face, no Arabic in the Latin sheet');
var fontsAr = fs.readFileSync(path.join(root, 'css/fonts-ar.css'), 'utf8');
assert.ok(/font-family: 'Amiri'/.test(fontsAr) && cached.indexOf('css/fonts-ar.css') < 0 && /var LAZY = \["css\/fonts-ar\.css"\]/.test(sw) && linked.indexOf('css/fonts-ar.css') < 0, 'the Arabic face is its own sheet, cached on first use, never at install, not linked by the page');
var i18n = fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8');
assert.ok(/fonts: 'css\/fonts-ar\.css'/.test(i18n) && /CF\.loadFonts\(CF\.LANGS\[lang\]\.fonts/.test(i18n), 'CF.setLang adds the language\'s fonts');

// ---- Back, install, resume, and a save that is never destroyed (js/main.js).
assert.ok(/popstate/.test(main) && /history\.pushState\(\{ cf: 1 \}/.test(main) && /history\.back\(\)/.test(main), 'the browser Back closes windows through UI.back');
assert.ok(/beforeinstallprompt/.test(main) && /appinstalled/.test(main) && /t-install/.test(main) && /id="t-install"/.test(html) && />Install<\/button>/.test(html), 'install in one tap');
assert.ok(/location\.hash/.test(main) && /resume/.test(main) && /UI\.setPaused\(true\)/.test(main), '#resume reopens the table, paused');
assert.ok(/casefile\.save\.v1\.broken/.test(main) && /casefile\.save\.v1\.prev/.test(main) && !/store\(SAVE_KEY, null\);\s*openTitle/.test(main), 'a save that cannot be read is copied, never removed');
assert.ok(/The saved letter could not be read/.test(main) && /JSON\.parse\(raw\)/.test(main), 'the title says so, and Continue hides only when the save is not JSON');

['android/settings.gradle', 'android/build.gradle', 'android/app/build.gradle', 'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/alkoda/casefile/MainActivity.java', 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  '.github/workflows/android.yml'].forEach(function (f) { assert.ok(fs.existsSync(path.join(root, f)), f); });
var activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/alkoda/casefile/MainActivity.java'), 'utf8');
assert.ok(/CF\.UI\.back/.test(activity), 'Back is wired to the game');
assert.ok(/OnBackPressedCallback/.test(activity) && !/void onBackPressed\(/.test(activity), 'Back goes through the dispatcher (predictive back)');
assert.ok(/onRenderProcessGone/.test(activity), 'a killed renderer is rebuilt');
assert.ok(/CF\.Audio\.suspend/.test(activity) && /CF\.UI\.onBackground/.test(activity), 'the background silences and saves the game');
assert.ok(/CF\.UI\.setInsets/.test(activity), 'the cutout reaches the page');
// A felt cue by name: the touches through the system's own feedback with no flags (the touch-feedback setting
// kept), the weights through the vibrator, each behind its API level.
assert.ok(/@JavascriptInterface\s+public void haptic\(final String kind\)/.test(activity), 'the bridge plays a cue by name');
assert.ok(/root\.performHapticFeedback\(HapticFeedbackConstants\.CLOCK_TICK\)/.test(activity) && /r30 \? HapticFeedbackConstants\.CONFIRM : HapticFeedbackConstants\.VIRTUAL_KEY/.test(activity) && /r30 \? HapticFeedbackConstants\.REJECT : HapticFeedbackConstants\.LONG_PRESS/.test(activity), 'tick, confirm, reject, with their fallbacks');
assert.ok(!/performHapticFeedback\([^)]*,/.test(activity), 'no flags: the system setting is kept');
assert.ok(/createPredefined\(VibrationEffect\.EFFECT_HEAVY_CLICK\)/.test(activity) && /new long\[\] \{0, 12, 140, 12\}/.test(activity) && /new long\[\] \{0, 30, 60, 30\}/.test(activity), 'heavy, toll and harm from the vibrator');
assert.ok(/web\.setHapticFeedbackEnabled\(false\)/.test(activity), 'the WebView\'s own stays off');
var mf = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
assert.ok(/enableOnBackInvokedCallback="true"/.test(mf) && /dataExtractionRules/.test(mf) && /fullBackupContent/.test(mf) && /localeConfig/.test(mf) && /appCategory="game"/.test(mf), 'manifest: back, backup, languages, category');
assert.ok(!/INTERNET/.test(mf), 'the game needs no network');
['android/app/src/main/res/xml/data_extraction_rules.xml', 'android/app/src/main/res/xml/backup_rules.xml', 'android/app/src/main/res/xml/locales_config.xml',
  'android/app/src/main/res/values-ar/strings.xml', 'android/keystore/sideload.jks.b64', 'docs/ANDROID.md'].forEach(function (f) { assert.ok(fs.existsSync(path.join(root, f)), f); });
var gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
assert.ok(/targetSdk 35/.test(gradle) && /CF_VERSION_CODE/.test(gradle) && /signingConfigs/.test(gradle), 'gradle: current SDK, CI version code, a signing key');
var wf = fs.readFileSync(path.join(root, '.github/workflows/android.yml'), 'utf8');
assert.ok(/assembleRelease/.test(wf) && /CF_VERSION_CODE/.test(wf) && /apk-latest/.test(wf), 'CI builds a signed release with a rising version');
assert.ok(/rm -f android\/app\/src\/main\/assets\/www\/css\/art\/cm-spare\.css android\/app\/src\/main\/assets\/www\/sw\.js/.test(wf), 'the APK ships neither the spare art nor the service worker it never registers');
assert.ok(wf.indexOf('rm -f android/app/src/main/assets/www/css/art/cm-spare.css') > wf.indexOf('cp -r index.html css js'), 'and strips them after the copy');
assert.ok(/!window\.CaseFileAndroid/.test(html.slice(html.indexOf("navigator.serviceWorker.register") - 200, html.indexOf("navigator.serviceWorker.register"))), 'the app does not register a worker');
assert.ok(/--inset-l/.test(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')) && /s-haptics/.test(html), 'the page pads for the cutout and offers haptics');
// ---- The Android wrapper: a bundle or a dead renderer reopens on the table; cutout insets alone.
assert.ok(/web\.loadUrl\(savedInstanceState == null \? START : START \+ RESUME\)/.test(activity) && !/else web\.restoreState/.test(activity), 'the page loads after a restore, whether or not it worked');
assert.strictEqual((activity.match(/web\.loadUrl\(START \+ RESUME\)/g) || []).length, 1, 'a killed renderer reloads with #resume');
assert.ok(/getInsets\(WindowInsetsCompat\.Type\.displayCutout\(\)\)/.test(activity) && !/displayCutout\(\) \| WindowInsetsCompat\.Type\.systemBars/.test(activity), 'the page pads for the cutout only');
assert.ok(/reopens on the table, paused/.test(fs.readFileSync(path.join(root, 'docs/ANDROID.md'), 'utf8')), 'ANDROID.md says so');

// ---- Audio: no pad is scheduled while suspended, the rain is not doubled (js/audio.js under Node).
(function audio() {
  var timers = 0, cleared = 0, rains = 0, listeners = {};
  var node = function () { return { connect: function () {}, start: function () { if (this.loop) rains++; }, stop: function () {}, gain: { setValueAtTime: function () {}, setTargetAtTime: function () {}, exponentialRampToValueAtTime: function () {}, linearRampToValueAtTime: function () {} },
    frequency: { setValueAtTime: function () {}, setTargetAtTime: function (v) { this.target = v; }, exponentialRampToValueAtTime: function () {}, linearRampToValueAtTime: function () {}, value: 0 }, detune: { value: 0 }, Q: { value: 0 } }; };
  function Ctx() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 100; this.destination = {}; }
  Ctx.prototype.createGain = Ctx.prototype.createOscillator = Ctx.prototype.createBiquadFilter = node;
  Ctx.prototype.createBufferSource = function () { var n = node(); n.loop = false; return n; };
  Ctx.prototype.createBuffer = function () { return { getChannelData: function () { return new Float32Array(100); } }; };
  Ctx.prototype.suspend = function () { this.state = 'suspended'; };
  Ctx.prototype.resume = function () { this.state = 'running'; };
  var win = { CF: { Settings: { values: { master: 80, music: 60, sfx: 70 }, onChange: function () {} } }, AudioContext: Ctx,
    addEventListener: function (ev, fn) { listeners[ev] = fn; }, setInterval: function () { timers++; return timers; }, clearInterval: function () { cleared++; } };
  var ctx = { window: win, document: { addEventListener: function () {}, hidden: false }, setInterval: win.setInterval, clearInterval: win.clearInterval, Float32Array: Float32Array, Math: Math };
  require('vm').runInNewContext(fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8'), ctx, { filename: 'js/audio.js' });
  var A = win.CF.Audio;
  listeners.pointerdown();
  assert.ok(A.ready && timers === 1 && rains === 2, 'the first gesture starts the pad and the rain (two layers of it)');
  A.suspend();
  assert.ok(cleared === 1 && A.ctx.state === 'suspended', 'suspend clears the pad timer and the context');
  A.resume();
  assert.ok(A.ctx.state === 'running' && timers === 2 && rains === 2, 'resume restarts the pad without a second rain');
  A.resume();
  assert.ok(timers === 2 && rains === 2, 'a second resume changes nothing');
  // The ending stops the pad, and a hidden page coming back does not start it again; a new game does.
  A.music(false);
  assert.strictEqual(cleared, 2, 'the ending clears the pad timer');
  A.suspend(); A.resume();
  assert.strictEqual(timers, 2, 'the pad stays silent behind the ending');
  A.music(true);
  assert.ok(timers === 3 && rains === 2, 'a new game starts the pad, the rain still one');
  // Paused or under a menu, the pad is muffled; and back.
  assert.ok(typeof A.hush === 'function' && typeof A.duck === 'function', 'hush and duck exist');
  A.hush(true); A.hush(false);
  // Danger is heard at once; calm comes back after twenty seconds of it.
  assert.strictEqual(A.mood(2, 100), 2, 'danger at once');
  assert.strictEqual(A.mood(0, 110), 2, 'not calm ten seconds on');
  assert.strictEqual(A.mood(0, 121), 0, 'calm after twenty');
})();
console.log('pwa: service worker list, editions, art, fonts, shell, android inputs, audio OK');
