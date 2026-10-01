// The table's words, read off the state: the hint gives a finished verb and an
// unanswered ask precedence over the lesson, the advisor speaks to a waiting
// choice, the opening prose is replayed on a new game, the dossier names the
// accused's mark and what a charge still lacks, the ask box says what ignoring
// costs, the verdict stamps the Court, and the Help lists where proof comes
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
};
var timers = [];
globalThis.window = globalThis;
globalThis.document = document;
globalThis.performance = { now: function () { return Date.now(); } };
globalThis.requestAnimationFrame = function () { return 1; };
globalThis.localStorage = { getItem: function () { return null; }, setItem: function () {} };
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, vibrate: function () {} }, configurable: true }); } catch (err) { /* node's own will do */ }
globalThis.matchMedia = function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; };
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
  assert.ok(/Mark: /.test(peek), 'the dossier opens with the mark');
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

// ---- The verdict stamps the Court token and the conviction is heard.
(function verdict() {
  var e = CF.Engine.newGame({ calling: 'master', seed: 7 });
  UI.attach(e);
  e.verb('arrest').unlocked = true;
  render(e);
  var tok = $('#board').querySelectorAll('.verb').filter(function (el) { return el.dataset.verb === 'arrest'; })[0];
  assert.ok(tok, 'the Court token is on the table');
  played.length = 0;
  e.emit('resolved', { title: 'Nothing', outcome: 'wrongful' });
  var st = tok.querySelector('.verdict');
  assert.ok(st && st.classList.contains('stamp'), 'the stamp lands on the token');
  assert.ok(/cwax-03/.test(st.style.backgroundImage), 'a wrongful verdict wears the wax of a true one');
  assert.ok(played.indexOf('complete') >= 0, 'and is heard');
  flushTimers();
  assert.ok(!tok.querySelector('.verdict'), 'the stamp lifts after its moment');
  e.emit('resolved', { title: 'Nothing', outcome: 'cold' });
  assert.ok(/ccirc-05/.test(tok.querySelector('.verdict').style.backgroundImage), 'a cold case takes the eye');
  console.log('ui: the verdict has its moment on the table');
})();

// ---- The Standing meter honours the rank cap and says when the letter is held.
(function standing() {
  var e = CF.Engine.newGame({ who: 'hangman', name: 'Gall', calling: 'master', seed: 11 });
  UI.attach(e);
  assert.strictEqual(e.rankCap(), 2, 'a hangman ends at Bailiff');
  e.s.rank = 2; e.s.meters.reputation = 5;
  render(e);
  var rep = $('#meters').querySelector('.meter[data-meter=reputation]');
  assert.ok(rep.classList.contains('lvl-4'), 'at the cap the meter is full, not measured against an office that will not come: ' + rep.className);
  assert.ok(/cres-09/.test(rep.querySelector('.m-icon').style.backgroundImage), 'Standing wears the crown');
  assert.ok(/cres-04/.test($('#meters').querySelector('.meter[data-meter=pressure] .m-icon').style.backgroundImage), 'the Crowd wears the fire');
  UI.showMeterInfo('reputation');
  var peek = $('#peek').innerHTML;
  assert.ok(/last office the Council will give a hangman/.test(peek), 'the dossier says where the ladder ends: ' + peek.replace(/<[^>]+>/g, ' ').slice(0, 200));
  assert.ok(!/Blocked/.test(peek), 'nothing is blocked yet');
  e.s.who = 'monk'; e.s.flags.promoHeld2 = true;
  UI.showMeterInfo('reputation');
  peek = $('#peek').innerHTML;
  assert.ok(/Blocked: the Council/.test(peek) && !/hangman/.test(peek), 'a held letter is told, and only to the one it concerns');
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

void realSetTimeout;
console.log('ui.test: all passed');
