// Languages. Every word the player reads passes through CF.T on its way to
// the screen; the English in the data files is the key, and js/lang/<code>/
// holds each other language as { 'English': 'translation' }. Keys may carry
// {placeholders}: 'Burglary at {scene}' matches any title built from that
// template, and the captured part is translated on its own. A string that
// no key matches is tried sentence by sentence, then as a list, then as a
// run of translated words (a name), and stays English if nothing fits.
// A value may be an object of plural forms, { one, two, few, many, other }
// (and zero), picked by the count the string carries (see CF.pluralForm).
(function (G) {
  var CF = G.CF;

  CF.LANGS = {
    en: { name: 'English', dir: 'ltr' },
    // A count past two changes the noun's form in Arabic: 3-10 take the plural, 11-99 the singular in the
    // accusative, 100 and up the singular again. The rule names the form a number wants (see pick below).
    ar: { name: 'العربية', dir: 'rtl', fonts: 'css/fonts-ar.css', plural: function (n) {
      var h = n % 100;
      return n === 0 ? 'zero' : n === 1 ? 'one' : n === 2 ? 'two' : h >= 3 && h <= 10 ? 'few' : h >= 11 && h <= 99 ? 'many' : 'other';
    } },
  };

  var I = (CF.I18N = { lang: 'en', dicts: {}, compiled: {}, lower: {}, cache: {}, cacheN: 0, cutoffs: 0, missing: {}, partial: {}, track: false });

  // A value is a string, or its forms by count: { one, two, few, many, other } (and zero), picked by the number the
  // string carries (see pick). A key given in forms keeps them: a plain value for it in a file loaded later does not
  // undo them, so the forms can be written beside the newer text without touching the older files.
  // 'Key#f' is the same key when the person it is about is a woman (see womanIn).
  CF.addStrings = function (lang, map) {
    var d = I.dicts[lang] || (I.dicts[lang] = {});
    for (var k in map) { if (d[k] && typeof d[k] === 'object' && typeof map[k] === 'string') continue; d[k] = map[k]; }
    I.compiled[lang] = null; I.lower[lang] = null;
    I.cache = {}; I.cacheN = 0;
  };

  CF.setLang = function (lang) {
    if (!CF.LANGS[lang]) lang = 'en';
    I.lang = lang;
    I.cache = {}; I.cacheN = 0;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', CF.LANGS[lang].dir);
      if (CF.LANGS[lang].fonts) CF.loadFonts(CF.LANGS[lang].fonts, 'fonts-' + lang);
      I.applyDOM(document.body);
      // The tab, the app switcher and the recents read the game's name in the player's language.
      if (I.docTitle === undefined) I.docTitle = document.title || 'Case File: The Free City';
      document.title = translate(I.docTitle, 0);
    }
    return lang;
  };
  // A language's own faces are a stylesheet of their own, added to the page the
  // first time that language is set, so the others never download it.
  CF.loadFonts = function (href, id) {
    try {
      if (!document.head || document.getElementById(id)) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = href; link.id = id;
      document.head.appendChild(link);
    } catch (err) { /* no page to add it to */ }
  };
  CF.lang = function () { return I.lang; };
  CF.isRTL = function () { return CF.LANGS[I.lang].dir === 'rtl'; };

  // The form of a value for a count: a string is its own form; forms pick by the language's rule, else 'one'
  // and 'other'. Without a count (a key read bare), the general form.
  function pick(v, n) {
    if (v === undefined || v === null || typeof v !== 'object') return v;
    if (typeof n !== 'number' || isNaN(n)) return v.other;
    var rule = CF.LANGS[I.lang] && CF.LANGS[I.lang].plural, f = rule ? rule(n) : n === 1 ? 'one' : 'other';
    return v[f] !== undefined ? v[f] : v.other !== undefined ? v.other : v.many;
  }
  CF.I18N.pick = pick;
  I.form = pick;
  // The form a count takes in a language (the current one by default): 'zero', 'one', 'two', 'few', 'many', 'other'.
  CF.pluralForm = function (n, lang) {
    var rule = CF.LANGS[lang || I.lang] && CF.LANGS[lang || I.lang].plural;
    return rule ? rule(n) : n === 1 ? 'one' : 'other';
  };
  // The number a string counts: the placeholder the entry names ({ by: 'cases', ... }), else the one named for it
  // ({n}, {d}, {count}, {days}) when it holds a whole number, else the first that does.
  var COUNT_KEYS = { n: 1, d: 1, count: 1, days: 1 };
  function countOf(keys, valueOf, by) {
    var first;
    for (var i = 0; i < keys.length; i++) {
      if (by) { if (keys[i] !== by) continue; var bv = valueOf(keys[i], i); return /^\s*\d+\s*$/.test(String(bv)) ? +bv : undefined; }
      var v = valueOf(keys[i], i);
      if (typeof v === 'number' ? v % 1 !== 0 : !/^\s*\d+\s*$/.test(String(v))) continue;
      if (COUNT_KEYS[keys[i]]) return +v;
      if (first === undefined) first = +v;
    }
    return first;
  }
  // The person a line is about, by the first of its person placeholders: a woman when her first name is one the
  // city gives women. Then 'Key#f', where written, is the line: 'تتحدث ... عن زوجها', not 'يتحدث'.
  var PERSON_KEYS = { name: 1, witness: 1, who: 1, culprit: 1, nick: 1, suspect: 1, accused: 1, victim: 1, label: 1 };
  var WOMEN_EXTRA = ['Lucia', 'Margarethe', 'Carolina', 'Anna'];
  function isWoman(v) {
    if (typeof v !== 'string') return false;
    if (!I.women) {
      var names = (CF.NAMES && CF.NAMES.f) || [];
      if (!names.length) return false;
      I.women = {};
      names.concat(WOMEN_EXTRA).forEach(function (w) { I.women[w] = 1; });
    }
    var bare = v.replace(/^[^A-Za-z\u00C0-\u024F]+/, ''), first = bare.replace(/^(the|a|an) /i, '').split(' ')[0];
    if (I.women[first] || /^(Widow|Mother|Goodwife|Goody|Dame|Mistress|Sister)$/.test(first)) return true;
    // A description ('the laundress', 'a market-woman'): the engine's own reading of a role.
    var sexOf = CF.Engine && CF.Engine.prototype && CF.Engine.prototype.sexOf;
    return !!sexOf && /^(the|a|an) /i.test(bare) && sexOf.call(null, bare) === 'f';
  }
  I.woman = isWoman;
  function personAt(keys) { for (var i = 0; i < keys.length; i++) if (PERSON_KEYS[keys[i]]) return i; return -1; }
  function keysOf(k) { var out = [], m, re = /\{(\w+)\}/g; while ((m = re.exec(k))) out.push(m[1]); return out; }
  // A key's value for a line with these values in it: the woman's form where the line is about one, and the form
  // its count wants.
  // Inside a line about a woman (I.fem), the pieces read in her form too: her mark, her role ('{name}, {role}. {text}').
  function valueFor(k, keys, valueOf) {
    var d = I.dicts[I.lang], v = d[k], pi = personAt(keys);
    if (d[k + '#f'] !== undefined && (pi >= 0 ? isWoman(valueOf(keys[pi], pi)) : I.fem)) v = d[k + '#f'];
    return pick(v, countOf(keys, valueOf, v && typeof v === 'object' ? v.by : null));
  }
  // Whether a line's pieces read in a woman's form: its own person decides; a line with none follows the line it is in.
  function femFor(keys, valueOf) { var pi = personAt(keys); return pi >= 0 ? isWoman(valueOf(keys[pi], pi)) : !!I.fem; }

  function lowerIndex(lang) {
    var d = I.dicts[lang], out = {};
    for (var k in d) out[k.toLowerCase()] = d[k];
    return (I.lower[lang] = out);
  }
  var SURNAME = "((?:[a-z]+ ){0,2}[A-Z][A-Za-z'\u00C0-\u024F-]*)";
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Keys with {placeholders} become anchored patterns; the ones with the
  // most literal text are tried first so 'Witness in: {t}' beats '{t}'.
  function compile(lang) {
    var d = I.dicts[lang], list = [];
    for (var k in d) {
      if (k.indexOf('{') < 0 || /#f$/.test(k)) continue;
      var keys = [], lit = 0;
      var parts = k.split(/(\{\w+\})/), tail = [], adj = [];
      var src = parts.map(function (part, idx) {
        if (/^\{\w+\}$/.test(part)) {
          keys.push(part.slice(1, -1));
          // Nothing but punctuation after it: the capture must not swallow
          // the sentences that follow a composed string.
          tail.push(!/[A-Za-z{]/.test(parts.slice(idx + 1).join('')));
          // '{entry} {time}': two placeholders a space apart split ambiguously.
          adj.push(parts[idx + 1] === ' ' && /^\{\w+\}$/.test(parts[idx + 2] || ''));
          // A surname ('Bader', 'de Witt', 'van der Meer') is one name, never a run of words.
          if (part === '{last}') return SURNAME;
          return '([\\s\\S]+?)';
        }
        lit += part.length;
        return escapeRe(part);
      }).join('');
      // Some words of its own ('It is {name}'s.'), not bare glue ('{a}: {b}', '{a} of {b}'); a surname's
      // place ('{last} Row') is enough, its capture being one name.
      var bare = k.replace(/\{\w+\}/g, ''), letters = (bare.match(/[A-Za-z]/g) || []).length;
      if (!keys.length || (letters < 4 && !(keys.indexOf('last') >= 0 && /[A-Za-z]{3}/.test(bare)))) continue;
      list.push({ re: new RegExp('^' + src + '$'), keys: keys, tail: tail, adj: adj, k: k, lit: lit });
    }
    list.sort(function (a, b) { return b.lit - a.lit; });
    return (I.compiled[lang] = list);
  }

  var LETTERS = /[A-Za-z]/;
  var SEPS = [' · ', ' / ', '; ', ', ', ' and '];

  function lookup(s, depth) {
    var d = I.dicts[I.lang];
    if (d[s] !== undefined) return pick(I.fem && d[s + '#f'] !== undefined ? d[s + '#f'] : d[s]);
    var t = s.trim();
    if (!t || !LETTERS.test(t)) return s;
    if (t !== s && d[t] !== undefined) return s.replace(t, pick(d[t]));
    // 'the clerk of the court' for a label the code lower-cased.
    var lower = I.lower[I.lang] || lowerIndex(I.lang), lk = pick(lower[t.toLowerCase()]);
    if (lk !== undefined) return s.replace(t, lk);
    if (depth > 7) { I.cutoffs++; return miss(s); }
    var fallback = null;
    // A pattern that reads every piece wins at once; one that leaves a piece in English is kept for last.
    var viaTpl = matchTemplate(t, depth, true);
    if (viaTpl !== null) return t === s ? viaTpl : s.replace(t, viaTpl);
    var loose = matchTemplate(t, depth);
    if (loose !== null) fallback = t === s ? loose : s.replace(t, loose);
    // A parenthesis in front: '(The Market) The crier has sung it.'
    var par = /^\(([^()]+)\)\s+([\s\S]+)$/.exec(t);
    if (par) {
      var a = translate(par[1], depth + 1), b2 = translate(par[2], depth + 1);
      if (a !== par[1] || b2 !== par[2]) return s.replace(t, '(' + a + ') ' + b2);
    }
    // A symbol in front of a known string: '★ The Body at the Crane'. A number in front is the string's
    // own ('2 who walked from you...'), unless the rest is one phrase.
    var sym = /^([^A-Za-z{("“]+)([\s\S]+)$/.exec(t);
    if (sym && LETTERS.test(sym[2]) && !(/\d/.test(sym[1]) && /[.!?]["'”)]*\s+\S/.test(sym[2]))) {
      var body = translate(sym[2], depth + 1);
      if (body !== sym[2]) return s.replace(t, sym[1].replace(/,/g, '،').replace(/;/g, '؛') + body);
    }
    // 'Label: the text' (the text may have colons of its own).
    // The label is one phrase: a colon after a sentence ('Rent is due. The stipend: 4 Coin.') is not a label's.
    var colon = t.indexOf(': ');
    if (colon > 0 && colon < 60 && /[A-Za-z]{2}/.test(t.slice(0, colon)) && !/[.!?]["'”)]*\s/.test(t.slice(0, colon))) {
      var lab = translate(t.slice(0, colon), depth + 1), txt = translate(t.slice(colon + 2), depth + 1);
      // Read in part, it is kept in case nothing reads it whole ('Witness: X; Y (accused)' is a list).
      if (lab !== t.slice(0, colon) && txt !== t.slice(colon + 2)) {
        if (whollyRead(txt)) return s.replace(t, lab + ': ' + txt);
        if (fallback === null) fallback = s.replace(t, lab + ': ' + txt);
      }
    }
    // The longest opening run of sentences that is one known text (a case's
    // brief, a story beat), then whatever follows it.
    var bre = /[.!?]["'”)]*\s+/g, cuts = [], bm, firstCut = null;
    while ((bm = bre.exec(t))) cuts.push(bm.index + bm[0].length);
    for (var ci = cuts.length - 1; ci >= 0; ci--) {
      var head = t.slice(0, cuts[ci]).replace(/\s+$/, ''), gap = t.slice(head.length, cuts[ci]), rest = t.slice(cuts[ci]);
      var hd = whole(head);
      // A quoted saying: '"A gold ring. Big, on the little finger." (Loves the accused.)'
      var qt = hd === null ? /^(["“])([\s\S]+?)(["”])$/.exec(head) : null;
      // Arabic quotes a saying in guillemets.
      if (qt) { var qin = whole(qt[2]), rtl = CF.LANGS[I.lang].dir === 'rtl'; if (qin !== null) hd = (rtl ? '«' : qt[1]) + qin + (rtl ? '»' : qt[3]); }
      // A pattern that fits the run but leaves a piece of it in English is the wrong cut: a shorter run is tried.
      if (hd === null) hd = matchTemplate(head, depth + 1, true);
      if (hd === null) continue;
      // What follows is the next sentence along, not a piece inside this one: a long week's news reads to its end.
      // A cut that leaves what follows in English (the run took a sentence the next pattern needed) gives way to a shorter one.
      var rr = translate(rest, Math.max(1, depth)), cut = s.replace(t, hd + gap + rr);
      if (whollyRead(rr)) return cut;
      if (firstCut === null) firstCut = cut;
    }
    if (firstCut !== null) return firstCut;
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
      // Read in part, a pattern that fit the whole string (its own words, a name left as written) reads better.
      if (hit && (fallback === null || whollyRead(joined))) return s.replace(t, joined);
    }
    // A trailing full stop or bracket around a known string.
    var m2 = /^([("'“]?)([\s\S]*?)([.!?:;,)"'”]*)$/.exec(t);
    if (m2 && m2[2] !== t && m2[2]) {
      var inner = translate(m2[2], depth + 1);
      if (inner !== m2[2] && (fallback === null || whollyRead(inner))) return s.replace(t, m2[1] + inner + m2[3].replace(/,/g, '،').replace(/;/g, '؛'));
    }
    // A list, or a label and its text: 'Wit, Instinct', 'The Bell: The bell
    // in the tower.' One separator at a time, and every part must be known.
    for (var si = 0; si < SEPS.length; si++) {
      var items = t.split(SEPS[si]);
      if (items.length < 2) continue;
      var all2 = true, out2 = [];
      // An item may hold the separator itself ('A ledger in weights, not sums'): an unknown piece is
      // read together with the next one or two before the list is given up.
      for (var ii = 0; ii < items.length; ii++) {
        var p = items[ii];
        if (!/[A-Za-z]{2}/.test(p)) { out2.push(p); continue; }
        var tr = translate(p, depth + 1), took = 0;
        for (var more = 1; tr === p && more <= 2 && ii + more < items.length; more++) {
          var joined = items.slice(ii, ii + more + 1).join(SEPS[si]), tj = translate(joined, depth + 1);
          if (tj !== joined) { tr = tj; p = joined; took = more; }
        }
        if (tr === p) all2 = false;
        out2.push(tr);
        ii += took;
      }
      if (all2) return s.replace(t, out2.join(SEPS[si] === ', ' ? '، ' : SEPS[si] === '; ' ? '؛ ' : SEPS[si] === ' and ' ? ' و' : SEPS[si]));
    }
    // A run of known words, or two known parts: 'Hans van der Meer',
    // 'Apothecary's Boy Pauw'.
    var words = t.split(' ');
    if (words.length > 1 && words.length <= 6) {
      var all = true;
      // A number, or a count, stands as it is: 'Body 1', 'Word 2'.
      var out3 = words.map(function (w) { if (!LETTERS.test(w)) return w; if (d[w] === undefined) all = false; return pick(d[w]); });
      if (all) return s.replace(t, out3.join(' '));
      for (var w = 1; w < words.length; w++) {
        var left = words.slice(0, w).join(' '), right = words.slice(w).join(' ');
        if (d[left] !== undefined) {
          var r2 = translate(right, depth + 1);
          if (r2 !== right) return s.replace(t, pick(d[left]) + ' ' + r2);
        }
      }
    }
    if (fallback !== null) return fallback;
    return miss(s);
  }
  // Exact keys only: what a captured piece must satisfy when it spans
  // sentences, so a trailing placeholder cannot swallow the
  // sentences that follow a composed string.
  function whole(t) {
    var d = I.dicts[I.lang];
    if (d[t] !== undefined) return pick(I.fem && d[t + '#f'] !== undefined ? d[t + '#f'] : d[t]);
    var lower = I.lower[I.lang] || lowerIndex(I.lang);
    return lower[t.toLowerCase()] !== undefined ? pick(lower[t.toLowerCase()]) : null;
  }
  function matchTemplate(t, depth, strict) {
    var tpls = I.compiled[I.lang] || compile(I.lang);
    for (var i = 0; i < tpls.length; i++) {
      var m = tpls[i].re.exec(t);
      if (!m) continue;
      var ok = true;
      for (var q = 0; q < tpls[i].keys.length; q++) {
        if (/[.!?]["'”)]*\s+\S/.test(m[q + 1]) && whole(m[q + 1]) === null) ok = false;
      }
      if (!ok) continue;
      var caps = m.slice(1);
      for (var a = 0; a < caps.length - 1; a++) {
        if (!tpls[i].adj[a]) continue;
        if (translate(caps[a], depth + 1) !== caps[a] && translate(caps[a + 1], depth + 1) !== caps[a + 1]) continue;
        // Re-split the pair at every space until both halves are known.
        var pair = caps[a] + ' ' + caps[a + 1], at = -1;
        while ((at = pair.indexOf(' ', at + 1)) >= 0) {
          var l = pair.slice(0, at), r = pair.slice(at + 1);
          if (translate(l, depth + 1) !== l && translate(r, depth + 1) !== r) { caps[a] = l; caps[a + 1] = r; break; }
        }
      }
      var capOf = function (key, at) { return caps[at]; };
      var out = valueFor(tpls[i].k, tpls[i].keys, capOf), filled = true;
      var wasFem = I.fem, fem = femFor(tpls[i].keys, capOf);
      for (var j = 0; j < tpls[i].keys.length; j++) {
        I.fem = fem;
        var tc = translate(caps[j], depth + 1);
        if (strict && /[A-Za-z]{3}/.test(caps[j]) && !whollyRead(tc)) filled = false;
        out = out.split('{' + tpls[i].keys[j] + '}').join(tc);
      }
      I.fem = wasFem;
      if (!filled) continue;
      return out;
    }
    return null;
  }
  function miss(s) { return s; }
  // (A {placeholder} is a slot still to be filled, not English left behind: a key read before its values.)
  function whollyRead(r) { return !/[A-Za-z]{3}/.test(r.replace(KEEP_LATIN, '').replace(/\{\w+\}/g, '')); }
  // Words that stay in Latin letters in every language: the names of keys.
  var KEEP_LATIN = /\b(Shift|Esc|Enter|Tab|Space|Ctrl|Alt)\b/g;
  // A text that opens on a woman's name is about her ('Grete Welser, a widow. Has a key to the house for years.'):
  // its sentences read in her form.
  function translate(s, depth) {
    if (I.lang === 'en' || !s || !I.dicts[I.lang]) return s;
    var wasFem = I.fem;
    if (!wasFem) { var fw = /^([A-Z][^\s,.:;!?]+) [A-Z]/.exec(s); if (fw && isWoman(fw[1])) I.fem = true; }
    try { return translate1(s, depth); } finally { I.fem = wasFem; }
  }
  function translate1(s, depth) {
    // Read in a woman's line, a piece is kept apart from the same piece read plain.
    var ck = I.fem ? '\u2640' + s : s;
    if (I.cache[ck] !== undefined) return I.cache[ck];
    var cut = I.cutoffs, r = lookup(s, depth);
    if (I.track && depth === 0) {
      if (r === s) I.missing[s] = (I.missing[s] || 0) + 1;
      // Half translated: English words left in the answer (the keys' caps aside) are as much a leak as none.
      else if (I.lang !== 'en' && !whollyRead(r)) I.partial[s] = r;
    }
    // A string read deep inside another may have met the depth cut-off on the way: that answer is only good for
    // where it was asked, so it is not kept (else a name reached first in a long sentence stays English everywhere).
    if (depth > 0 && I.cutoffs !== cut) return r;
    if (I.cacheN > 4000) { I.cache = {}; I.cacheN = 0; }
    I.cache[ck] = r; I.cacheN++;
    return r;
  }

  // In a right-to-left paragraph a sign before a number is drawn after it ('+1' reads '1+'), and
  // 'a / b' turns about. Each such run is wrapped in invisible isolates (LRI ... PDI) so it keeps
  // its own order. A run already wrapped, or a sign that joins two numbers ('3-5'), is left be.
  var BIDI_RUN = /[+\u2212\u00b1\u00d7-] ?\d+(?:[.,]\d+)?%?|\d+(?:[.,]\d+)? ?\/ ?\d+/g;
  var LRI = '\u2066', PDI = '\u2069';
  CF.bidi = function (s) {
    if (typeof s !== 'string' || I.lang === 'en' || !CF.isRTL() || !/[+\u2212\u00b1\u00d7\/-] ?\d/.test(s)) return s;
    return s.replace(BIDI_RUN, function (m, off, all) {
      var prev = all.charAt(off - 1);
      if (prev === LRI) return m;
      if (/^[^\d]/.test(m) && /[0-9A-Za-z]/.test(prev)) return m;
      return LRI + m + PDI;
    });
  };

  // Translate a string (and fill {vars}, translating each value too).
  CF.T = function (s, vars) {
    if (s === undefined || s === null) return s;
    s = String(s);
    var d = I.lang !== 'en' && I.dicts[I.lang], out;
    // A key asked with its values: the values choose its form (a count, a woman).
    if (vars && d && d[s] !== undefined && (typeof d[s] === 'object' || d[s + '#f'] !== undefined)) out = valueFor(s, keysOf(s), function (key) { return vars[key]; });
    else out = translate(s, 0);
    if (vars) {
      var tv = {}, wasFem = I.fem;
      I.fem = d ? femFor(keysOf(s), function (key) { return vars[key]; }) : false;
      for (var k in vars) tv[k] = typeof vars[k] === 'string' ? translate(vars[k], 1) : vars[k];
      I.fem = wasFem;
      out = CF.util.fill(out, tv);
    }
    return CF.bidi(joinPrefix(out));
  };
  // An Arabic one-letter preposition stretched to meet a placeholder ('بـ{card}') joins the Arabic word that fills
  // it: 'بالفطنة', not 'بـالفطنة'. Before a number or a Latin name the stretch stays.
  var STRETCHED = /(^|[\s(«"“'])([بلك])\u0640(?=[\u0621-\u064A])/g;
  function joinPrefix(s) { return typeof s === 'string' && s.indexOf('\u0640') >= 0 ? s.replace(STRETCHED, '$1$2') : s; }
  CF.joinPrefix = joinPrefix;

  // ---- Static markup. A paragraph with only <b>/<i> inside is one unit, so
  // the translation can reorder it; anything else is walked text by text.
  // The few words on the face of a card, read off its label: a person's card
  // is their name, a token's card is what kind of token it is. A status a
  // token gained later (kept past its case, matched, read only in part, found staged) is
  // looked through, so the face says what the token is and the status is a
  // seal beside it. DOM-free, so the tests can check every face a game makes
  // has its words in each language. The table's case cards are titled by the
  // interface from their case.
  var FACE_SHORTS = [
    [/^Word from /, 'A Word'], [/^Rumour from /, 'A Rumour'], [/^Sighting: |^Seen at /, 'A Sighting'], [/^Found at .*Lodging$/, 'The Lodging'],
    [/^Found at .*House$/, 'The House'], [/^Corroborated: /, 'Corroborated'], [/^Thread: /, 'A Thread'], [/^Blood Court: /, 'The Blood Court'],
    [/^Confession Under the Question: /, 'The Question'], [/^Unanswered: /, 'Unanswered'], [/^The Hand Matched: /, 'The Hand Matched'],
  ];
  var FACE_STATUS = /^(Kept|Matched|Partial|Staged): (?=\S)/;
  var FACE_PERSONS = { witness: 1, suspect: 1, informant: 1, atlarge: 1, condemned: 1, teammate: 1, hospital: 1, injured: 1, personnel: 1 };
  CF.cardFace = function (card, label) {
    var def = (CF.CARDS && CF.CARDS[card.def]) || {}, status = [], m;
    label = String(label || '');
    while ((m = FACE_STATUS.exec(label))) { status.push(m[1]); label = label.slice(m[0].length); }
    for (var i = 0; i < FACE_SHORTS.length; i++) if (FACE_SHORTS[i][0].test(label)) return { text: FACE_SHORTS[i][1], status: status };
    var at = label.indexOf(': ');
    if (at < 0) return { text: label, status: status };
    var head = label.slice(0, at), tail = label.slice(at + 2);
    if (FACE_PERSONS[card.def]) return { text: (head === 'Prime Suspect' ? '★ ' : '') + tail, status: status, person: true };
    if (card.def === 'order' || card.def === 'personnel' || def.kind === 'calling' || card.def === 'gang') return { text: tail, status: status };
    return { text: head, status: status };
  };

  var INLINE = { B: 1, I: 1, EM: 1, STRONG: 1, BR: 1, KBD: 1 };
  var ATTRS = ['title', 'placeholder', 'aria-label'];
  function inlineOnly(el) {
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.nodeType === 3) continue;
      if (k.nodeType !== 1 || !INLINE[k.tagName] || !inlineOnly(k)) return false;
    }
    return true;
  }
  function unitOf(el) {
    if (!inlineOnly(el) || !/\S/.test(el.textContent)) return false;
    var tags = el.querySelectorAll('b,i,em,strong,kbd');
    for (var i = 0; i < tags.length; i++) if (/\S/.test(tags[i].textContent)) return true;
    return false;
  }
  I.applyDOM = function (root) {
    if (!root) return;
    walk(root);
  };
  function walk(el) {
    if (el.nodeType === 3) {
      if (el.__en === undefined) el.__en = el.nodeValue;
      var v = el.__en, t = v.trim();
      if (t) el.nodeValue = v.replace(t, CF.bidi(translate(t, 0)));
      return;
    }
    if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    if (el.hasAttribute && el.hasAttribute('data-no-i18n')) return;
    for (var a = 0; a < ATTRS.length; a++) {
      var name = ATTRS[a];
      if (!el.hasAttribute(name)) continue;
      var key = '__en_' + name;
      if (el[key] === undefined) el[key] = el.getAttribute(name);
      el.setAttribute(name, CF.bidi(translate(el[key], 0)));
    }
    if (el.tagName === 'BUTTON' && el.hasAttribute('value')) {
      if (el.__en_value === undefined) el.__en_value = el.getAttribute('value');
      el.setAttribute('value', translate(el.__en_value, 0));
    }
    if (unitOf(el)) {
      if (el.__enHTML === undefined) el.__enHTML = el.innerHTML.replace(/\s+/g, ' ').trim();
      el.innerHTML = CF.bidi(translate(el.__enHTML, 0));
      return;
    }
    var kids = Array.prototype.slice.call(el.childNodes);
    for (var i = 0; i < kids.length; i++) walk(kids[i]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
