// Lists every English string the game can show, grouped by the file that
// defines it, so a language file can be written or checked against it.
//   node tools/i18n_extract.js            -> JSON on stdout { file: [keys] }
//   node tools/i18n_extract.js --missing ar -> the keys js/lang/ar has no entry for
// Data strings are found by walking CF after each script loads; strings that
// only exist in code (journal entries, toasts) are found as literals in the
// source, and the ones built from pieces need a {placeholder} key written
// by hand (see js/i18n.js).
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');

var SCRIPTS = ['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'];
var CODE = ['js/engine.js', 'js/ui.js', 'js/screens.js', 'js/main.js', 'js/core/recipes.js', 'js/data/recipes.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/data/story.js', 'js/data/cases.js'];

// Text meant for the player: has letters and either a space or a capital.
function isText(s) {
  if (typeof s !== 'string' || s.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_\-.:/#]+$/.test(s)) return false;          // keys, ids, art names
  if (/^#[0-9a-f]{3,8}$/i.test(s) || /^var\(|^url\(|^[a-z-]+\(/.test(s)) return false;
  if (/^(n|icon-|medal-|plate-|dlg-)[a-z0-9-]+$/.test(s)) return false;
  if (!/\s/.test(s) && !/^[A-Z]/.test(s)) return false;
  return true;
}
// A string literal in the code: 'key' (a whole thing the player reads), 'fragment' (a piece of a built sentence,
// which needs a {placeholder} key by hand) or 'skip' (not text at all).
function literalKind(s) {
  if (!isText(s)) return 'skip';
  if (!/\s/.test(s) && !/^[A-Z][a-z]+$/.test(s)) return 'skip';
  if (/^(BUTTON|SELECT|TEXTAREA|A)$|^[A-Z][a-z]+(Sans|Serif|Prime|One|English)/.test(s)) return 'skip';
  // A lowercase start is usually a piece of a built sentence ('the {who} says'), but a run of three words or more
  // that ends on a stop is a whole sentence the player reads ('or drop a card on the token. ... finds less.').
  var sentence = /^[a-z][\s\S]*\s\S+\s\S+[.!?]$/.test(s) && !/[<>="{}]/.test(s);
  if (/[<>="]|^[#.)%,:;]|^\s|\s$/.test(s) || (/^[a-z]/.test(s) && !sentence) || !/[A-Za-z]{2}.*[A-Za-z]/.test(s)) return 'fragment';
  return 'key';
}
function walk(v, out, seen, depth) {
  if (depth > 12 || v === null) return;
  if (typeof v === 'string') { if (isText(v)) out[v] = 1; return; }
  if (typeof v !== 'object') return;
  if (seen.indexOf(v) >= 0) return;
  seen.push(v);
  if (Array.isArray(v)) { v.forEach(function (x) { walk(x, out, seen, depth + 1); }); return; }
  for (var k in v) if (k !== 'accepts' && k !== 'tags' && k !== 'traits') walk(v[k], out, seen, depth + 1);
}

var byFile = {}, all = {}, fragments = {};
var before = {};
SCRIPTS.forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  var CF = globalThis.CF, found = {};
  Object.keys(CF).forEach(function (k) {
    if (before[k]) return;
    if (typeof CF[k] === 'function' && k !== 'Engine') return;
    walk(k === 'Engine' ? CF.Engine.prototype : CF[k], found, [], 0);
  });
  Object.keys(CF).forEach(function (k) { before[k] = true; });
  var keys = Object.keys(found).filter(function (s) { return !all[s]; });
  keys.forEach(function (s) { all[s] = 1; });
  if (keys.length) byFile[f] = keys;
});
// Add the strings the CF.Engine methods and other code keep in literals.
CODE.forEach(function (f) {
  var src = fs.readFileSync(path.join(root, f), 'utf8');
  var re = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"/g, m, keys = [], frags = [];
  while ((m = re.exec(src))) {
    var s = (m[1] !== undefined ? m[1] : m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (all[s]) continue;
    var kind = literalKind(s);
    if (kind === 'skip') continue;
    if (kind === 'fragment') { frags.push(s); continue; }
    all[s] = 1; keys.push(s);
  }
  if (keys.length) byFile[f] = (byFile[f] || []).concat(keys);
  if (frags.length) fragments[f] = frags;
});
// The page's own words: paragraphs with only <b>/<i> inside are one unit.
(function html() {
  var src = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  var keys = [];
  var decode = function (t) { return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); };
  var attr = /\s(?:title|placeholder|aria-label)="([^"]+)"/g, m;
  while ((m = attr.exec(src))) { var av = decode(m[1]); if (isText(av) && !all[av]) { all[av] = 1; keys.push(av); } }
  var unit = /<(p|h[1-6]|label|button|span|option|div)[^>]*>([^<]*(?:<(?:b|i|em|strong|kbd)>[^<]*<\/(?:b|i|em|strong|kbd)>[^<]*)*)<\/\1>/g;
  var rest = src.replace(unit, function (whole, tag, inner) {
    var t = inner.replace(/\s+/g, ' ').trim();
    if (t.indexOf('<') < 0) t = decode(t); // a text node; innerHTML keeps entities only around tags
    if (!t || /data-no-i18n/.test(whole)) return whole;
    if (isText(t) && !all[t]) { all[t] = 1; keys.push(t); }
    return '<' + tag + '></' + tag + '>';
  });
  src = rest;
  var text = />([^<>{}]+)</g;
  while ((m = text.exec(src))) { var t2 = decode(m[1].replace(/\s+/g, ' ').trim()); if (isText(t2) && !all[t2] && /^[A-Z]/.test(t2)) { all[t2] = 1; keys.push(t2); } }
  byFile['index.html'] = keys;
})();

function missing(lang) {
  var dir = path.join(root, 'js/lang', lang);
  if (fs.existsSync(dir)) fs.readdirSync(dir).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); });
  var d = globalThis.CF.I18N.dicts[lang] || {}, miss = {}, n = 0, total = 0;
  Object.keys(byFile).forEach(function (f) {
    var m2 = byFile[f].filter(function (k) { total++; return d[k] === undefined; });
    if (m2.length) { miss[f] = m2; n += m2.length; }
  });
  return { missing: miss, count: n, total: total };
}
module.exports = { keys: byFile, fragments: fragments, missing: missing, literalKind: literalKind };
if (require.main === module) cli();
function cli() {
var args = process.argv.slice(2);
if (args[0] === '--fragments') process.stdout.write(JSON.stringify(fragments, null, 1) + '\n');
else if (args[0] === '--missing') {
  var lang = args[1] || 'ar', r = missing(lang);
  process.stdout.write(JSON.stringify(r.missing, null, 1) + '\n');
  process.stderr.write(r.count + ' of ' + r.total + ' strings have no ' + lang + ' entry\n');
} else process.stdout.write(JSON.stringify(byFile, null, 1) + '\n');
}
