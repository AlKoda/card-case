// The table's words, read off the state: the hint gives a finished verb and an
// unanswered ask precedence over the lesson, the advisor speaks to a waiting
// choice, the opening prose is replayed on a new game, the dossier names the
// accused's mark and what a charge still lacks, the ask box says what ignoring
// costs, the verdict stamps the card it was given on, and the Help lists where proof comes
// from. js/ui.js is run under Node on a small stand-in for the DOM.
// Run: node tests/ui.test.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

// ---- A stand-in DOM: elements that remember their classes, text and children.
function El(tag) {
  this.tagName = (tag || 'div').toUpperCase();
  this.children = []; this.parentNode = null; this.className = ''; this.dataset = {}; this.title = '';
  this._text = ''; this._html = ''; this.listeners = {};
  var self = this;
  this.style = { setProperty: function (k, v) { self.style[k] = v; }, removeProperty: function (k) { delete self.style[k]; } };
  this.classList = {
    add: function () { for (var i = 0; i < arguments.length; i++) if (!self.classList.contains(arguments[i])) self.className = (self.className + ' ' + arguments[i]).trim(); },
    remove: function () { for (var i = 0; i < arguments.length; i++) { var c = arguments[i]; self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); } },
    toggle: function (c, on) { var has = self.classList.contains(c); if (on === undefined) on = !has; if (on && !has) self.classList.add(c); if (!on && has) self.classList.remove(c); return on; },
    contains: function (c) { return self.className.split(/\s+/).indexOf(c) >= 0; },
  };
}
El.prototype.appendChild = function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; };
El.prototype.insertBefore = function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; var i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; };
El.prototype.removeChild = function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; };
El.prototype.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
El.prototype.insertAdjacentElement = function (where, el) { if (!this.parentNode) return el; if (where === 'afterend') { var i = this.parentNode.children.indexOf(this); this.parentNode.children.splice(i + 1, 0, el); el.parentNode = this.parentNode; } else this.parentNode.appendChild(el); return el; };
El.prototype.insertAdjacentHTML = function (where, html) { this._html += html; parseHTML(this, html); };
El.prototype.addEventListener = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
El.prototype.removeEventListener = function () {};
El.prototype.click = function () { (this.listeners.click || []).forEach(function (fn) { fn({ target: this, stopPropagation: function () {}, preventDefault: function () {} }); }, this); };
El.prototype.setAttribute = function (k, v) { this[k] = v; };
El.prototype.getAttribute = function (k) { return this[k]; };
El.prototype.removeAttribute = function (k) { delete this[k]; };
El.prototype.hasAttribute = function (k) { return this[k] !== undefined; };
El.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }; };
El.prototype.contains = function (c) { while (c) { if (c === this) return true; c = c.parentNode; } return false; };
El.prototype.closest = function () { return null; };
El.prototype.focus = function () {};
El.prototype.all = function (out) { out = out || []; this.children.forEach(function (c) { out.push(c); c.all(out); }); return out; };
function matches(el, sel) {
  var m = /^([a-z][a-z0-9]*)?(?:#([\w-]+))?((?:\.[\w-]+)*)(?:\[([\w-]+)(?:=([^\]]+))?\])?$/.exec(sel.trim());
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  if (m[2] && el.id !== m[2]) return false;
  var classes = m[3] ? m[3].split('.').filter(Boolean) : [];
  for (var i = 0; i < classes.length; i++) if (!el.classList.contains(classes[i])) return false;
  if (m[4]) { var key = m[4].replace(/^data-/, ''); var v = m[4].indexOf('data-') === 0 ? el.dataset[key] : el[m[4]]; if (v === undefined) return false; if (m[5] !== undefined && String(v) !== m[5].replace(/^["']|["']$/g, '')) return false; }
  return true;
}
El.prototype.querySelectorAll = function (sel) {
  var parts = sel.split(/\s+/), set = this.all();
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i], next = [];
    set.forEach(function (el) { if (matches(el, p)) next.push(el); });
    if (i < parts.length - 1) { var deeper = []; next.forEach(function (el) { el.all(deeper); }); set = deeper; } else set = next;
  }
  return set;
};
El.prototype.querySelector = function (sel) { var r = sel.split(',').map(function (s) { return this.querySelectorAll(s)[0]; }, this).filter(Boolean); return r[0] || null; };
Object.defineProperty(El.prototype, 'textContent', { get: function () { return this.tagName === '#TEXT' ? this._text : (this._text || '') + this.children.map(function (c) { return c.textContent; }).join(''); }, set: function (v) { this._text = String(v); this.children = []; } });
// innerHTML is parsed just far enough for querySelector: tags, class, id, data-*, title, style, text.
var VOID = { br: 1, img: 1, input: 1, hr: 1, rect: 0 };
function parseHTML(parent, html) {
  var re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g, m, stack = [parent];
  var decode = function (t) { return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); };
  while ((m = re.exec(html))) {
    var top = stack[stack.length - 1];
    if (m[5] !== undefined) { if (m[5].trim()) { var tn = new El('#text'); tn._text = decode(m[5]); top.appendChild(tn); } continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    var el = new El(m[2]), attrs = m[3], am, ar = /([\w-]+)="([^"]*)"/g;
    while ((am = ar.exec(attrs))) {
      var k = am[1], v = decode(am[2]);
      if (k === 'class') el.className = v; else if (k.indexOf('data-') === 0) el.dataset[k.slice(5)] = v; else if (k === 'style') { v.split(';').forEach(function (d) { var i = d.indexOf(':'); if (i > 0) el.style[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }); el.style.backgroundImage = el.style['background-image'] || ''; } else el[k] = v;
    }
    top.appendChild(el);
    if (!m[4] && !VOID[m[2].toLowerCase()]) stack.push(el);
  }
}
Object.defineProperty(El.prototype, 'innerHTML', { get: function () { return this._html; }, set: function (v) { this._html = String(v); this._text = ''; this.children = []; parseHTML(this, this._html); } });
Object.defineProperty(El.prototype, 'firstChild', { get: function () { return this.children[0] || null; } });
Object.defineProperty(El.prototype, 'offsetWidth', { get: function () { return 100; } });
Object.defineProperty(El.prototype, 'offsetHeight', { get: function () { return 100; } });

var ids = ['app', 'table', 'tilt', 'board', 'windows', 'drag-layer', 'toasts', 'hint', 'peek', 'journal', 'journal-drawer', 'journal-close', 'btn-journal', 'meters', 'rank', 'rank-badge', 'controls', 'zoom', 'help-aspects'];
var body = new El('body');
ids.forEach(function (id) { var el = new El('div'); el.id = id; body.appendChild(el); });
var document = {
  body: body, documentElement: new El('html'), hidden: false,
  querySelector: function (sel) { return body.querySelector(sel); },
  querySelectorAll: function (sel) { return body.querySelectorAll(sel); },
  getElementById: function (id) { return body.querySelector('#' + id); },
  createElement: function (tag) { return new El(tag); },
  createElementNS: function (ns, tag) { return new El(tag); },
  addEventListener: function () {}, removeEventListener: function () {},
  elementFromPoint: function () { return null; },
};
var timers = [];
globalThis.window = globalThis;
globalThis.document = document;
globalThis.performance = { now: function () { return Date.now(); } };
globalThis.requestAnimationFrame = function () { return 1; };
globalThis.localStorage = { getItem: function () { return null; }, setItem: function () {} };
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, vibrate: function () {} }, configurable: true }); } catch (err) { /* node's own will do */ }
globalThis.matchMedia = function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; };
globalThis.getComputedStyle = function () { return { perspective: 'none', perspectiveOrigin: '0px 0px', transform: 'none', transformOrigin: '0px 0px' }; };
globalThis.addEventListener = function () {};
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
var realSetTimeout = setTimeout;
var delays = [];
globalThis.setTimeout = function (fn, ms) { timers.push(fn); delays.push(ms || 0); return timers.length; };
globalThis.clearTimeout = function () {};
function flushTimers() { var t = timers; timers = []; t.forEach(function (fn) { fn(); }); }

['js/util.js', 'js/i18n.js', 'js/data/cards.js', 'js/data/cases.js', 'js/data/verbs.js', 'js/data/deductions.js', 'js/data/structures.js', 'js/data/story.js', 'js/engine.js', 'js/systems/charge.js', 'js/systems/reflect.js', 'js/systems/informants.js', 'js/systems/criminals.js', 'js/systems/sentence.js', 'js/systems/purse.js', 'js/systems/origins.js', 'js/systems/coquille.js', 'js/systems/patrons.js', 'js/systems/societies.js', 'js/systems/network.js', 'js/systems/callings.js', 'js/systems/intro.js', 'js/systems/life.js', 'js/systems/growth.js', 'js/core/recipes.js', 'js/data/recipes.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f });
});
var CF = globalThis.CF;
var settings = { shake: false, pauseOnCase: true, pauseOnVerb: false, pauseOnBlur: false, grid: false, snap: true, strings: true, haptics: false, uiScale: 100, guided: true };
CF.Settings = { get: function (k) { return settings[k]; }, onChange: function () {}, typeRate: function () { return 0; } };
var played = [];
CF.Audio = { play: function (k) { played.push(k); } };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8'), { filename: 'js/ui.js' });
var UI = CF.UI;
console.error = function (err) { throw err; };

function $(sel) { return body.querySelector(sel); }
function render(e) { e.dirty = true; UI.renderNow(); }

// ---- The Help lists the six kinds of proof with where each comes from.
(function helpAspects() {
  UI.init();
  var rows = $('#help-aspects').children;
  assert.strictEqual(rows.length, CF.CLUE_ASPECTS.length, 'one Help line per kind of proof');
  assert.ok(/Where it comes from/.test(rows[0].innerHTML) && /Study/.test(rows[0].innerHTML), 'the Body line says it is read in Study');
  console.log('ui: the Help lists where proof comes from');
})();

// ---- A new game replays the opening prose once the title has closed; the book shows unread.
(function opening() {
  var e = CF.Engine.newGame({ who: 'monk', name: 'Vogel', guided: true, opening: true });
  assert.strictEqual(e.s.t, 0);
  UI.attach(e);
  assert.strictEqual(UI.journalSeen, 0, 'nothing in the book has been read yet');
  var before = $('#toasts').children.length;
  flushTimers();
  assert.ok($('#toasts').children.length > before, 'the opening toasts after the title');
  assert.ok(!UI.paused, 'the replay of a case entry does not pause the game');
  render(e);
  assert.ok($('#btn-journal').classList.contains('unread'), 'the book shows unread');
  // A loaded game is not replayed.
  e.tick(1);
  UI.attach(e);
  var n = $('#toasts').children.length;
  flushTimers();
  assert.strictEqual($('#toasts').children.length, n, 'a game in progress keeps its toasts');
  console.log('ui: the opening prose is shown');
})();

// ---- The hint: a finished verb beats the lesson; a waiting choice is the advisor's first word.
(function hint() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 1 });
  UI.attach(e);
  UI.lastInput = performance.now();
  render(e);
  var hp = e.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0];
  assert.ok(e.autoSlot('duty', hp.uid) && e.start('duty'), 'Attend starts with Health');
  e.tick(e.verb('duty').duration + 0.01);
  assert.strictEqual(e.verb('duty').status, 'done');
  render(e);
  assert.ok(/Attend has finished/.test($('#hint').textContent), 'the hint names the finished verb: ' + $('#hint').textContent);
  assert.ok($('#hint').classList.contains('advice'), 'as advice');
  e.collect('duty'); e.tick(0.1);
  render(e);
  assert.ok(!/has finished/.test($('#hint').textContent) || $('#hint').classList.contains('gone'), 'and lets go once it is taken');
  // The advisor speaks to a waiting choice, and the hint goes to it.
  e.s.choice = { id: 'x', title: 'A question', text: 'Well?', options: [{ label: 'Yes', text: '' }] };
  var line = UI.advice();
  assert.ok(/clock waits/.test(line), 'the choice line: ' + line);
  assert.ok(UI.hintGo && UI.hintGo.spot, 'the hint pans to the choice');
  e.s.choice = null;
  // The Rival, after two moves, is the advisor's business.
  var rv = e.create('rival', { label: 'The Rival: Anselm Brecht', data: { name: 'Anselm Brecht', heat: 0, stalled: 0 } });
  e.s.journal.unshift({ t: 1, week: 1, title: 'The Rival Takes a Case', text: '', kind: 'danger' }, { t: 2, week: 1, title: 'A Scene Spoiled', text: '', kind: 'danger' });
  if (!e.verb('interrogate').unlocked) e.verb('interrogate').unlocked = true;
  var wit = e.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; })[0];
  if (wit) {
    var say = UI.advice();
    assert.ok(/Rival has moved twice/.test(say) && /Anselm Brecht/.test(say), 'the Rival line names them: ' + say);
  }
  e.remove(rv);
  console.log('ui: a finished verb beats the lesson; the advisor speaks to a choice and the Rival');
})();

// ---- The dossier: the accused's mark, what the charge still lacks, the Rival's spoiling.
(function dossier() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 3 });
  UI.attach(e);
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  assert.ok(sc, 'the accused is on the table');
  UI.selected = sc.uid;
  render(e);
  var peek = $('#peek').innerHTML;
  // Each fact once (Lane 2, item 100): the mark and the role in the description, the case in the kind line.
  var text = peek.replace(/<[^>]+>/g, ' '), susR = e.suspectOf(sc), mk = CF.TRAITS.filter(function (t) { return t.id === susR.trait; })[0];
  function times(hay, needle) { return hay.split(needle).length - 1; }
  assert.strictEqual(times(text, mk.desc.replace(/\.$/, '')), 1, 'the mark is read once: ' + text.slice(0, 400));
  assert.strictEqual(times(text, susR.role), 1, 'the role once');
  assert.strictEqual(times(text, rec.title), 1, 'the case once');
  assert.ok(!/Mark: |Case: |To convict: /.test(text), 'no line repeats what the description, the kind line or the proof row says');
  assert.ok(/data-trait="/.test(peek), 'and carries the mark chip');
  assert.ok(/Still wanted: /.test(peek), 'and says what the charge still lacks: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 300));
  var card = $('#peek').querySelector('.card');
  assert.ok(card && card.querySelector('.chip.trait'), 'the accused card wears the mark chip');
  // A token the Rival spoiled says so.
  var clue = e.create('clue', e.clueSpec(rec, { label: 'A Boot Print', text: 'Mud.', aspects: { forensic: 1 } }));
  clue.data.tampered = true;
  UI.selected = clue.uid;
  render(e);
  assert.ok(/Spoiled by the Rival/.test($('#peek').innerHTML), 'a spoiled token says so');
  // The case card: the Rival's clock, and the Inquisitor.
  rec.rival = true; e.s.flags.inquisitor = true;
  var kase = e.caseCard(rec.id);
  UI.selected = kase.uid;
  render(e);
  var cp = $('#peek').innerHTML;
  assert.ok(/The Rival works this too/.test(cp) && /The Inquisitor is in the city/.test(cp), 'the case dossier reads the systems');
  console.log('ui: the dossier names the mark, the lack and the Rival');
})();

// ---- The ask box says what ignoring costs.
(function askBox() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 5 });
  UI.attach(e);
  var rec = e.openCases()[0], kase = e.caseCard(rec.id);
  var inst = e.create('instinct');
  void inst;
  assert.ok(e.autoSlot('investigate', kase.uid) && e.start('investigate'), 'Explore starts');
  var v = e.verb('investigate');
  e.tick(v.duration * 0.31);
  assert.ok(v.ask && !v.ask.filled, 'the search asks for a shoulder at the door');
  var pen = (CF.ASKS.filter(function (a) { return a.label === v.ask.label && a.when(v.recipe, 'investigate'); })[0] || {}).penalty;
  UI.openVerbs = ['investigate'];
  var win = UI.openWindow ? UI.openWindow('investigate') : null;
  void win;
  render(e);
  var text = $('#windows').all().map(function (el) { return el.textContent; }).join('\n');
  if (pen === 'thin') assert.ok(/finds less/.test(text), 'a thin ask says it finds less');
  else if (pen === 'fatigue') assert.ok(/wearier/.test(text), 'a weary ask says wearier');
  else assert.ok(/as it would have/.test(text), 'a free ask says so');
  console.log('ui: the ask box says what ignoring costs (' + (pen || 'none') + ')');
})();

// ---- The verdict is stamped on the Blood Court card where the player watched its clock, then the Condemned comes
// out of it; no shake, the gavel instead of a finished verb's ding; a cold case stamps its own card, never the Court.
(function verdict() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 7 });
  UI.attach(e);
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  var trial = e.create('trial', { label: 'Blood Court: Jakob Hess', data: { caseId: rec.id, name: 'Jakob Hess', guilty: true, solid: true, real: 6, need: 6 } });
  render(e);
  var tok = $('#board').querySelectorAll('.verb').filter(function (el) { return el.dataset.verb === 'arrest'; })[0];
  assert.ok(tok, 'the Court token is on the table');
  var ghost = $('#board').querySelector('.card[data-uid=' + trial.uid + ']');
  assert.ok(ghost, 'the Blood Court card is on the table');
  var shook = 0, app = $('#app'), add0 = app.classList.add;
  app.classList.add = function (c) { if (c === 'shake') shook++; return add0.apply(app.classList, arguments); };
  settings.shake = true;
  played.length = 0; timers = []; delays = [];
  // The engine takes the card, gives its verdict and makes the Condemned, all before the board is drawn again.
  e.remove(trial);
  e.emit('resolved', { id: rec.id + '-' + e.s.seed, title: rec.title, outcome: 'convicted' });
  var made = e.create('condemned', { label: 'Condemned: Jakob Hess', data: { name: 'Jakob Hess' } });
  var st = ghost.querySelector('.verdict');
  assert.ok(st && st.classList.contains('stamp'), 'the stamp lands on the Blood Court card');
  assert.ok(/cwax-01/.test(st.style.backgroundImage), 'in red wax, not the Court tile\'s own gold');
  assert.ok(ghost.classList.contains('judged') && ghost.parentNode === $('#board'), 'the card stays a moment as a ghost');
  assert.ok(!tok.querySelector('.verdict'), 'the Court tile is left alone');
  assert.deepStrictEqual(played, ['convict'], 'the gavel and the bell, not the finished-verb ding: ' + played);
  assert.strictEqual(shook, 0, 'a verdict does not shake the screen');
  assert.ok(delays.indexOf(1400) >= 0, 'the ghost is held 1.4 seconds');
  render(e);
  assert.ok(ghost.parentNode === $('#board') && !ghost.classList.contains('leaving'), 'the board\'s sync leaves the ghost be');
  var mel = $('#board').querySelector('.card[data-uid=' + made.uid + ']');
  assert.ok(mel && mel.classList.contains('awaiting'), 'the Condemned waits under the stamp');
  timers.shift()();
  assert.ok(ghost.classList.contains('leaving') && !mel.classList.contains('awaiting'), 'then it comes out of the ghost, and the ghost goes');
  assert.ok(/translate\(/.test(mel.style.transform), 'gliding to its place');
  flushTimers();
  // An acquittal: the ribbon, and the crowd.
  var trial2 = e.create('trial', { label: 'Blood Court: Anna Weber', data: { caseId: rec.id, name: 'Anna Weber' } });
  render(e);
  var g2 = $('#board').querySelector('.card[data-uid=' + trial2.uid + ']');
  played.length = 0;
  e.remove(trial2);
  e.emit('resolved', { id: rec.id + '-' + e.s.seed, title: rec.title, outcome: 'acquitted', uid: trial2.uid });
  assert.ok(/cok-02/.test(g2.querySelector('.verdict').style.backgroundImage) && played.indexOf('acquit') >= 0, 'an acquittal: the ribbon and the murmur');
  flushTimers(); flushTimers();
  // A verdict made while the trial card is not on the board falls back to the Court tile.
  played.length = 0;
  e.emit('resolved', { title: 'Nothing', outcome: 'wrongful' });
  assert.ok(/cwax-01/.test(tok.querySelector('.verdict').style.backgroundImage), 'with no card to stamp, the Court tile takes it');
  flushTimers();
  assert.ok(!tok.querySelector('.verdict'), 'the stamp lifts after its moment');
  // A cold case: the eye on its own case card, silent, and never the Court.
  var cc = e.caseCard(rec.id);
  render(e);
  var cel = $('#board').querySelector('.card[data-uid=' + cc.uid + ']');
  played.length = 0;
  e.remove(cc);
  e.emit('resolved', { id: rec.id + '-' + e.s.seed, title: rec.title, outcome: 'cold' });
  assert.ok(cel.querySelector('.verdict') && /ccirc-05/.test(cel.querySelector('.verdict').style.backgroundImage), 'a cold case takes the eye on its own card');
  assert.ok(!tok.querySelector('.verdict') && played.length === 0, 'no court sat: the Court is not stamped and no gavel falls');
  e.emit('resolved', { title: 'Nothing', outcome: 'cold' });
  assert.ok(!tok.querySelector('.verdict'), 'not even when the card is gone');
  flushTimers(); flushTimers();
  settings.shake = false;
  app.classList.add = add0;
  var asrc = fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8');
  assert.ok(/\n    convict: function \(\) \{ gavel\(\); bell\(110/.test(asrc) && /\n    acquit: function \(\) \{ gavel\(\); noise\([^)]*attack: 0\.4/.test(asrc) && /if \(opts\.attack\)/.test(asrc), 'the gavel, then the bell or the crowd swelling in');
  console.log('ui: the verdict has its moment on the card it was given on');
})();

// ---- The Standing meter honours the rank cap and says when the letter is held.
(function standing() {
  var e = CF.Engine.newGame({ who: 'hangman', name: 'Gall', calling: 'master', seed: 11 });
  UI.attach(e);
  assert.strictEqual(e.rankCap(), 2, 'a hangman ends at Bailiff');
  e.s.rank = 2; e.s.meters.reputation = 5;
  // Past the last office the rules write a favour every few Standing (favourNext): the meter climbs toward it.
  var fn0 = e.favourNext;
  assert.ok(typeof fn0 === 'function' && UI.repTarget(e).max === e.favourNext().at && UI.repTarget(e).max > CF.RANK_REP[2], 'at the cap, Standing climbs to the Council\'s next favour, never to an office: ' + UI.repTarget(e).max);
  // Where no favour comes, the meter is full.
  e.favourNext = function () { return null; };
  render(e);
  var rep = $('#meters').querySelector('.meter[data-meter=reputation]');
  assert.ok(rep.classList.contains('lvl-4'), 'at the cap the meter is full, not measured against an office that will not come: ' + rep.className);
  e.favourNext = fn0;
  assert.ok(/cres-09/.test(rep.querySelector('.m-icon').style.backgroundImage), 'Standing wears the crown');
  assert.ok(/cres-04/.test($('#meters').querySelector('.meter[data-meter=pressure] .m-icon').style.backgroundImage), 'the Crowd wears the fire');
  UI.showMeterInfo('reputation');
  var peek = $('#peek').innerHTML;
  assert.ok(/last office the Council will give a hangman/.test(peek), 'the dossier says where the ladder ends: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 200));
  assert.ok(!/Blocked/.test(peek), 'nothing is blocked yet');
  // The dossier asks the engine, not a flag: a stale flag alone says nothing.
  e.s.who = 'monk'; e.s.flags.promoHeld2 = true;
  UI.showMeterInfo('reputation');
  peek = $('#peek').innerHTML;
  assert.ok(!/Blocked/.test(peek), 'a flag left over from an earlier rank does not block');
  e.favour().council = -2; e.s.meters.reputation = CF.RANK_REP[3];
  assert.ok(e.promotionHeld(), 'the Council is displeased');
  UI.showMeterInfo('reputation');
  peek = $('#peek').innerHTML;
  assert.ok(/Blocked: the Council/.test(peek) && !/hangman/.test(peek), 'a held letter is told, and only to the one it concerns');
  e.favour().council = 0;
  UI.showMeterInfo('reputation');
  assert.ok(!/Blocked/.test($('#peek').innerHTML), 'favour recovered: the line goes');
  console.log('ui: the Standing meter honours the cap and the held letter');
})();

// ---- The Court reads the charge first and marks the tokens that hurt it.
(function court() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 13 });
  UI.attach(e);
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  assert.ok(sc && e.autoSlot('arrest', sc.uid), 'the accused goes before the Court');
  // The offending tokens come from the charge (charge.bad): stood in for here.
  var preview = e.preview;
  e.preview = function (vid) { var pv = preview.call(this, vid); if (vid === 'arrest' && pv && pv.detail && pv.detail.charge) pv.detail.charge.bad = [sc.uid]; return pv; };
  UI.openWindow('arrest');
  render(e);
  assert.ok(document.body.classList.contains('has-window'), 'the page knows a window is open');
  var w = $('#windows').querySelector('.vwin');
  var pane = w.querySelector('.vw-body');
  assert.ok(pane.firstChild && pane.firstChild.classList.contains('charge-box'), 'the charge comes first in the window');
  assert.ok(pane.firstChild.querySelector('.charge .ch-row'), 'with the case\'s rows');
  assert.strictEqual(pane.querySelectorAll('.charge').length, 1, 'and only once');
  var lab = pane.querySelector('.slot.primary .s-label');
  assert.strictEqual(lab.textContent, 'Accused', 'the primary slot wears its first name');
  assert.strictEqual(lab.title, 'Accused / Condemned', 'with the whole list in the title');
  assert.ok(pane.querySelector('.slot.primary .card').classList.contains('bad'), 'the offending token is marked');
  w.querySelector('.vw-close').click();
  render(e);
  assert.ok(!document.body.classList.contains('has-window'), 'and the page knows when it closes');
  e.preview = preview;
  console.log('ui: the Court shows the charge first and marks the bad tokens');
})();

// ---- The pile has its tab and label; toasts stay longer for stories and say only the title for verbs.
(function pileAndToasts() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 17 });
  UI.attach(e);
  render(e);
  var pz = $('#board').querySelector('.pile-zone');
  assert.ok(pz && pz.querySelector('.pz-tab'), 'the pile has a tab');
  assert.strictEqual(pz.querySelector('.pz-label').textContent, 'New cards', 'and its label');
  delays.length = 0;
  e.emit('story', { title: 'A Letter', text: 'Long words.', kind: 'major' });
  var t = $('#toasts').children[$('#toasts').children.length - 1];
  assert.ok(t && /Long words/.test(t.innerHTML), 'a story toast carries its text');
  assert.ok(t.style['--bar'] && /clabel-02/.test(t.style['--bar']), 'the bar is a property for the stylesheet');
  assert.strictEqual(delays[delays.length - 1], 9000, 'a story stays nine seconds');
  delays.length = 0;
  e.verb('duty').story = { title: 'A Quiet Shift', text: 'Nothing happened, at length.' };
  e.emit('complete', { verb: 'duty' });
  t = $('#toasts').children[$('#toasts').children.length - 1];
  assert.ok(/A Quiet Shift/.test(t.innerHTML) && /Tap to read/.test(t.innerHTML) && !/at length/.test(t.innerHTML), 'a verb\'s toast is title-only: ' + t.innerHTML);
  assert.strictEqual(delays[delays.length - 1], 6000, 'and goes in six');
  console.log('ui: the pile is labelled; toasts know their length');
})();

// ---- The advisor is read once a second, and not at all while the hint is hidden.
(function advisorCache() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 19 });
  UI.attach(e);
  UI.lastInput = performance.now() - 7000;
  var calls = 0, advice = UI.advice;
  UI.advice = function () { calls++; return advice.call(UI); };
  render(e);
  assert.strictEqual(calls, 1, 'one reading on render');
  UI.updateLive(); UI.updateLive(); UI.updateLive();
  assert.strictEqual(calls, 1, 'the live frames reuse it');
  UI.adviceAt -= 1000;
  UI.updateLive();
  assert.strictEqual(calls, 2, 'a second later it is read again');
  UI.hintHidden = true;
  UI.adviceAt -= 1000;
  UI.updateLive();
  assert.strictEqual(calls, 2, 'a hidden hint is never computed');
  UI.hintHidden = false;
  UI.advice = advice;
  console.log('ui: the advisor is computed once a second, never on a hidden hint');
})();

