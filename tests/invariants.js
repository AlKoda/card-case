// The card bookkeeping every state must keep: every card somewhere, verbs
// holding only live cards, nothing covering anything on the felt, and the
// desk within its office. Shared by tests/sim.test.js and tests/migrate.test.js.
//   var checkInvariants = require('./invariants.js')(CF, assert);
'use strict';
module.exports = function (CF, assert) {
  // opts.desk false: skip the desk rule (an older save may hold more cases than its office is sent today).
  return function checkInvariants(e, opts) {
    var s = e.s;
    var groups = {};
    Object.keys(s.cards).forEach(function (k) {
      var c = s.cards[k];
      assert.ok(c.loc, 'card ' + c.def + ' has no location');
      var v = c.loc.verb && s.verbs[c.loc.verb];
      if (c.loc.t === 'slot') assert.strictEqual(v.slots[c.loc.slot], c.uid, 'slot mismatch');
      if (c.loc.t === 'held') assert.ok(v.held.indexOf(c.uid) >= 0 && v.status === 'running', 'held mismatch');
      if (c.loc.t === 'out') assert.ok(v.out.indexOf(c.uid) >= 0, 'out mismatch');
      if (c.loc.t === 'table') {
        assert.ok(isFinite(c.loc.x) && isFinite(c.loc.y) && c.loc.x >= CF.TABLE.BOUNDS.x && c.loc.y >= CF.TABLE.BOUNDS.y, 'bad position');
        var pk = c.loc.x + ',' + c.loc.y;
        var key = e.stackKey(c) || ('u' + c.uid);
        assert.ok(!groups[pk] || (groups[pk] === key && e.stackKey(c)), 'two different cards share a position: ' + key + ' vs ' + groups[pk]);
        groups[pk] = key;
      }
    });
    // Nothing on the board covers anything else.
    var T = CF.TABLE, rects = [];
    Object.keys(groups).forEach(function (pk) { var xy = pk.split(','); rects.push({ x: +xy[0], y: +xy[1], w: T.CW, h: T.CH, n: 'stack ' + pk }); });
    // Verbs live in the dock, not on the felt, so only cards can overlap.
    for (var i = 0; i < rects.length; i++) for (var j = i + 1; j < rects.length; j++) {
      var a = rects[i], b = rects[j];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'overlap: ' + a.n + ' / ' + b.n);
    }
    Object.keys(s.verbs).forEach(function (id) {
      var v = s.verbs[id];
      Object.keys(v.slots).forEach(function (k) { assert.ok(s.cards[v.slots[k]], 'dangling slot ' + id + '.' + k); });
      v.held.forEach(function (u) { assert.ok(s.cards[u], 'dangling held'); });
      v.out.forEach(function (u) { assert.ok(s.cards[u], 'dangling out'); });
      // A finished verb with nothing left in it is idle, not 'Ready' and empty.
      assert.ok(!(v.status === 'done' && !v.out.length && !(v.story && v.story.keepOpen)), 'verb ' + id + ' is done with nothing in it');
    });
    // Every spawn site honours the rank's desk: at most one case over it (a warned case, an old case opened again).
    var ordinary = e.openCases().filter(function (r) { return !r.special; }).length;
    if (!(opts && opts.desk === false)) assert.ok(ordinary <= e.maxOpenCases() + 1, ordinary + ' ordinary cases open with a desk for ' + e.maxOpenCases());
  };
};
