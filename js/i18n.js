// Languages. Every word the player reads passes through CF.T on its way to
// the screen; the English in the data files is the key, and js/lang/<code>/
// holds each other language as { 'English': 'translation' }. Keys may carry
// {placeholders}: 'Burglary at {scene}' matches any title built from that
// template, and the captured part is translated on its own. A string that
// no key matches is tried sentence by sentence, then as a list, then as a
// run of translated words (a name), and stays English if nothing fits.
(function (G) {
  var CF = G.CF;

  CF.LANGS = {
    en: { name: 'English', dir: 'ltr' },
    ar: { name: 'العربية', dir: 'rtl' },
  };

  var I = (CF.I18N = { lang: 'en', dicts: {}, compiled: {}, cache: {}, cacheN: 0, missing: {}, track: false });

  CF.addStrings = function (lang, map) {
    var d = I.dicts[lang] || (I.dicts[lang] = {});
    for (var k in map) d[k] = map[k];
    I.compiled[lang] = null;
    I.cache = {}; I.cacheN = 0;
  };

  CF.setLang = function (lang) {
    if (!CF.LANGS[lang]) lang = 'en';
    I.lang = lang;
    I.cache = {}; I.cacheN = 0;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', CF.LANGS[lang].dir);
      I.applyDOM(document.body);
    }
    return lang;
  };
  CF.lang = function () { return I.lang; };
  CF.isRTL = function () { return CF.LANGS[I.lang].dir === 'rtl'; };

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Keys with {placeholders} become anchored patterns; the ones with the
  // most literal text are tried first so 'Witness in: {t}' beats '{t}'.
  function compile(lang) {
    var d = I.dicts[lang], list = [];
    for (var k in d) {
      if (k.indexOf('{') < 0) continue;
      var keys = [], lit = 0;
      var src = k.split(/(\{\w+\})/).map(function (part) {
        if (/^\{\w+\}$/.test(part)) { keys.push(part.slice(1, -1)); return '([\\s\\S]+?)'; }
        lit += part.length;
        return escapeRe(part);
      }).join('');
      if (!keys.length || !/[A-Za-z]/.test(k.replace(/\{\w+\}/g, ''))) continue;
      list.push({ re: new RegExp('^' + src + '$'), keys: keys, out: d[k], lit: lit });
    }
    list.sort(function (a, b) { return b.lit - a.lit; });
    return (I.compiled[lang] = list);
  }

  var LETTERS = /[A-Za-z]/;
  var SEP = /(, |; | · | \/ )/;

  function lookup(s, depth) {
    var d = I.dicts[I.lang];
    if (d[s] !== undefined) return d[s];
    var t = s.trim();
    if (!t || !LETTERS.test(t)) return s;
    if (t !== s && d[t] !== undefined) return s.replace(t, d[t]);
    // 'clerk' for a label the code lower-cased for English style.
    var cap = t.charAt(0).toUpperCase() + t.slice(1);
    if (cap !== t && d[cap] !== undefined) return s.replace(t, d[cap]);
    if (depth > 5) return miss(s);
    var tpls = I.compiled[I.lang] || compile(I.lang);
    for (var i = 0; i < tpls.length; i++) {
      var m = tpls[i].re.exec(t);
      if (!m) continue;
      var out = tpls[i].out;
      for (var j = 0; j < tpls[i].keys.length; j++) out = out.split('{' + tpls[i].keys[j] + '}').join(translate(m[j + 1], depth + 1));
      return t === s ? out : s.replace(t, out);
    }
    // Sentence by sentence.
    var parts = t.match(/[^.!?]+[.!?]+["'”)]*(\s+|$)|[^.!?]+$/g);
    if (parts && parts.length > 1) {
      var hit = false;
      var joined = parts.map(function (p) {
        var ws = /\s*$/.exec(p)[0], core = p.slice(0, p.length - ws.length);
        var tr = translate(core, depth + 1);
        if (tr !== core) hit = true;
        return tr + ws;
      }).join('');
      if (hit) return s.replace(t, joined);
    }
    // A trailing full stop or bracket around a known string.
    var m2 = /^([("'“]?)([\s\S]*?)([.!?:;,)"'”]*)$/.exec(t);
    if (m2 && m2[2] !== t && m2[2]) {
      var inner = translate(m2[2], depth + 1);
      if (inner !== m2[2]) return s.replace(t, m2[1] + inner + m2[3].replace(/,/g, '،').replace(/;/g, '؛'));
    }
    // A list: 'Wit, Instinct' or 'Trust 1/3 · heat 0/3'.
    var items = t.split(SEP);
    if (items.length > 1) {
      var hit2 = false;
      var out2 = items.map(function (p, idx) {
        if (idx % 2) return p === ', ' ? '، ' : p === '; ' ? '؛ ' : p;
        var tr = translate(p, depth + 1);
        if (tr !== p) hit2 = true;
        return tr;
      }).join('');
      if (hit2) return s.replace(t, out2);
    }
    // A run of known words: a person's name.
    var words = t.split(' ');
    if (words.length > 1 && words.length <= 4) {
      var all = true;
      var out3 = words.map(function (w) { if (d[w] === undefined) all = false; return d[w]; });
      if (all) return s.replace(t, out3.join(' '));
    }
    return miss(s);
  }
  function miss(s) {
    if (I.track) I.missing[s] = (I.missing[s] || 0) + 1;
    return s;
  }
  function translate(s, depth) {
    if (I.lang === 'en' || !s || !I.dicts[I.lang]) return s;
    if (I.cache[s] !== undefined) return I.cache[s];
    var r = lookup(s, depth);
    if (I.cacheN > 4000) { I.cache = {}; I.cacheN = 0; }
    I.cache[s] = r; I.cacheN++;
    return r;
  }

  // Translate a string (and fill {vars}, translating each value too).
  CF.T = function (s, vars) {
    if (s === undefined || s === null) return s;
    var out = translate(String(s), 0);
    if (vars) {
      var tv = {};
      for (var k in vars) tv[k] = typeof vars[k] === 'string' ? translate(vars[k], 1) : vars[k];
      out = CF.util.fill(out, tv);
    }
    return out;
  };

  // ---- Static markup. A paragraph with only <b>/<i> inside is one unit, so
  // the translation can reorder it; anything else is walked text by text.
  var INLINE = { B: 1, I: 1, EM: 1, STRONG: 1, BR: 1, KBD: 1 };
  var ATTRS = ['title', 'placeholder', 'aria-label'];
  function unitOf(el) {
    var kids = el.childNodes, hasText = false;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.nodeType === 3) { if (k.nodeValue.trim()) hasText = true; continue; }
      if (k.nodeType !== 1 || !INLINE[k.tagName]) return false;
      if (k.childNodes.length && !unitOf(k)) return false;
    }
    return hasText && el.querySelector('b,i,em,strong,kbd') !== null;
  }
  I.applyDOM = function (root) {
    if (!root) return;
    walk(root);
  };
  function walk(el) {
    if (el.nodeType === 3) {
      if (el.__en === undefined) el.__en = el.nodeValue;
      var v = el.__en, t = v.trim();
      if (t) el.nodeValue = v.replace(t, translate(t, 0));
      return;
    }
    if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    if (el.hasAttribute && el.hasAttribute('data-no-i18n')) return;
    for (var a = 0; a < ATTRS.length; a++) {
      var name = ATTRS[a];
      if (!el.hasAttribute(name)) continue;
      var key = '__en_' + name;
      if (el[key] === undefined) el[key] = el.getAttribute(name);
      el.setAttribute(name, translate(el[key], 0));
    }
    if (el.tagName === 'BUTTON' && el.hasAttribute('value')) {
      if (el.__en_value === undefined) el.__en_value = el.getAttribute('value');
      el.setAttribute('value', translate(el.__en_value, 0));
    }
    if (unitOf(el)) {
      if (el.__enHTML === undefined) el.__enHTML = el.innerHTML.replace(/\s+/g, ' ').trim();
      el.innerHTML = translate(el.__enHTML, 0);
      return;
    }
    var kids = Array.prototype.slice.call(el.childNodes);
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
