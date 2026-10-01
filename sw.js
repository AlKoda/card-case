// Service worker: the whole game is cached on first visit, so it opens
// offline and installs to a tablet's home screen. VERSION names the edition:
// the deploy workflow stamps it with the commit (casefile-<sha>), so every
// release is a new cache; bumping it by hand works too.
var VERSION = 'casefile-v16';
var FILES = [
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "css/style.css",
  "css/fonts.css",
  "css/fonts-ar.css",
  "css/art/menu.css",
  "css/art/noir-tables.css",
  "css/art/deck-menu.css",
  "css/art/cm-cards.css",
  "css/art/cm-icons.css",
  "css/art/cm-ui.css",
  "js/util.js",
  "js/i18n.js",
  "js/lang/ar/cards.js",
  "js/lang/ar/cases-1.js",
  "js/lang/ar/cases-2.js",
  "js/lang/ar/cases-3.js",
  "js/lang/ar/engine.js",
  "js/lang/ar/recipes-1.js",
  "js/lang/ar/recipes-2.js",
  "js/lang/ar/round3.js",
  "js/lang/ar/story.js",
  "js/lang/ar/structures-1.js",
  "js/lang/ar/structures-2.js",
  "js/lang/ar/systems.js",
  "js/lang/ar/ui.js",
  "js/data/cards.js",
  "js/data/cases.js",
  "js/data/verbs.js",
  "js/data/deductions.js",
  "js/data/structures.js",
  "js/data/story.js",
  "js/engine.js",
  "js/systems/charge.js",
  "js/systems/reflect.js",
  "js/systems/informants.js",
  "js/systems/criminals.js",
  "js/systems/sentence.js",
  "js/systems/purse.js",
  "js/systems/origins.js",
  "js/systems/coquille.js",
  "js/systems/patrons.js",
  "js/systems/societies.js",
  "js/systems/network.js",
  "js/systems/callings.js",
  "js/systems/intro.js",
  "js/systems/life.js",
  "js/systems/growth.js",
  "js/core/recipes.js",
  "js/data/recipes.js",
  "js/settings.js",
  "js/audio.js",
  "js/ui.js",
  "js/screens.js",
  "js/main.js"
];
// An edition is one cache: every file in it was fetched together at install,
// so a page never runs a script from one release with a stylesheet from
// another. The home-screen icons are rasterised at deploy time; a missing one
// (a local checkout) does not stop the install.
var ICONS = /\.png$/;
self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FILES.filter(function (f) { return !ICONS.test(f); })).then(function () {
      return Promise.all(FILES.filter(function (f) { return ICONS.test(f); }).map(function (f) {
        return fetch(f).then(function (res) { if (res && res.ok) return c.put(f, res); }).catch(function () { /* no icon here */ });
      }));
    });
  }));
});
// A new edition waits until the page asks for it (the update toast), so a
// running game is never switched under the player.
self.addEventListener('message', function (ev) {
  if (ev.data === 'skip') self.skipWaiting();
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// The path inside the scope, without query or hash; null for anything else.
function scopePath(url) {
  var base = self.registration.scope;
  return url.indexOf(base) === 0 ? url.slice(base.length).split(/[?#]/)[0] : null;
}
// Every file of the edition, the page itself included, comes from its cache
// alone: never a mix. Nothing is put in the cache after the install. A file
// not in the list (the spare art, an icon that was never built) goes to the
// network as it would without a worker.
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;
  var p = scopePath(ev.request.url);
  if (p === null) return;
  if (p === '') p = 'index.html';
  if (FILES.indexOf(p) < 0) return;
  ev.respondWith(caches.open(VERSION).then(function (c) { return c.match(p); }).then(function (hit) {
    return hit || fetch(ev.request);
  }));
});
