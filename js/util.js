// Shared helpers. Everything hangs off the global CF namespace so the game
// runs straight from index.html (no bundler) and loads in Node for tests.
(function (G) {
  var CF = (G.CF = G.CF || {});

  // Seeded RNG (mulberry32) so a save file reproduces the same future.
  CF.makeRng = function (seed) {
    var s = seed >>> 0;
    var rng = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.getState = function () { return s; };
    rng.setState = function (v) { s = v >>> 0; };
    return rng;
  };

  CF.util = {
    pick: function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
    chance: function (rng, p) { return rng() < p; },
    randInt: function (rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); },
    shuffle: function (rng, arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    sample: function (rng, arr, n) { return CF.util.shuffle(rng, arr).slice(0, n); },
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    // Replace {token} with values from vars; unknown tokens are left as-is.
    fill: function (text, vars) {
      if (!text) return '';
      return String(text).replace(/\{(\w+)\}/g, function (m, k) {
        return vars && vars[k] !== undefined ? vars[k] : m;
      });
    },
    addAspects: function (into, from, mult) {
      mult = mult === undefined ? 1 : mult;
      for (var k in from) into[k] = (into[k] || 0) + from[k] * mult;
      return into;
    },
    clone: function (o) { return JSON.parse(JSON.stringify(o)); },
    fmtTime: function (sec) {
      sec = Math.max(0, Math.ceil(sec));
      var m = Math.floor(sec / 60), s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
