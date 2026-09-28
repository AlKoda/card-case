// Service worker: the whole game is cached on first visit, so it opens
// offline and installs to a tablet's home screen. Bump VERSION on release.
var VERSION = 'casefile-v7';
var FILES = [
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "css/style.css",
  "css/fonts.css",
  "css/art/menu.css",
  "css/art/city-ui.css",
  "css/art/city-icons.css",
  "css/art/noir-cards.css",
  "css/art/noir-icons.css",
  "css/art/noir-verbs.css",
  "css/art/noir-tables.css",
  "js/util.js",
  "js/i18n.js",
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
  "js/core/recipes.js",
  "js/data/recipes.js",
  "js/settings.js",
  "js/audio.js",
  "js/ui.js",
  "js/screens.js",
  "js/main.js"
];
self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Cache first, then the network; a fresh copy replaces the cached one.
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(caches.match(ev.request).then(function (hit) {
    var fetched = fetch(ev.request).then(function (res) {
      if (res && res.ok) caches.open(VERSION).then(function (c) { c.put(ev.request, res.clone()); });
      return res;
    }).catch(function () { return hit; });
    return hit || fetched;
  }));
});