// ---- The play button cycles the speed on a narrow screen; the week shade is a scale, written when it moves.
(function speedAndFrame() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 23 });
  UI.attach(e);
  var ctl = $('#controls');
  var btns = [0, 1, 2, 3].map(function (sp) { var b = new El('button'); b.dataset.speed = String(sp); ctl.appendChild(b); return b; });
  var wb = new El('div'); wb.id = 'weekbar'; var sh = new El('div'); sh.className = 'wb-shade'; wb.appendChild(sh); body.appendChild(wb);
  var click = function (sp) { ctl.listeners.click[0]({ target: { closest: function () { return btns[sp]; } } }); };
  UI.setSpeed(1);
  click(1);
  assert.strictEqual(UI.speed, 1, 'on a wide screen the play button is plain');
  var mm = globalThis.matchMedia;
  globalThis.matchMedia = function () { return { matches: true, addEventListener: function () {}, addListener: function () {} }; };
  click(1); assert.strictEqual(UI.speed, 2, 'narrow: play cycles to 2');
  assert.strictEqual(btns[1].querySelector('small').textContent, '2', 'and the badge shows it');
  assert.ok(btns[1].classList.contains('on'), 'the play button stays lit');
  click(1); assert.strictEqual(UI.speed, 3, 'then 3');
  click(1); assert.strictEqual(UI.speed, 1, 'then round to 1');
  assert.strictEqual(btns[1].querySelector('small').textContent, '', 'with no badge at 1');
  globalThis.matchMedia = mm;
  render(e);
  UI.updateLive();
  assert.strictEqual(sh.style.transform, 'scaleX(1)', 'a fresh week: the shade covers the bar');
  assert.ok(!sh.style.transform || sh.style.left === '19%', 'anchored at the sun end');
  e.tick(CF.WEEK / 2);
  UI.updateLive();
  assert.ok(/scaleX\(0\.6/.test(sh.style.transform), 'half the week gone, the shade has drawn back: ' + sh.style.transform);
  var timed = $('#board').querySelectorAll('.card.timed')[0];
  assert.ok(timed, 'a timed card is on the table');
  assert.strictEqual(timed.style['--pct'], undefined, 'no --pct is written on cards');
  var time = timed.querySelector('.c-time'), was = time.textContent;
  e.tick(1); UI.updateLive();
  assert.notStrictEqual(time.textContent, was, 'the clock still moves');
  console.log('ui: speed cycles on the play button; the week shade is a scale');
})();

// ---- The seals: counts and badges on numbered wax, the dues on a numbered ring.
(function seals() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 5 });
  UI.attach(e);
  e.verb('time').unlocked = true;
  if (e.verb('time').x === undefined) e.layoutVerbs();
  render(e);
  var badge = $('#board').querySelector('.verb.duty .v-badge');
  assert.ok(/cmark-04/.test(badge.style.backgroundImage) && badge.textContent === '!', 'an idle verb keeps the mark behind its word');
  var hp = e.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0];
  assert.ok(e.autoSlot('duty', hp.uid), 'Health goes into Attend');
  render(e);
  var count = $('#board').querySelector('.verb.duty .v-count');
  assert.ok(/cwaxn-01/.test(count.style.backgroundImage) && count.textContent === '', 'one card: the first seal, no figure');
  assert.ok(e.start('duty'), 'Attend starts');
  e.tick(e.verb('duty').duration + 0.01);
  render(e);
  var n = e.verb('duty').out.length;
  assert.ok(n >= 1, 'Attend made something');
  badge = $('#board').querySelector('.verb.duty .v-badge');
  if (n <= 5) assert.ok(badge.style.backgroundImage.indexOf('cwaxn-0' + n) >= 0 && badge.textContent === '', 'the badge is the seal for ' + n + ': ' + badge.style.backgroundImage);
  else assert.ok(badge.textContent === String(n) && !badge.style.backgroundImage, 'past five the badge is a figure');
  var dues = e.dues();
  var mag = $('#board').querySelector('.verb.time .v-magnet');
  assert.ok(mag.style.backgroundImage.indexOf('cnum-' + (dues + 1 < 10 ? '0' : '') + (dues + 1)) >= 0 && mag.textContent === '', 'the dues ' + dues + ' on the numbered ring: ' + mag.style.backgroundImage);
  e.dues = function () { return 12; };
  render(e);
  assert.ok(mag.textContent === '12' && !mag.style.backgroundImage, 'past nine the dues are a figure');
  console.log('ui: counts and badges are seals, the dues a ring');
})();

// ---- The journal: firsts wear the progress marks, entries their kind's icon.
(function journal() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 7 });
  UI.attach(e);
  e.s.journal.unshift({ t: 1, week: 1, title: 'A Case', text: 'Opened.', kind: 'case' });
  UI.journalLen = -1;
  render(e);
  var firsts = $('#journal').querySelectorAll('.firsts .first');
  assert.ok(firsts.length > 3, 'the firsts are listed');
  firsts.forEach(function (f) {
    var i = f.querySelector('i');
    assert.ok(i && /cprog-0[12]/.test(i.style.backgroundImage), 'each first wears a progress mark');
    assert.ok(!/[✓○]/.test(f.textContent), 'and no glyph');
    assert.ok(f.classList.contains('done') === /cprog-02/.test(i.style.backgroundImage), 'the check only on a done first');
  });
  var entry = $('#journal').querySelector('.journal-entry.k-case');
  var icon = entry && entry.querySelector('.j-icon');
  assert.ok(icon && /imark-01/.test(icon.style.backgroundImage), 'a case entry carries the case icon');
  console.log('ui: firsts wear the progress marks; entries their icon');
})();

// ---- The wake lock: asked for once per change of state, released when the game pauses.
(function wake() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 9 });
  UI.attach(e);
  var requests = 0, releases = 0;
  var lock = { release: function () { releases++; }, addEventListener: function () {} };
  navigator.wakeLock = { request: function () { requests++; return { then: function (ok) { ok(lock); } }; } };
  UI.wakeWant = undefined;
  UI.paused = false; UI.modal = false;
  UI.wake(); UI.wake(); UI.wake();
  assert.strictEqual(requests, 1, 'one request while the state holds');
  UI.paused = true;
  UI.wake(); UI.wake();
  assert.strictEqual(releases, 1, 'one release on pause');
  assert.strictEqual(requests, 1, 'and no new request');
  UI.paused = false;
  UI.wake();
  assert.strictEqual(requests, 2, 'asked for again when play resumes');
  delete navigator.wakeLock;
  UI.wakeWant = undefined;
  console.log('ui: the wake lock crosses the bridge only on change');
})();

// ---- A cancelled token drag puts the token back, strings and all.
(function tokenBack() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 11 });
  UI.attach(e);
  render(e);
  var el = $('#board').querySelector('.verb.duty');
  var v = e.s.verbs.duty, b0 = { x: v.x, y: v.y };
  UI.drag = { kind: 'verb', verb: 'duty', el: el, started: true, b0: b0, x0: 0, y0: 0 };
  v.x = b0.x + 300; v.y = b0.y + 200;
  el.classList.add('dragging');
  assert.ok(UI.back(), 'Back cancels the drag');
  assert.ok(!UI.drag, 'nothing is held');
  assert.strictEqual(v.x, b0.x, 'the token is back where it was lifted');
  assert.strictEqual(v.y, b0.y);
  assert.ok(!el.classList.contains('dragging'), 'and no longer dragging');
  assert.ok(el.style.transform.indexOf('translate(' + Math.round(b0.x) + 'px,' + Math.round(b0.y) + 'px') === 0, 'placed back: ' + el.style.transform);
  console.log('ui: a cancelled token drag puts the token back');
})();

// ---- Small reads: an option that takes a card for good says so; the Harbourmaster's man; the crier's pulse.
(function smallReads() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 15 });
  UI.attach(e);
  e.s.choice = { id: 'fg', title: 'A question', text: 'Well?', options: [{ label: 'Go', text: 'Now.', cost: 'health', forGood: true }, { label: 'Stay', text: 'Later.', cost: 'health' }] };
  render(e);
  var ch = $('#board').querySelector('.choice');
  var opts = ch.querySelectorAll('.ch-opt');
  assert.strictEqual(opts.length, 2);
  var fg = opts[0].querySelector('.ch-cost-forgood');
  assert.ok(fg, 'the option that takes Health for good wears the class');
  assert.ok(/Takes Health, for good\./.test(opts[0].textContent), 'and says so: ' + opts[0].textContent);
  assert.ok(/Takes Health\./.test(opts[1].textContent) && !opts[1].querySelector('.ch-cost-forgood'), 'the other only takes it');
  e.s.choice = null;
  // The Bell's window names the rival's patron.
  e.verb('time').unlocked = true;
  if (e.verb('time').x === undefined) e.layoutVerbs();
  e.create('rival', { label: 'The Rival: Anselm Brecht', data: { name: 'Anselm Brecht', heat: 0, stalled: 0 } });
  UI.openWindow('time');
  render(e);
  var text = $('#windows').textContent;
  assert.ok(/The Harbourmaster's Examiner is in the city/.test(text), 'the Harbourmaster\'s Examiner: ' + text.slice(0, 200));
  assert.ok(!/Provost/.test(text), 'and no Provost');
  while (UI.openVerbs.length) UI.back();
  // A crier-sung case pulses from two minutes out.
  var rec = e.openCases()[0], cc = e.caseCard(rec.id);
  assert.ok(cc, 'the case card is on the table');
  render(e);
  var cel = $('#board').querySelector('.card[data-uid=' + cc.uid + ']');
  assert.ok(cel, 'and drawn');
  cc.life = 100;
  rec.highProfile = false;
  UI.updateLive();
  assert.ok(!cel.classList.contains('urgent'), 'an ordinary case at 100s is calm');
  rec.highProfile = true;
  UI.updateLive();
  assert.ok(cel.classList.contains('urgent'), 'a crier-sung case at 100s pulses');
  cc.life = 130;
  UI.updateLive();
  assert.ok(!cel.classList.contains('urgent'), 'and not yet at 130s');
  console.log('ui: for good, the Harbourmaster, the crier\'s pulse');
})();

// ---- A hold on a stacked card lifts the whole stack; a lifted card moves its own strings only.
(function holdAndStrings() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 19 });
  UI.attach(e);
  var a = e.create('health'), b = e.create('health');
  var spot = { x: a.loc.x, y: a.loc.y };
  b.loc = { t: 'table', x: spot.x, y: spot.y };
  var stack = e.stackOf(a);
  assert.ok(stack.length >= 2, 'the Health is one stack');
  render(e);
  var n = $('#board').querySelector('.card[data-uid=' + stack[0].uid + ']');
  assert.ok(n, 'the stack is drawn');
  n.closest = function (sel) { return sel === '.card[data-uid]' ? n : null; };
  var ev = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 300, target: n, preventDefault: function () {} };
  timers = []; delays = [];
  UI.pointer.down(ev);
  assert.ok(UI.drag && UI.drag.kind === 'card' && !UI.drag.started, 'the card is under the finger, not lifted');
  assert.strictEqual(delays[delays.length - 1], 400, 'a hold is 400ms');
  flushTimers();
  assert.ok(UI.drag && UI.drag.started && UI.drag.whole, 'the hold lifts the stack');
  assert.strictEqual(UI.drag.uids.length, stack.length, 'the whole of it');
  assert.ok(UI.drag.rect && UI.drag.rect.width === 1280, 'the table rect is measured once for the drag');
  UI.pointer.up({ pointerId: 1, clientX: 300, clientY: 300, target: n });
  assert.ok(!UI.drag, 'put down again');
  // A moved pointer cancels the hold.
  timers = [];
  UI.pointer.down(ev);
  UI.pointer.move({ pointerId: 1, clientX: 320, clientY: 320, target: n });
  assert.ok(UI.drag && UI.drag.started && !UI.drag.whole && UI.drag.uids.length === 1, 'a drag lifts one card');
  assert.ok(!UI.drag.holdT, 'and the hold is off');
  UI.pointer.move({ pointerId: 1, clientX: 340, clientY: 340, target: n });
  assert.ok(UI.drag.raf, 'later moves wait for the frame');
  UI.back();
  flushTimers();
  // The strings: a case's token moves its rope and pin alone, without a rebuild.
  var rec = e.openCases()[0], cc = e.caseCard(rec.id);
  var clue = e.create('clue', e.clueSpec(rec, { label: 'A Boot Print', text: 'Mud.', aspects: { forensic: 1 } }));
  clue.loc = { t: 'table', x: cc.loc.x + 400, y: cc.loc.y + 100 };
  render(e);
  var svgs = $('#board').children.filter(function (c) { return c.tagName === 'SVG'; });
  var links = svgs[0], pins = svgs[svgs.length - 1];
  assert.ok(links && pins && links !== pins, 'the rope layer and the pin layer');
  var html = links.innerHTML;
  assert.ok(links.children.length >= 1 && /^M/.test(links.children[0].d), 'a rope is drawn');
  // Each rope has its shadow path: the shadows first, the ropes after them in the same order.
  var half = links.children.length / 2;
  assert.ok(half >= 1 && half === Math.floor(half), 'two paths per rope');
  assert.ok(links.children.slice(0, half).every(function (c) { return c.classList.contains('shade'); }) && links.children.slice(half).every(function (c) { return !c.classList.contains('shade') && c.stroke; }), 'the shadows under the coloured ropes');
  var rope = null, ropeAt = -1, i;
  var head = 'M' + (cc.loc.x + CF.TABLE.CW / 2).toFixed(0) + ' ' + (cc.loc.y + 12).toFixed(0);
  for (i = half; i < links.children.length; i++) if (links.children[i].d.indexOf(head) === 0) { rope = links.children[i]; ropeAt = i - half; }
  assert.ok(rope, 'the rope starts at the case card');
  assert.strictEqual(links.children[ropeAt].d, rope.d, 'its shadow follows the same line');
  var d0 = rope.d;
  UI.drag = { kind: 'card', started: true, uid: clue.uid, uids: [clue.uid], from: 'table', el: new El('div'), origin: { left: 0, top: 0, w: 1, h: 1 }, z: 1, lastEv: { clientX: 900, clientY: 500 }, gx: 10, gy: 10, rect: { left: 0, top: 0, width: 1280, height: 800 } };
  UI.syncLinksHeld([String(clue.uid)]);
  assert.strictEqual(links.innerHTML, html, 'the layer is not rebuilt');
  assert.notStrictEqual(rope.d, d0, 'the rope follows the held token');
  assert.strictEqual(links.children[ropeAt].d, rope.d, 'and so does its shadow');
  var hidden = pins.children.filter(function (c) { return c.visibility === 'hidden'; });
  assert.strictEqual(hidden.length, 2, 'the held token\'s pin goes with it');
  UI.back();
  assert.ok(!pins.children.some(function (c) { return c.visibility === 'hidden'; }), 'and comes back when it is put down');
  console.log('ui: a hold lifts the stack; a drag moves only its own strings');
})();

