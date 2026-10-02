// The house terms, held: every Arabic entry whose English key names one of these offices, places or things
// carries the glossary's rendering of it (by its stem, so the article and the suffixes may change).
// Run: node tools/i18n_glossary.js -> the entries that drift, or nothing. tests/i18n.test.js runs it.
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');

// [the English term, the stem its Arabic rendering always carries]
var TERMS = [
  [/\bExaminer\b/, 'محقق'], [/\bDominican\b/, 'دومينيكيّ'], [/\bInquisitor\b/, 'المفتّش'], [/\bBailiff\b/, 'رئيس الحرس'],
  [/\bCoquille\b/, 'كوكي'], [/\bBlood Court\b/, 'محكمة الدم'], [/\bRival\b/, 'غريم'], [/\bFever\b/, 'حمّى'],
  [/\bBurgomaster\b/, 'عمدة'], [/\bMagistrate\b/, 'الحاكم'], [/\bThe Bell\b/, 'الجرس'], [/\bProvost\b/, 'الوالي'],
  [/\bHarbourmaster\b/, 'رئيس الميناء'], [/\bthe Rolls\b/i, 'السجلات'], [/\bCarolina\b/, 'كارولينا'],
];

function drift(lang) {
  lang = lang || 'ar';
  if (!globalThis.CF || !globalThis.CF.addStrings) {
    globalThis.window = globalThis;
    ['js/util.js', 'js/i18n.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); });
  }
  var dir = path.join(root, 'js/lang', lang);
  fs.readdirSync(dir).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); });
  var d = globalThis.CF.I18N.dicts[lang] || {}, out = [];
  Object.keys(d).forEach(function (k) {
    // A value in forms by count (js/i18n.js) holds the term in every form.
    var forms = typeof d[k] === 'object' ? Object.keys(d[k]).map(function (f) { return d[k][f]; }) : [d[k]];
    TERMS.forEach(function (t) {
      if (!t[0].test(k.replace(/#f$/, ''))) return;
      forms.forEach(function (v) { if (v.indexOf(t[1]) < 0) out.push({ key: k, term: String(t[0]), want: t[1], got: v }); });
    });
  });
  return out;
}
module.exports = { drift: drift, TERMS: TERMS };
if (require.main === module) {
  var r = drift(process.argv[2]);
  r.forEach(function (x) { process.stdout.write(x.term + ' wants ' + x.want + ':\n  ' + x.key + '\n  ' + x.got + '\n'); });
  process.exitCode = r.length ? 1 : 0;
}
