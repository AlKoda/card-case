// Player settings, kept in localStorage.
(function () {
  var CF = window.CF;
  var KEY = 'casefile.settings.v1';
  var DEFAULTS = { master: 80, music: 60, sfx: 70, textSpeed: 50, shake: true, lang: 'en', pauseOnCase: false, pauseOnVerb: false, pauseOnBlur: true,
    gap: 14, guided: true, uiScale: 100, pauseOnDrag: false, grid: false, snap: true, strings: true, haptics: true };

  var Settings = (CF.Settings = { values: {}, listeners: [] });

  Settings.load = function () {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (err) { v = {}; }
    for (var k in DEFAULTS) Settings.values[k] = v[k] !== undefined ? v[k] : DEFAULTS[k];
    // A first run follows the device's language, when the game speaks it.
    if (v.lang === undefined) Settings.values.lang = Settings.deviceLang();
    return Settings.values;
  };

  Settings.save = function (vals) {
    for (var k in DEFAULTS) if (vals[k] !== undefined) Settings.values[k] = vals[k];
    try { localStorage.setItem(KEY, JSON.stringify(Settings.values)); } catch (err) { /* storage unavailable */ }
    Settings.listeners.forEach(function (fn) { fn(Settings.values); });
  };

  Settings.deviceLang = function () {
    var tag = '';
    try { if (typeof window !== 'undefined' && window.CaseFileAndroid && window.CaseFileAndroid.locale) tag = window.CaseFileAndroid.locale(); } catch (err) { tag = ''; }
    try { if (!tag && typeof navigator !== 'undefined') tag = (navigator.languages && navigator.languages[0]) || navigator.language || ''; } catch (err) { tag = ''; }
    return /^ar\b/i.test(String(tag)) ? 'ar' : 'en';
  };
  Settings.get = function (k) { return Settings.values[k]; };
  Settings.onChange = function (fn) { Settings.listeners.push(fn); };

  // Characters revealed per second by the typewriter; Infinity = instant.
  Settings.typeRate = function () {
    var t = Settings.values.textSpeed;
    return t >= 100 ? Infinity : 20 + t * 3;
  };

  Settings.load();
})();
