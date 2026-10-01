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
  assert.ok(el.style.transform.indexOf('translate3d(' + Math.round(b0.x) + 'px,' + Math.round(b0.y) + 'px') === 0, 'placed back: ' + el.style.transform);
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
  var topbar = /#topbar \{[^}]*\}/.exec(css)[0];
  assert.ok(/flex-wrap:\s*nowrap/.test(topbar) && /overflow:\s*hidden/.test(topbar), 'the top bar never wraps');
  assert.ok(/@media \(max-width: 1500px\)[^}]*\.meter \.m-label \{ display: none/.test(css), 'the meter names go first');
  assert.ok(/@media \(max-width: 1300px\)[^}]*#topbar \.rank \{ display: none/.test(css) && /@media \(max-width: 1100px\)[^}]*#topbar \.brand \{ display: none/.test(css), 'then the rank, then the brand');
  assert.ok(/#controls button\[data-speed="2"\], #controls button\[data-speed="3"\], #btn-journal, #btn-precinct, #btn-help \{ display: none/.test(css), 'a phone keeps the play button and the menu');
  assert.ok(/id="m-journal"/.test(html) && /id="m-help"/.test(html) && /click\('m-journal'/.test(main) && /click\('m-help'/.test(main), 'the journal and the Help live in the pause menu');
  assert.ok(/@keyframes stamp \{ from \{ transform: scale\(2\.2\) rotate\(-12deg\)/.test(css) && /\.verb \.verdict \{[^}]*width: 120px/.test(css), 'the verdict slams down as a stamp');
  assert.ok(/\.card\.sealed \.c-face::after \{[^}]*var\(--seal\)[^}]*rotate\(-8deg\)/.test(css), 'a sealed case wears its wax');
  assert.ok(/\.toast \{[^}]*aspect-ratio: auto/.test(css) && !/\.toast \{[^}]*overflow: hidden/.test(css), 'a toast is as tall as its words');
  assert.ok(/\.toast::after \{[^}]*border-image: var\(--bar\)/.test(css) && /\.toast::before \{[^}]*var\(--icon\)/.test(css), 'the bar is sliced, the icon sits in its circle');
  assert.ok(/#toasts \{[^}]*right: calc\(12px \+ var\(--sa-r\)\)[^}]*top: calc\(var\(--sa-t\) \+ 64px\)/.test(css) && /body\.has-window #toasts \{ right: calc\(390px \* var\(--ui-scale, 1\)\)/.test(css), 'toasts sit top right, clear of the window and the notch');
  assert.ok(/#hint \{[^}]*top: 10px;[^}]*pointer-events: auto/.test(css) && /#hint::before \{[^}]*bround-17/.test(css) && /#hint::after \{[^}]*clabel-06/.test(css), 'the hint is a painted bar under the verbs');
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
  var help = /<div class="help-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="row center"><button class="plate-btn redfill" id="help-close">/.exec(html)[1];
  var heads = help.match(/<h4>[^<]+<\/h4>/g).map(function (x) { return x.slice(4, -5); });
  assert.deepStrictEqual(heads.slice(0, 7), ['Your table', 'Your first case, in order', 'What a verb finds', 'Asks', 'Proof of six kinds', 'The Court', 'The ladder'], 'the left column is in the order a game is played');
  assert.deepStrictEqual(heads.slice(-2), ['Keys', 'Time'], 'Keys and Time come last');
  assert.ok(!/Cards and verbs/.test(help), 'the old heading is gone');
  assert.ok(/<h4>Proof of six kinds<\/h4>\s*<p>[^<]*<\/p>\s*<div id="help-aspects"><\/div>/.test(help), 'the six kinds have their list');
  assert.ok(/<h4>The Court<\/h4>\s*<p>The Blood Court sits under the Carolina, the Emperor's law of 1532:/.test(help), 'the Court is glossed');
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
  assert.ok(/\* 0\.805\)/.test(rule('.slot .s-box.empty ~ .s-label')), 'the name in the lower band');
  assert.ok(/drop-shadow\(0 0 3px rgba\(208, 86, 74, 1\)\)/.test(rule('.card.bad .c-face')), 'a bad token wears a red shadow');
  // The ending.
  var end = /<div class="modal screen hidden" id="end">([\s\S]*?)\n  <\/div>\n/.exec(html)[1];
  assert.ok(/<div class="screen-box end-box">/.test(end) && /<div class="banner" id="end-banner"><span id="end-title"><\/span><\/div>/.test(end) && /<div class="paper end-paper">/.test(end), 'the ending is a screen with a banner and paper');
  assert.ok(/id="end-card-pic"/.test(end) && /id="end-card-seal"/.test(end) && /class="ec-name" id="end-card-bottom"/.test(end), 'the end card has its arch, its circle and its band');
  ['end-successor', 'end-new', 'end-archive', 'end-look'].forEach(function (id) { assert.ok(new RegExp('class="plate-btn [a-z]+" id="' + id + '"').test(end), id + ' is a plate button'); });
  assert.ok(/cbar-01/.test(rule('.banner.lose span')) && /cbar-03/.test(rule('.banner.win span')), 'red on a loss, gold on a win');
  assert.ok(/cwide-03/.test(rule('.end-win .end-card')) && /cwide-04/.test(rule('.end-lose .end-card')), 'the end card is a wide frame of the same tone');
  var statb = rule('.stats b');
  assert.ok(/width: 72px; height: 72px/.test(statb) && /var\(--c, /.test(statb) && /font-family: var\(--display\)/.test(statb), 'the counters are 72px tiles with the number in the display font');
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
  assert.ok(/border-left: 3px solid/.test(rule('.journal-entry')) && /background: rgba\(255, 250, 238/.test(rule('.journal-entry')) && /border-left-color: var\(--danger\)/.test(rule('.journal-entry.k-case')), 'entries are paper blocks with the kind down the left');
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
  assert.ok(/'snap', 'strings', 'haptics', 'tilt'\]/.test(screens), 'screens.js wires it like snap');
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

void realSetTimeout;
console.log('ui.test: all passed');
