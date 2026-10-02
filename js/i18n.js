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
    ar: { name: 'العربية', dir: 'rtl', fonts: 'css/fonts-ar.css' },
  };

  var I = (CF.I18N = { lang: 'en', dicts: {}, compiled: {}, lower: {}, cache: {}, cacheN: 0, cutoffs: 0, missing: {}, track: false });

  CF.addStrings = function (lang, map) {
    var d = I.dicts[lang] || (I.dicts[lang] = {});
    for (var k in map) d[k] = map[k];
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

  function lowerIndex(lang) {
    var d = I.dicts[lang], out = {};
    for (var k in d) out[k.toLowerCase()] = d[k];
    return (I.lower[lang] = out);
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Keys with {placeholders} become anchored patterns; the ones with the
  // most literal text are tried first so 'Witness in: {t}' beats '{t}'.
  function compile(lang) {
    var d = I.dicts[lang], list = [];
    for (var k in d) {
      if (k.indexOf('{') < 0) continue;
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
          return '([\\s\\S]+?)';
        }
        lit += part.length;
        return escapeRe(part);
      }).join('');
      if (!keys.length || !/[A-Za-z]{3}/.test(k.replace(/\{\w+\}/g, ''))) continue;
      list.push({ re: new RegExp('^' + src + '$'), keys: keys, tail: tail, adj: adj, out: d[k], lit: lit });
    }
    list.sort(function (a, b) { return b.lit - a.lit; });
    return (I.compiled[lang] = list);
  }

  var LETTERS = /[A-Za-z]/;
  var SEPS = [' · ', ' / ', '; ', ', ', ' and '];

  function lookup(s, depth) {
    var d = I.dicts[I.lang];
    if (d[s] !== undefined) return d[s];
    var t = s.trim();
    if (!t || !LETTERS.test(t)) return s;
    if (t !== s && d[t] !== undefined) return s.replace(t, d[t]);
    // 'the clerk of the court' for a label the code lower-cased.
    var lower = I.lower[I.lang] || lowerIndex(I.lang), lk = lower[t.toLowerCase()];
    if (lk !== undefined) return s.replace(t, lk);
    if (depth > 5) { I.cutoffs++; return miss(s); }
    var viaTpl = matchTemplate(t, depth);
    if (viaTpl !== null) return t === s ? viaTpl : s.replace(t, viaTpl);
    // A parenthesis in front: '(The Market) The crier has sung it.'
    var par = /^\(([^()]+)\)\s+([\s\S]+)$/.exec(t);
    if (par) {
      var a = translate(par[1], depth + 1), b2 = translate(par[2], depth + 1);
      if (a !== par[1] || b2 !== par[2]) return s.replace(t, '(' + a + ') ' + b2);
    }
    // A symbol in front of a known string: '★ The Body at the Crane'.
    var sym = /^([^A-Za-z{(]+)([\s\S]+)$/.exec(t);
    if (sym && LETTERS.test(sym[2])) {
      var body = translate(sym[2], depth + 1);
      if (body !== sym[2]) return s.replace(t, sym[1].replace(/,/g, '،').replace(/;/g, '؛') + body);
    }
    // 'Label: the text' (the text may have colons of its own).
    var colon = t.indexOf(': ');
    if (colon > 0 && colon < 60 && /[A-Za-z]{2}/.test(t.slice(0, colon))) {
      var lab = translate(t.slice(0, colon), depth + 1), txt = translate(t.slice(colon + 2), depth + 1);
      if (lab !== t.slice(0, colon) && txt !== t.slice(colon + 2)) return s.replace(t, lab + ': ' + txt);
    }
    // The longest opening run of sentences that is one known text (a case's
    // brief, a story beat), then whatever follows it.
    var bre = /[.!?]["'”)]*\s+/g, cuts = [], bm;
    while ((bm = bre.exec(t))) cuts.push(bm.index + bm[0].length);
    for (var ci = cuts.length - 1; ci >= 0; ci--) {
      var head = t.slice(0, cuts[ci]).replace(/\s+$/, ''), gap = t.slice(head.length, cuts[ci]), rest = t.slice(cuts[ci]);
      var hd = whole(head);
      if (hd === null) hd = matchTemplate(head, depth + 1);
      if (hd === null) continue;
      return s.replace(t, hd + gap + translate(rest, depth + 1));
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
    // A list, or a label and its text: 'Wit, Instinct', 'The Bell: The bell
    // in the tower.' One separator at a time, and every part must be known.
    for (var si = 0; si < SEPS.length; si++) {
      var items = t.split(SEPS[si]);
      if (items.length < 2) continue;
      var all2 = true;
      var out2 = items.map(function (p) {
        if (!/[A-Za-z]{2}/.test(p)) return p;
        var tr = translate(p, depth + 1);
        if (tr === p) all2 = false;
        return tr;
      });
      if (all2) return s.replace(t, out2.join(SEPS[si] === ', ' ? '، ' : SEPS[si] === '; ' ? '؛ ' : SEPS[si] === ' and ' ? ' و' : SEPS[si]));
    }
    // A run of known words, or two known parts: 'Hans van der Meer',
    // 'Apothecary's Boy Pauw'.
    var words = t.split(' ');
    if (words.length > 1 && words.length <= 6) {
      var all = true;
      // A number, or a count, stands as it is: 'Body 1', 'Word 2'.
      var out3 = words.map(function (w) { if (!LETTERS.test(w)) return w; if (d[w] === undefined) all = false; return d[w]; });
      if (all) return s.replace(t, out3.join(' '));
      for (var w = 1; w < words.length; w++) {
        var left = words.slice(0, w).join(' '), right = words.slice(w).join(' ');
        if (d[left] !== undefined) {
          var r2 = translate(right, depth + 1);
          if (r2 !== right) return s.replace(t, d[left] + ' ' + r2);
        }
      }
    }
    return miss(s);
  }
  // Exact keys only: what a captured piece must satisfy when it spans
  // sentences, so a trailing placeholder cannot swallow the
  // sentences that follow a composed string.
  function whole(t) {
    var d = I.dicts[I.lang];
    if (d[t] !== undefined) return d[t];
    var lower = I.lower[I.lang] || lowerIndex(I.lang);
    return lower[t.toLowerCase()] !== undefined ? lower[t.toLowerCase()] : null;
  }
  function matchTemplate(t, depth) {
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
      var out = tpls[i].out;
      for (var j = 0; j < tpls[i].keys.length; j++) out = out.split('{' + tpls[i].keys[j] + '}').join(translate(caps[j], depth + 1));
      return out;
    }
    return null;
  }
  function miss(s) { return s; }
  function translate(s, depth) {
    if (I.lang === 'en' || !s || !I.dicts[I.lang]) return s;
    if (I.cache[s] !== undefined) return I.cache[s];
    var cut = I.cutoffs, r = lookup(s, depth);
    if (I.track && depth === 0 && r === s) I.missing[s] = (I.missing[s] || 0) + 1;
    // A string read deep inside another may have met the depth cut-off on the way: that answer is only good for
    // where it was asked, so it is not kept (else a name reached first in a long sentence stays English everywhere).
    if (depth > 0 && I.cutoffs !== cut) return r;
    if (I.cacheN > 4000) { I.cache = {}; I.cacheN = 0; }
    I.cache[s] = r; I.cacheN++;
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
    var out = translate(String(s), 0);
    if (vars) {
      var tv = {};
      for (var k in vars) tv[k] = typeof vars[k] === 'string' ? translate(vars[k], 1) : vars[k];
      out = CF.util.fill(out, tv);
    }
    return CF.bidi(out);
  };

  // ---- Static markup. A paragraph with only <b>/<i> inside is one unit, so
  // the translation can reorder it; anything else is walked text by text.
  // The few words on the face of a card, read off its label: a person's card
  // is their name, a token's card is what kind of token it is. A status a
  // token gained later (kept past its case, matched, read only in part) is
  // looked through, so the face says what the token is and the status is a
  // seal beside it. DOM-free, so the tests can check every face a game makes
  // has its words in each language. The table's case cards are titled by the
  // interface from their case.
  var FACE_SHORTS = [
    [/^Word from /, 'A Word'], [/^Rumour from /, 'A Rumour'], [/^Sighting: |^Seen at /, 'A Sighting'], [/^Found at .*Lodging$/, 'The Lodging'],
    [/^Found at .*House$/, 'The House'], [/^Corroborated: /, 'Corroborated'], [/^Thread: /, 'A Thread'], [/^Blood Court: /, 'The Blood Court'],
    [/^Confession Under the Question: /, 'The Question'], [/^Unanswered: /, 'Unanswered'], [/^The Hand Matched: /, 'The Hand Matched'],
  ];
  var FACE_STATUS = /^(Kept|Matched|Partial): (?=\S)/;
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
