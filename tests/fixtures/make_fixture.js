// Writes save fixtures from any commit's engine, for tests/migrate.test.js.
// Each round adds the previous head's saves, so old saves keep loading.
//   node tests/fixtures/make_fixture.js <commit or engine directory> [label]
// A commit is unpacked with `git archive` (js/ and tests/ only) into a
// temporary directory. The saves are written to tests/fixtures/saves as
// <label>-<scenario>.json: { from, scenario, note, save }.
'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var FILES = ['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'];
var REPO = path.join(__dirname, '..', '..');

// The engine and the bot of `root`, in a context of their own.
function engineAt(root) {
  var ctx = { console: console, Math: Math, JSON: JSON, Date: Date };
  ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  FILES.forEach(function (f) { var p = path.join(root, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p }); });
  var bot = fs.readFileSync(path.join(root, 'tests/bot.test.js'), 'utf8');
  bot = bot.replace(/^[\s\S]*?var CF = globalThis.CF;/, 'var CF = globalThis.CF; var assert = function () {}; assert.ok = function () {}; assert.strictEqual = function () {};')
    .replace(/module\.exports = ([^\n]*)\nif \(require\.main !== module\) return;[\s\S]*$/, 'globalThis.BOT = $1');
  vm.runInContext(bot, ctx, { filename: 'bot' });
  return ctx;
}

function play(G, e, ticks, temper, until) {
  for (var t = 0; t < ticks && !e.s.over; t++) { if (until && until(e)) return true; G.BOT.step(e, temper); e.tick(1); }
  return !!(until && until(e));
}
function spec(G, id) { return G.CF.CHOICES.filter(function (c) { return c.id === id; })[0]; }
function life(G, seed, calling) { return G.CF.Engine.newGame({ seed: seed, calling: calling || 'master', life: true }); }
// Three thieves abroad, found by each other: a band with sworn members.
function band(G, e, tag) {
  for (var i = 0; i < 3; i++) {
    var name = 'Sworn ' + tag + i;
    var c = e.criminalEscapes({ title: 'an old case', template: 'burglary' }, { name: name, trait: 'limp' }, 'cold');
    c.traits = [];
    e.create('atlarge', { label: 'At Large: ' + name, data: { name: name, trait: 'limp', criminalId: c.id } });
  }
  e.organise();
}

// The scenarios: each returns { e, note } or null when the engine cannot make it.
var SCENARIOS = {
  opening: function (G) {
    var e = G.CF.Engine.newGame({ seed: 81, who: 'clerk', name: 'Fixture', opening: true, guided: true });
    play(G, e, 40, 'custom');
    return { e: e, note: 'the opening, part-way' };
  },
  sergeant: function (G) {
    var e = G.CF.Engine.newGame({ seed: 82, who: 'soldier', name: 'Fixture', opening: true, guided: true });
    play(G, e, 400, 'custom', function (g) { return g.s.flags.stage === 'questioned' || g.s.flags.stage === 'hired'; });
    return { e: e, note: 'the opening, the sergeant\'s questions (stage ' + e.s.flags.stage + ')' };
  },
  ask: function (G) {
    var e = life(G, 83, 'commissioner');
    var open = function (g) { return Object.keys(g.s.verbs).some(function (k) { var v = g.s.verbs[k]; return v.status === 'running' && v.ask && !v.ask.filled; }); };
    play(G, e, 3000, 'custom', open);
    return open(e) ? { e: e, note: 'a verb running, its ask open' } : null;
  },
  swan: function (G) {
    var e = life(G, 84, 'master');
    play(G, e, 300, 'merciful');
    if (e.s.choice) e.s.choice = null;
    e.cardsOf('funds', true).forEach(function (c) { e.remove(c); });
    e.create('fatigue');
    e.offerChoice(spec(G, 'swan'));
    return { e: e, note: 'the room at the Swan, asked with no Coin' };
  },
  pawnbroker: function (G) {
    var e = life(G, 85, 'crusader');
    play(G, e, 900, 'brutal');
    if (e.s.over) return null;
    if (e.s.choice) e.s.choice = null;
    var rec = e.openCases().filter(function (r) { return !r.identified; })[0];
    if (!rec) return null;
    e.offerChoice(spec(G, 'pawnbroker'), { caseId: rec.id });
    return { e: e, note: 'a question a verb invited, about an open case' };
  },
  syndicate: function (G) {
    var e = life(G, 86, 'crusader');
    play(G, e, 600, 'corrupt');
    if (e.s.over) return null;
    band(G, e, 'A'); band(G, e, 'B'); e.organise();
    return e.cardsOf('syndicate', true).length ? { e: e, note: 'two bands become the Coquille' } : null;
  },
  band: function (G) {
    var e = life(G, 87, 'commissioner');
    play(G, e, 600, 'custom');
    if (e.s.over) return null;
    band(G, e, 'C');
    return e.cardsOf('gang', true).length ? { e: e, note: 'a band with sworn members' } : null;
  },
  cold: function (G) {
    var e = life(G, 88, 'master');
    play(G, e, 200, 'custom');
    var rec = e.openCases()[0];
    if (!rec) return null;
    rec.searches = Math.max(1, rec.searches || 0);
    e.goCold(rec.id);
    return e.cardsOf('coldcase', true).length ? { e: e, note: 'an unanswered case, its book kept' } : null;
  },
  wrongful: function (G) {
    var e = life(G, 89, 'master');
    play(G, e, 600, 'brutal');
    if (e.s.over) return null;
    var rec = e.openCases()[0];
    if (!rec || !e.hideCriminal) return null;
    var cul = rec.suspects.filter(function (x) { return x.guilty; })[0], wrong = rec.suspects.filter(function (x) { return !x.guilty; })[0];
    var c = e.criminalEscapes(rec, cul, 'wrongful');
    e.hideCriminal(c, rec, 'rope', wrong.alibi, wrong);
    return { e: e, note: 'a wrong name hanged, the culprit hidden' };
  },
  late: function (G) {
    for (var seed = 90; seed < 100; seed++) {
      var e = life(G, seed, 'commissioner');
      play(G, e, 1500, 'custom');
      if (!e.s.over) return { e: e, note: 'a longer game, week ' + e.s.week + ', rank ' + e.s.rank };
    }
    return null;
  },
};

function main() {
  var src = process.argv[2] || REPO, label = process.argv[3], root = src, tmp = null;
  var only = (process.argv[4] || '').split(',').filter(Boolean);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-'));
    cp.execSync('git -C ' + JSON.stringify(REPO) + ' archive ' + src + ' js tests | tar -x -C ' + JSON.stringify(tmp));
    root = tmp;
    label = label || src.slice(0, 7);
  }
  label = label || 'head';
  var G = engineAt(root), out = path.join(__dirname, 'saves');
  if (!fs.existsSync(out)) fs.mkdirSync(out);
  Object.keys(SCENARIOS).forEach(function (name) {
    if (only.length && only.indexOf(name) < 0) return;
    var r;
    try { r = SCENARIOS[name](G); } catch (err) { console.log(label + '-' + name + ': not made (' + err.message + ')'); return; }
    if (!r) { console.log(label + '-' + name + ': not made'); return; }
    var file = path.join(out, label + '-' + name + '.json');
    fs.writeFileSync(file, JSON.stringify({ from: label, scenario: name, note: r.note, save: JSON.parse(r.e.save()) }) + '\n');
    console.log(path.relative(REPO, file) + ': ' + r.note + ' (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
  });
  if (tmp) cp.execSync('rm -rf ' + JSON.stringify(tmp));
}
main();
