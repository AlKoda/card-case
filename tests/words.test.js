// The verbs were renamed (Contemplate is Rest, Interrogate is Question,
// Investigate is Explore, Analyze is Study). No text the player can read
// may still use an old name. Comments are skipped; the Arabic dictionaries
// are skipped too, since their keys are the English of the code as it was.
// Run: node tests/words.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var OLD = /\b(Contemplate|Interrogate|Investigate|Analyze)\b/;

function listJs(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'lang') listJs(p, out); }
    else if (/\.js$/.test(f)) out.push(p);
  });
  return out;
}

// Every string literal in a source file, with comments and regex literals skipped.
function literals(src) {
  var out = [], i = 0, n = src.length, last = '';
  while (i < n) {
    var ch = src[i];
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (ch === "'" || ch === '"') {
      var j = i + 1, buf = '';
      while (j < n && src[j] !== ch) { if (src[j] === '\\') { buf += src[j + 1]; j += 2; } else buf += src[j++]; }
      out.push(buf); i = j + 1; last = ch; continue;
    }
    if (ch === '/' && /^[(,=:\[!&|?{};+\-*%<>~^]$|^$/.test(last)) {
      // A regex literal: skip to its closing slash, minding classes and escapes.
      var k = i + 1, cls = false;
      while (k < n && (cls || src[k] !== '/') && src[k] !== '\n') { if (src[k] === '\\') k++; else if (src[k] === '[') cls = true; else if (src[k] === ']') cls = false; k++; }
      i = k + 1; last = '/'; continue;
    }
    if (!/\s/.test(ch)) last = ch;
    i++;
  }
  return out;
}

var root = path.join(__dirname, '..', 'js');
var bad = [];
listJs(root, []).forEach(function (f) {
  literals(fs.readFileSync(f, 'utf8')).forEach(function (s) {
    if (OLD.test(s)) bad.push(path.relative(path.join(__dirname, '..'), f) + ': ' + JSON.stringify(s));
  });
});
assert.deepStrictEqual(bad, [], 'old verb names in player text:\n' + bad.join('\n'));

// The scanner itself: comments and regexes are skipped, strings are read.
var probe = literals("var a = 'Contemplate x'; // Investigate\n/* Analyze */ var r = /Interrogate/; var b = \"Rest\"; var c = x / y / 'z';");
assert.deepStrictEqual(probe, ['Contemplate x', 'Rest', 'z']);
console.log('words: no old verb names in player text');
