// Which Candlemark tiles the game refers to. Scans js/**/*.js, css/style.css
// and index.html for the keys defined in css/art/cm-*.css (and cm-spare.css)
// and writes the used ones to tools/art_used.txt, one key a line.
// tools/build_cm_art.py --used reads that list and puts every other tile in
// css/art/cm-spare.css, which the page does not load.
//   node tools/art_used.js            -> writes tools/art_used.txt, prints a tally
//   require('./art_used.js').scan()   -> { defined: {key: file}, used: [keys], refs: {key: true} }
// A key is used when it appears whole in the sources ('cwax-01', --art-cwax-01),
// or when its family is built by a prefix ('cnum-' + n): then the whole family is.
'use strict';
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');

function listJs(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) listJs(p, out);
    else if (/\.js$/.test(f)) out.push(p);
  });
  return out;
}

function scan() {
  var defined = {};
  fs.readdirSync(path.join(root, 'css/art')).forEach(function (f) {
    if (!/^cm-.*\.css$/.test(f)) return;
    var src = fs.readFileSync(path.join(root, 'css/art', f), 'utf8'), re = /--art-([a-z0-9-]+):/g, m;
    while ((m = re.exec(src))) defined[m[1]] = f;
  });
  var sources = listJs(path.join(root, 'js'), []).concat([path.join(root, 'css/style.css'), path.join(root, 'index.html')]);
  var corpus = sources.map(function (p) { return fs.readFileSync(p, 'utf8'); }).join('\n');
  // Whole keys ('cwax-01', --art-cvtok-time), and families named by a quoted prefix ('cwaxn-' + n).
  var families = {}, pre = /['"]([a-z][a-z0-9]*)-['"]\s*\+/g, m;
  while ((m = pre.exec(corpus))) families[m[1]] = true;
  function whole(k) { return new RegExp('(^|[^a-z0-9_-]|art-)' + k.replace(/-/g, '\\-') + '(?![a-z0-9_-])').test(corpus); }
  var refs = {};
  Object.keys(defined).forEach(function (k) { if (whole(k)) refs[k] = true; });
  var used = Object.keys(defined).filter(function (k) { return refs[k] || families[k.replace(/-[^-]+$/, '')]; }).sort();
  return { defined: defined, used: used, refs: refs, families: Object.keys(families) };
}

module.exports = { scan: scan, file: path.join(root, 'tools/art_used.txt') };

if (require.main === module) {
  var r = scan();
  fs.writeFileSync(module.exports.file, r.used.join('\n') + '\n');
  var all = Object.keys(r.defined).length, byFam = {};
  Object.keys(r.defined).forEach(function (k) { var f = k.replace(/-\d+$/, ''); byFam[f] = byFam[f] || [0, 0]; byFam[f][0]++; if (r.used.indexOf(k) >= 0) byFam[f][1]++; });
  console.log(r.used.length + ' of ' + all + ' tiles are used; by family (used/all): ' + Object.keys(byFam).sort().map(function (f) { return f + ' ' + byFam[f][1] + '/' + byFam[f][0]; }).join(', '));
}