// ---- The page's markup and stylesheet: the top bar is one row, the stamp and the seal are drawn,
// the toasts grow with their words, the tools are art on phones, the promotion panel has real buttons.
(function markup() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var ui = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  var topbar = /#topbar \{[^}]*\}/.exec(css)[0];
  assert.ok(/flex-wrap:\s*nowrap/.test(topbar) && /overflow:\s*hidden/.test(topbar), 'the top bar never wraps');
  assert.ok(/@media \(max-width: 1500px\)[^}]*\.meter \.m-label \{ display: none/.test(css), 'the meter names go first');
  assert.ok(/@media \(max-width: 1300px\)[^}]*#topbar \.rank \{ display: none/.test(css) && /@media \(max-width: 1100px\)[^}]*#topbar \.brand \{ display: none/.test(css), 'then the rank, then the brand');
  assert.ok(/#controls button\[data-speed="2"\], #controls button\[data-speed="3"\], #btn-journal, #btn-precinct, #btn-help \{ display: none/.test(css), 'a phone keeps the play button and the menu');
  assert.ok(/id="m-journal"/.test(html) && /id="m-help"/.test(html) && /click\('m-journal'/.test(main) && /click\('m-help'/.test(main), 'the journal and the Help live in the pause menu');
  assert.ok(/@keyframes stamp \{ from \{ transform: scale\(2\.2\) rotate\(-12deg\)/.test(css) && /\.verb \.verdict \{[^}]*width: 120px/.test(css), 'the verdict slams down as a stamp');
  assert.ok(/\.card \.verdict \{[^}]*width: 80%[^}]*animation: stamp 0\.35s/.test(css) && /\.card\.awaiting \{ visibility: hidden; \}/.test(css), 'the verdict is stamped on the card it was given on, at four fifths of it');
  assert.ok(/\.toast \{[^}]*aspect-ratio: auto/.test(css) && !/\.toast \{[^}]*overflow: hidden/.test(css), 'a toast is as tall as its words');
  assert.ok(/\.toast::after \{[^}]*border-image: var\(--bar\)/.test(css) && /\.toast::before \{[^}]*var\(--bar\)/.test(css) && /\.toast \.t-icon \{[^}]*var\(--icon\)/.test(css) && /<i class="t-icon"><\/i>/.test(ui), 'the bar is sliced, the icon sits in its circle (its own element, so Arabic mirrors the bar and not the icon)');
  assert.ok(/#toasts \{[^}]*right: calc\(12px \+ var\(--sa-r\)\)[^}]*top: calc\(var\(--sa-t\) \+ 260px\)/.test(css) && /body\.has-window #toasts \{ right: calc\(390px \* var\(--ui-scale, 1\)\)/.test(css), 'toasts sit top right under the verb row, clear of the hint, the window and the notch');
  var phone = /@media \(max-height: 520px\), \(max-width: 980px\) \{[\s\S]*?\n\}/.exec(css)[0]; // to the block's own closing brace, past the nested keyframes
  assert.ok(/#toasts \{ top: auto; bottom: calc\(12px \+ var\(--sa-b\)\)/.test(phone) && /#toasts \.toast:nth-last-child\(n\+3\) \{ display: none/.test(phone), 'on a phone the toasts grow up from the bottom, two at most');
  assert.ok(/body\.has-window #toasts \{[^}]*bottom: calc\(78% - 28px/.test(phone) && /body\.has-window #toasts \.toast:not\(:last-child\) \{ display: none/.test(phone), 'with the sheet open the newest toast alone sits above it, never on its X');
  assert.ok(/@media \(max-height: 520px\) \{[^@]*body\.has-window #toasts \{ right: auto; left: calc\(12px \+ var\(--sa-l\)\); top: calc\(var\(--sa-t\) \+ 56px\)/.test(css) && /\[dir=rtl\] body\.has-window #toasts \{ left: auto; right:/.test(css), 'on a phone on its side the toast goes top-left, mirrored for Arabic');
  var narrow = /@media \(max-width: 980px\) \{[\s\S]*?\n\}/.exec(css)[0];
  assert.ok(/#topbar #rank-badge \{ width: 32px/.test(narrow) && /#topbar #weekbar \{ width: auto; flex: 0 1 100px; min-width: 30px/.test(narrow) && /\.meter \{[^}]*width: 30px; flex: none/.test(narrow), 'the narrow bar keeps five 30px meters and shortens the week bar instead');
  assert.ok(/\.vw-body \{[^}]*margin: 0 -46px 0 -10px; padding: 2px 4px 2px 12px/.test(css) && /\[dir=rtl\] \.vw-body \{[^}]*padding: 2px 12px 2px 4px/.test(css), 'the window body pads what it took from the frame so the first glyph sits on the paper');
  assert.ok(/\.title-buttons \.plate-btn, #menu \.plate-btn \{ display: flex; align-items: center;[^}]*gap: 10px/.test(css) && /\.plate-btn \.mi \{ display: block; flex: none;[^}]*margin: -6px 0;/.test(css), 'a plate with an icon is a flex row, the icon never over its words');
  assert.ok(/@media \(max-height: 520px\) \{[^@]*\.title-scene \.title-buttons \{ display: grid; grid-template-columns: 1fr 1fr/.test(css) && />Install<\/button>/.test(html), 'the title plates go two abreast on a short screen; Install is one word');
  assert.ok(/#hint \{[^}]*top: 10px;[^}]*pointer-events: auto/.test(css) && /#hint::before \{[^}]*bround-17/.test(css) && /#hint::after \{[^}]*clabel-06/.test(css), 'the hint is a painted bar under the verbs');
  assert.ok(!/#hint \{ display: none/.test(css) && /@media \(max-width: 980px\) and \(min-height: 521px\) \{[^@]*#hint \{ left: 8px; right: 8px; top: 62px;[^}]*max-width: none; transform: none/.test(css), 'on a phone held upright the hint is a strip under the tool row, never hidden');
  // A phone on its side: the verbs fill the top of the felt, so the strip would lie across every tile (a tap on a verb
  // hit the hint). The hint docks at the foot instead, on the left, clear of the toasts at the bottom-right.
  var hintShort = /@media \(max-height: 520px\) \{\s*#hint \{[^}]*\}/.exec(css);
  assert.ok(hintShort && /top: auto; bottom: 8px;/.test(hintShort[0]) && /left: 8px; right: auto;/.test(hintShort[0]) && /transform: none/.test(hintShort[0]), 'on a phone on its side the hint docks at the foot, off the verbs');
  assert.ok(css.indexOf(hintShort[0]) > css.indexOf('@media (max-width: 980px) and (min-height: 521px)'), 'after the upright strip, so a short window never takes the strip');
  assert.ok(/function toolBand\(r\)/.test(ui) && /UI\.fitView = function \(\) \{[\s\S]{0,200}var dockH = toolBand\(r\)/.test(ui) && /var margin = 80, dockH = toolBand\(r\)/.test(ui) && /band \+ \(r\.height - band\) \/ 2/.test(ui), 'the camera keeps the band under the tool row free on a phone: fit, clamp and the pan to a choice');
  // Arabic: every board child is placed from the board's origin, so the city's question is where the camera goes.
  assert.ok(/#board > \* \{ position: absolute; left: 0; top: 0; z-index: 1; \}/.test(css), 'board children are pinned to the origin, so right-to-left never moves the choice off the camera');
  var box = /\.screen-box \{ width: 100%[^}]*\}/.exec(css)[0];
  assert.ok(/display: flex; flex-direction: column/.test(box) && /overflow: hidden/.test(box), 'a screen is a column that never outgrows the page');
  assert.ok(/\.help-paper, \.settings-paper, \.precinct-paper, \.archive-body \{ flex: 1 1 auto; min-height: 0; overflow: auto; max-height: none/.test(css), 'the paper scrolls, the buttons stay');
  assert.ok(!/\.help-paper \{[^}]*100vh/.test(css) && !/\.settings-paper \{[^}]*60vh/.test(css) && !/\.precinct-paper \{[^}]*100vh/.test(css), 'no viewport heights on the papers');
  assert.ok(/@media \(max-height: 520px\), \(max-width: 980px\) \{[^@]*\.vwin \{ left: 0; right: 0; top: auto; bottom: 0; width: 100%/.test(css), 'the verb window is a sheet from the bottom on phones');
  ['collect', 'stack', 'tidy', 'undo'].forEach(function (tool) {
    var m = new RegExp('<button data-tool="' + tool + '" class="tool-word tool-art[^"]*" style="--i:var\\(--art-bsq-\\d\\d\\)" title="([^"]+)">([^<]+)</button>').exec(html);
    assert.ok(m && m[1] === m[2], tool + ' is an art button titled with its word');
  });
  assert.ok(/#zoom button\.tool-art \{[^}]*font-size: 0/.test(css), 'the tools are art alone on a phone');
  var promo = /<div class="dlg dlg-levelup" id="promo-box">[\s\S]*?<\/button>\s*<\/div>/.exec(html);
  assert.ok(promo && !/title=/.test(promo[0].split('\n')[0]), 'the promotion box has no whole-box title');
  assert.strictEqual((promo[0].match(/class="lu-cap"/g) || []).length, 3, 'a caption under each slot');
  assert.ok(/id="promo-note"/.test(promo[0]) && /class="dlg-hot blue" id="promo-precinct">The Watch-house</.test(promo[0]) && /class="dlg-hot red" id="promo-close">Carry on</.test(promo[0]), 'two real buttons and a note');
  assert.ok(/click\('promo-close'/.test(main) && /click\('promo-precinct'/.test(main) && !/click\('promo-box'/.test(main), 'the buttons are wired; the box itself is not');
  assert.ok(/CF\.POWERS\[k\]\.label/.test(main) && /promo-note/.test(main), 'the captions are the powers\' names; a tap reads one out');
  console.log('ui: the markup and the stylesheet hold the polish');
})();

// ---- Lot V, items 8-14: the meter icons read at level 0, fingers get 44px, the Help is in play order
// and tells the truth about asks, empty slots are framed cards, the ending wears the paper and the
// banner, the pile is painted, the verb window and the dossier are painted panels.
(function markup2() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
  // Every declaration block the stylesheet gives a selector (some are split across rules), joined.
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }
  // Meter icons.
  assert.ok(/opacity: 0\.85/.test(rule('.meter .m-icon')) && /opacity: 0\.9;/.test(rule('.meter.lvl-1 .m-icon')) && /opacity: 0\.95/.test(rule('.meter.lvl-2 .m-icon')), 'the meter icons read at every level');
  assert.ok(/animation: urgentIcon/.test(rule('.meter.crit .m-icon::after')) && /drop-shadow/.test(rule('.meter.lvl-3 .m-icon')), 'the glow and the pulse stay (the pulse on its pseudo-element)');
  // Touch targets.
  var coarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(coarse, 'a block for coarse pointers');
  assert.ok(/#zoom button[^{]*\{ width: 44px; height: 44px/.test(coarse[1]), 'the zoom buttons are 44px');
  assert.ok(/\.vw-close, \.vw-info, #peek \.peek-close, #peek-x, \.picker \.pk-close, \.side-head button, \.archive-pager \.pg \{ min-width: 44px; min-height: 44px/.test(coarse[1]), 'every small control is 44px');
  assert.ok(/\.card \.c-count::after, \.chip\.big::after \{ content: ''; position: absolute; inset: -10px/.test(coarse[1]), 'the count and the chips get a hit-slop');
  // The Help.
  // Lane 2, item 97: chapters with a tab row, each in the order a game is played; the words of the city last.
  var help = /<div class="paper help-paper" id="help-paper">([\s\S]*?)<\/div>\s*<div class="row center"><button class="plate-btn redfill" id="help-close">/.exec(html)[1];
  var chs = (help.match(/<section class="help-ch" id="([a-z-]+)">/g) || []).map(function (x) { return /id="([a-z-]+)"/.exec(x)[1]; });
  assert.deepStrictEqual(chs, ['help-goal', 'help-case', 'help-court', 'help-self', 'help-city', 'help-words'], 'five chapters and the words of the city');
  var tabs = (html.match(/<button data-ch="([a-z-]+)"/g) || []).map(function (x) { return /"([a-z-]+)"/.exec(x)[1]; });
  assert.deepStrictEqual(tabs, chs, 'a tab for each');
  var heads = help.match(/<h4[^>]*>(?:<i[^>]*><\/i>)?[^<]+<\/h4>/g).map(function (x) { return x.replace(/<[^>]+>/g, ''); });
  assert.deepStrictEqual(heads.slice(0, 12), ['Winning', 'Cases', 'Your first days, in order', 'Attend', 'Explore', 'Study', 'Question', 'Rest', 'What a verb finds', 'Asks', 'Proof of six kinds', 'Read everything'], 'the goal, then a case in the order it is played');
  assert.deepStrictEqual(heads.slice(-3), ['Your table', 'Keys', 'Time'], 'the table, the keys and time close the city');
  ['duty', 'investigate', 'analyze', 'interrogate', 'reflect', 'arrest', 'time'].forEach(function (v) { assert.ok(new RegExp('<h4 id="' + UI.HELP_AT[v] + '"><i class="hv" style="--i:var\\(--art-cvtok-' + v + '\\)"><\\/i>').test(help), v + ': its heading wears its tile, and a verb window\'s i finds it'); });
  assert.ok(!/Cards and verbs|Six verbs|Provost|⌂/.test(help), 'the old heading, the five verbs called six, the Provost and the glyph are gone');
  assert.ok(/<b>confront<\/b> the accused/.test(help) && /Put Health into <b>Attend<\/b> for a day's labour and a Coin/.test(help), 'the first days are the real opening, with the confrontation');
  ['Carolina', 'Indicia', 'Blood Court', 'Sworn men', 'The Hole', 'Quarter', 'Writ', 'Abroad', 'Dues', 'Standing', 'Token', 'Aspect'].forEach(function (w) { assert.ok(help.indexOf('<p class="hw"><b>' + w + '</b>: ') >= 0, 'the words of the city: ' + w); });
  assert.ok(/<h4>Proof of six kinds<\/h4>\s*<p>[^<]*<\/p>\s*<div id="help-aspects"><\/div>/.test(help), 'the six kinds have their list');
  assert.ok(/<h4 id="help-court-verb"><i[^>]*><\/i>The Court<\/h4>\s*<p>The Blood Court sits under the Carolina, the Emperor's law of 1532:/.test(help), 'the Court is glossed');
  var asks = /<h4>Asks<\/h4>\s*<p>([^]*?)<\/p>/.exec(help)[1];
  assert.ok(/the box says which\.$/.test(asks) && !/costs nothing/.test(asks) && !/finishes sooner/.test(asks), 'the Help tells the truth about asks');
  assert.ok(/<b>Clear<\/b> hands the cards back\./.test(help) && /The New cards tab marks the collection pile\./.test(help) && !/yellow rail/.test(help), 'the table paragraph names Clear and the tab');
  assert.ok(/Sleep it off in Rest\./.test(help) && !/Rest in Rest\./.test(help), 'and sleeps it off');
  assert.ok(/A question that takes a card spends it, like a verb; one marked for good keeps it\./.test(help), 'Yourself says what a question costs');
  // Slots are framed cards; bad tokens are marked.
  assert.ok(/border: none/.test(rule('.slot .s-box.empty')) && /cframe-06/.test(rule('.slot .s-box.empty')), 'an empty slot draws a frame, not a border');
  assert.ok(/cframe-03/.test(rule('.slot.primary .s-box.empty')), 'gold for the first slot');
  assert.ok(/\.slot\[data-slot="mind"\] \.s-box\.empty, \.slot\[data-slot="grow"\] \.s-box\.empty, \.slot\[data-slot="aid2"\] \.s-box\.empty, \.slot\[data-slot="aid3"\] \.s-box\.empty \{ --frame: var\(--art-cframe-02\)/.test(css), 'blue for an ability');
  assert.ok(/\.slot\[data-verb="arrest"\] \.s-box\.empty, \.slot\[data-slot="c1"\] \.s-box\.empty, [^{]*\{ --frame: var\(--art-cframe-01\)/.test(css), 'red before the Court');
  var sicon = rule('.slot .s-box.empty ~ .s-icon');
  assert.ok(/\* 0\.44\)/.test(sicon) && /width: 46%/.test(sicon) && /clip-path: circle\(41%\)/.test(sicon), 'the icon sits in the arch');
  // Round 8: the name sits under the slot, on the baseline of the filled ones (the room of the small icon).
  assert.ok(!rule('.slot .s-box.empty ~ .s-label') && /margin-top: 25px/.test(rule('.slot .s-box.empty ~ .s-icon ~ .s-label')), 'the name under the slot, on one baseline');
  assert.ok(/drop-shadow\(0 0 3px rgba\(208, 86, 74, 1\)\)/.test(rule('.card.bad .c-face')), 'a bad token wears a red shadow');
  // The ending.
  var end = /<div class="modal screen hidden" id="end">([\s\S]*?)\n  <\/div>\n/.exec(html)[1];
  assert.ok(/<div class="screen-box end-box">/.test(end) && /<div class="banner" id="end-banner"><span id="end-title"><\/span><\/div>/.test(end) && /<div class="paper end-paper">/.test(end), 'the ending is a screen with a banner and paper');
  assert.ok(/id="end-card-pic"/.test(end) && /id="end-card-seal"/.test(end) && /class="ec-name" id="end-card-bottom"/.test(end), 'the end card has its arch, its circle and its band');
  ['end-successor', 'end-new', 'end-archive', 'end-look'].forEach(function (id) { assert.ok(new RegExp('class="plate-btn [a-z]+" id="' + id + '"').test(end), id + ' is a plate button'); });
  assert.ok(/cbar-01/.test(rule('.banner.lose span')) && /cbar-03/.test(rule('.banner.win span')), 'red on a loss, gold on a win');
  assert.ok(/cwide-03/.test(rule('.end-win .end-card')) && /cwide-04/.test(rule('.end-lose .end-card')), 'the end card is a wide frame of the same tone');
  var statb = rule('.stats b');
  // Lane 2, item 101: the number stands beside its tile, never over it.
  assert.ok(/width: 40px; height: 40px; font-size: 0/.test(statb) && /var\(--c, /.test(statb) && /font-family: var\(--display\)/.test(rule('.stats em')) && /font-size: 22px/.test(rule('.stats em')), 'the counters are 40px tiles with the number beside them in the display font');
  assert.ok(/'cres-09'\]/.test(main) && /'cres-03'\]/.test(main) && /'cres-12'\]/.test(main) && /'cres-04'\]/.test(main) && /--c:var\(--art-' \+ x\[2\]/.test(main), 'onGameOver sets a counter per tile');
  assert.ok(/'screen-box end-box ' \+ \(over\.win \? 'end-win' : 'end-lose'\)/.test(main) && /'banner ' \+ \(over\.win \? 'win' : 'lose'\)/.test(main) && !/end-card-top/.test(main) && !/modal-box/.test(main), 'and the classes');
  // The pile.
  var pz = rule('#board .pile-zone');
  assert.ok(/z-index: auto/.test(pz) && (pz.match(/repeating-linear-gradient/g) || []).length === 3 && /var\(--cell-px, 130px\)/.test(pz) && !/border-bottom/.test(pz), 'the strip is six faint cells, above the grid and below the cards');
  assert.ok(/width: 34px/.test(rule('#board .pile-zone .pz-tab')) && /ctab-04/.test(rule('#board .pile-zone .pz-tab')) && /z-index: 2/.test(rule('#board .pile-zone .pz-tab')), 'the tab hangs off the corner');
  var lab = rule('#board .pile-zone .pz-label');
  assert.ok(/border-image: var\(--art-clabel-02\)/.test(lab) && /z-index: 2/.test(lab) && /color: #1c1914/.test(lab), 'the label is a painted bar in paper ink');
  assert.ok(/--cell-px/.test(screens) && /CF\.Settings\.onChange\(cellPitch\)/.test(screens), 'the cell pitch follows the spacing setting');
  // The verb window and the dossier.
  var vw = /\n\.vwin \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.ok(/border: solid transparent; border-width: calc\(64px \* var\(--ui-scale, 1\)\) calc\(66px/.test(vw) && /background: none/.test(vw) && /color: var\(--paper-ink\)/.test(vw) && /overflow: visible/.test(vw), 'the window is bordered for the panel, in paper ink');
  assert.ok(/border-image: var\(--art-cpanel3-01\) 64 66 28 20 fill \/ 1 stretch/.test(rule('.vwin::before')), 'the panel is painted on ::before');
  assert.ok(/overflow: auto/.test(rule('.vw-body')) && /flex: 1 1 auto/.test(rule('.vw-body')), 'the body scrolls under the bar');
  assert.ok(/position: absolute/.test(rule('.vw-head')) && /top: -56px/.test(rule('.vw-head')) && /color: var\(--paper\)/.test(rule('.vw-head h3')), 'the head sits in the bar, the title in paper white');
  var vc = rule('.vw-close');
  assert.ok(/position: absolute/.test(vc) && /width: 44px; height: 44px/.test(vc) && /background: none/.test(vc) && /right: -54px/.test(vc), 'the X is a 44px hot spot over the baked X');
  assert.ok(/background: #f6efdc/.test(rule('.recipe')) && /border: 1px solid #a88a4c/.test(rule('.recipe')), 'the recipe is a bordered paper inset');
  assert.ok(!/background: var\(--paper\)/.test(rule('.story')), 'the story has no paper of its own');
  assert.ok(/transform: none/.test(rule('[dir=rtl] .vwin')) && /scaleX\(-1\)/.test(rule('[dir=rtl] .vwin::before')) && /left: -54px/.test(rule('[dir=rtl] .vw-close')), 'Arabic mirrors the panel and moves the X left');
  assert.ok(/border-image: var\(--art-cpanel3-01\) 64 66 28 20 fill \/ 1 stretch/.test(rule('#peek')) && /border-width: 45px 46px 20px 14px/.test(rule('#peek')), 'the dossier is the same panel, smaller');
  assert.ok(/<div id="peek"><\/div>\s*<button id="peek-x" title="Close">/.test(html) && /display: block/.test(rule('#peek.open + #peek-x')) && /peek-x/.test(screens) && /#peek \.peek-close/.test(screens), 'the dossier\'s X is a hot spot beside the panel, wired to its close');
  console.log('ui: the stylesheet and the markup paint the panels, the pile, the slots and the ending');
})();

// ---- Lot V, items 15-19: glows pulse by opacity on pseudo-elements and the pause is a shade, the
// badges and counts are seals, the journal is paper, nothing is promoted at rest and the table can
// lie flat, the dead rules are gone, the grey button is blue and the third speed has its glyph.
(function markup3() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
  var settingsSrc = fs.readFileSync(path.join(__dirname, '..', 'js/settings.js'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }
  // Glows: the keyframes move opacity alone, each on a pre-drawn pseudo-element.
  ['pulse', 'glow', 'urgent', 'urgentIcon', 'mergedGlow'].forEach(function (k) {
    var kf = new RegExp('@keyframes ' + k + ' \\{([^}]*\\}[^}]*)\\}').exec(css);
    assert.ok(kf && /opacity: 1/.test(kf[1]) && !/filter/.test(kf[1]), k + ' animates opacity, not a filter');
  });
  assert.ok(/animation: pulse/.test(rule('.verb.done .v-token::before')) && /box-shadow/.test(rule('.verb.done .v-token::before, .verb.new .v-token::before, .verb.noticed .v-token::before')), 'a done token pulses on its ::before');
  assert.ok(/animation: urgent /.test(rule('.card.urgent::after')) && /box-shadow/.test(rule('.card.urgent::after, .card.noticed::after, .card.merged::after')), 'an urgent card glows on its ::after');
  assert.ok(/animation: urgentIcon/.test(rule('.meter.crit .m-icon::after')) && /animation: pulse/.test(rule('.edge-mark b::after')) && /animation: glow/.test(rule('.verb .v-magnet.asks::after')), 'the meter, the edge mark and the ask box too');
  assert.ok(!/animation: (pulse|glow|urgent)/.test(rule('.verb.done .v-token') || '') && !/\.card\.urgent \.c-face \{/.test(css) && !/\.meter\.crit \.m-icon \{/.test(css), 'nothing animates on the element itself');
  assert.ok(!/#table\.paused #board/.test(css) && /rgba\(6, 20, 24, 0\.35\)/.test(rule('#table.paused #tilt::after')) && /pointer-events: none/.test(rule('#table.paused #tilt::after')), 'the pause is a shade over the plane');
  assert.ok(!/transition: filter/.test(rule('#board')), 'the board has no filter transition');
  assert.ok(!/filter/.test(rule('#board .links path')) && /translateY\(2px\)/.test(rule('#board .links path.shade')), 'the ropes have a shadow path, not a filter');
  var rm = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(rm && /\.verb\.done \.v-token::before[^{]*\.card\.urgent::after[^{]*\{ animation: none/.test(rm[1]), 'the pulses hold still under reduced motion');
  assert.ok(/transform-origin: right center/.test(rule('#weekbar .wb-shade')) && /transition: transform 0\.5s linear/.test(rule('#weekbar .wb-shade')) && !/transition: left/.test(rule('#weekbar .wb-shade')), 'the week shade is right-anchored for the scaleX');
  // Seals and counters.
  var badge = rule('.verb .v-badge'), count = rule('.verb .v-count');
  assert.ok(/width: 40px; height: 40px/.test(badge) && /background: center \/ contain no-repeat/.test(badge) && !/var\(--good\)/.test(badge) && !/border-radius/.test(badge), 'the badge is a 40px seal with no disc');
  assert.ok(/width: 30px; height: 30px/.test(count) && /background: center \/ contain no-repeat/.test(count) && !/var\(--accent\)/.test(count) && !/border-radius/.test(count), 'the count is a 30px seal');
  assert.ok(/border-radius: 50%/.test(rule('.verb .v-count.figures, .verb .v-badge.figures')), 'figures past five get a disc');
  assert.ok(/background-size: 78%/.test(rule('.verb.time .v-magnet')) && /box-shadow:[^;]*rgba\(240, 200, 90, 0\.7\)/.test(rule('.verb .v-magnet.due')), 'the Bell shows its ring at 78% and keeps the due glow');
  // The journal on paper.
  assert.ok(/width: 18px; height: 18px/.test(rule('.firsts .first i')) && /display: inline-block/.test(rule('.firsts .first i')), 'the firsts wear 18px marks');
  assert.ok(/float: left/.test(rule('.journal-entry .j-icon')) && /width: 20px; height: 20px/.test(rule('.journal-entry .j-icon')), 'an entry floats its 20px icon');
  assert.ok(/rgba\(239, 227, 198, 0\.92\)/.test(rule('#journal')) && /border: 2px solid #b8913f/.test(rule('#journal')), 'the journal is paper at 92%');
  assert.ok(/border-inline-start: 3px solid/.test(rule('.journal-entry')) && /background: rgba\(255, 250, 238/.test(rule('.journal-entry')) && /border-inline-start-color: var\(--danger\)/.test(rule('.journal-entry.k-case')), 'entries are paper blocks with the kind down the side a line starts on');
  assert.ok(/cbar-02/.test(rule('.side-head')) && /color: #1c1914/.test(rule('.side-head')), 'the head is the small blue banner');
  // No layers at rest; the flat table.
  var card = /\n\.card \{([^}]*)\}/.exec(css)[1], verb = /\n\.verb \{([^}]*)\}/.exec(css)[1];
  assert.ok(!/will-change/.test(card) && !/will-change/.test(verb), 'cards and verbs are not promoted at rest');
  assert.ok(/will-change: transform/.test(rule('.card.lifted, .card.settle, .card.flying, .card.arrive, .verb.dragging, #drag-layer .card')), 'only while they move');
  assert.ok(!/box-shadow/.test(rule('#board::before')) && (rule('#tilt').match(/radial-gradient/g) || []).length === 2, 'the table\'s shadow is a gradient on the plane');
  assert.ok(/contain: paint/.test(rule('#table')), 'the table contains its paint');
  assert.ok(/transform: none/.test(rule('html[data-flat] #tilt')) && /perspective: none/.test(rule('html[data-flat] #table')), 'data-flat lays the table flat');
  assert.ok(/tilt: true/.test(settingsSrc) && !/deviceMemory/.test(settingsSrc) && /prefers-reduced-motion: reduce/.test(settingsSrc), 'tilt is on by default, off only under reduced motion');
  assert.ok(/<label for="s-tilt">Tilt the table<\/label><input type="checkbox" class="toggle" id="s-tilt">/.test(html) && /<p class="set-note">Off, the table lies flat: easier on an old phone\.<\/p>/.test(html), 'the Settings row and its note');
  assert.ok(/'snap', 'strings', 'haptics', 'tilt', 'calm'\]/.test(screens), 'screens.js wires it like snap');
  // settings.js under Node: the attribute follows the value.
  var keep = CF.Settings, store = {};
  globalThis.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } };
  vm.runInThisContext(settingsSrc, { filename: 'js/settings.js' });
  var root = document.documentElement;
  assert.strictEqual(CF.Settings.get('tilt'), true, 'tilt defaults on');
  assert.ok(!root.hasAttribute('data-flat'), 'no data-flat on the page');
  CF.Settings.save({ tilt: false });
  assert.ok(root.hasAttribute('data-flat'), 'turning it off lays the table flat');
  CF.Settings.save({ tilt: true });
  assert.ok(!root.hasAttribute('data-flat'), 'and on tilts it again');
  var mm = globalThis.matchMedia;
  globalThis.matchMedia = function (q) { return { matches: q === '(prefers-reduced-motion: reduce)', addEventListener: function () {}, addListener: function () {} }; };
  store = {};
  CF.Settings.load();
  assert.strictEqual(CF.Settings.get('tilt'), false, 'a first run under reduced motion lies flat');
  assert.ok(root.hasAttribute('data-flat'), 'from the first paint');
  store = { 'casefile.settings.v1': JSON.stringify({ tilt: true }) };
  CF.Settings.load();
  assert.strictEqual(CF.Settings.get('tilt'), true, 'a saved choice wins');
  globalThis.matchMedia = mm;
  CF.Settings = keep;
  // Dead rules, the blue button, the third speed.
  assert.ok(!/#side \{/.test(css) && !/#inspector/.test(css) && !/\.c-sub/.test(css) && !/\.c-timer/.test(css), 'the dead rules are gone');
  assert.ok(!/plate-btn\.grey/.test(css) && !/plate-btn grey/.test(html) && /cpill-02/.test(rule('.plate-btn.blue')) && (html.match(/class="plate-btn blue/g) || []).length >= 4, 'the blue button is called blue');
  var sp3 = rule('#controls button[data-speed="3"]::after');
  assert.ok(sp3 && /data:image\/svg\+xml/.test(sp3) && (sp3.match(/l24 20-24 20/g) || []).length === 3, 'speed 3 wears three chevrons');
  assert.ok(/data-speed="3" title="Fastest \(3\)" style="--i:var\(--art-bround-06\)"><\/button>/.test(html) && !/<small>/.test(html), 'over bround-06, with no numeral');
  console.log('ui: the glows, the seals, the paper journal, the flat table and the third speed hold');
})();

// ---- Round 8, lane 2: the way to full proof is taught (confront the accused), the advisor never sends a player
// back to a searched-out scene, the camera leaves #table's style alone, the Crowd names its tally, and the first
// case's Court says in red that Indicia walk.
(function fullProof() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 29 });
  UI.attach(e);
  ['interrogate', 'arrest', 'investigate', 'duty'].forEach(function (v) { e.verb(v).unlocked = true; });
  var rec = e.openCases()[0];
  rec.searches = 1;
  e.tableCards().forEach(function (c) { if (c.def === 'evidence' || c.def === 'witness' || c.def === 'insight') e.remove(c); });
  e.revealSuspect(rec, null, { key: rec.culprit });
  rec.identified = rec.culprit;
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  var sus = e.suspectOf(sc);
  sus.questioned = true;
  // Every row of the case met, and no word behind it: half proof that nothing on the table can finish.
  var prof = CF.Charge.profileOf(rec), toks = [];
  Object.keys(prof).forEach(function (k) { var a = {}; a[k] = prof[k]; toks.push(e.create('clue', e.clueSpec(rec, { label: 'Proof of ' + k, text: 'It shows.', aspects: a }))); });
  var a = e.assessCharge(sc, toks);
  assert.notStrictEqual(a.tier, 'strong', 'rows alone are not full proof');
  var wit = e.cardsOf('focus').filter(function (c) { return c.loc.t === 'table' && !e.unavailableReason(c); })[0] || e.create('focus');
  var say = UI.advice();
  assert.ok(/^Confront /.test(say) && /token of the case and Wit/.test(say), 'the advisor teaches the confrontation: ' + say);
  assert.strictEqual(UI.hintGo && UI.hintGo.uid, sc.uid, 'and the hint goes to the accused');
  UI.selected = sc.uid;
  render(e);
  var peek = $('#peek').innerHTML;
  assert.ok(/Still wanted: a witness, a confession, or proof that names them/.test(peek), 'the dossier says what full proof still wants: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 400));
  assert.ok(/Confront them in Question with a token of the case/.test(peek) && !/Questioned already/.test(peek), 'and a questioned accused can still be confronted');
  UI.selected = e.caseCard(rec.id).uid;
  render(e);
  assert.ok(/Still wanted: a witness, a confession, or proof that names them/.test($('#peek').innerHTML), 'the case dossier says it too');
  UI.selected = null;
  // A searched-out scene: never 'search again'. Door to door when the case's Quarter is on the table.
  e.remove(wit);
  e.cardsOf('focus').forEach(function (c) { if (c.loc.t === 'table') e.remove(c); });
  while (e.cardsOf('funds').filter(function (c) { return c.loc.t === 'table'; }).length < 2) e.create('funds');
  rec.found = rec.items.length;
  if (!rec.witnesses.length) rec.witnesses.push('a carter');
  var q = e.create('district', { data: { district: rec.district } });
  say = UI.advice();
  assert.ok(/^Go door to door: /.test(say) && say.indexOf(rec.title) >= 0, 'the advisor sends the player door to door: ' + say);
  e.remove(q);
  say = UI.advice();
  assert.ok(/^Charge .* on half proof, or let it go\.$/.test(say), 'without a Quarter: charge on half proof, or let it go: ' + say);
  assert.ok(!/search|Search/.test(say), 'never the searched-out scene');
  // A free confession on the table is full proof.
  var conf = e.create('clue', e.clueSpec(rec, { label: 'Confession: ' + sus.name, text: 'Freely.', aspects: { testimony: 3, motive: 1 } }, [], { confession: 'free' }));
  assert.strictEqual(e.assessCharge(sc, toks.concat([conf])).tier, 'strong', 'a confession freely given finishes it');
  assert.ok(/^The proof is enough/.test(UI.advice()), 'and the advisor says so');
  // The camera moves only the board: no custom property on #table to restyle every card on each zoom step.
  UI.fitView();
  assert.ok(!Object.keys($('#table').style).some(function (k) { return /^--z$/.test(k); }), 'the zoom writes nothing on #table');
  // The Crowd's help names the tally of names abroad, the threshold and the ways to lower it.
  e.create('atlarge', { label: 'Abroad: Kaspar Ohm', data: { name: 'Kaspar Ohm' } });
  UI.showMeterInfo('pressure');
  var mp = $('#peek').innerHTML;
  assert.ok(/Thieves abroad: \d+\. At four/.test(mp) && /Work the Quarter/.test(mp) && /Old Ghosts/.test(mp), 'the Crowd names the tally and the levers: ' + mp.replace(/<[^>]+>/g, ' ').slice(0, 300));
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  console.log('ui: confronting is taught, a searched-out scene is never sent to, the Crowd names its tally');
})();

(function firstCourt() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 13 });
  UI.attach(e);
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  assert.ok(sc && e.autoSlot('arrest', sc.uid), 'the accused goes before the Court');
  UI.openWindow('arrest');
  render(e);
  var pane = $('#windows').querySelector('.vwin .vw-body');
  assert.ok(/tier-weak/.test(pane.firstChild.innerHTML) || pane.firstChild.querySelector('.charge.tier-weak'), 'no tokens: Indicia');
  assert.ok(!pane.querySelector('.ch-first'), 'an ordinary case has no first-case line');
  $('#windows').querySelector('.vw-close').click();
  render(e);
  rec.opening = true;
  if (!e.verb('arrest').slots[e.primaryKey('arrest')]) e.autoSlot('arrest', sc.uid);
  UI.openWindow('arrest');
  render(e);
  var wins = $('#windows').querySelectorAll('.vwin');
  pane = wins[wins.length - 1].querySelector('.vw-body'); // the one closing a moment ago is still leaving
  var first = pane.querySelector('.ch-first');
  assert.ok(first && /On Indicia the Court will let them go/.test(first.textContent), 'the first case of the office says, in red, that Indicia walk');
  wins[wins.length - 1].querySelector('.vw-close').click();
  render(e);
  console.log('ui: the first case\'s Court warns that Indicia walk');
})();

// A lesson whose cue is long met gives way to the advisor while the player sits idle, and comes back on a touch.
(function staleLesson() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 31, guided: true });
  UI.attach(e);
  var lesson = e.introHint();
  assert.ok(lesson, 'a guided start has a lesson');
  UI.lastInput = performance.now();
  e.s.intro.lastBeatT = e.s.t;
  render(e);
  assert.strictEqual($('#hint').textContent, lesson, 'the lesson shows');
  e.s.choice = { id: 'stale', title: 'A question', text: 'Well?', options: [{ label: 'Yes', text: '' }] };
  UI.lastInput = performance.now() - 7000; UI.adviceAt = undefined;
  render(e);
  assert.strictEqual($('#hint').textContent, lesson, 'a fresh lesson holds even when the player is idle');
  e.s.t += 25; UI.adviceAt = undefined;
  render(e);
  assert.ok(/clock waits/.test($('#hint').textContent) && $('#hint').classList.contains('advice'), 'twenty seconds on, the advisor speaks over it: ' + $('#hint').textContent);
  UI.lastInput = performance.now();
  render(e);
  assert.strictEqual($('#hint').textContent, lesson, 'and the lesson returns when the player moves');
  e.s.choice = null;
  console.log('ui: a stale lesson gives way to the advisor while the player is idle');
})();

// ---- Round 8, lane 2, items 9-16: a fading token says how to keep it and the advisor warns before the proof
// goes; the Order's dagger is explained and advised; the Court's plates stay in sight; the ring repaints in steps
// with no filter; the advisor's full proof prefers the Prime Suspect.
(function fadingAndPrime() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 29 });
  UI.attach(e);
  ['interrogate', 'arrest', 'investigate', 'duty', 'reflect'].forEach(function (v) { e.verb(v).unlocked = true; });
  var rec = e.openCases()[0];
  rec.searches = 1;
  e.tableCards().forEach(function (c) { if (c.def === 'evidence' || c.def === 'witness' || c.def === 'insight' || c.def === 'clue') e.remove(c); });
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  var prof = CF.Charge.profileOf(rec);
  function proofs() { return Object.keys(prof).map(function (k) { var a = {}; a[k] = prof[k]; return e.create('clue', e.clueSpec(rec, { label: 'Proof of ' + k, text: 'It shows.', aspects: a })); }); }
  var toks = proofs();
  var tier = e.assessCharge(sc, toks).tier;
  assert.ok(tier === 'reasonable' || tier === 'strong', 'the rows give half proof or better: ' + tier);
  assert.ok(toks[0].maxLife, 'a token keeps a clock');
  // The advisor: a token under the charge about to fade.
  toks[0].life = 40;
  var say = UI.advice();
  assert.ok(/^The proof against .+ fades in 0:40\. Charge now, or lose it\.$/.test(say) && say.indexOf(e.labelOf(sc)) >= 0, 'the advisor warns before the proof fades: ' + say);
  assert.strictEqual(UI.hintGo && UI.hintGo.uid, toks[0].uid, 'and the hint goes to the token');
  // The toast: whom to take to the Court, and that a verb at work stops a card's clock.
  e.emit('expiring', { uid: toks[0].uid, label: e.labelOf(toks[0]), verb: null });
  var tb = $('#toasts').children[$('#toasts').children.length - 1].innerHTML;
  assert.ok(tb.indexOf('Into The Court with ' + e.labelOf(sc) + ' now') >= 0 && /a card's clock stops while a verb works on it/.test(tb) && !/Use it or lose it/.test(tb), 'the fading toast names the accused and how to keep it: ' + tb);
  // A token under no charge: only how to keep it.
  toks.forEach(function (t) { e.remove(t); });
  var lone = e.create('clue', e.clueSpec(rec, { label: 'A Stray Thread', text: 'Nothing much.', aspects: { motive: 1 } }));
  e.emit('expiring', { uid: lone.uid, label: e.labelOf(lone), verb: null });
  tb = $('#toasts').children[$('#toasts').children.length - 1].innerHTML;
  // The time left is told in the city's days, read off the card's own clock.
  var loneDays = CF.daysLeft(lone.life);
  assert.ok(tb.indexOf((loneDays <= 1 ? 'A day' : loneDays + ' days') + ' before it is gone. A card\'s clock stops while a verb works on it.') >= 0 && !/Into The Court|minute/.test(tb), 'a token under no charge says only how to keep it, in days: ' + tb);
  e.remove(lone);
  toks = proofs();
  // The Court's Charge plate: the plates share a row and the name sits in a span a narrow phone hides.
  assert.ok(e.autoSlot('arrest', sc.uid), 'the accused goes before the Court');
  toks.forEach(function (t) { e.autoSlot('arrest', t.uid); });
  UI.openWindow('arrest');
  render(e);
  var wins = $('#windows').querySelectorAll('.vwin'), win = wins[wins.length - 1];
  var go = win.querySelector('.go');
  assert.ok(go && go.parentNode.classList.contains('go-row'), 'the go plate sits in the go row');
  var gn = go.querySelector('.go-name');
  assert.ok(gn && gn.textContent === CF.cardFace(sc, e.labelOf(sc)).text.replace(/^★ /, '') && /^Charge /.test(go.innerHTML), 'the accused\'s name is a span on the Charge plate: ' + go.innerHTML);
  win.querySelector('.vw-close').click();
  render(e);
  e.clearSlots('arrest');
  render(e);
  // Full proof: the Prime Suspect is preferred, and full proof against anyone else is not offered when one is named.
  var other = rec.suspects.filter(function (x) { return x.key !== rec.culprit; })[0];
  e.revealSuspect(rec, null, { key: other.key });
  var oc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.data.key === other.key; })[0];
  var conf = e.create('clue', e.clueSpec(rec, { label: 'Confession: somebody', text: 'Freely.', aspects: { testimony: 3, motive: 1 } }, [], { confession: 'free' }));
  toks.push(conf);
  assert.strictEqual(e.assessCharge(sc, toks).tier, 'strong', 'a free confession is full proof against the culprit');
  assert.strictEqual(e.assessCharge(oc, toks).tier, 'strong', 'and against the other');
  [sc, oc].forEach(function (p) {
    rec.identified = p.data.key;
    var w = UI.advice();
    assert.strictEqual(w, 'The proof is enough: put ' + e.labelOf(p) + ' and the tokens into the Court.', 'the advisor names the Prime Suspect: ' + w);
    assert.strictEqual(UI.hintGo && UI.hintGo.uid, p.uid, 'and points to them');
  });
  // Named somebody the tokens cannot carry: no full proof is offered against the other.
  rec.identified = rec.culprit;
  var sus = e.suspectOf(sc);
  var mark = CF.TRAITS.filter(function (t) { return t.id !== sus.trait; })[0];
  e.remove(conf);
  toks.pop();
  conf = e.create('clue', e.clueSpec(rec, { label: 'Confession: somebody', text: 'Freely.', aspects: { testimony: 3, motive: 1 }, trait: mark.id }, [], { confession: 'free' }));
  toks.push(conf);
  assert.notStrictEqual(e.assessCharge(sc, toks).tier, 'strong', 'a token that describes somebody else spoils the Prime Suspect\'s charge');
  say = UI.advice() || '';
  assert.ok(!/^The proof is enough/.test(say), 'and full proof against another is not offered while your own reasoning named the Prime Suspect: ' + say);
  console.log('ui: a fading token says how to keep it, the advisor warns, the Court\'s plates stay in sight, the Prime Suspect is preferred');
})();

(function daggerAndRing() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 33 });
  UI.attach(e);
  ['arrest', 'duty', 'reflect'].forEach(function (v) { e.verb(v).unlocked = true; });
  e.tableCards().forEach(function (c) { if (c.def !== 'health' && c.def !== 'focus' && c.def !== 'funds') e.remove(c); });
  var d = e.create('dagger');
  var guard = CF.VERBS.duty.slots.some(function (sl) { return (sl.accepts || []).indexOf('dagger') >= 0; });
  var say = UI.advice();
  assert.ok(/^A dagger on the pillow, \d+:\d\d left: into Rest with two Coin to buy a season/.test(say), 'the advisor names the dagger\'s answer: ' + say);
  if (!guard) assert.ok(/alone to endure it\.$/.test(say), 'Rest is its one door while Attend does not take it');
  assert.strictEqual(UI.hintGo && UI.hintGo.uid, d.uid, 'and points to it');
  UI.selected = d.uid;
  render(e);
  var peek = $('#peek').innerHTML;
  var grace = CF.Societies.MOUNTAIN.grace;
  assert.ok(peek.indexOf('Rest with two Coin: ' + grace + ' weeks of peace') >= 0 && /Rest alone: endure it/.test(peek) && /Time left: /.test(peek), 'the dossier says which verb takes it and what the Coin buys: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 400));
  assert.strictEqual(/Attend with a watchman: Double the Guard/.test(peek), guard, 'Attend is named only where the rules let it take the dagger');
  e.s.flags.mountainIgnored = true;
  $('#peek').dataset.uid = '';
  render(e);
  assert.ok(/Ignored once already/.test($('#peek').innerHTML), 'a dagger ignored once says the next has no warning');
  delete e.s.flags.mountainIgnored;
  UI.selected = null;
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  render(e);
  // The verb ring: a line and its glow share a dash written in 200 steps a lap.
  var hp = e.tableCards().filter(function (c) { return c.def === 'health'; })[0] || e.create('health');
  assert.ok(e.autoSlot('duty', hp.uid) && e.start('duty'), 'Attend runs');
  e.verb('duty').elapsed = e.verb('duty').duration * 0.3337;
  render(e);
  UI.updateLive();
  var tok = $('#board').querySelectorAll('.verb').filter(function (x) { return x.dataset.verb === 'duty'; })[0];
  var line = tok.querySelector('rect.line'), glow = tok.querySelector('rect.glow');
  assert.ok(line && glow, 'the ring has a line and a glow');
  var len = 2 * (240 + 240) - 8 * 20 + 2 * Math.PI * 20, dash = parseFloat(line.style.strokeDasharray);
  assert.ok(dash > 0 && Math.abs(dash / (len / 200) - Math.round(dash / (len / 200))) < 0.01, 'the dash is a whole step: ' + dash);
  assert.strictEqual(glow.style.strokeDasharray, line.style.strokeDasharray, 'the glow follows the line');
  var before = line.style.strokeDasharray;
  e.verb('duty').elapsed += e.verb('duty').duration / 1000;
  UI.updateLive();
  assert.strictEqual(line.style.strokeDasharray, before, 'a move under a step writes nothing');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }
  assert.ok(!/filter/.test(rule('.verb .v-ring rect')) && !/filter/.test(rule('.verb .v-ring rect.track')) && !/filter/.test(rule('.verb.done .v-ring rect:not(.track)')), 'no filter on the ring');
  assert.ok(/stroke-width: 14/.test(rule('.verb .v-ring rect.glow')) && /stroke-opacity: 0\.35/.test(rule('.verb .v-ring rect.glow')), 'the glow is a wider pale stroke');
  // The window's plates stay in sight at every width, and a narrow phone drops the name from the Charge plate.
  var phone = css.indexOf('@media (max-height: 520px), (max-width: 980px)'), acts = css.indexOf('\n.vw-body .actions {');
  assert.ok(acts > 0 && acts < phone && /position: sticky; top: 0/.test(rule('.vw-body .actions')) && /border-bottom: 1px solid #a88a4c/.test(rule('.vw-body .actions')) && /order: -1/.test(rule('.vw-body .actions')), 'the sticky plates are outside the phone block');
  assert.ok(/flex-wrap: nowrap/.test(rule('.vw-body .actions.go-row')) && /flex: 1 1 auto; min-width: 0/.test(rule('.actions.go-row .go')) && /flex: none/.test(rule('.actions.go-row .go + button')), 'the go plate and Clear share one row');
  assert.ok(/@media \(max-width: 480px\) \{ \.go-name \{ display: none; \} \}/.test(css) && /@container \(max-width: 480px\) \{ \.go-name \{ display: none; \} \}/.test(css) && /container-type: inline-size/.test(rule('.vw-body')), 'and the name gives way on a narrow screen or in a narrow window');
  // The tier is a line of its own under the verb, so a 150px plate beside Clear does not cut it to 'Full Pr...'.
  assert.ok(/display: block/.test(rule('.plate-btn.go .go-tier')) && !/margin-inline-start/.test(rule('.plate-btn.go .go-tier')), 'the Charge plate\'s tier sits on its own line');
  // A phone on its side with a sheet open: the toast and the table's tools keep opposite top corners in Arabic too.
  assert.ok(/@media \(max-height: 520px\) \{[^@]*\[dir=rtl\] body\.has-window #toasts \{ left: auto; right:[^@]*\[dir=rtl\] #zoom \{ right: auto; left: 10px; \}/.test(css), 'in Arabic the toast takes the right and the tools the left, so it never lies over them');
  console.log('ui: the dagger is advised and explained, the ring steps without a filter, the plates stay in sight');
})();

// ---- Round 8, lane 2, items 17-24: the Rival hunted a thread a week, a swipe on a tile pans, the searched-out
// seal, the Arabic seconds, sounds that do not pile up, harm apart from reminders, the board pinned left.
(function round8c() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 23 });
  UI.attach(e);
  UI.view = UI.view || { x: 0, y: 0, z: 1 };
  render(e);
  // Sounds: harm is the alarm and the shake; a need a heartbeat; other bad news an omen; a verdict's story is silent.
  assert.strictEqual(UI.storySound({ kind: 'danger', title: 'Wounded' }), 'danger', 'harm by title is the alarm');
  assert.strictEqual(UI.storySound({ kind: 'harm', title: 'Anything' }), 'danger', 'a harm kind is the alarm');
  assert.strictEqual(UI.storySound({ kind: 'danger', title: 'Something', harm: true }), 'danger', 'a harm flag is the alarm');
  assert.strictEqual(UI.storySound({ kind: 'danger', title: CF.CARDS.hunger.label }), 'heartbeat', 'a need arriving is a heartbeat');
  assert.strictEqual(UI.storySound({ kind: 'danger', title: 'The Rival Boasts' }), 'omen', 'a boast is an omen');
  assert.strictEqual(UI.storySound({ kind: 'danger', title: 'Not Guilty: Jakob Hess' }), null, 'the acquittal leaves the sound to the verdict');
  assert.strictEqual(UI.storySound({ kind: 'major', title: 'X' }), 'page', 'a major story turns a page');
  assert.strictEqual(UI.storySound({ kind: 'victory', title: 'X' }), null, 'the verdict story rings no second bell');
  assert.strictEqual(UI.dangerWeight({ kind: 'danger', title: 'Lost: Health' }), 'harm', 'a lost ability is harm');
  settings.shake = true;
  $('#app').classList.remove('shake');
  played.length = 0;
  e.story('The Rival Boasts', 'They boast.', 'danger');
  assert.ok(!$('#app').classList.contains('shake') && played.indexOf('omen') >= 0 && played.indexOf('danger') < 0, 'a boast does not shake the screen: ' + played);
  e.story('Beaten on the Stair', 'Ow.', 'danger');
  assert.ok($('#app').classList.contains('shake') && played.indexOf('danger') >= 0, 'a beating does');
  settings.shake = false;
  e.story('A Blow', 'Ow.', 'harm');
  var lastToast = $('#toasts').children[$('#toasts').children.length - 1];
  assert.ok(lastToast && lastToast.classList.contains('k-harm') && /clabel-01/.test(lastToast.style['--bar']), 'a harm story is toasted like danger');
  // The audio's own throttle and priority, on a stand-in clock.
  var actx = { window: {}, document: { addEventListener: function () {}, hidden: false } };
  actx.window.CF = { Settings: { onChange: function () {}, values: {} } };
  actx.window.addEventListener = function () {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8'), actx, { filename: 'js/audio.js' });
  var A = actx.window.CF.Audio;
  assert.ok(A.allow('complete', 10) && !A.allow('complete', 10.001) && !A.allow('complete', 10.5), 'the same ding does not repeat inside its gap');
  assert.ok(A.allow('complete', 10.8), 'and is heard again after it');
  A.reset();
  assert.ok(A.allow('danger', 20) && !A.allow('click', 20.1) && A.allow('gavel', 20.1), 'a lesser cue gives way to a greater one a moment before; a greater one plays');
  A.reset();
  assert.ok(A.allow('click', 30) && !A.allow('page', 30.1) && A.allow('page', 30.5), 'a page turns only alone');
  var asrc = fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8');
  assert.ok(/createDynamicsCompressor/.test(asrc) && /master\.connect\(limiter\)/.test(asrc), 'a limiter sits between the master and the speakers');
  // A finger on a verb tile pans; held still, it lifts the tile; a tap still opens it.
  var tok = $('#board').querySelectorAll('.verb').filter(function (x) { return x.dataset.verb === 'duty'; })[0];
  assert.ok(tok, 'the Attend tile is on the table');
  var inner = new El('div');
  inner.closest = function (sel) { return /\.verb\[data-verb\]/.test(sel) ? tok : null; };
  var vb = e.verb('duty'), vx = vb.x, vy = vb.y, v0 = { x: UI.view.x, y: UI.view.y };
  timers = []; delays = [];
  var down = { pointerId: 7, pointerType: 'touch', button: 0, clientX: 400, clientY: 400, target: inner, preventDefault: function () {} };
  UI.pointer.down(down);
  assert.ok(UI.drag && UI.drag.kind === 'pan' && UI.drag.under && UI.drag.under.kind === 'verb', 'a touch on a tile starts as a pan');
  assert.strictEqual(delays[delays.length - 1], 350, 'with a 350ms hold to lift');
  UI.pointer.move({ pointerId: 7, clientX: 550, clientY: 420, target: inner });
  assert.ok(UI.drag.started && (UI.view.x !== v0.x || UI.view.y !== v0.y), 'a swipe pans the view');
  flushTimers();
  assert.strictEqual(UI.drag.kind, 'pan', 'and the hold does not fire once it moved');
  UI.pointer.up({ pointerId: 7, clientX: 550, clientY: 420, target: inner });
  assert.ok(vb.x === vx && vb.y === vy, 'the tile stays where it was');
  timers = [];
  UI.pointer.down(down);
  flushTimers();
  assert.ok(UI.drag && UI.drag.kind === 'verb' && UI.drag.lifted && tok.classList.contains('held'), 'a hold lifts the tile');
  UI.pointer.move({ pointerId: 7, clientX: 480, clientY: 470, target: inner });
  assert.ok(UI.drag.started, 'and a drag moves it');
  UI.pointer.up({ pointerId: 7, clientX: 480, clientY: 470, target: inner });
  assert.ok((vb.x !== vx || vb.y !== vy) && !tok.classList.contains('held'), 'the tile is put down elsewhere');
  e.moveVerb('duty', vx, vy);
  timers = [];
  UI.pointer.down(down);
  UI.pointer.up({ pointerId: 7, clientX: 400, clientY: 400, target: inner });
  assert.ok(UI.openVerbs.indexOf('duty') >= 0, 'a tap still opens the verb');
  UI.back();
  // The mouse lifts at once, as before.
  UI.pointer.down({ pointerId: 8, pointerType: 'mouse', button: 0, clientX: 400, clientY: 400, target: inner, preventDefault: function () {} });
  assert.strictEqual(UI.drag.kind, 'verb', 'a mouse press on a tile is a tile drag');
  UI.pointer.up({ pointerId: 8, clientX: 400, clientY: 400, target: inner });
  UI.back();
  render(e);
  // The pile, the same.
  var pzEl = $('#board').querySelector('.pile-zone');
  if (pzEl) {
    var pin = new El('div');
    pin.closest = function (sel) { return sel === '.pile-zone' ? pzEl : null; };
    timers = [];
    UI.pointer.down({ pointerId: 9, pointerType: 'touch', button: 0, clientX: 200, clientY: 200, target: pin, preventDefault: function () {} });
    assert.ok(UI.drag.kind === 'pan' && UI.drag.under.kind === 'pile', 'a touch on the pile starts as a pan');
    UI.pointer.up({ pointerId: 9, clientX: 200, clientY: 200, target: pin });
  }
  // A searched-out scene wears the glass stamp on its case card.
  var rec = e.openCases()[0], cc = e.caseCard(rec.id);
  assert.ok(rec && cc, 'a case is open');
  var found0 = rec.found;
  rec.found = rec.items.length;
  render(e);
  var ccEl = $('#board').querySelector('.card[data-uid=' + cc.uid + ']');
  var so = ccEl && ccEl.querySelector('.c-searched');
  assert.ok(so && /cstamp-02/.test(so.style.backgroundImage) && !so.textContent, 'the searched-out stamp, without a word');
  rec.found = found0;
  render(e);
  ccEl = $('#board').querySelector('.card[data-uid=' + cc.uid + ']');
  assert.ok(!ccEl.querySelector('.c-searched'), 'a scene with more to give has none');
  // The Rival: careful for the week a thread was found; the second thread is the other way. (Under the rules
  // that want the Rival caught at it, item 65 below, Question has a slot for their work: read here without it.)
  var islots0 = CF.VERBS.interrogate.slots;
  CF.VERBS.interrogate.slots = islots0.filter(function (sl) { return sl.key !== 'theirs'; });
  if (!e.verb('interrogate').unlocked) e.verb('interrogate').unlocked = true;
  if (!e.verb('investigate').unlocked) e.verb('investigate').unlocked = true;
  var rv = e.create('rival', { label: 'The Rival: Anselm Brecht', data: { name: 'Anselm Brecht', heat: 1, heatWeek: e.s.week, heatBy: 'interrogate', stalled: 0 } });
  e.s.journal.unshift({ t: 1, week: 1, title: 'The Rival Takes a Case', text: '', kind: 'danger' }, { t: 2, week: 1, title: 'A Scene Spoiled', text: '', kind: 'danger' });
  var wit = e.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; })[0] || e.create('focus');
  var ins = e.cardsOf('instinct').filter(function (c) { return c.loc.t === 'table'; })[0] || e.create('instinct');
  void wit; void ins;
  assert.ok(!/Rival/.test(UI.advice() || ''), 'careful this week: no Rival line');
  rv.data.heatWeek = e.s.week - 1;
  var say = UI.advice() || '';
  assert.ok(/shadow Anselm Brecht in Explore with Instinct/.test(say), 'after a Wit thread, the next is shadowing: ' + say);
  rv.data.heatBy = 'investigate';
  say = UI.advice() || '';
  assert.ok(/Question Anselm Brecht with Wit/.test(say), 'after a shadow, the next is a question: ' + say);
  UI.selected = rv.uid;
  rv.data.heatWeek = e.s.week;
  render(e);
  var peek = $('#peek').innerHTML;
  assert.ok(/Careful this week/.test(peek) && /The next thread: Question them with Wit/.test(peek), 'the dossier says when and how: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 300));
  UI.selected = null;
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  CF.VERBS.interrogate.slots = islots0;
  e.remove(rv);
  render(e);
  // The board's children are placed from its origin, in Arabic too.
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  assert.ok(/\n#board > \* \{ position: absolute; left: 0; top: 0;/.test(css), 'every board child is pinned to left and top 0');
  console.log('ui: the Rival a thread a week, a swipe pans past a tile, the searched-out stamp, sounds that do not pile up, harm apart');
})();

// ---- Round 8, lane 2, items 25-32: an instrument's boosts in words, the Court's tier glossed, the Calling's
// dossier with room for the endings and the origin, the first Bell's lesson kept until it rings, the Abroad card
// pointed at its owner's new crime, the promotion's ceremony, and the windows in the period serif.
(function round8d() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 37 });
  UI.attach(e);
  UI.view = UI.view || { x: 0, y: 0, z: 1 };
  render(e);
  function peekText(card) {
    UI.selected = card.uid; render(e);
    var t = $('#peek').innerHTML.replace(/<[^>]+>/g, '\n');
    UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
    return t;
  }
  // An instrument names the kinds of find it sharpens, not the engine's tag ids.
  var kit = e.create('kit'), lab = e.create('labpass');
  var kt = peekText(kit), lt = peekText(lab);
  assert.ok(/Body \+1 on bodies and traces/.test(kt) && !/biology|physical/.test(kt), 'the Physician\'s Case in words: ' + kt);
  assert.ok(/Writ \+1 on papers/.test(lt) && !/records/.test(lt), 'the Apothecary\'s Key in words: ' + lt);
  e.remove(kit); e.remove(lab);
  // The Calling: near an ending the counts say how near, the origin is one line, only the latest note.
  e.initPaths();
  var calling = e.cardsOf('calling')[0] || e.create('calling_master');
  e.s.counts = { mercy: 10, cruelty: 1, purse: 2 };
  e.s.who = 'monk'; e.s.origin = 'commissioner'; e.s.calling = 'master';
  e.s.paths = { commissioner: 2, master: 3, crusader: 1 };
  e.s.pathNotes = [{ path: 'commissioner', n: 1, why: 'promoted' }, { path: 'master', n: 1, why: 'an identification' }];
  var ct = peekText(calling);
  assert.ok(/Mercy 10 of 12/.test(ct) && new RegExp('Hangman at ' + CF.Societies.HANGMANS.cruelty).test(ct), 'the Merciful ending is in sight: ' + ct);
  assert.ok(/Once the physician-monk; set out as The Burgomaster/.test(ct), 'the origin in one line: ' + ct);
  assert.ok(/an identification/.test(ct) && !/promoted/.test(ct), 'only the latest note: ' + ct);
  // The Court's tier carries its gloss.
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  var tok = e.create('clue', e.clueSpec(rec, { label: 'A Small Thing', text: 'Little.', aspects: { motive: 1 } }));
  e.autoSlot('arrest', sc.uid); e.autoSlot('arrest', tok.uid);
  UI.openWindow('arrest');
  render(e);
  var wins = $('#windows').querySelectorAll('.vwin'), win = wins[wins.length - 1];
  var gl = win.querySelector('.ch-gloss');
  assert.ok(gl && /Suspicion, not proof: it will not convict/.test(gl.textContent || gl.innerHTML), 'Indicia glossed in the window');
  win.querySelector('.vw-close').click();
  e.clearSlots('arrest'); e.remove(tok);
  render(e);
  // The Abroad card points at its owner's new crime only where the rules have the recipe for it.
  var crim = { id: 'c-test', name: 'Barent Tanner', crimes: 2, traits: [], organization: 'none', heat: 0, rank: 0 };
  var oldCrim = e.criminal;
  e.criminal = function (id) { return id === crim.id ? crim : oldCrim.call(e, id); };
  var ab = e.create('atlarge', { label: 'Petty Thief: Barent Tanner', data: { criminalId: crim.id } });
  rec.criminalId = crim.id;
  // (The rules have the recipe now: read without it first, then with it.)
  var hadRecipe = CF.RECIPES_BY_ID.ref_known;
  delete CF.RECIPES_BY_ID.ref_known;
  assert.ok(!/Their new crime/.test(peekText(ab)), 'no promise without the recipe');
  CF.RECIPES_BY_ID.ref_known = hadRecipe || { id: 'ref_known', label: 'Known to the Watch' };
  assert.ok(/Their new crime: lay this beside it in Rest/.test(peekText(ab)), 'with it, the hint');
  rec.criminalId = undefined;
  assert.ok(!/Their new crime/.test(peekText(ab)), 'and only while their new case is open');
  if (!hadRecipe) delete CF.RECIPES_BY_ID.ref_known;
  e.remove(ab); e.criminal = oldCrim;
  render(e);
  // The first Bell's lesson stands once the lessons are done, until that week's Bell rings.
  var bell = 'The Bell rings from now on: lodging and dues come out of your Coin at every turn of the week. Attend earns it.';
  e.s.flags.stage = 'keep';
  e.s.intro = e.s.intro || {}; e.s.intro.finished = true; e.s.intro.hint = null;
  UI.lastInput = performance.now();
  e.story(CF.OPENING_TEXT.keep, CF.OPENING_TEXT.keepText, 'major');
  render(e);
  assert.strictEqual($('#hint').textContent, bell, 'the Bell lesson stands after the keep');
  e.s.week++;
  render(e);
  assert.notStrictEqual($('#hint').textContent, bell, 'and gives way when the Bell has rung');
  // A player who came through the opening is not taught to drag cards.
  UI.hintMode = null;
  UI.lastInput = performance.now();
  render(e);
  assert.ok($('#hint').classList.contains('gone') || $('#hint').textContent !== CF.T('Drag cards onto the verbs above, or tap an empty slot to pick a card for it. Drag the table to look around, pinch or scroll to zoom. Drag a stack by its number to move all of it.'), 'no dragging lesson after the opening');
  // The promotion: the kicker over the rank, the wax stamped down, the powers dealt, the badge glows after.
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  assert.ok(/tr\('Promoted'\)/.test(main) && /lu-rank/.test(main) && !/'Promoted: ' \+/.test(main), 'the title is split');
  assert.ok(/classList\.add\('cer'\)/.test(main) && /Audio\.play\('seal'\)/.test(main) && /rank-new/.test(main), 'the ceremony and the glow');
  assert.ok(/\.dlg-levelup\.cer \.lu-badge \{ animation: stamp/.test(css) && /\.dlg-levelup\.cer \.lu-slot:not\(\.empty\) \{ animation: flipIn/.test(css), 'stamp and deal');
  var badge = /\n\.lu-badge \{[^}]*\}/.exec(css)[0];
  assert.ok(!/clip-path/.test(badge) && /border:/.test(badge), 'the wax is framed whole, not clipped');
  assert.ok(/prefers-reduced-motion: reduce\) \{\n  \.dlg-levelup, \.dlg-levelup\.cer \.lu-badge/.test(css), 'and it holds still for less motion');
  // The windows read in the period serif.
  assert.ok(/\n\.vwin, \.picker, \.ask \{ font-family: var\(--serif\); \}/.test(css), 'windows in the serif');
  console.log('ui: instruments in words, the tier glossed, the Calling\'s endings and origin, the Bell kept, the Abroad hint, the promotion, the serif');
})();

// ---- Round 8, lane 2, items 33-40: the Rolls by case, the short screen's banners, a choice from an old save,
// the save on pause and on a hidden page, a token's portrait of whom it is about, fresh editions, Back.
(function round8e() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 41 });
  UI.attach(e);
  UI.view = UI.view || { x: 0, y: 0, z: 1 };
  render(e);
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');

  // The Rolls: each case wears its own crime card and an outcome wax; a sealed record its key.
  assert.strictEqual(UI.caseArt('arson'), 'ccrime-03', 'a case\'s own crime card');
  assert.strictEqual(UI.caseArt(undefined), UI.caseArt('no-such-case'), 'an old record without a template falls back');
  assert.ok(/CF\.UI\.caseArt\(rec\.template\)/.test(screens) && !/CARD_ART\[rec\.outcome\]/.test(screens), 'the archive paints the case, not the outcome');
  assert.ok(/convicted: 'cwax-03'/.test(screens) && /cold: 'cwax-05'/.test(screens) && /class="pc-seal"/.test(screens) && /class="pc-sealed" style="--s:var\(--art-cstamp-04\)"/.test(screens), 'the outcome is a wax, the seal a key');
  assert.ok(/rec\.short \|\| \(tpl && tpl\.label\)/.test(screens), 'the strip names the kind of case, in either language');
  assert.ok(/\.archive-grid \.pcard \.pc-seal \{ top: 3%; right: 3%;/.test(css), 'the wax sits in the corner');

  // A short screen: slim banners and a sideways strip of rooms.
  var shortBlock = css.slice(css.indexOf('/* Help, Settings, the Watch-house and the Rolls'));
  assert.ok(/\.screen-box\.wide > \.banner span \{ font-size: 18px;/.test(shortBlock) && /\.precinct-grid \{ grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 270px; overflow-x: auto;/.test(shortBlock), 'the short window\'s banners and rooms');

  // An old save's choice lists two options the player cannot pay; the question's own free answer is shown.
  var swan = CF.CHOICES.filter(function (c) { return c.id === 'swan'; })[0];
  e.cardsOf('funds', true).forEach(function (c) { e.remove(c); });
  e.cardsOf('focus', true).forEach(function (c) { e.remove(c); });
  e.s.choice = { id: 'swan', title: swan.title, text: swan.text, ctx: null,
    options: [{ label: 'Take the room', text: 'x', cost: 'funds' }, { label: 'Work through', text: 'y', cost: 'focus' }] };
  // Written to disk and read back, as a save from before round 7 would be.
  var old = CF.Engine.load(e.save());
  UI.attach(old);
  render(old);
  var opts = $('#board').querySelector('.choice').querySelectorAll('.ch-opt');
  assert.strictEqual(opts.length, swan.options.length, 'the question\'s own options are shown');
  assert.ok(/Sleep at the desk/.test(opts[2].textContent) && !opts[2].classList.contains('cant'), 'and the free one can be taken');
  assert.ok(old.choose(2) && !old.s.choice, 'it answers the question');
  render(old);
  e.s.choice = null;
  UI.attach(e);
  render(e);
  // A save of today keeps its own options.
  e.offerChoice(swan);
  assert.strictEqual(UI.choiceOptions(e, e.s.choice), e.s.choice.options, 'a current save shows what it stored');
  e.s.choice = null;
  render(e);

  // The save: on an answered choice and on the player's pause (after the tick), and when the page is hidden.
  var ui = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  UI.saveSoon = false; UI.autoPaused = false;
  UI.setPaused(true);
  assert.ok(UI.saveSoon, 'a pause asks for a save');
  UI.saveSoon = false; UI.autoPaused = true; UI.setPaused(true);
  assert.ok(!UI.saveSoon, 'the brief pause under a drag does not');
  UI.autoPaused = false; UI.setPaused(false);
  assert.ok(/if \(type === 'chosen'\) UI\.saveSoon = true;/.test(ui) && /if \(UI\.saveSoon\) \{ UI\.saveSoon = false; saveT = 0; if \(UI\.onSave\) UI\.onSave\(\); \}/.test(ui), 'a choice is saved, after the tick');
  assert.ok(/addEventListener\('visibilitychange', function \(\) \{ if \(document\.hidden\) save\(\); \}\)/.test(main) && /addEventListener\('pagehide', save\)/.test(main), 'a hidden page is saved');

  // A token about one accused wears their portrait, and the dossier names them first.
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sus = rec.suspects.filter(function (x) { return x.key === rec.culprit; })[0];
  var plate = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  var motive = e.create('clue', e.clueSpec(rec, { label: 'Motive: ' + sus.name, text: 'A reason.', aspects: { motive: 2 } }));
  motive.data.about = sus.key;
  var plain = e.create('clue', e.clueSpec(rec, { label: 'A Boot Print', text: 'Mud.', aspects: { forensic: 1 } }));
  render(e);
  var mEl = $('#board').querySelector('.card[data-uid=' + motive.uid + ']'), pEl = $('#board').querySelector('.card[data-uid=' + plain.uid + ']');
  var pip = mEl && mEl.querySelector('.c-about');
  assert.ok(pip, 'the Motive wears a portrait');
  var plateFace = plate && $('#board').querySelector('.card[data-uid=' + plate.uid + ']').querySelector('.c-face');
  assert.ok(plateFace && pip.style.backgroundImage === plateFace.style['--pic'], 'the picture of the nameplate: ' + pip.style.backgroundImage);
  assert.ok(pEl && !pEl.querySelector('.c-about'), 'a token about nobody wears none');
  assert.ok(!mEl.querySelector('.chip.trait'), 'and it is not the mark chip, which means a mark was found');
  UI.selected = motive.uid; render(e);
  var lines = $('#peek').querySelector('.i-lines');
  assert.ok(lines && lines.children[0].textContent === 'About ' + sus.name, 'the dossier opens with whom it is about: ' + (lines && lines.children[0].textContent));
  UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  e.remove(motive); e.remove(plain);
  render(e);

  // Back puts away the nearest thing first: the picker, the pinned dossier, the journal, then the windows, then the menu.
  var menus = 0;
  UI.onBack = function () { menus++; return true; };
  UI.pick = { verb: 'duty', slot: 0 };
  assert.ok(UI.back() && !UI.pick && menus === 0, 'Back closes the slot picker');
  UI.selected = plate.uid; render(e);
  assert.ok($('#peek').classList.contains('pinned'), 'the dossier is pinned');
  assert.ok(UI.back() && !$('#peek').classList.contains('pinned') && !$('#peek').classList.contains('open') && UI.selected === null && menus === 0, 'Back closes the dossier');
  UI.toggleJournal(true);
  assert.ok(UI.back() && !$('#journal-drawer').classList.contains('open') && menus === 0, 'Back closes the journal');
  UI.back();
  assert.strictEqual(menus, 1, 'and only then opens the menu');
  UI.onBack = null;
  assert.ok(/else if \(ev\.key === 'Escape'\) closeNearest\(\);/.test(ui), 'Escape shares it');
  console.log('ui: the Rolls by case, the short screen, an old choice answered, the save on pause, the portrait of whom, Back');
})();

// ---- Round 8, lane 2 (41-48): the edge marks read no element, the phone's turn card, the drag by translate and the
// pan once a frame, the bar's empty badge and hit-slop, the urgent before the finished, the city's memory of fear,
// the clocks readable far out, and a phone's tap on a story toast.
(function round8c6() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var ui = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var e = CF.Engine.newGame({ calling: 'master', seed: 23 });
  UI.attach(e);
  render(e);
  Object.defineProperty(El.prototype, 'isConnected', { configurable: true, get: function () { return body.contains(this); } });
  var reads = 0, realRect = El.prototype.getBoundingClientRect;
  El.prototype.getBoundingClientRect = function () { reads++; return realRect.call(this); };

  // An edge mark is placed from the camera and the state: no element measured once it stands, and written only on change.
  UI.view = { x: -6000, y: 0, z: 1 };
  timers = [];
  UI.notice({ verb: 'duty', label: 'Attend' });
  flushTimers();
  var mark = $('#table').querySelectorAll('.edge-mark')[0];
  assert.ok(mark && !mark.classList.contains('hidden'), 'the off-screen tile gets a mark');
  // The stand-in measures every element 100px wide: the mark's centre keeps half of that, and 4px, from the edge.
  assert.strictEqual(mark.style.left, '54px', 'at the left edge, toward it, its label whole on screen');
  reads = 0;
  var writes = 0, st = mark.style, left = st.left;
  Object.defineProperty(st, 'left', { configurable: true, get: function () { return left; }, set: function (v) { writes++; left = v; } });
  UI.updateLive(); UI.updateLive(); UI.updateLive();
  assert.strictEqual(writes, 0, 'nothing moved: nothing written');
  UI.view.y = -40;
  UI.updateLive();
  assert.ok(reads === 0, 'and no element is measured for it: ' + reads);
  UI.view = { x: 0, y: 0, z: 1 };
  UI.updateLive();
  assert.ok(mark.classList.contains('hidden'), 'in sight, the mark goes');
  assert.ok(/body\.has-window \.edge-mark, #peek\.open ~ \.edge-mark \{ display: none; \}/.test(css), 'on a phone the marks keep off the sheet and the dossier');
  UI.notices.slice().forEach(function (n) { n.mark.remove(); });
  UI.notices.length = 0;

  // The clocks' counter-scale steps with the zoom, written only when a step is crossed.
  UI.view = { x: 0, y: 0, z: 0.5 };
  UI.fitView();
  var board = $('#board');
  UI.view.z = 0.5; UI.panTo(-1); // nothing to pan to: the view is not applied
  var zk0 = board.style['--zk'];
  assert.ok(zk0, 'the board carries --zk');
  assert.ok(/\.card \.c-time \{ font-size: calc\(12px \* var\(--zk, 1\)\); \}/.test(css) && /\.verb \.v-status \{ font-size: calc\(13px \* var\(--zk, 1\)\); \}/.test(css) && /\.card \.c-ringsvg rect \{ stroke-width: calc\(4px \* var\(--zk, 1\)\); \}/.test(css), 'the time, the count and the ring grow as the board shrinks');
  assert.ok(/var zk = Math\.round\(100 \/ U\.clamp\(Math\.round\(v\.z \* 10\) \/ 10, 0\.6, 1\)\) \/ 100;/.test(ui) && /if \(zk !== zkShown\)/.test(ui), 'in tenths, written on a change');
  // The empty pile does not widen the fit: the opening's few cards are seen close.
  var pile = e.pile();
  e.tableCards().forEach(function (c) { if (c.loc.x >= pile.x && c.loc.x < pile.x + 6 * CF.TABLE.PX && c.loc.y >= pile.y && c.loc.y < pile.y + CF.TABLE.CH) c.loc = { t: 'table', x: pile.x + 7 * CF.TABLE.PX, y: pile.y + 2 * CF.TABLE.PY }; });
  render(e);
  UI.fitView();
  var zEmpty = UI.view.z;
  var inPile = e.tableCards()[0];
  inPile.loc = { t: 'table', x: pile.x + 5 * CF.TABLE.PX, y: pile.y };
  render(e);
  UI.fitView();
  assert.ok(UI.view.z <= zEmpty, 'a card in the pile brings its strip into the fit (' + UI.view.z + ' vs ' + zEmpty + ')');

  // A pan writes the board once a frame; the camera's numbers follow every move.
  var raf = [], realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = function (fn) { raf.push(fn); return raf.length; };
  var felt = new El('div');
  felt.closest = function (sel) { return sel === '#table' ? $('#table') : null; };
  UI.view = { x: 0, y: 0, z: 1 };
  UI.pointer.down({ pointerId: 3, pointerType: 'touch', button: 0, clientX: 400, clientY: 400, target: felt, preventDefault: function () {} });
  var t0 = board.style.transform;
  UI.pointer.move({ pointerId: 3, clientX: 430, clientY: 410, target: felt });
  UI.pointer.move({ pointerId: 3, clientX: 460, clientY: 420, target: felt });
  UI.pointer.move({ pointerId: 3, clientX: 490, clientY: 430, target: felt });
  assert.strictEqual(raf.length, 1, 'three moves, one frame asked for');
  assert.strictEqual(board.style.transform, t0, 'the board waits for it');
  assert.ok(UI.view.x !== 0, 'while the camera keeps up');
  UI.pointer.up({ pointerId: 3, clientX: 490, clientY: 430, target: felt });
  assert.ok(board.style.transform !== t0 && /translate\(/.test(board.style.transform), 'the release draws the last of it');
  assert.ok(/clampView\(tr0\)/.test(ui) && /zoomAt\(pinch\.cx, pinch\.cy, want \/ UI\.view\.z, d\.rect\)/.test(ui), 'the rect is measured once per gesture');
  // A lifted card moves by translate, where the browser has it; it glides home by left and top.
  assert.ok(/d\.el\.style\.translate = Math\.round\(x\) \+ 'px ' \+ Math\.round\(y\) \+ 'px'/.test(ui) && /function liftToLeftTop\(d\)/.test(ui), 'the lift moves by translate');
  assert.ok(!/d\.settleT = setTimeout\(function \(\) \{ if \(UI\.drag === d\)/.test(ui) && /if \(!d\.settleT\) d\.settleT = setTimeout/.test(ui), 'one settle timer at a time');
  globalThis.requestAnimationFrame = realRaf;

  // The bar: no empty gold disc on the play button; 44px under a finger on a phone without growing the art.
  assert.ok(/\.ctl\.dbi small:empty \{ display: none; \}/.test(css), 'an empty badge is not drawn');
  var coarse = css.slice(css.indexOf('@media (pointer: coarse) and (max-width: 980px)'));
  assert.ok(/\.meter \{ position: relative; overflow: visible; \}/.test(coarse) && /\.ctl\.dbi::after \{ content: ''; position: absolute; inset: -4px -1px; \}/.test(coarse) && /\.meter::after \{ content: ''; position: absolute; inset: -7px -2px; \}/.test(coarse), 'the hit-slop reaches 44px');

  // The urgent comes before the finished: a need about to take its due outranks a verb waiting to be emptied.
  var hint = $('#hint');
  UI.hintHidden = false;
  e.verb('duty').status = 'done';
  render(e);
  UI.updateLive();
  assert.ok(/has finished/.test(hint.textContent), 'a finished verb is named: ' + hint.textContent);
  var needDef = CF.NEEDS && Object.keys(CF.NEEDS)[0];
  assert.ok(needDef && e.verb('reflect').unlocked, 'a need and Rest to answer it');
  {
    var need = e.create(needDef);
    need.maxLife = need.maxLife || 120; need.life = 30;
    render(e);
    UI.updateLive();
    assert.ok(/left: into Rest/.test(hint.textContent), 'a need about to take its due comes first: ' + hint.textContent);
    e.remove(need);
  }
  e.verb('duty').status = 'idle';
  render(e);

  // The city remembers its fear: the Dread page says so where the rules keep a floor.
  UI.showMeterInfo('dread');
  var hadFloor = typeof e.dreadFloor === 'function';
  assert.strictEqual(/not below what you have done/.test($('#peek').innerHTML), hadFloor, 'the floor is told only where the rules keep one');
  e.dreadFloor = function () { return 2; };
  e.s.counts = e.s.counts || {}; e.s.counts.cruelty = 6;
  UI.showMeterInfo('dread');
  assert.ok(/not below what you have done/.test($('#peek').innerHTML) && /Cruelties: 6\. Dread stays at 2 of 10 or above\./.test($('#peek').textContent), 'with the count and the floor: ' + $('#peek').textContent);
  delete e.dreadFloor;
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';

  // A phone held upright: the turn card, and the clock and the screen wait; playing upright is a choice kept.
  assert.ok(/id="turn"/.test(html) && /id="turn-ok"/.test(html) && /#table\.upright #turn \{ display: flex; \}/.test(css) && /var\(--art-cback-01\)/.test(css.slice(css.indexOf('#turn .turn-card'))), 'the turn card is art over the felt');
  assert.ok(/!UI\.paused && !UI\.modal && !UI\.upright\) \{\n\s*e\.tick/.test(ui), 'the clock waits under it');
  var mm = globalThis.matchMedia, store = {};
  var realLS = globalThis.localStorage;
  globalThis.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); } };
  globalThis.matchMedia = function (q) { return { matches: q === '(orientation:portrait)' || q === '(max-width:600px)' || q === '(max-width:980px)', addEventListener: function () {}, addListener: function () {} }; };
  UI.paused = false; UI.modal = false; UI.wakeWant = undefined;
  UI.checkUpright();
  assert.ok(UI.upright && $('#table').classList.contains('upright'), 'upright on a phone, the card shows');
  assert.strictEqual(UI.wakeWant, false, 'and the screen may sleep');
  UI.view = { x: 0, y: 0, z: 1 };
  UI.playUpright();
  assert.ok(!UI.upright && !$('#table').classList.contains('upright') && store['casefile.upright'] === '1', 'play upright: the card goes, remembered');
  assert.ok(UI.view.z >= 0.4, 'the fit may go as far as 0.4 upright');
  UI.checkUpright();
  assert.ok(!UI.upright, 'and it does not come back');
  assert.ok(/screen\.orientation\.lock\('landscape'\)/.test(main), 'installed, the page asks to lie on its side');

  // A phone's tap on a story toast puts it away; the Journal stays shut. On a desk it opens the Journal.
  UI.toggleJournal(false);
  e.emit('story', { title: 'Before the Office', text: 'The long night.', kind: 'major' });
  var toastEl = $('#toasts').children[$('#toasts').children.length - 1];
  toastEl.click();
  assert.ok(!$('#journal-drawer').classList.contains('open'), 'a phone tap does not open the Journal');
  assert.ok($('#toasts').children.indexOf(toastEl) < 0, 'it dismisses the toast');
  globalThis.matchMedia = mm;
  globalThis.localStorage = realLS;
  e.emit('story', { title: 'Before the Office', text: 'The long night.', kind: 'major' });
  toastEl = $('#toasts').children[$('#toasts').children.length - 1];
  toastEl.click();
  assert.ok($('#journal-drawer').classList.contains('open'), 'a desk click opens the Journal');
  UI.toggleJournal(false);

  El.prototype.getBoundingClientRect = realRect;
  delete El.prototype.isConnected;
  console.log('ui: marks off the DOM, the turn card, the drag by translate, the bar\'s badge and reach, the urgent first, the city remembers, clocks far out, the phone\'s toast');
})();

// ---- Round 8, lane 2, items 49-56: less motion, a choice with a visible return, a find turned over, the knock
// and the heartbeat, the office's bell, Arabic laid out from the right, Arabic type.
(function round8g() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var fontsAr = fs.readFileSync(path.join(__dirname, '..', 'css/fonts-ar.css'), 'utf8');
  var settingsSrc = fs.readFileSync(path.join(__dirname, '..', 'js/settings.js'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }

  // Less motion: on from the first run where the device asks for it, with the shake off; a saved choice wins.
  var keep = CF.Settings, store = {}, realLS = globalThis.localStorage, mm = globalThis.matchMedia;
  globalThis.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } };
  globalThis.matchMedia = function (q) { return { matches: q === '(prefers-reduced-motion: reduce)', addEventListener: function () {}, addListener: function () {} }; };
  vm.runInThisContext(settingsSrc, { filename: 'js/settings.js' });
  var root = document.documentElement;
  assert.ok(CF.Settings.get('calm') === true && CF.Settings.get('shake') === false && root.hasAttribute('data-calm'), 'a first run under reduced motion is calm and does not shake');
  store = { 'casefile.settings.v1': JSON.stringify({ calm: false, shake: true }) };
  CF.Settings.load();
  assert.ok(CF.Settings.get('calm') === false && CF.Settings.get('shake') === true && !root.hasAttribute('data-calm'), 'a saved choice wins');
  globalThis.matchMedia = function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; };
  store = { 'casefile.settings.v1': JSON.stringify({ master: 50 }) };
  CF.Settings.load();
  assert.ok(CF.Settings.get('calm') === false && CF.Settings.get('shake') === true, 'settings saved before the toggle load with motion as it was');
  CF.Settings = keep; globalThis.matchMedia = mm; globalThis.localStorage = realLS;
  assert.ok(/<label for="s-calm">Reduce motion<\/label><input type="checkbox" class="toggle" id="s-calm">/.test(html), 'the Settings row');
  assert.ok(/animation: none/.test(rule('html[data-calm] #app.shake')) && /fadeIn/.test(rule('html[data-calm] .verb .verdict')) && /fadeOut/.test(rule('html[data-calm] .mini-wrap.flip-out')) && /fadeIn/.test(rule('html[data-calm] .mini-wrap.flip-in')), 'no shake, no slam, flips that fade');
  assert.ok(/html\[data-calm\] \.dlg-levelup, html\[data-calm\] #board \.choice, html\[data-calm\] \.vwin, html\[data-calm\] \.toast[^{]*\{ animation-name: fadeIn; \}/.test(css), 'panels come in by opacity alone');
  // The camera is there at once: no frame of a glide is needed (the stand-in never runs one).
  var e = CF.Engine.newGame({ calling: 'master', seed: 31 });
  UI.attach(e);
  render(e);
  settings.calm = true;
  var spot = e.choiceSpot(), v0 = { x: UI.view.x, y: UI.view.y, z: UI.view.z };
  played.length = 0;
  e.offerChoice(CF.CHOICES.filter(function (c) { return c.id === 'lamplighter'; })[0], null);
  assert.ok(UI.view.x !== v0.x || UI.view.y !== v0.y || UI.view.z !== v0.z, 'a calm camera is on the choice at once');
  void spot;

  // The answer: the Coin flies into the option, the wax comes down on it, the others dim, the camera waits.
  if (!e.cardsOf('funds', true).length) e.create('funds');
  render(e);
  var ch = $('#board').querySelector('.choice');
  var opts = ch.querySelectorAll('.ch-opt');
  var coins = e.cardsOf('funds', true).length;
  timers = []; delays = []; played.length = 0;
  var ghosts = $('#drag-layer').children.length;
  opts[0].click();
  assert.ok(!e.s.choice && e.cardsOf('funds', true).length === coins - 1, 'the Coin is paid');
  assert.ok(ch.classList.contains('answered') && opts[0].classList.contains('taken') && !opts[1].classList.contains('taken'), 'the answer is sealed, the other is not');
  assert.ok(played.indexOf('seal') >= 0 && played.indexOf('drop') < 0, 'the wax is heard, not a dropped card: ' + played);
  assert.ok($('#drag-layer').children.length > ghosts, 'the Coin flies into the option');
  assert.ok(delays.indexOf(550) >= 0, 'the camera waits for the seal');
  render(e);
  assert.ok(ch.parentNode && !ch.classList.contains('gone'), 'the answered panel stays a moment');
  opts[1].click();
  assert.ok(!opts[1].classList.contains('taken'), 'a second press does nothing');
  flushTimers(); flushTimers();
  assert.ok(ch.classList.contains('gone'), 'then it goes');
  assert.ok(/#board \.choice\.answered \.ch-opt:not\(\.taken\) \{ opacity: 0\.45; \}/.test(css) && /cwax-01/.test(rule('#board .choice .ch-opt.taken::after')) && /animation: stamp/.test(rule('#board .choice .ch-opt.taken::after')), 'the seal and the dimming');
  settings.calm = false;

  // A find turned over: a paper flick per card, a moment apart; one that names someone is heard and glows.
  var vid = 'investigate';
  e.verb(vid).unlocked = true;
  if (e.verb(vid).x === undefined) e.layoutVerbs();
  var vb = e.verb(vid), uids = [];
  for (var n = 0; n < 3; n++) {
    var c = e.create(n === 2 ? 'suspect' : 'clue', { label: n === 2 ? 'Suspect: Jakob Hess' : 'A Bloody Shoe', data: {} });
    e.detach(c); c.loc = { t: 'out', verb: vid }; c.hidden = true; vb.out.push(c.uid); uids.push(c.uid);
  }
  vb.status = 'done';
  UI.openWindow(vid);
  render(e);
  timers = []; delays = []; played.length = 0;
  UI.revealAll(vid);
  assert.deepStrictEqual(delays.filter(function (d) { return d >= 180; }), [180, 250, 320], 'each find turns 70ms after the last');
  flushTimers();
  assert.ok(played.filter(function (x) { return x === 'flip'; }).length === 3 && played.indexOf('click') < 0, 'a flick per card, not a menu click: ' + played);
  assert.ok(uids.every(function (u) { return !e.card(u).hidden; }), 'all turned');
  flushTimers();
  assert.ok(played.indexOf('discovery') >= 0, 'the suspect lands with its low note');
  var src = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  assert.ok(/card\.def === 'suspect' \|\| !!d\.points \|\| !!d\.confession/.test(src), 'only a name or a confession is a discovery');
  while (UI.openVerbs.length) UI.back();

  // An ask knocks; a need about to take its due beats once; a fading token is quiet.
  played.length = 0;
  e.emit('ask', { verb: 'duty', label: 'A hand', text: 'Someone.' });
  assert.ok(played.indexOf('knock') >= 0 && played.indexOf('click') < 0, 'an ask knocks');
  var hunger = e.create('hunger');
  played.length = 0;
  e.emit('expiring', { uid: hunger.uid, label: e.labelOf(hunger), verb: null });
  assert.ok(played.indexOf('heartbeat') >= 0, 'a need about to take its due is heard');
  var tok = e.create('clue', { label: 'A Bloody Shoe', data: {} });
  played.length = 0;
  e.emit('expiring', { uid: tok.uid, label: e.labelOf(tok), verb: null });
  assert.strictEqual(played.indexOf('heartbeat'), -1, 'a fading token is not');

  // The audio: the new cues exist and are rate-limited; the promotion has the office's bell, not the ending's fanfare.
  var actx = { window: {}, document: { addEventListener: function () {}, hidden: false } };
  actx.window.CF = { Settings: { onChange: function () {}, values: {} } };
  actx.window.addEventListener = function () {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8'), actx, { filename: 'js/audio.js' });
  var A = actx.window.CF.Audio, asrc = fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8');
  ['flip', 'discovery', 'knock', 'seal', 'office'].forEach(function (k) { assert.ok(new RegExp('\\n    ' + k + ': function').test(asrc), 'the ' + k + ' cue'); });
  assert.ok(A.allow('knock', 5) && !A.allow('knock', 5.9) && A.allow('knock', 6.1), 'a knock at most once a second');
  A.reset();
  assert.ok(A.allow('heartbeat', 5) && !A.allow('heartbeat', 8.5) && A.allow('heartbeat', 9.1), 'a heartbeat at most once in four seconds');
  var promo = main.slice(main.indexOf('UI.onPromotion'), main.indexOf('var promoStamp'));
  assert.ok(/Audio\.play\('office'\)/.test(promo) && !/'victory'/.test(promo) && /Audio\.play\('seal'\)/.test(promo), 'the promotion rings the office bell and seals');
  assert.ok(/15% \{ opacity: 1; transform: scale\(0\.95\); \}/.test(css), 'the new wax is pressed into the bar');

  // Arabic from the right: logical sides for the choices, the ending, the journal, the dossier, the toasts and the hint.
  assert.ok(/text-align: start/.test(rule('#board .choice .ch-opt')) && /padding-inline-end: 44px/.test(rule('#board .choice .ch-opt')) && /inset-inline-end: 8px/.test(rule('#board .choice .ch-opt .ch-cost')), 'a choice reads from where its language starts');
  assert.ok(/text-align: start/.test(rule('.end-box .end-paper .lead')) && /margin-inline: 0 8px/.test(rule('.firsts .first')) && /margin-inline: 0 4px/.test(rule('.firsts .first i')), 'the ending and the firsts');
  assert.ok(/border-inline-start: 2px solid/.test(rule('#peek .i-lines')) && /padding-inline: 58px 30px/.test(rule('.toast')) && /padding-inline: 54px 18px/.test(rule('#hint')), 'the dossier notes, the toast, the hint');
  assert.ok(/scaleX\(-1\)/.test(rule('[dir=rtl] .toast::after, [dir=rtl] .toast::before, [dir=rtl] #hint::after, [dir=rtl] #hint::before')) && /right 8px center/.test(rule('[dir=rtl] .toast .t-icon')), 'the bar is mirrored, the icon is not');
  assert.ok(/\[dir=rtl\] #zoom button\.tool-art\[data-tool=undo\] \{ transform: scaleX\(-1\); \}/.test(css), 'Undo points back the Arabic way');
  assert.ok(/padding-inline: 6px 10px/.test(rule('.edge-mark')), 'the edge mark pads by its sides');

  // Arabic type: real targets, no fake italics, Amiri's own spaces and digits.
  assert.ok(!/\.c-name|\.v-label/.test(css), 'no rule for classes that are gone');
  assert.ok(/font-size: 12\.5px; line-height: 1\.45/.test(rule('[dir=rtl] .card .c-title')) && /font-size: 16px/.test(rule('[dir=rtl] .verb .v-plate')) && /font-size: 14\.5px/.test(rule('[dir=rtl] .toast b')) && /font-size: 13\.5px/.test(rule('[dir=rtl] .meter .m-word')), 'Arabic is set larger where it is read');
  assert.ok(/font-style: normal !important/.test(rule('[dir=rtl] *')), 'Arabic is never slanted');
  assert.ok(/unicode-range: U\+0020-007E/.test(fontsAr) && (fontsAr.match(/font-family: 'Amiri'/g) || []).length === 4, 'Amiri carries its own spaces, digits and stops, in both weights');
  console.log('ui: less motion, the sealed answer, the flick of a find, the knock, the office bell, Arabic from the right, Arabic type');
})();

// ---- Round 8, lane 2, item 61: a card held at the felt's edge carries the camera that way, and stops with it.
(function edgeScrollTest() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 21 });
  UI.attach(e);
  render(e);
  var card = e.tableCards()[0];
  var n = $('#board').querySelector('.card[data-uid=' + card.uid + ']');
  assert.ok(n, 'a card on the table');
  n.closest = function (sel) { return sel === '.card[data-uid]' ? n : null; };
  var raf = [], realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = function (fn) { raf.push(fn); return raf.length; };
  function frames(k) { for (var i = 0; i < k; i++) { var q = raf; raf = []; q.forEach(function (fn) { fn(); }); } }
  UI.view = { x: 16, y: 16, z: 1 };
  UI.pointer.down({ pointerId: 4, pointerType: 'touch', button: 0, clientX: 300, clientY: 300, target: n, preventDefault: function () {} });
  UI.pointer.move({ pointerId: 4, clientX: 320, clientY: 320, target: n });
  assert.ok(UI.drag && UI.drag.started, 'the card is lifted');
  frames(1);
  var x0 = UI.view.x;
  assert.strictEqual(x0, 16, 'away from the edge the camera stays');
  // To the right edge (the table is 1280 wide): the board slides left, frame after frame.
  UI.pointer.move({ pointerId: 4, clientX: 1272, clientY: 320, target: n });
  frames(4);
  assert.ok(UI.view.x < x0 - 10, 'held at the right edge, the camera moves right (' + x0 + ' -> ' + UI.view.x + ')');
  assert.strictEqual(UI.view.y, 16, 'and only that way');
  // Back into the middle: it stops.
  UI.pointer.move({ pointerId: 4, clientX: 640, clientY: 320, target: n });
  frames(3);
  var x1 = UI.view.x;
  frames(3);
  assert.strictEqual(UI.view.x, x1, 'out of the band, the camera rests');
  // At the left edge it comes back; put down, it stops at once.
  UI.pointer.move({ pointerId: 4, clientX: 4, clientY: 320, target: n });
  frames(2);
  assert.ok(UI.view.x > x1, 'the left edge carries it back');
  UI.pointer.up({ pointerId: 4, clientX: 4, clientY: 320, target: n });
  var x2 = UI.view.x;
  frames(3);
  assert.strictEqual(UI.view.x, x2, 'a card put down ends the glide');
  assert.ok(!UI.drag, 'put down');
  globalThis.requestAnimationFrame = realRaf;
  render(e);
  console.log('ui: a card held at the edge carries the camera');
})();

// ---- Round 8, lane 2, item 60: the Fever is heard, marked, pressed, and its locked verbs send you to Rest.
(function fever() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 33 });
  UI.attach(e);
  e.verb('reflect').unlocked = true;
  render(e);
  timers = []; delays = [];
  var marks0 = UI.notices.length;
  var f = e.create('burnout');
  var box = $('#toasts'), n0 = box.children.length;
  e.story('Fever', 'Your hands will not stop shaking.', 'danger');
  render(e);
  assert.strictEqual(UI.strainSeen, f.uid, 'the Fever\'s arrival is caught from its story');
  var t = box.children[box.children.length - 1];
  assert.ok(t && /^Fever/.test(t.querySelector('b').textContent), 'its toast'); void n0;
  flushTimers();
  assert.ok(UI.notices.length > marks0 && UI.notices[UI.notices.length - 1].uid === f.uid, 'an edge mark points at it');
  // Tapped, the toast goes to the card, not the Journal.
  t.click();
  assert.strictEqual(UI.selected, f.uid, 'the toast, tapped, goes to the Fever');
  // Its clock running low: 'Pressing', and it says the file ends.
  e.emit('expiring', { uid: f.uid, label: e.labelOf(f), verb: null });
  var pt = box.children[box.children.length - 1];
  assert.ok(/^Pressing: Fever/.test(pt.querySelector('b').textContent) && /the file ends/.test(pt.querySelector('span').textContent), 'pressing, and the file ends: ' + pt.textContent);
  // Attend is shut by it: its plate goes to Rest with the Fever laid in.
  assert.ok(e.lockReason('duty'), 'Attend is shut');
  UI.openWindow('duty');
  render(e);
  var go = $('#windows').querySelector('.to-rest');
  assert.ok(go && !go.disabled && /To Rest/.test(go.textContent), 'the shut plate is a way to Rest');
  go.click();
  assert.ok(UI.openVerbs.indexOf('reflect') >= 0, 'Rest is open');
  var rs = e.verb('reflect').slots;
  assert.ok(Object.keys(rs).some(function (k) { return rs[k] === f.uid; }), 'with the Fever in it');
  while (UI.openVerbs.length) UI.back();
  flushTimers();
  console.log('ui: the Fever is marked, pressing, and its shut verbs point to Rest');
})();

// ---- Round 8, lane 2, item 64: 'Where it comes from' names only the ways open to this player now.
(function aspectSources() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 41 });
  UI.attach(e);
  e.s.rank = 0; e.s.rooms = e.s.rooms || {}; e.s.rooms.archive = false;
  e.tableCards().filter(function (c) { return c.def === 'witness' || c.def === 'district' || c.def === 'evidence'; }).forEach(function (c) { e.remove(c); });
  var rec = e.openCases()[0];
  var dig = UI.aspectFrom('digital', e, rec);
  assert.ok(!/Writ|Rolls/.test(dig), 'a junior is not sent for a Writ or to the Rolls: ' + dig);
  assert.ok(/nothing in your reach yet/.test(dig), 'and is told so, with what is left to do');
  e.s.rank = 1; e.s.rooms.archive = true;
  dig = UI.aspectFrom('digital', e, rec);
  assert.ok(/Writ/.test(dig) && /the Rolls/.test(dig), 'a Sworn Examiner with the Rolls is: ' + dig);
  var word = UI.aspectFrom('testimony', e, rec);
  assert.ok(!/a witness in Question/.test(word) && !/door to door/.test(word) && /confronted/.test(word), 'no witness, no Quarter: the confrontation alone: ' + word);
  var w = e.create('witness', { label: 'Witness: Ursel Bicker', data: { caseId: rec.id } });
  w.caseId = rec.id;
  e.create('district', { label: CF.DISTRICTS[rec.district].label, data: { district: rec.district } });
  word = UI.aspectFrom('testimony', e, rec);
  assert.ok(/a witness in Question/.test(word) && /door to door/.test(word), 'a witness and the Quarter on the table are named: ' + word);
  var all = UI.aspectFrom('digital', null);
  assert.ok(/Writ/.test(all) && /the Rolls/.test(all) && /Study/.test(all), 'the Help names every way');
  if (!CF.I18N.dicts.ar || !CF.I18N.dicts.ar['the Rolls']) fs.readdirSync(path.join(__dirname, '..', 'js/lang/ar')).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js/lang/ar', f), 'utf8'), { filename: f }); });
  CF.setLang('ar');
  var ar = CF.T(UI.aspectFrom('testimony', e, rec)) + ' ' + CF.T(UI.aspectFrom('digital', e, rec)) + ' ' + CF.T(UI.aspectFrom('opportunity', null)) + ' ' + CF.T(UI.aspectFrom('financial', null));
  CF.setLang('en');
  assert.ok(!/[A-Za-z]{3}/.test(ar), 'and in Arabic: ' + ar);
  console.log('ui: where proof comes from, as far as the player can reach');
})();

// ---- Round 8, lane 2, item 58: below Bailiff the Coquille's dossier points to the Watch on its stair, where the
// rules let Post the Watch take it; otherwise it keeps the Disguise line.
(function coquilleWatch() {
  var e = CF.Engine.newGame({ calling: 'crusader', seed: 43 });
  UI.attach(e);
  var syn = e.create('syndicate', { label: 'The Coquille' });
  e.s.rank = 0;
  function peekFor() { UI.selected = null; render(e); UI.selected = syn.uid; $('#peek').dataset.uid = ''; render(e); return $('#peek').innerHTML; }
  var r = CF.RECIPES_BY_ID.duty_post_watch, prim = r.requires.primary;
  var takes = prim === 'syndicate' || (typeof prim !== 'string' && prim.indexOf('syndicate') >= 0);
  var html = peekFor();
  if (takes) assert.ok(/post the Watch/.test(html), 'a junior is sent to post the Watch');
  else assert.ok(/Disguise/.test(html) && !/post the Watch/.test(html), 'without the rule, the Disguise line stands');
  r.requires.primary = ['gang', 'syndicate'];
  html = peekFor();
  assert.ok(/Below Bailiff: post the Watch \(Attend \+ watchman\)/.test(html) && !/Disguise:/.test(html), 'with it, the Watch on the stair: ' + html.slice(0, 200));
  e.s.rank = 2;
  html = peekFor();
  assert.ok(/Disguise/.test(html), 'a Bailiff goes in Disguise');
  r.requires.primary = prim;
  UI.selected = null;
  console.log('ui: the Coquille below Bailiff points to the Watch');
})();

// ---- Round 8, lane 2, items 65-72: the Rival caught at it, what the patron asked for, a meter that moves is seen,
// what an answer gives as chips, the four seals of full proof, a staged mark's seal, one render's memo and stack tops.
(function round8i() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }

  // Item 72: one memo for the render, cleared after; only a stack's top is asked whether it can be used.
  var e = CF.Engine.newGame({ calling: 'master', seed: 41 });
  UI.attach(e);
  render(e);
  var stack = [0, 1, 2].map(function () { var c = e.create('clue', { label: 'A Loose Button', text: 'A button.', aspects: { opportunity: 1 }, data: {} }); c.loc = { t: 'table', x: 4000, y: 4000 }; return c; });
  e.tableCards().forEach(function (c) { if (c.def === 'clue' && c.label === 'A Loose Button') { c.loc.x = stack[0].loc.x; c.loc.y = stack[0].loc.y; } });
  var orig = e.unavailableReason, asked = {}, memoSeen = 0;
  e.unavailableReason = function (c) { asked[c.uid] = (asked[c.uid] || 0) + 1; if (e._memo && typeof e._memo === 'object') memoSeen++; return orig.call(this, c); };
  render(e);
  e.unavailableReason = orig;
  assert.ok(memoSeen > 0 && e._memo === null, 'the render keeps a memo, and lets it go');
  assert.ok(!asked[stack[1].uid] && !asked[stack[2].uid] && asked[stack[0].uid] >= 1, 'only the top of a stack is asked: ' + JSON.stringify(asked));
  // A stack whose lower card fits an open slot glows, read from the place map.
  stack.forEach(function (c) { e.remove(c); });
  render(e);

  // Item 68: the meters are built once; a change of word bumps the icon, red up for the Crowd, gold for Standing.
  var meters = $('#meters'), pEl = meters.querySelector('.meter[data-meter=pressure]');
  assert.ok(!/bump/.test(meters.children.map(function (m) { return m.className; }).join(' ')), 'a game just opened does not bump');
  var max = e.meterMax('pressure');
  e.s.meters.pressure = max; // to the top word
  timers = [];
  render(e);
  assert.strictEqual(meters.querySelector('.meter[data-meter=pressure]'), pEl, 'the meter is changed in place, not rebuilt');
  assert.ok(pEl.classList.contains('bump') && pEl.classList.contains('bump-up') && pEl.classList.contains('bump-bad') && pEl.classList.contains('crit'), 'the Crowd going up bumps red: ' + pEl.className);
  assert.strictEqual(pEl.querySelector('.m-word').textContent, CF.METER_WORDS.pressure[4], 'and its word changes');
  render(e);
  assert.ok(pEl.classList.contains('bump'), 'a render while it shows keeps the bump');
  var rEl = meters.querySelector('.meter[data-meter=reputation]');
  e.s.meters.reputation += 1;
  render(e);
  assert.ok(rEl.classList.contains('bump-up') && rEl.classList.contains('bump-good'), 'every step of Standing is seen, in gold');
  flushTimers();
  assert.ok(!pEl.classList.contains('bump') && !rEl.classList.contains('bump'), 'and it passes');
  e.s.meters.pressure = 0;
  render(e);
  assert.ok(pEl.classList.contains('bump-down') && pEl.classList.contains('bump-good'), 'the Crowd easing is gold');
  flushTimers();
  assert.ok(/scale\(1\.35\)/.test(css.match(/@keyframes meterBump \{[^}]*\}/)[0]) && /opacity: 1/.test(css.match(/@keyframes meterGlow \{[^}]*\}/)[0]), 'the icon swells, the glow pulses by opacity');
  assert.ok(/carrow2-02/.test(rule('.meter.bump .m-icon::before')) && /rotate\(-90deg\)/.test(css.match(/@keyframes meterArrowUp \{[^}]*\}[^}]*\}[^}]*\}/)[0]), 'a Candlemark arrow, turned to point the way');
  assert.ok(/html\[data-calm\] \.meter\.bump \.m-icon, html\[data-calm\] \.meter\.bump::before, html\[data-calm\] \.meter\.bump \.m-icon::before \{ animation: none; \}/.test(css), 'still under less motion');

  // Item 69: an answer's return as chips, from a trial on a copy that leaves the game as it was.
  if (!e.cardsOf('funds', true).length) e.create('funds');
  if (!e.cardsOf('health', true).filter(function (c) { return c.loc.t === 'table'; }).length) e.create('health');
  e.offerChoice(CF.CHOICES.filter(function (c) { return c.id === 'lamplighter'; })[0], null);
  var before = JSON.stringify(e.s.cards) + JSON.stringify(e.s.meters) + e.s.journal.length;
  var d1 = UI.choiceDeltas(1);
  assert.strictEqual(JSON.stringify(e.s.cards) + JSON.stringify(e.s.meters) + e.s.journal.length, before, 'the trial leaves the game as it was');
  assert.ok(d1 && d1.some(function (x) { return x.kind === 'card' && x.key === 'witness' && x.d === 1; }) && d1.some(function (x) { return x.kind === 'meter' && x.key === 'dread' && x.d > 0 && !x.good; }), 'leaning on him: a witness, and Dread up: ' + JSON.stringify(d1));
  assert.ok(!d1.some(function (x) { return x.key === 'health' || x.key === 'spent_health'; }), 'what it pays with is the cost, not a chip');
  render(e);
  var ch = $('#board').querySelector('.choice'), opt1 = ch.querySelectorAll('.ch-opt')[1];
  var chips = opt1.querySelectorAll('.ch-chip');
  assert.ok(chips.length === d1.length && opt1.querySelector('.ch-chip.moves.up.bad') && chips.some(function (c) { return !c.classList.contains('moves') && /\+1/.test(c.textContent); }), 'the chips: the witness +1 and Dread rising');
  assert.ok(/Witness who saw it/.test(opt1.querySelector('.ch-gain-text').textContent) && /Witness who saw it/.test(opt1.querySelector('.ch-gain').title), 'the sentence stays, for what only shows later');
  var dread0 = e.s.meters.dread, wit0 = e.cardsOf('witness', true).length;
  UI.answerChoice(e, ch, opt1, 1, UI.choiceOptions(e, e.s.choice)[1]);
  assert.ok(e.s.meters.dread > dread0 && e.cardsOf('witness', true).length === wit0 + 1, 'and the answer gives what its chips said');
  flushTimers(); flushTimers(); render(e);
  assert.ok(!/2937/.test(css) && !/var\(--mono\)/.test(rule('#board .choice .ch-opt .ch-gain')), 'no arrow glyph, no typewriter');

  // Item 70: the four seals; the word note when only the word is wanting; each token's standing.
  e = CF.Engine.newGame({ calling: 'master', seed: 29 });
  UI.attach(e);
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  var sus = e.suspectOf(sc), prof = CF.Charge.profileOf(rec), toks = [];
  Object.keys(prof).forEach(function (k) { var a = {}; a[k] = prof[k]; toks.push(e.create('clue', e.clueSpec(rec, { label: 'Proof of ' + k, text: 'It shows.', aspects: a }))); });
  assert.ok(e.autoSlot('arrest', sc.uid), 'the accused before the Court');
  toks.slice(0, 3).forEach(function (t) { e.autoSlot('arrest', t.uid); });
  UI.openWindow('arrest');
  render(e);
  var box = $('#windows').querySelector('.charge-box');
  var gates = box.querySelectorAll('.ch-gate');
  var a = e.assessCharge(sc, toks.slice(0, 3));
  assert.strictEqual(gates.length, 4, 'four seals');
  assert.ok(!box.querySelector('.ch-score') && !/\//.test(box.querySelector('.ch-head').textContent), 'no score against need in the head');
  var on = gates.map(function (g) { return g.dataset.gate + ':' + (g.classList.contains('on') ? 1 : 0); }).join(' ');
  assert.strictEqual(on, 'enough:' + (a.score >= a.need ? 1 : 0) + ' kinds:' + (a.covered >= 2 ? 1 : 0) + ' word:0 clean:1', 'the seals read the charge: ' + on);
  if (a.score >= a.need && a.covered >= 2) assert.ok(box.querySelector('.ch-word') && !/To full proof/.test(box.textContent), 'only the word dark: the note says what word would do');
  var labs = $('#windows').querySelectorAll('.slot .s-label').map(function (l) { return l.textContent; });
  assert.ok(labs.indexOf('Proof') >= 0 && labs.indexOf('PROOF') < 0, 'a plain token is Proof: ' + labs);
  // A token that names them, one that names somebody else.
  var other = rec.suspects.filter(function (x) { return x.key !== sus.key; })[0];
  var named = e.create('clue', e.clueSpec(rec, { label: 'A Name', text: 'A name.', aspects: { testimony: 1 } })); named.data.points = sus.key;
  var wrong = e.create('clue', e.clueSpec(rec, { label: 'Another Name', text: 'A name.', aspects: { testimony: 1 } })); wrong.data.points = other.key;
  var aN = e.assessCharge(sc, [named, wrong]);
  assert.strictEqual(UI.tokenStanding(aN, sc, named), 'names', 'it names them');
  assert.strictEqual(UI.tokenStanding(aN, sc, wrong), 'other', 'it names somebody else');
  e.verb('arrest').slots.c4 = wrong.uid; e.detach(wrong); wrong.loc = { t: 'slot', verb: 'arrest', slot: 'c4' };
  render(e);
  var redLab = $('#windows').querySelectorAll('.slot .s-label.st-other')[0];
  assert.ok(redLab && redLab.textContent === 'Someone else', 'under it, in red: Someone else');
  assert.ok(/st-other/.test(css) && /Four seals say how it stands/.test(html), 'the colours and the Help');
  while (UI.openVerbs.length) UI.back();

  // Item 66: the rungs that please the Bishop wear his seal; the Condemned says what he asked for.
  e = CF.Engine.newGame({ calling: 'master', seed: 23 });
  UI.attach(e);
  rec = e.openCases()[0];
  rec.commission = { from: 'bishop', wants: 'mercy' };
  var cul = rec.suspects.filter(function (x) { return x.key === rec.culprit; })[0];
  var cond = e.condemn(rec, { name: cul.name, guilty: true }, 'strong');
  render(e);
  var rungs = e.cardsOf('rung', true).filter(function (r) { return r.data.condemned === cond.uid; });
  var pardon = rungs.filter(function (r) { return r.data.rung === 'pardon' || r.data.rung === 'fine'; })[0], rope = rungs.filter(function (r) { return r.data.rung !== 'pardon' && r.data.rung !== 'fine'; })[0];
  var rEl2 = $('#board').querySelector('.card[data-uid=' + pardon.uid + ']'), ropeEl = $('#board').querySelector('.card[data-uid=' + rope.uid + ']');
  assert.ok(rEl2 && rEl2.querySelector('.c-patron') && /casp-04/.test(rEl2.querySelector('.c-patron').style.backgroundImage), 'the Bishop\'s seal on a merciful rung');
  assert.ok(ropeEl && !ropeEl.querySelector('.c-patron'), 'and none on a hard one');
  UI.selected = cond.uid;
  render(e);
  // Said once: the rules write the ask into the Condemned's own description (data.patronWants), so no second line.
  assert.strictEqual(($('#peek').textContent.match(/The Bishop asks/g) || []).length, 1, 'the Condemned says what the Bishop asked, once: ' + $('#peek').textContent.slice(0, 300));
  // A Condemned from before the rules wrote it: the dossier line says it.
  var condOld = e.create('condemned', { label: 'Old Hand', data: { name: 'Old Hand', caseId: rec.id, template: rec.template, custom: cond.data.custom } });
  e.cardsOf('rung', true).filter(function (r) { return r.data.condemned === cond.uid; }).forEach(function (r) { r.data.condemned = condOld.uid; });
  UI.selected = condOld.uid;
  render(e);
  assert.ok(/The Bishop asks for: /.test($('#peek').textContent), 'an older Condemned says what the Bishop asked: ' + $('#peek').textContent.slice(0, 300));
  e.cardsOf('rung', true).filter(function (r) { return r.data.condemned === condOld.uid; }).forEach(function (r) { r.data.condemned = cond.uid; });
  e.remove(condOld);
  UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  // The rules' own mark wins: a rung marked for the Guilds wears theirs.
  rope.data.patron = 'guild';
  render(e);
  ropeEl = $('#board').querySelector('.card[data-uid=' + rope.uid + ']');
  assert.ok(ropeEl.querySelector('.c-patron') && /cres-01/.test(ropeEl.querySelector('.c-patron').style.backgroundImage), 'data.patron is read first');

  // Item 65: when the rules want the Rival caught at it, the advisor and the dossier point to their own dirty work.
  e.verb('interrogate').unlocked = true;
  var rv = e.create('rival', { label: 'The Rival: Anselm Brecht', data: { name: 'Anselm Brecht', heat: 1, heatWeek: e.s.week - 1, heatBy: 'interrogate', stalled: 0 } });
  e.s.journal.unshift({ t: 1, week: 1, title: 'The Rival Takes a Case', text: '', kind: 'danger' }, { t: 2, week: 1, title: 'A Scene Spoiled', text: '', kind: 'danger' });
  if (!e.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; }).length) e.create('focus');
  var slots0 = CF.VERBS.interrogate.slots;
  CF.VERBS.interrogate.slots = slots0.concat([{ key: 'dirt', label: 'Their Work', accepts: ['clue', 'witness', 'case'], when: function (p) { return !!p && p.def === 'rival'; } }]);
  var spoiled = e.create('clue', e.clueSpec(rec, { label: 'A Smudged Print', text: 'Spoiled.', aspects: { forensic: 1 } }));
  spoiled.data.tampered = true;
  var say = UI.advice() || '';
  assert.ok(/catch them at it: Question Anselm Brecht with A Smudged Print/.test(say) && UI.hintGo && UI.hintGo.uid === spoiled.uid, 'the advisor points to the spoiled token: ' + say);
  UI.selected = rv.uid;
  render(e);
  var pk = $('#peek').textContent;
  assert.ok(/catch them at it/.test(pk) && /On your table: A Smudged Print/.test(pk) && new RegExp('goes cold after week ' + (e.s.week + 2)).test(pk), 'the dossier says how, with what, and until when: ' + pk.slice(0, 400));
  // (The rules carry such a slot of their own now, 'theirs': read without either.)
  CF.VERBS.interrogate.slots = slots0.filter(function (sl) { return sl.key !== 'theirs'; });
  // (The card's own description tells the whole rule now; the lines after it are the dossier's.)
  assert.ok(!/catch them at it/.test(UI.dossierLines(rv).slice(2).join(' ')), 'without the slot, the old rule\'s words');
  CF.VERBS.interrogate.slots = slots0;
  UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  e.remove(rv);
  assert.ok(/Then catch them at it/.test(html) && /goes cold in three/.test(html), 'the Help has the race');

  // Item 71: a staged token wears a seal, its face the token's own words; the Help names the second mark.
  var st = e.create('clue', e.clueSpec(rec, { label: 'Staged: A Bloody Shoe', text: 'Put there.', aspects: { opportunity: 1 } }));
  var face = CF.cardFace(st, 'Staged: A Bloody Shoe');
  assert.ok(face.text === 'A Bloody Shoe' && face.status[0] === 'Staged', 'the face looks through the status');
  render(e);
  var stEl = $('#board').querySelector('.card[data-uid=' + st.uid + ']');
  assert.ok(stEl && stEl.querySelector('.c-status') && /ccstamp-02/.test(stEl.querySelector('.c-status').style.backgroundImage), 'the masked stamp in the corner');
  assert.ok(/a second mark, put there to be found/.test(html), 'the Help names it');
  console.log('ui: the Rival caught at it, the patron\'s seal, meters that move, chips for an answer, four seals, a staged mark, one memo a render');
})();

// ---- Round 8, lane 2, items 73-80: the Harbourmaster's leaves and books, Loose Ends that remember, the Charge plate
// by tier, the lesson under a loss, the Bell's toll, a step inside a meter's word, a junior's verb info, one mark a thing.
(function round8j() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var audio = fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8');
  var mainSrc = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }

  // Item 80: a verb that unlocks and runs by itself in the same tick is marked once.
  var e = CF.Engine.newGame({ calling: 'master', seed: 51 });
  UI.attach(e);
  render(e);
  UI.notices.slice().forEach(function (n) { n.mark.remove(); });
  UI.notices = [];
  UI.notice({ verb: 'investigate', label: 'Explore', fresh: true });
  UI.notice({ verb: 'investigate', label: 'Explore' });
  flushTimers();
  var marks = $('#table').children.filter(function (c) { return c.classList.contains('edge-mark'); });
  assert.strictEqual(UI.notices.filter(function (n) { return n.verb === 'investigate'; }).length, 1, 'one entry for Explore');
  assert.strictEqual(marks.filter(function (m) { return /Explore/.test(m.textContent); }).length, 1, 'one mark at the edge for Explore');
  marks.forEach(function (m) { m.remove(); }); UI.notices = [];

  // Item 79: a junior's Explore info: the basics, and the offices' powers still to come, one line each.
  e.verb('investigate').unlocked = true;
  UI.about = 'investigate';
  UI.openWindow('investigate');
  render(e);
  var win = $('#windows').querySelectorAll('.vwin').filter(function (w) { return w.querySelector('.vw-about'); })[0];
  assert.ok(win, 'the info shows');
  var about = win.querySelector('.vw-about').textContent;
  assert.ok(/walk the ward/.test(about) && !/Bailiff|Sworn Examiner|Disguise|Coquille/.test(about), 'the basics name no higher office: ' + about);
  var pw = win.querySelectorAll('.vw-power');
  assert.ok(pw.length === 3 && pw.every(function (p) { return p.classList.contains('locked'); }) && /^At Sworn Examiner: Writ$/.test(pw[0].textContent), 'the powers to come, locked, one line each: ' + pw.map(function (p) { return p.textContent; }));
  e.s.rank = 1;
  render(e);
  pw = $('#windows').querySelectorAll('.vw-power');
  assert.ok(!pw[0].classList.contains('locked') && /^Writ: An Accused/.test(pw[0].textContent), 'an office reached shows its power: ' + pw[0].textContent);
  e.s.rank = 0; UI.about = null;
  while (UI.openVerbs.length) UI.back();
  assert.ok(/vw-power\.locked/.test(css), 'the locked lines are dimmer');

  // Item 75: the Charge plate wears the charge it would bring.
  e.verb('arrest').unlocked = true;
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  assert.ok(e.autoSlot('arrest', sc.uid), 'the accused before the Court');
  UI.openWindow('arrest');
  render(e);
  var lastGo = function () { var gs = $('#windows').querySelectorAll('.go'); return gs[gs.length - 1]; };
  var go = lastGo();
  var need = e.assessCharge(sc, []).need;
  assert.ok(go.classList.contains('tier-weak') && go.classList.contains('dark') && !go.classList.contains('redfill'), 'on Indicia the plate is dark: ' + go.className);
  assert.ok(go.querySelector('.go-tier') && go.querySelector('.go-tier').textContent === 'Indicia · 0/' + need && go.querySelector('.go-name') && /^Charge /.test(go.textContent), 'and says so after the name, with the weight: ' + go.textContent);
  var prof = CF.Charge.profileOf(rec), toks = [];
  Object.keys(prof).forEach(function (k) { var a = {}; a[k] = prof[k]; toks.push(e.create('clue', e.clueSpec(rec, { label: 'Proof of ' + k, text: 'It shows.', aspects: a }))); });
  toks.forEach(function (t) { e.autoSlot('arrest', t.uid); });
  render(e);
  go = lastGo();
  var tier = e.assessCharge(sc, toks.filter(function (t) { return t.loc.t === 'slot'; })).tier;
  assert.ok(go.classList.contains('tier-' + tier) && go.classList.contains({ weak: 'dark', reasonable: 'redfill', strong: 'gold' }[tier]), 'the plate follows the tier (' + tier + '): ' + go.className);
  e.clearSlots('arrest');
  while (UI.openVerbs.length) UI.back();
  toks.forEach(function (t) { e.remove(t); });

  // Item 78: a step inside a word nudges the icon; a new word comes in with two soft notes.
  render(e);
  var pEl = $('#meters').querySelector('.meter[data-meter=pressure]');
  var lvl = function (v) { return Math.min(4, Math.floor((v / Math.max(1, e.meterMax('pressure'))) * 4.999)); };
  e.s.meters.pressure = 0; render(e); flushTimers();
  var step = 1; while (lvl(step) === lvl(0)) step++;
  // a value inside the first word, above zero
  if (step > 1) {
    played.length = 0;
    e.s.meters.pressure = 1;
    render(e);
    assert.ok(pEl.classList.contains('nudge') && pEl.classList.contains('nudge-up') && pEl.classList.contains('nudge-bad') && !pEl.classList.contains('bump'), 'a step inside a word nudges, red for the Crowd: ' + pEl.className);
    assert.ok(played.indexOf('meterWorse') < 0, 'and is not heard');
    render(e);
    assert.ok(pEl.classList.contains('nudge'), 'a render while it shows keeps the nudge');
    flushTimers();
    assert.ok(!pEl.classList.contains('nudge'), 'and it passes');
  }
  played.length = 0;
  e.s.meters.pressure = step;
  render(e);
  assert.ok(pEl.classList.contains('bump') && pEl.querySelector('.m-word').classList.contains('word-new') && played.indexOf('meterWorse') >= 0, 'a new word bumps, comes in and is heard');
  flushTimers();
  played.length = 0;
  e.s.meters.pressure = 0;
  render(e);
  assert.ok(played.indexOf('meterBetter') >= 0, 'easing is heard rising');
  flushTimers();
  assert.ok(/translateY\(-4px\) scale\(1\.18\)/.test(css) && /@keyframes wordIn \{ from \{ opacity: 0; letter-spacing: 0\.18em; \} \}/.test(css) && /html\[data-calm\] \.meter\.nudge \.m-icon/.test(css), 'the nudge, the word, and less motion');
  assert.ok(/meterWorse: function/.test(audio) && /meterBetter: function/.test(audio) && /meterWorse: 0\.8/.test(audio), 'the notes are rate-limited');

  // Item 77: the Bell tolls: the coins ring as they land, the stipend flies out of the Bell, an unpaid week is cracked.
  render(e);
  var bellEl = $('#board').querySelector('.verb[data-verb=time]') || $('#board').all().filter(function (n) { return n.classList.contains('time') && n.classList.contains('verb'); })[0];
  while (e.cardsOf('funds').filter(function (c) { return c.loc.t === 'table'; }).length < e.dues() + 1) e.create('funds');
  render(e);
  played.length = 0; timers = [];
  UI.tickUid = e.s.nextUid;
  UI.spawn = {};
  e.s.weekT = CF.WEEK - 0.01;
  e.tick(0.05);
  assert.ok(played.indexOf('week') >= 0 && played.indexOf('weekUnpaid') < 0, 'a paid week tolls: ' + played);
  var fresh = e.cardsOf('funds', true).filter(function (c) { return c.uid >= UI.tickUid; });
  assert.ok(fresh.length >= 1 && fresh.every(function (c) { return UI.spawn[c.uid]; }), 'the stipend comes out of the Bell');
  assert.ok(bellEl && bellEl.classList.contains('toll'), 'the Bell swings');
  flushTimers(); flushTimers();
  assert.ok(played.indexOf('coin') >= 0, 'the Coin rings as it lands');
  e.cardsOf('funds', true).forEach(function (c) { e.remove(c); });
  played.length = 0;
  e.s.weekT = CF.WEEK - 0.01;
  e.tick(0.05);
  assert.ok(played.indexOf('weekUnpaid') >= 0 && played.indexOf('week') < 0, 'an unpaid week is cracked: ' + played);
  flushTimers(); flushTimers();
  assert.ok(/week: function \(\) \{ churchBell\(196, 2\.5, \{ vol: 0\.08 \}\); \}/.test(audio) && /cents: 15, decay: 0\.5/.test(audio), 'a church bell, short and quiet; the cracked one detuned and shorter');
  assert.ok(/class="wb-glass"/.test(html) && /var\(--art-ctimer-01\)/.test(rule('#weekbar .wb-glass')) && !/ctimer/.test(rule('#weekbar')) && /hourTurn/.test(rule('#weekbar .wb-glass.turn')), 'the hourglass is its own element and turns');
  assert.ok(/transform-origin: 50% 0; animation: toll 1\.2s ease-out/.test(rule('.verb.time.toll .v-token')) && /wbFlash/.test(rule('#weekbar.flash::after')), 'the toll and the flash');
  // The bar does not run back: the turn is written with no transition.
  var wb = new El('div'); wb.id = 'weekbar'; var sh = new El('div'); sh.className = 'wb-shade'; wb.appendChild(sh); body.appendChild(wb);
  e.s.weekT = CF.WEEK * 0.9; UI.updateLive();
  var shade = $('#weekbar').querySelector('.wb-shade');
  e.s.weekT = 0; UI.updateLive();
  assert.ok(shade.style.transition === 'none' && shade.style.transform === 'scaleX(1)', 'a new week: full at once, no rewind: ' + shade.style.transition);
  e.s.weekT = CF.WEEK * 0.2; UI.updateLive();
  assert.ok(/0\.5s linear/.test(shade.style.transition), 'then it slides again');

  // Item 76: the lesson under a loss, the rules' own first, the cause made particular.
  var lessonSrc = mainSrc.slice(mainSrc.indexOf('  var LESSONS = {'), mainSrc.indexOf('  UI.endLesson = endLesson;'));
  var endLesson = new Function('CF', 'tr', lessonSrc + '\nreturn endLesson;')(CF, CF.T);
  ['burnout', 'collapse', 'consumed', 'dismissed', 'corruption', 'death'].forEach(function (id) {
    var l = endLesson({ id: id, win: false });
    assert.ok(l && l.text && l.art, 'a lesson for ' + id);
  });
  assert.ok(/Rest/.test(endLesson({ id: 'burnout', win: false }).text), 'the Fever\'s lesson sends you to Rest');
  assert.strictEqual(endLesson({ id: 'master', win: true }), null, 'no lesson under a win');
  assert.ok(/idle the whole time/.test(endLesson({ id: 'burnout', win: false, cause: { fever: 120, restIdle: true } }).text), 'the cause, where the rules keep it');
  CF.ENDINGS.burnout.lesson = 'The rules say so.';
  assert.strictEqual(endLesson({ id: 'burnout', win: false }).text, 'The rules say so.', 'the rules\' own lesson first');
  delete CF.ENDINGS.burnout.lesson;
  assert.ok(/id="end-lesson"/.test(html) && /end-lesson i/.test(css), 'the line has its place on the end paper');

  // Item 74: a Loose End remembers the case that left it.
  e = CF.Engine.newGame({ calling: 'master', seed: 52 });
  UI.attach(e);
  var le = e.create('looseend');
  le.data = { fromTitle: 'The Tanner\'s Daughter', aspect: 'motive', week: 2 };
  UI.selected = le.uid;
  render(e);
  var pk = $('#peek').textContent;
  assert.ok(/From The Tanner's Daughter: three strokes cut where the crime began\./.test(pk) && /3 in Rest find the Architect: 1 of 3/.test(pk), 'the mark says where it was cut, and how near the Architect is: ' + pk.slice(0, 300));
  e.remove(le); UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';

  // Item 73: the Harbourmaster's leaves, where the rules have them; nothing where they do not.
  // (The rules have the leaf now: it is set aside to read the interface without it, and put back after.)
  var realLeaf = CF.CARDS.customsleaf;
  delete CF.CARDS.customsleaf; UI.leafDef = undefined;
  assert.strictEqual(UI.customsLeafDef(), null, 'no leaf in these rules yet, or the test below stands in for one');
  var rv = e.create('rival', { label: 'The Rival: Anselm Brecht', data: { name: 'Anselm Brecht', heat: 0, stalled: 0 } });
  UI.selected = rv.uid; render(e);
  assert.ok(!/Customs House/.test($('#peek').textContent), 'without the rules, no word of the leaves');
  UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  CF.CARDS.customsleaf = { label: 'A Leaf from the Customs House', kind: 'insight', tags: ['insight'], aspects: { customsleaf: 1 }, stackable: true, desc: 'What the Harbourmaster paid his examiner, and for what.' };
  CF.CASE_TEMPLATES.harbourbooks = { label: 'The Harbourmaster\'s Books', title: 'The Harbourmaster\'s Books', special: true };
  var fakeRec = { id: 'ref_customs_test', verb: 'reflect', requires: { primary: 'customsleaf' } };
  CF.RECIPES.push(fakeRec);
  UI.leafDef = undefined;
  try {
    UI.init();
    assert.ok(!$('#help-harbour') || !$('#help-harbour').classList.contains('hidden'), 'the Help tells of the books');
    var l1 = e.create('customsleaf'), l2 = e.create('customsleaf');
    render(e);
    var lEl = $('#board').querySelector('.card[data-uid=' + e.stackOf(l1)[0].uid + ']');
    assert.ok(lEl && lEl.querySelector('.c-face') && /charb2-06/.test(lEl.querySelector('.c-face').style['--pic']), 'the leaf wears the Customs House seal');
    UI.selected = l1.uid; render(e);
    assert.ok(/2 in Rest open the Harbourmaster's Books: 2 of 2/.test($('#peek').textContent), 'the leaf says what two open: ' + $('#peek').textContent.slice(0, 300));
    UI.selected = rv.uid; render(e);
    assert.ok(/Sent home, they leave a leaf from the Customs House/.test($('#peek').textContent), 'the Rival says what they leave');
    UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
    e.remove(rv);
    e.s.choice = null;
    var say = UI.advice() || '';
    assert.ok(/Two leaves from the Customs House: lay them in Rest/.test(say) && UI.hintGo && (UI.hintGo.uid === l1.uid || UI.hintGo.uid === l2.uid), 'the advisor sends them to Rest: ' + say);
    var hr = e.openCases()[0];
    hr.template = 'harbourbooks';
    UI.selected = e.caseCard(hr.id).uid; render(e);
    assert.ok(/Convict the Harbourmaster himself/.test($('#peek').textContent), 'the books say what convicting him does');
    assert.strictEqual(UI.caseArt('harbourbooks'), 'charb2-01', 'the books wear a ship at the quay');
  } finally {
    UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
    if (realLeaf) CF.CARDS.customsleaf = realLeaf; else delete CF.CARDS.customsleaf;
    delete CF.CASE_TEMPLATES.harbourbooks;
    CF.RECIPES.splice(CF.RECIPES.indexOf(fakeRec), 1);
    UI.leafDef = undefined;
  }
  assert.ok(/id="help-harbour" class="hidden"/.test(html), 'the Help\'s line waits hidden for the rules');
  console.log('ui: the Harbourmaster\'s leaves, Loose Ends that remember, the plate by tier, the lesson, the Bell\'s toll, a step in a word, a junior\'s info, one mark a thing');
})();

// ---- Round 8, items 81-88: the board's petition, the Dominican's empty threat, quiet empty slots,
// the chrome leftovers, the title alive, the table still under menus.
(function round8k() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var mainSrc = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }

  // Item 82: the heresy line warns only when the seizure can come; a warm Bishop is said to keep it off.
  var e = CF.Engine.newGame({ calling: 'master', seed: 53 });
  UI.attach(e);
  var rec = e.openCases()[0], tpl = rec.template;
  try {
    rec.template = 'scriptorium';
    e.s.favour = e.s.favour || {};
    var kase = e.caseCard(rec.id);
    e.s.favour.bishop = 2; e.s.flags.inquisitor = false;
    UI.selected = kase.uid; render(e);
    assert.ok(/The Bishop has kept the Dominicans off this one/.test($('#peek').textContent) && !/Smells of heresy/.test($('#peek').textContent), 'a warm Bishop keeps the Dominicans off: ' + $('#peek').textContent.slice(0, 300));
    e.s.favour.bishop = 0; e.dirty = true; render(e);
    assert.ok(/Smells of heresy/.test($('#peek').textContent), 'a cool Bishop: the Inquisitor is after it');
    e.s.favour.bishop = 2; e.s.flags.inquisitor = true; e.dirty = true; render(e);
    assert.ok(/Smells of heresy/.test($('#peek').textContent), 'with the Inquisitor here, the Bishop\'s warmth does not help');
  } finally {
    rec.template = tpl; e.s.flags.inquisitor = false;
    UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  }

  // Item 83: an empty frame is quiet and wakes for a fitting drag; its caption sits under it.
  assert.ok(/\n\.slot \.s-box\.empty, \.slot \.s-box\.empty ~ \.s-icon \{ opacity: 0\.55; filter: saturate\(0\.55\); \}/.test(css), 'an empty frame is quiet');
  assert.ok(/opacity: 1/.test(rule('.slot.can-drop .s-box.empty') || '') && /drop-shadow\(0 0 6px rgba\(109, 187, 106/.test(rule('.slot.can-drop .s-box.empty') || ''), 'a fitting drag wakes it, green shadow kept');
  assert.ok(!/\.slot \.s-box\.empty ~ \.s-label \{[^}]*position: absolute/.test(css), 'the empty slot\'s caption is not laid inside the frame');

  // Item 84: the Journal closes with the red roundel; the language button is a plate with the Aa.
  assert.ok(/--art-cok-02/.test(rule('#journal-close') || '') && /font-size: 0/.test(rule('#journal-close') || ''), 'the Journal\'s close is the red X');
  assert.ok(/class="plate-btn dark lang" id="t-lang"[^>]*><i class="mi" style="--i:var\(--art-cset2-01\)"><\/i><span>English<\/span>/.test(html), 'the language plate carries the Aa');
  assert.ok(/\$\('t-lang'\), w = b && \(b\.querySelector\('span'\) \|\| b\)/.test(mainSrc), 'naming the language keeps the icon');
  assert.ok(/\.ctl\.dbi small:empty \{ display: none; \}/.test(css), 'an empty badge is not drawn');

  // Item 85: the title fills the screen with its own room, the candle breathes, still under calm or reduced motion.
  assert.ok(/var\(--art-dmenu\) center \/ cover/.test(rule('#title.modal') || ''), 'the bars are the room in shadow');
  assert.ok(/animation: flicker/.test(rule('.title-scene::after') || '') && /animation: riverDrift/.test(rule('.title-scene::before') || ''), 'the candle and the river move');
  assert.ok(/html\[data-calm\] \.title-scene::before, html\[data-calm\] \.title-scene::after \{ animation: none; \}/.test(css), 'and keep still when calm');

  // Item 88: under a modal the table's pulses pause; under a covering screen it is not drawn.
  assert.ok(/html\.cf-still #table \*[^{]*\{ animation-play-state: paused !important; \}/.test(css), 'the table holds still under a menu');
  assert.ok(/html\.cf-cover #app \{ visibility: hidden; \}/.test(css), 'and is not drawn under a screen');
  assert.ok(/function show\(id, on\) \{[^\n]*holdStill\(\);/.test(mainSrc) && /UI\.modal = !!id;\s*holdStill\(\);/.test(mainSrc) && /new MutationObserver\(holdStill\)/.test(mainSrc), 'the classes follow every modal');
  assert.ok(css.indexOf('html.held') < 0 && mainSrc.indexOf("toggle('held'") < 0, 'not the .held class the table already uses');
  console.log('ui: the Dominican\'s threat, quiet slots, the Journal\'s X, the language plate, the title alive, the table still');
})();

// ---- Round 8, items 89-96: the pause banner under a finger, the slab pressed and risen, a refused drop, the Arabic
// quotes and title, the offices' Insights, the advisor beside a running verb and for a spent ability.
(function round8l() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var uiSrc = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');

  // Item 90: no 'Space' under a finger; the banner says tap and resumes.
  assert.ok(/<div id="pause-banner">Paused <span class="pb-key">Space to resume<\/span><span class="pb-tap">Tap to resume<\/span><\/div>/.test(html), 'the banner has a word for keys and one for fingers');
  var coarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.ok(/#pause-banner \.pb-key \{ display: none; \}\n  #pause-banner \.pb-tap \{ display: inline; \}\n  #table\.paused #pause-banner \{ pointer-events: auto;/.test(coarse) && /\n#pause-banner \.pb-tap \{ display: none; \}/.test(css), 'a coarse pointer reads the tap and can use it');
  assert.ok(/pb\.addEventListener\('click', function \(ev\) \{ ev\.stopPropagation\(\); if \(UI\.paused\) \{ UI\.setPaused\(false\);/.test(uiSrc), 'a tap on the banner resumes');

  var e = CF.Engine.newGame({ calling: 'master', seed: 61 });
  UI.attach(e);
  ['interrogate', 'arrest', 'investigate', 'duty', 'reflect', 'analyze'].forEach(function (v) { if (e.verb(v)) e.verb(v).unlocked = true; });
  render(e);

  // Item 91: a start presses the slab; a finish raises it once and its cue carries the verb; the pitch is the chord's.
  var duty = $('#board').querySelectorAll('.verb').filter(function (x) { return x.dataset.verb === 'duty'; })[0];
  timers = []; played.length = 0;
  UI.verbStarted('duty');
  assert.ok(duty.classList.contains('pressed') && played.indexOf('start') >= 0, 'the slab is pressed and the start sounds');
  flushTimers();
  assert.ok(!duty.classList.contains('pressed'), 'and comes back up');
  settings.calm = true; UI.verbStarted('duty'); settings.calm = false;
  assert.ok(!duty.classList.contains('pressed'), 'under less motion it keeps still');
  var cues = [];
  CF.Audio.play = function (k, o) { played.push(k); cues.push([k, o]); };
  e.emit('complete', { verb: 'duty' });
  var fin = cues.filter(function (c) { return c[0] === 'complete'; })[0];
  assert.ok(fin && fin[1] && fin[1].verb === 'duty' && duty.classList.contains('risen'), 'a finish rises and its cue knows the verb');
  cues.length = 0; e.emit('complete', { verb: 'time' });
  assert.ok(!cues.some(function (c) { return c[0] === 'complete'; }), 'the Bell keeps its toll');
  CF.Audio.play = function (k) { played.push(k); };
  flushTimers();
  assert.ok(/\.verb\.pressed \.v-token \{ animation: press 0\.22s ease-out; \}/.test(css) && /@keyframes press \{ 35% \{ transform: translateY\(8px\);/.test(css) && /@keyframes rise \{ 40% \{ transform: translateY\(-6px\);/.test(css), 'press and rise, translate only');
  assert.ok(/html\[data-calm\] \.verb\.pressed \.v-token, html\[data-calm\] \.verb\.risen \.v-token/.test(css), 'still when calm');
  var actx = { window: {}, document: { addEventListener: function () {}, hidden: false } };
  actx.window.CF = { Settings: { onChange: function () {}, values: {} } };
  actx.window.addEventListener = function () {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/audio.js'), 'utf8'), actx, { filename: 'js/audio.js' });
  var A = actx.window.CF.Audio, note = A.completeNote();
  assert.ok(note > 400 && note < 540 && [523.2, 440, 415.4].some(function (f) { return Math.abs(f - note) < 1; }), 'the finish is the pad\'s upper voice an octave up: ' + note);
  assert.ok(A.allow('refuse', 1) && !A.allow('refuse', 1.1), 'the refusal cue exists and does not stutter');

  // Item 92: a refused drop shakes its target, sounds, and says why for two seconds.
  var slot = new El('div'); slot.className = 'slot';
  timers = []; played.length = 0;
  var lockOf = e.lockReason;
  e.lockReason = function (v) { return v === 'duty' ? 'The fever has you.' : null; };
  UI.refused({ verb: 'duty', slot: 'main', node: slot });
  e.lockReason = lockOf;
  assert.ok(slot.classList.contains('refuse') && played.indexOf('refuse') >= 0, 'the slot shakes and the knock sounds');
  assert.ok(UI.hintFlash && UI.hintFlash.text === 'The fever has you.', 'the reason waits for the hint');
  render(e);
  assert.strictEqual($('#hint').textContent, 'The fever has you.', 'and the hint bar shows it');
  UI.hintFlash.until = 0; render(e);
  assert.ok(!UI.hintFlash, 'then lets go');
  flushTimers();
  assert.ok(!slot.classList.contains('refuse'), 'the shake ends');
  assert.ok(/\} else \{\n        refused\(t\);/.test(uiSrc), 'every refused drop on a slot or tile is told');
  assert.ok(/html\[data-calm\] \.slot\.refuse \{ outline: 2px solid transparent;[^}]*animation: refuseFlash/.test(css), 'a red edge instead of a shake when calm');

  // Item 96: a running verb no longer silences the advisor; a line waits only for its own verb.
  e.tableCards().forEach(function (c) { if (c.def === 'witness' || c.def === 'insight' || c.def === 'evidence' || c.def === 'dagger') e.remove(c); });
  var rec = e.openCases()[0];
  rec.searches = 1;
  var wit = e.cardsOf('focus').filter(function (c) { return c.loc.t === 'table'; })[0] || e.create('focus', {});
  var hp = e.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0] || e.create('health', {});
  var wn = e.create('witness', { label: 'Witness: Grete Amsel', caseId: rec.id, data: {} });
  var say = UI.advice();
  assert.ok(/A witness: put .*Grete Amsel.* into Question with Wit\./.test(say), 'the witness line: ' + say);
  e.verb('analyze').status = 'running';
  say = UI.advice();
  assert.ok(/Grete Amsel/.test(say || ''), 'another verb at work does not silence it: ' + say);
  e.verb('analyze').status = 'idle';
  e.verb('interrogate').status = 'running';
  say = UI.advice() || '';
  assert.ok(!/into Question/.test(say), 'Question at work is not sent more: ' + say);
  e.verb('interrogate').status = 'idle';
  // The Wit spent: when it comes back and what to do meanwhile.
  e.remove(wit);
  var spent = e.create('spent_focus', {});
  spent.life = 25;
  say = UI.advice() || '';
  assert.ok(/^Wits' End: your Wit is back in 0:25, sooner in Rest\./.test(say), 'a spent Wit is told: ' + say);
  assert.ok(e.lockReason('duty') || /Meanwhile Attend with Health for a Coin\./.test(say), 'with Attend for a Coin meanwhile: ' + say);
  assert.strictEqual(UI.hintGo && UI.hintGo.uid, spent.uid, 'the hint goes to the spent card');
  e.remove(spent); e.remove(wn);
  if (!e.cardsOf('focus').some(function (c) { return c.loc.t === 'table'; })) e.create('focus', {});

  // Item 95: an office's Insight not yet open is named dim with its office, and the advisor leaves it be.
  var hpCard = e.cardsOf('health').filter(function (c) { return c.loc.t === 'table'; })[0];
  CF.INSIGHTS.test_office = { label: 'The White Staff', trains: 'health', rank: 2, need: 2, how: 'Walk the night with a watchman twice.', text: '', perk: '', perkText: '', count: function () { return 1; }, when: function () { return false; } };
  try {
    e.s.rank = 0;
    var notes = UI.dossierLines ? null : null;
    UI.selected = hpCard.uid; render(e);
    var peek = $('#peek').textContent;
    assert.ok(peek.indexOf('At ' + CF.RANKS[2] + ': The White Staff') >= 0 && peek.indexOf('Walk the night with a watchman twice') < 0, 'below its office the Insight is named, not its way: ' + peek.slice(0, 400));
    assert.strictEqual(UI.wayRank({ id: 'test_office' }), 2, 'its office read off the rules');
    e.s.rank = 2; e.dirty = true; render(e);
    peek = $('#peek').textContent;
    assert.ok(peek.indexOf('The White Staff: Walk the night with a watchman twice. (1 of 2)') >= 0, 'at its office the way and the count show: ' + peek.slice(0, 400));
  } finally {
    delete CF.INSIGHTS.test_office; e.s.rank = 0;
    UI.selected = null; $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  }
  assert.ok(/<p id="help-office-growth" class="hidden">/.test(html), 'the Help\'s line on the offices waits for the rules');

  // Item 93: a quoted saying reads in guillemets in Arabic. Item 94: the tab and the title read the game's Arabic name.
  if (!CF.I18N.dicts.ar || !CF.I18N.dicts.ar['the Rolls']) fs.readdirSync(path.join(__dirname, '..', 'js/lang/ar')).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js/lang/ar', f), 'utf8'), { filename: f }); });
  document.title = 'Case File: The Free City';
  CF.setLang('ar');
  var q = CF.T('"They were rolling a die over their knuckles." (Wants the reward.)');
  var tab = document.title;
  CF.setLang('en');
  assert.ok(/^«[^"A-Za-z]+» \([^A-Za-z]+\)$/.test(q), 'the saying in guillemets, the stake after it: ' + q);
  assert.strictEqual(tab, 'ملف القضية: المدينة الحرة', 'the tab in Arabic');
  assert.strictEqual(document.title, 'Case File: The Free City', 'and back in English');
  assert.ok(/<div class="title-sub" aria-hidden="true">Case File: The Free City<\/div>/.test(html) && /\.title-sub \{ display: none; \}\n\[dir=rtl\] \.title-scene \.title-sub \{ display: block;/.test(css), 'the Arabic name under the plate, only right-to-left');
  console.log('ui: the banner under a finger, the slab pressed, a refused drop, the advisor beside a running verb and for a spent ability, the offices\' Insights, Arabic quotes and title');
})();

// ---- Round 8, lane 2, items 97-104: the Help by chapter with a verb's way in, the patrons' seals under Standing,
// a room's return (tests/ranks.test.js), the dossier's band, each fact once and the proof in pips, an ending of its
// own with its tally beside it, the first paint, the Arabic dossier (tests/i18n.test.js), and no layers at rest.
(function round8l() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  function rule(sel) { var re = new RegExp('(?:^|[\\n,] ?)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'), m, out = []; while ((m = re.exec(css))) out.push(m[1]); return out.length ? out.join('\n') : null; }
  var e = CF.Engine.newGame({ calling: 'master', seed: 3 });
  UI.attach(e);
  render(e);

  // Item 104: a card that deals in or flies in is promoted only while it moves; at rest it carries a plain translate.
  flushTimers();
  var rec0 = e.openCases()[0];
  var fresh = e.create('clue', e.clueSpec(rec0, { label: 'A Boot Print', text: 'Mud.', aspects: { forensic: 1 } }));
  fresh.fresh = true;
  var flown = e.create('clue', e.clueSpec(rec0, { label: 'A Torn Glove', text: 'Kid leather.', aspects: { opportunity: 1 } }));
  UI.spawn[flown.uid] = { cx: 10, cy: 10, gx: 0, gy: 0 };
  render(e);
  var fel = $('#board').querySelector('.card[data-uid=' + fresh.uid + ']'), wel = $('#board').querySelector('.card[data-uid=' + flown.uid + ']');
  assert.ok(fel && fel.classList.contains('arrive') && wel && wel.classList.contains('flying'), 'a new card deals in, a taken one flies');
  flushTimers();
  var still = $('#board').querySelectorAll('.card').filter(function (c) { return c.classList.contains('arrive') || c.classList.contains('flying'); });
  assert.strictEqual(still.length, 0, 'no card at rest keeps .arrive or .flying (and so no will-change)');
  assert.ok(/^translate\(-?\d+px,-?\d+px\)$/.test(fel.style.transform), 'a resting card has no 3D hint: ' + fel.style.transform);
  // The ropes' and pins' layers are the ropes' size, not the table's.
  var rec = e.openCases()[0];
  e.revealSuspect(rec, null, { key: rec.culprit });
  e.dirty = true; render(e); UI.syncLinks();
  var pins = $('#board').children.filter(function (c) { return /\bpins\b/.test(c.getAttribute('class') || ''); })[0];
  var B = CF.TABLE.BOUNDS;
  assert.ok(pins && parseFloat(pins.style.width) > 0 && parseFloat(pins.style.width) < B.w && parseFloat(pins.style.height) < B.h, 'the pins layer is fitted to its ropes: ' + (pins && pins.style.width + ' x ' + pins.style.height));
  assert.strictEqual(pins.getAttribute('viewBox'), parseFloat(pins.style.left) + ' ' + parseFloat(pins.style.top) + ' ' + parseFloat(pins.style.width) + ' ' + parseFloat(pins.style.height), 'drawn one to one');
  UI.fitLayers(null);
  assert.strictEqual(pins.style.width, '0px', 'nothing tied, no size');
  assert.ok(/visibility: hidden/.test(rule('#journal-drawer')) && /visibility 0s linear 0\.25s/.test(rule('#journal-drawer')) && /visibility: visible/.test(rule('#journal-drawer.open')), 'the closed journal is hidden once it has slid out');

  // Item 98: the patrons' seals under Standing, a word for each and the next step.
  e.s.favour = { council: 3, bishop: -2, guild: 1 };
  UI.showMeterInfo('reputation');
  var peek = $('#peek').innerHTML;
  assert.ok(/class="i-favour"/.test(peek) && (peek.match(/class="fv-row /g) || []).length === 3, 'three seal rows: ' + peek.slice(0, 200));
  assert.ok(/Your patron/.test(peek) && /Now: Suspicion falls a step each week/.test(peek), 'the Council at 3 is your patron, and its boon is now');
  assert.ok(/Cold/.test(peek) && /Now: The Inquisitor comes/.test(peek) && /At 3: A bed in the Abbey hospital/.test(peek), 'the Bishop at -2: the Inquisitor now, the bed at 3');
  assert.ok(/Warm/.test(peek) && /At 3: Now and then the guilds/.test(peek) && !/At -2: [^<]*guild/i.test(peek), 'the Guilds warm, with no threat to name');
  assert.ok(peek.indexOf(PATRON_ART_OF('council')) >= 0, 'each row wears its patron\'s seal');
  function PATRON_ART_OF(k) { return 'var(--art-' + { council: 'casp-05', bishop: 'casp-04', guild: 'cres-01' }[k] + ')'; }
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  var calling = e.tableCards().filter(function (c) { return CF.CARDS[c.def].kind === 'calling'; })[0];
  if (calling) assert.ok(UI.dossierLines(calling).some(function (l) { return l === 'Favour: The Council: Your patron · The Bishop: Cold · The Guilds: Warm'; }), 'the Calling names each patron\'s favour in a word');
  e.s.favour = { council: 0, bishop: 0, guild: 0 };

  // Item 100: the band carries the seal and the name; each fact once; the proof in pips with its sentences as title.
  var head = new El('div'); head.id = 'peek-head'; body.appendChild(head);
  var sc = e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; })[0];
  UI.selected = sc.uid; render(e);
  assert.ok(head.classList.contains('on') && head.innerHTML.indexOf(e.labelOf(sc)) >= 0 && /k-icon/.test(head.innerHTML), 'the band: the kind\'s seal and the name');
  peek = $('#peek').innerHTML;
  assert.ok(!/<h4>/.test(peek), 'no second name under the card');
  var proof = $('#peek').querySelector('.i-proof');
  var prof = CF.Charge.profileOf(rec);
  assert.ok(proof && proof.querySelectorAll('.pf-chip').filter(function (c) { return !c.classList.contains('pf-word'); }).length === Object.keys(prof).length, 'a chip for each kind the case turns on');
  assert.ok(/^To convict: /.test(proof.title) && / · Still wanted: /.test(proof.title), 'the sentences are its title: ' + proof.title);
  var pr = UI.proofRow(sc);
  pr.rows.forEach(function (r) { assert.ok(r.have <= r.need, 'pips never overflow'); });
  var chip = proof.querySelector('.pf-chip b');
  assert.ok(/^[●○]+$/.test(chip.textContent), 'filled and empty pips: ' + chip.textContent);
  UI.selected = null; render(e);
  body.removeChild(head);

  // Item 101: every ending its own picture; the tally's number beside its tile; a phone on its side keeps two columns.
  var ea = /var ENDING_ART = (\{[\s\S]*?\});/.exec(main);
  var EA = (0, eval)('(' + ea[1] + ')');
  Object.keys(CF.ENDINGS).forEach(function (id) { assert.ok(EA[id], id + ' has its picture'); });
  var losing = ['dismissed', 'burnout', 'collapse', 'consumed', 'corruption', 'death', 'riot', 'hangmans', 'dagger', 'stake', 'oldbailey'];
  var seen = {};
  losing.forEach(function (id) { assert.ok(!seen[EA[id]], id + ' does not share ' + EA[id] + ' with ' + seen[EA[id]]); seen[EA[id]] = id; });
  assert.strictEqual(EA.death, 'cback-04', 'the skull is death\'s alone');
  assert.ok(/<b><\/b><em>0<\/em><span>/.test(main) && /countUp\(/.test(main) && /classList\.add\('dealt'\)/.test(main), 'the tally counts up beside its tiles, the card is dealt');
  assert.ok(/@media \(max-height: 520px\) \{\n  \.end-box \.end-paper \{ grid-template-columns: 150px 1fr; \}/.test(css), 'a phone on its side keeps the card beside the words');
  assert.ok(/animation: flipIn 0\.5s/.test(rule('.end-box.dealt .end-card')) && /animation: stamp 0\.45s ease-out 0\.4s/.test(rule('.end-box.dealt .end-card .ec-seal')), 'the card deals in and the wax lands after');

  // Item 103: the first paint waits for nothing heavy.
  var headHtml = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
  assert.ok(headHtml.indexOf('<style>html,body{background:#0b1516}</style>') >= 0 && headHtml.indexOf('<style>') < headHtml.indexOf('rel="stylesheet"'), 'the page is dark before any sheet');
  ['css/art/noir-tables.css', 'css/art/cm-cards.css', 'css/art/cm-icons.css'].forEach(function (f) {
    assert.ok(new RegExp('<link rel="stylesheet" href="' + f.replace(/\./g, '\\.') + '" media="print" onload="this\\.media=\'all\';window\\.CF&amp;&amp;CF\\.artLoaded&amp;&amp;CF\\.artLoaded\\(\\)" onerror="this\\.media=\'all\'').test(headHtml), f + ' loads beside the page');
    assert.ok(/<noscript>[^\n]*/.exec(headHtml)[0].indexOf(f) >= 0, f + ' without scripts too');
  });
  ['css/fonts.css', 'css/art/menu.css', 'css/art/deck-menu.css', 'css/art/cm-ui.css', 'css/style.css'].forEach(function (f) { assert.ok(headHtml.indexOf('<link rel="stylesheet" href="' + f + '">') >= 0, f + ' holds the first paint'); });
  assert.ok(/CF\.artLoaded = function/.test(main) && /'art-wait'/.test(main) && /link\[media="print"\]/.test(main) && /whenArt\(function \(\) \{ if \(continueGame\(\)\)/.test(main), 'New Game and Continue wait for the art, and so does a resume');
  assert.ok(/#title\.art-wait #t-new \.mi, #title\.art-wait #t-continue \.mi \{ background-image: var\(--art-ctimer-01\)/.test(css), 'an hourglass turns in their place');

  // Item 97: a verb window's i opens the Help at its verb.
  var asked = null;
  CF.openHelp = function (at) { asked = at; };
  UI.openVerbs = [];
  UI.about = 'interrogate';
  UI.openWindow('interrogate');
  render(e);
  var hb = $('#windows').querySelector('.vw-help');
  assert.ok(hb && /bround-22/.test(hb.style.backgroundImage) && hb.title === 'How to Play', 'the book, no words');
  hb.click();
  assert.strictEqual(asked, 'help-question', 'it opens the Help at Question');
  Object.keys(UI.HELP_AT).forEach(function (v) { assert.ok(html.indexOf('id="' + UI.HELP_AT[v] + '"') >= 0, v + ': its heading is in the Help'); });
  delete CF.openHelp; UI.about = null;
  while (UI.openVerbs.length) UI.back();
  assert.ok(/openHelp\('title'\)/.test(main) && /CF\.openHelp = function \(at\)/.test(main) && /target\.scrollIntoView\(\{ block: 'start' \}\)/.test(main), 'the Help opens at a heading when asked');
  console.log('ui: the Help by chapter and a verb\'s way in, the patrons\' seals, the dossier\'s band and pips, an ending of its own, the first paint, no layers at rest');
})();

// ---- Lane 2, items 105-112: the Council's count, the Petitions' board, Standing past the last office, the Roads,
// what became of them, a card's own way out, the music under menus and danger, felt cues by name.
(function lane2r8c() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var e = CF.Engine.newGame({ calling: 'master', seed: 4 });
  UI.attach(e);
  render(e);

  // Item 112: a cue by name. The app's bridge plays the name; the web plays its pattern; an unknown name nothing.
  settings.haptics = true;
  var buzz = [], named = [], oldVib = navigator.vibrate;
  navigator.vibrate = function (p) { buzz.push(p); return true; };
  UI.haptic('toll'); UI.haptic('reject'); UI.haptic('tick'); UI.haptic('nonsense');
  assert.deepStrictEqual(buzz, [[12, 140, 12], [8, 40, 8], 8], 'the names as web patterns: ' + JSON.stringify(buzz));
  globalThis.CaseFileAndroid = { haptic: function (k) { named.push(k); }, vibrate: function () { named.push('ms'); } };
  UI.haptic('heavy'); UI.haptic(12);
  assert.deepStrictEqual(named, ['heavy', 'ms'], 'the app plays the name itself, and milliseconds through its vibrator');
  delete globalThis.CaseFileAndroid;
  settings.haptics = false;
  buzz.length = 0; UI.haptic('heavy');
  assert.strictEqual(buzz.length, 0, 'the Vibration setting still rules');
  navigator.vibrate = oldVib;
  var uisrc = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  assert.ok(/UI\.haptic\('heavy'\)/.test(uisrc) && /UI\.haptic\('harm'\)/.test(uisrc) && /UI\.haptic\('toll'\)/.test(uisrc) && /UI\.haptic\('reject'\)/.test(uisrc) && /UI\.haptic\('confirm'\)/.test(uisrc) && /UI\.haptic\('tick'\)/.test(uisrc), 'the verdict, harm, the week, a refusal, a slotting, a pick-up');
  assert.ok(/UI\.haptic\('heavy'\)/.test(main), 'and the new office');

  // Item 110: a card leaves the table as the rules say it went.
  var spot = 0;
  function gone(why) {
    var c = e.create('clue', { label: 'A Thread ' + why });
    c.loc.x = 2600 + 200 * spot++; c.loc.y = 2600; // a place of its own, not under another card
    render(e);
    var el = $('#board').querySelectorAll('.card').filter(function (x) { return String(x.dataset.uid) === String(c.uid); })[0];
    assert.ok(el, 'the card is on the table');
    e.emit('gone', { uid: c.uid, why: why });
    e.remove(c);
    render(e);
    return el;
  }
  played.length = 0;
  assert.ok(gone('lost').classList.contains('gone-burn') && played.indexOf('loss') >= 0, 'an ability lost for good burns, and is heard');
  assert.ok(gone('faded').classList.contains('gone-ink'), 'a trail fades like ink');
  assert.ok(gone('left').classList.contains('gone-walk'), 'a witness walks off');
  assert.ok(gone('whatever').classList.contains('leaving'), 'anything else fades as before');
  assert.ok(/@keyframes burn \{ 40% \{ filter: sepia\(1\) brightness\(0\.6\) contrast\(1\.3\); \}/.test(css) && /\[dir=rtl\] \.card\.gone-walk \.c-face \{ animation-name: walkoffRtl; \}/.test(css), 'the burn, and the walk the other way in Arabic');
  assert.ok(/html\[data-calm\] \.card\.gone-burn \.c-face, html\[data-calm\] \.card\.gone-ink \.c-face, html\[data-calm\] \.card\.gone-walk \.c-face \{ animation-name: fadeOut; \}/.test(css), 'less motion: a plain fade');

  // Item 111: the pad muffled while paused (not under a drag) or under a menu; darker under danger.
  var hush = [], moods = [];
  CF.Audio.hush = function (on) { hush.push(on); };
  CF.Audio.mood = function (n) { moods.push(n); };
  UI.setPaused(true); UI.setPaused(false);
  UI.autoPaused = true; UI.setPaused(true); UI.autoPaused = false; UI.setPaused(false);
  assert.deepStrictEqual(hush, [true, false, false, false], 'a pause hushes, a drag\'s does not: ' + JSON.stringify(hush));
  e.create('fatigue');
  UI.updateLive();
  assert.ok(moods.length === 1 && moods[0] >= 1, 'a threat on the table darkens the music: ' + moods);
  delete CF.Audio.hush; delete CF.Audio.mood;
  assert.ok(/if \(CF\.Audio\.music\) CF\.Audio\.music\(false\);\n    CF\.Audio\.play\(over\.win \? 'victory' : 'defeat'\);/.test(main), 'the ending stops the pad before its stinger');
  assert.ok(/if \(UI\.hushSync\) UI\.hushSync\(\);/.test(main), 'menus hush it');

  // Item 107: Standing at the last office aims at the next favour where the rules grant them, and says so.
  var cap = e.rankCap ? e.rankCap() : CF.TOP_RANK, oldEvery = CF.FAVOUR_EVERY;
  e.s.rank = cap; e.s.calling = 'master'; e.s.meters.reputation = CF.RANK_REP[cap] + 5;
  delete CF.FAVOUR_EVERY;
  var fn1 = e.favourNext;
  e.favourNext = undefined;
  var t0 = UI.repTarget(e);
  assert.ok(t0.max === e.s.meters.reputation && t0.line === 'You hold the last office open to you.', 'without favours: full, and no promise of a letter');
  CF.FAVOUR_EVERY = 4; e.s.flags.favourStep = 1;
  var t1 = UI.repTarget(e);
  e.favourNext = fn1;
  // The rules' own writ (engine favourNext) is what the meter aims at, where they keep one.
  var tw = UI.repTarget(e);
  assert.ok(tw.max === e.favourNext().at && /grants you a favour/.test(tw.line), 'the rules\' next writ: ' + tw.max + ' ' + tw.line);
  assert.ok(t1.max === CF.RANK_REP[cap] + 8 && /every 4 Standing the Council grants you a favour/.test(t1.line), 'the next favour: ' + t1.max + ' ' + t1.line);
  UI.showMeterInfo('reputation');
  assert.ok(/grants you a favour/.test($('#peek').innerHTML) && !/At each threshold/.test($('#peek').innerHTML), 'the popover says what comes next, not a threshold that never will');
  e.s.calling = 'commissioner'; e.s.rank = CF.TOP_RANK; e.s.meters.reputation = 10;
  assert.strictEqual(UI.repTarget(e).max, CF.COMMISSIONER_REP, 'a Commissioner aims at the Seat first');
  if (oldEvery === undefined) delete CF.FAVOUR_EVERY; else CF.FAVOUR_EVERY = oldEvery;
  delete e.s.flags.favourStep; e.s.calling = 'master'; e.s.rank = 0; e.s.meters.reputation = 0;
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';

  // Item 105: the Council's count in the Bell's pane, where the rules keep one.
  e.verb('time').unlocked = true;
  // The engine's count (councilExpects: n answered of m, from Bailiff).
  var ce0 = e.councilExpects;
  e.councilExpects = function () { return { n: 1, m: 3, weeksLeft: 1 }; };
  UI.openWindow('time'); render(e);
  var q = $('#windows').querySelector('.quota');
  assert.ok(q && q.querySelectorAll('.q-pips i').length === 3 && q.querySelectorAll('.q-pips i.on').length === 1 && /1 of 3 this fortnight/.test(q.innerHTML), 'a pip a case, one filled');
  e.councilExpects = undefined;
  e.councilQuota = function () { return { closed: 2, expect: 3 }; };
  e.s.week++; render(e);
  q = $('#windows').querySelector('.quota');
  assert.ok(q && q.querySelectorAll('.q-pips i.on').length === 2, 'the older shape reads the same');
  e.councilQuota = undefined;
  e.councilExpects = ce0;
  assert.strictEqual(e.s.rank < 2 ? UI.councilQuota(e) : null, null, 'below Bailiff the Council counts nothing');
  e.s.week++; render(e);
  assert.ok(!$('#windows').querySelector('.quota'), 'no count where the rules keep none');
  while (UI.openVerbs.length) UI.back();

  // Item 108: the Roads under the Firsts, from the rules' reckoning; a defeat's warning among them.
  e.roads = function () { return [{ id: 'merciful', text: 'Mercy {m} of {at}', vars: { m: 9, at: 12 } }, { id: 'dismissed', text: 'The Crowd has warned you once', warn: true }, { bad: 1 }]; };
  render(e);
  var rb = $('#journal').querySelector('.roads');
  assert.ok(rb && rb.querySelectorAll('.road').length === 2 && rb.querySelectorAll('.road.warn').length === 1 && /Mercy 9 of 12/.test(rb.innerHTML) && /The Merciful Judge/.test(rb.innerHTML), 'two roads, one a warning, each named');
  e.roads = undefined; render(e);
  assert.ok(!$('#journal').querySelector('.roads'), 'no Roads where the rules reckon none');
  assert.ok(/The journal's <b>Roads<\/b> show the three you are nearest/.test(html), 'the Help says where to look');

  // Item 109: what became of them, read with care from the story's epilogue.
  var src = main.slice(main.indexOf('  var EPI_ART'), main.indexOf('  UI.endEpilogue = endEpilogue;'));
  var fakeCF = { Story: { epilogue: function () { return ['He still walks the lanes.', { text: '{n} examiners sent home', vars: { n: 2 }, kind: 'rival' }, { text: 'x', art: 'bad"key' }, null, 'four', 'five']; } } };
  var epi = new Function('CF', 'tr', src + '\nreturn endEpilogue;')(fakeCF, CF.T)(e);
  assert.ok(epi.length === 4 && epi[1].text === '2 examiners sent home' && epi[1].art === 'cwax-02' && epi[2].art === 'ccirc-01', 'four lines at most, templates filled, a bad picture refused: ' + JSON.stringify(epi));
  assert.deepStrictEqual(new Function('CF', 'tr', src + '\nreturn endEpilogue;')({}, CF.T)(e), [], 'no epilogue, no list');
  assert.ok(/id="end-epi"><h6>What Became of Them<\/h6><ul id="end-epi-list"><\/ul>/.test(html), 'the list under the ending\'s words');

  // Item 106: a Petition's dossier opens the Watch-house board.
  var opened = 0;
  UI.openPrecinct = function () { opened++; };
  var ord = e.create('order', { label: 'Petition: Sketch-book', data: { order: 'camera', discount: 0 } });
  UI.selected = ord.uid; render(e);
  var bb = $('#peek').querySelector('.peek-board');
  assert.ok(bb, 'the Watch-house button');
  bb.click();
  assert.strictEqual(opened, 1, 'it opens the board');
  UI.selected = null; delete UI.openPrecinct; render(e);
  console.log('ui: the Council\'s count, the Petitions\' board, Standing past the last office, the Roads, the epilogue, a card\'s way out, the music hushed and dark, felt cues by name');
})();

(function lane2r8d() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
  var uisrc = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  var e = CF.Engine.newGame({ calling: 'master', seed: 6 });
  UI.attach(e);
  render(e);

  // Item 115: a chit names the same door as another case's chit on the table, and its dossier says so, no more.
  var f = e.newFront('the Quiet Men', 'market');
  while (e.openCases().length < 2) e.spawnCase();
  var r1 = e.openCases()[0], r2 = e.openCases()[1];
  var chit = function (rec) { return e.create('clue', e.clueSpec(rec, e.linkItem(f))); };
  var c1 = chit(r1);
  var cue = 'Another token on the table names the same door';
  assert.ok(UI.dossierLines(c1).indexOf(cue) < 0, 'alone, the chit says nothing of a door');
  var c2 = chit(r2);
  assert.ok(UI.dossierLines(c1).indexOf(cue) >= 0 && UI.dossierLines(c2).indexOf(cue) >= 0, 'two cases\' chits for one door: each says another names it');
  assert.ok(!UI.dossierLines(c1).some(function (l) { return l.indexOf(f.name) >= 0 && l !== e.labelOf(c1) && l.indexOf('chit') < 0 && l.indexOf('token') < 0 && l.indexOf('tally') < 0; }), 'and does not name the door');
  e.remove(c2);
  var c3 = chit(r1);
  assert.ok(UI.dossierLines(c1).indexOf(cue) < 0, 'two chits of one case make no thread, and no cue');
  e.remove(c1); e.remove(c3);

  // Item 116: the two new crimes have their pictures, whole tiles that are loaded.
  var cards = fs.readFileSync(path.join(__dirname, '..', 'css/art/cm-cards.css'), 'utf8'), icons = fs.readFileSync(path.join(__dirname, '..', 'css/art/cm-icons.css'), 'utf8');
  ['cplace3-04', 'cplace2-06'].forEach(function (k) { assert.ok(cards.indexOf('--art-' + k + ':') >= 0, k + ' is loaded'); });
  ['iplace2-04', 'iplace2-14'].forEach(function (k) { assert.ok(icons.indexOf('--art-' + k + ':') >= 0, k + ' is loaded'); });
  assert.ok(/weights: \['cplace3-04', 'iplace2-04'\], searchers: \['cplace2-06', 'iplace2-14'\]/.test(uisrc), 'False Weights and the Searchers have their cards');

  // Item 117: letting go of the effects or the whole volume plays a card landing; the music needs nothing.
  assert.ok(/\['sfx', 'master'\]\.forEach[\s\S]{0,200}addEventListener\('change'[\s\S]{0,200}now - tasteAt < 150[\s\S]{0,80}CF\.Audio\.play\('drop'\)/.test(screens), 'the SFX and Master sliders sound on release, 150 ms apart');

  // Item 118: the season, where the rules keep one, on the week bar and first in the Bell; nothing without one.
  var wb = $('#weekbar');
  if (!wb) { wb = new El('div'); wb.id = 'weekbar'; var sh = new El('div'); sh.className = 'wb-shade'; wb.appendChild(sh); body.appendChild(wb); }
  e.s.week = 27;
  // The rules' own year (engine season(): { id, name, line, effect }): the week bar and the Bell's first lines.
  assert.ok(typeof e.season === 'function' && UI.seasonNow(e).id === 'plague' && UI.seasonNow(e).label === 'The Plague Summer', 'week 27 is the Plague Summer, by the rules');
  render(e);
  assert.strictEqual(wb.title, 'Week 27. The Plague Summer', 'the week bar names it: ' + wb.title);
  e.verb('time').unlocked = true;
  if (e.verb('time').x === undefined) e.layoutVerbs();
  UI.openWindow('time');
  render(e);
  var sl = $('#windows').querySelectorAll('.vw-season');
  assert.ok(sl[0] && sl[0].textContent === 'Week 27. The Plague Summer: the Abbey cart goes round twice a day.' && sl[1] && sl[1].textContent === e.season().effect, 'the Bell\'s first lines: the season, and what it changes');
  while (UI.openVerbs.length) UI.back();
  var season0 = e.season, oldSeasons = CF.SEASONS;
  e.season = undefined; CF.SEASONS = undefined;
  assert.strictEqual(UI.seasonNow(e), null, 'no seasons in the rules: none shown');
  CF.SEASONS = [{ id: 'lent', label: 'Lent', from: 1, to: 13 }, { id: 'plague', label: 'The Plague Summer', line: 'the Abbey cart goes round twice a day.', from: 27, to: 39 }];
  assert.strictEqual(UI.seasonNow(e).id, 'plague', 'week 27 is the Plague Summer');
  e.s.week = 53;
  assert.strictEqual(UI.seasonNow(e).id, 'lent', 'and the year comes round');
  e.s.week = 27;
  render(e);
  assert.strictEqual(wb.title, 'Week 27. The Plague Summer', 'the week bar names it: ' + wb.title);
  e.verb('time').unlocked = true;
  if (e.verb('time').x === undefined) e.layoutVerbs();
  UI.openWindow('time');
  render(e);
  var first = $('#windows').querySelector('.vw-season');
  assert.ok(first && first.textContent === 'Week 27. The Plague Summer: the Abbey cart goes round twice a day.', 'the Bell\'s first line: ' + (first && first.textContent));
  while (UI.openVerbs.length) UI.back();
  assert.ok(/\.vwin \.vw-desc\.vw-season \{/.test(css), 'the season line has its style');
  CF.SEASONS = oldSeasons; e.season = season0;
  // The Long Service ending has its picture.
  assert.ok(/longservice: 'cherald-05'/.test(main), 'the Long Service: the rose');
  console.log('ui: a chit\'s door, the new crimes\' cards, the sliders heard, the season on the week and the Bell');
})();

// ---- Round 8, after the merge: the interface reads the rules' own fields, under the names the rules gave them.
(function mergedFields() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 29 });
  UI.attach(e);
  // How loud a bad story lands is the rules' cue (engine story(): entry.cue), whatever its title.
  assert.strictEqual(UI.dangerWeight({ kind: 'danger', title: 'In the Council\'s Service', cue: 'harm' }), 'harm', 'a cue of harm is the alarm and the shake');
  assert.strictEqual(UI.dangerWeight({ kind: 'danger', title: 'Anything', cue: 'need' }), 'need', 'a need is a heartbeat');
  assert.strictEqual(UI.dangerWeight({ kind: 'danger', title: 'Fever', cue: 'quiet' }), 'quiet', 'quiet is quiet');
  assert.strictEqual(UI.dangerWeight(e.story('Beaten on the Stair', 'x', 'danger')), 'harm', 'the engine\'s own story carries it');
  assert.strictEqual(UI.dangerWeight(e.story('The Rival Boasts', 'x', 'danger')), 'omen', 'and no cue is an omen');
  // A story told in sentences is read a sentence at a time, in the journal and its toast.
  var parts = ['Lodging and dues take 2.', 'The ledger: no case closed; 1 open; 3 Coin in hand.'];
  var st = e.story('Week 3', parts, 'week');
  assert.ok(st.parts && UI.storyText(st) === parts.join(' '), 'in English, the sentences joined');
  if (!CF.I18N.dicts.ar || !CF.I18N.dicts.ar['the Rolls']) fs.readdirSync(path.join(__dirname, '..', 'js/lang/ar')).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js/lang/ar', f), 'utf8'), { filename: f }); });
  CF.setLang('ar');
  var arText = UI.storyText(st);
  assert.ok(arText === parts.map(function (x) { return CF.T(x); }).join(' ') && !/[A-Za-z]{3}/.test(arText), 'in Arabic, each sentence on its own: ' + arText);
  CF.setLang('en');
  render(e);
  assert.ok($('#journal').textContent.indexOf(parts.join(' ')) >= 0, 'the journal shows the story');
  // The Roads as the rules reckon them (callings.js roads(): how near in a word, and what it still wants).
  var roads0 = e.roads;
  e.roads = function () { return [{ id: 'merciful', title: 'The Merciful Judge', warn: false, frac: 0.5, near: 'Halfway', want: 'More mercies at the Court.' }, { id: 'dismissed', title: 'Dismissed', warn: true, frac: 1, near: 'Warned', want: 'The Crowd is near boiling.' }]; };
  var jr = UI.journalRoads(e);
  assert.ok(jr.length === 2 && jr[0].text === 'Halfway · More mercies at the Court.' && jr[1].warn, 'each road says how near and what it wants: ' + JSON.stringify(jr));
  e.roads = roads0;
  assert.ok(UI.journalRoads(e).every(function (r) { return typeof r.text === 'string' && r.text; }), 'the rules\' own roads all have words');
  // A heresy case says what the rules say of it (patrons.js heresyWatch: their week, their gate).
  var rec = e.openCases()[0], hw0 = e.heresyWatch, cc = e.caseCard(rec.id);
  e.heresyWatch = function (r) { return r.id === rec.id ? { kept: false, week: 9, line: 'Smells of heresy: the Inquisitor\'s after week {n}', vars: { n: 9 } } : null; };
  assert.ok(UI.dossierLines(cc).some(function (l) { return l === 'Smells of heresy: the Inquisitor\'s after week 9'; }), 'the Inquisitor\'s week is the rules\' own');
  e.heresyWatch = function () { return null; };
  assert.ok(!UI.dossierLines(cc).some(function (l) { return /heresy|Dominicans/.test(l); }), 'nothing where the rules see no heresy');
  e.heresyWatch = hw0;
  // The cards and cases the rules added wear pictures of their own, never the question mark.
  ['mint', 'gloryhand', 'receiver'].forEach(function (t) { assert.ok(UI.caseArt(t) && UI.caseArt(t) !== 'csign-01', t + ' has its own card'); });
  var seal = e.create('seal', { data: { patron: 'bishop' } }), writ = e.create('councilwrit');
  assert.strictEqual(UI.cardPicture(seal).art, 'casp-04', 'the Bishop\'s seal wears his church');
  assert.ok(UI.cardPicture(writ).art !== 'csign-01', 'the Council\'s writ has its picture');
  e.remove(seal); e.remove(writ);
  // The Court's word on each token is the rules' (assessCharge standing), when they give it.
  var tok = { uid: 9999, def: 'clue', caseId: rec.id, data: {} };
  assert.strictEqual(UI.tokenStanding({ standing: { 9999: { id: 'else', label: 'Someone else' } } }, { uid: 1 }, tok), 'other', 'the rules\' Someone else');
  assert.strictEqual(UI.tokenStanding({ standing: { 9999: { id: 'names', label: 'Names them' } } }, { uid: 1 }, tok), 'names', 'the rules\' Names them');
  // The Rolls name a case the Rival closed and one the Council took.
  var screens = fs.readFileSync(path.join(__dirname, '..', 'js/screens.js'), 'utf8');
  assert.ok(/rival: 'Answered by the Rival'/.test(screens) && /council: 'Taken by the Council'/.test(screens) && /rival: 'cwax-02', council: 'cwax-04'/.test(screens), 'the Rolls name the Rival\'s and the Council\'s cases');
  // The Fever half a minute from the end: a heartbeat and a mark, once.
  var fev = e.create('burnout');
  played.length = 0;
  e.emit('pressing', { uid: fev.uid, label: 'Fever', def: 'burnout', verb: 'reflect', ends: true });
  e.emit('pressing', { uid: fev.uid, label: 'Fever', def: 'burnout', verb: 'reflect', ends: true });
  assert.strictEqual(played.filter(function (k) { return k === 'heartbeat'; }).length, 1, 'one heartbeat for the pressing Fever');
  e.remove(fev);
  // The Crowd's tally is the rules' count (abroadTally), the Coquille one.
  UI.showMeterInfo('pressure');
  assert.ok(new RegExp('Thieves abroad: ' + e.abroadTally().n + '\\.').test($('#peek').innerHTML) && /the Coquille one/.test($('#peek').innerHTML), 'the tally the rules keep');
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  // The Standing past its office, held for a record (recordShort): said in the popover.
  var rs0 = e.recordShort;
  e.s.rank = 0; e.s.meters.reputation = CF.RANK_REP[1];
  e.recordShort = function () { return 2; };
  UI.showMeterInfo('reputation');
  assert.ok(/the Council wants 2 more cases answered first/.test($('#peek').innerHTML), 'held for a record, and how many');
  e.recordShort = rs0; e.s.meters.reputation = 0;
  $('#peek').classList.remove('open', 'pinned'); $('#peek').dataset.uid = '';
  // A Mark from a case the Architect touched reads as a Mark.
  assert.strictEqual(CF.cardFace({ def: 'clue' }, 'The Mark at The Burglary at Pauw\'s').text, 'The Mark', 'the Mark at a case is a Mark');
  console.log('ui: after the merge, the rules\' own cues, sentences, roads, heresy, pictures, standing, outcomes, tally and record');
})();

void realSetTimeout;
console.log('ui.test: all passed');
