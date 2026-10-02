// Saves written by earlier releases (tests/fixtures/saves, made by
// tests/fixtures/make_fixture.js from that commit's engine) still load, keep
// their bookkeeping, answer any question they hold open, play on, and save
// and load again unchanged. Each round adds the previous head's saves.
// Run: node tests/migrate.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');

// The bot loads the engine into this context and hands back its step.
var BOT = require('./bot.test.js');
var CF = globalThis.CF;
console.error = function (err) { throw err; };
var checkInvariants = require('./invariants.js')(CF, assert);

var dir = path.join(__dirname, 'fixtures', 'saves');
var files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).sort();
assert.ok(files.length >= 8, 'a set of old saves: ' + files.length);
var TEMPERS = ['custom', 'merciful', 'brutal', 'corrupt'];
var seen = {};
files.forEach(function (f, i) {
  var fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  assert.ok(fx.from && fx.scenario && fx.save && fx.save.cards, f + ' is a fixture');
  seen[fx.scenario] = true;
  var e = CF.Engine.load(JSON.stringify(fx.save));
  // An older release sent more cases than an office is sent today: the desk rule holds once they are answered.
  checkInvariants(e, { desk: false });
  // A question held open: what the window shows is what the engine answers, and one answer is always payable.
  if (e.s.choice) {
    var spec = CF.CHOICES.filter(function (c) { return c.id === e.s.choice.id; })[0];
    assert.ok(spec, f + ': the question is still one the city asks');
    assert.strictEqual(e.s.choice.options.length, spec.options.length, f + ': every answer shown');
    var payable = e.s.choice.options.map(function (o, k) { return e.canChoose(k); });
    assert.ok(payable.some(Boolean), f + ': at least one answer can be given');
    assert.ok(e.s.choice.options.every(function (o, k) { return o.label === spec.options[k].label; }), f + ': the answers in the city\'s own order');
  }
  if (fx.scenario === 'swan') assert.ok(e.s.choice && e.s.choice.id === 'swan' && e.canChoose(2) && !e.canChoose(0), f + ': no Coin for the room, and the desk is free');
  if (fx.scenario === 'opening' || fx.scenario === 'sergeant') assert.ok(e.s.flags.opening, f + ': the opening goes on');
  if (fx.scenario === 'wrongful') assert.ok(Object.keys(e.s.criminals).some(function (k) { var c = e.s.criminals[k]; return c.hidden && c.wrongfulTitle && c.wrongSex !== undefined; }), f + ': the hidden name, with the new field defaulted');
  // It plays on.
  var w0 = e.s.week;
  BOT.play(e, 600, TEMPERS[i % TEMPERS.length]);
  checkInvariants(e, { desk: e.openCases().filter(function (r) { return !r.special && r.week >= w0; }).length === e.openCases().filter(function (r) { return !r.special; }).length });
  assert.ok(e.s.over || e.s.week > w0 || e.s.flags.opening, f + ': the clock moves');
  // And saves and loads again unchanged.
  var j1 = e.save(), j2 = CF.Engine.load(j1).save();
  assert.strictEqual(j2, j1, f + ': load(save()) round-trips');
  console.log(f + ': ok (' + fx.note + '; week ' + w0 + ' to ' + e.s.week + (e.s.over ? ', ' + e.s.over.id : '') + ')');
});
['opening', 'sergeant', 'ask', 'swan', 'pawnbroker', 'syndicate', 'band', 'cold', 'wrongful'].forEach(function (k) { assert.ok(seen[k], 'a fixture for ' + k); });
console.log('migrate: ' + files.length + ' old saves load, answer, play and round-trip');
