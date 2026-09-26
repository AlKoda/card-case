// DOM rendering and input. Reads engine state, renders the table, verbs and
// side panel, and turns drags/clicks into engine calls.
(function () {
  var CF = window.CF;
  var U = CF.util;

  // Art lives in css/art/*.css as --art-* custom properties (see tools/build_art.py).
  function art(name) { return 'var(--art-' + name + ')'; }
  function hash(str) { var x = 0; str = String(str); for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
  // Which coloured frame each card kind is drawn in.
  var FRAME_COLOR = {
    case: 'red', court: 'red', coldcase: 'black',
    clue: 'black', evidence: 'black', paper: 'black',
    witness: 'blue', suspect: 'blue', informant: 'purple', personnel: 'blue',
    teammate: 'gold', hospital: 'black',
    district: 'green', room: 'green',
    threat: 'crimson', criminal: 'crimson',
    ability: 'gold', funds: 'gold', equipment: 'gold', order: 'gold', career: 'gold',
    insight: 'purple', calling: 'purple', temptation: 'purple', intel: 'purple', place: 'green',
  };
  // Icons for cards that have no picture.
  var CARD_ICONS = {
    health: 'icon-health', wound: 'icon-health', focus: 'icon-focus', instinct: 'icon-instinct', funds: 'icon-funds',
    fatigue: 'icon-fatigue', burnout: 'icon-burnout', obsession: 'icon-obsession', tunnel: 'icon-redeye',
    bribe: 'icon-handshake', gang: 'icon-roots', syndicate: 'icon-pyramid', trial: 'icon-gavel',
    promotion: 'icon-star', promo_inspector: 'icon-star', promo_chief: 'icon-star', chair: 'icon-court', room: 'icon-court',
    looseend: 'icon-hook', ledger: 'icon-scales', paperwork: 'icon-folder', order: 'icon-folder', notes: 'icon-folder',
    camera: 'icon-camera', prints: 'aspect-forensic', kit: 'icon-search', surveillance: 'icon-binoculars', labpass: 'icon-mind',
    calling_commissioner: 'icon-star', calling_master: 'icon-mind', calling_crusader: 'icon-scales',
  };
  // Evidence pictures, chosen by what a clue is about.
  var EV_RULES = [
    [/victim's account|statement|word from|confession|cover story|slip of|testimony/i, 'prop-clipnote'],
    [/motive|hide|signature/i, 'ev-sketch'],
    [/convenient|knife|weapon/i, 'ev-bloodtag'],
    [/corroborated/i, 'pic-board'],
    [/finger|print|ink/i, 'prop-fingerprint'],
    [/blood|fibre|stroke/i, 'ev-blood'],
    [/accelerant|paraffin|residue|vial/i, 'prop-vial'],
    [/call|phone|wiretap|record|cassette/i, 'prop-cassette'],
    [/letter|correspondence|iou|diary|note/i, 'prop-envelope'],
    [/ledger|account|bank|money|payment|insurance|prospectus|shell|payroll|discrepanc|spending|books|owner/i, 'pic-files'],
    [/photo|caught|sighting|seen|ghost/i, 'pic-photo'],
    [/window|glass|latch|frame|tool|scratch|dent|dust|room|paint/i, 'ev-glass'],
    [/key|entry|found at|home/i, 'prop-key'],
    [/timing|tide|timetable|schedule|pattern|suitcase/i, 'prop-notepad'],
    [/pawn|gem|ring|goods|stock|wallet|chip/i, 'ev-gem'],
    [/cigarette|wrapper|scent|butt|licorice/i, 'prop-bag'],
    [/footprint|boot/i, 'prop-boot'],
    [/file|typewriter|newspaper/i, 'ev-newspaper'],
  ];
  var EV_BY_ASPECT = { forensic: 'prop-fingerprint', testimony: 'prop-clipnote', motive: 'prop-envelope', opportunity: 'pic-photo', digital: 'prop-cassette', financial: 'pic-files' };
  var CASE_ART = { burglary: 'pic-mansion', missing: 'prop-mugshot', harbor: 'ev-chalk', arson: 'ev-newspaper', fraud: 'pic-files',
    extortion: 'pic-fedora', manhunt: 'pic-board', gang: 'ev-snapshots', syndicate: 'pic-book', architect: 'ev-sketch' };
  var DISTRICT_ART = { docks: 'pic-docks', market: 'pic-street', neon: 'ev-alley', uptown: 'pic-mansion', warrens: 'prop-house', canal: 'pic-arch' };
  var PEOPLE = ['pic-man', 'pic-woman', 'pic-glasses', 'pic-lady', 'pic-smoker', 'pic-hood', 'pic-youth', 'pic-fedora'];
  var CASE_DOSSIER = { burglary: 'house', missing: 'map', harbor: 'knife', arson: 'alley', fraud: 'city', extortion: 'redprint',
    manhunt: 'alley', gang: 'redprint', syndicate: 'fedora', architect: 'man' };
  var KIND_DOSSIER = { suspect: 'man', witness: 'woman', clue: 'print', evidence: 'print', teammate: 'badge', personnel: 'badge', equipment: 'print', intel: 'fedora', place: 'city',
    hospital: 'badge', informant: 'fedora', district: 'city', criminal: 'redprint', coldcase: 'city', court: 'knife' };
  var VERB_TOKENS = { time: 'token-time', delegate: 'token-rest', majorcrimes: 'token-warrant' };
  var METER_ICONS = { pressure: 'icon-group', scrutiny: 'icon-search', retaliation: 'icon-retaliation', reputation: 'icon-star' };
  var TOAST_BARS = { case: 'bar-case', danger: 'bar-danger', defeat: 'bar-danger', major: 'bar-major', victory: 'bar-victory', week: 'bar-mind', verb: 'bar-search' };
  var RING_LEN = 2 * Math.PI * 47;

  // The picture in a card's window: {art, fit: 'cover'|'contain'|'icon', gray?}
  // pic-* are full-bleed paintings; props and old evidence art sit on the paper.
  function pictureOf(art, gray) {
    return { art: art, fit: /^pic-/.test(art) ? 'cover' : 'contain', gray: !!gray };
  }
  function cardPicture(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind;
    var named = CF.imageOf(card);
    if (named) return /^icon-|^aspect-/.test(named) ? { art: named, fit: 'icon', gray: card.def === 'wound' } : pictureOf(named, k === 'hospital' || k === 'coldcase');
    if (k === 'case') { var r = e.caseRec(card.caseId); return pictureOf(CASE_ART[r && r.template] || 'pic-mansion'); }
    if (k === 'coldcase') return pictureOf(CASE_ART[card.data.template] || 'pic-mansion', true);
    if (k === 'clue' || k === 'evidence') {
      var label = e.labelOf(card);
      for (var i = 0; i < EV_RULES.length; i++) if (EV_RULES[i][0].test(label)) return pictureOf(EV_RULES[i][1]);
      var a = CF.clueAspects(card), best = null;
      for (var key in a) if (!best || a[key] > a[best]) best = key;
      return pictureOf(EV_BY_ASPECT[best] || 'prop-tag');
    }
    if (k === 'district') return pictureOf(DISTRICT_ART[card.data.district] || 'pic-street');
    if (k === 'teammate' || k === 'personnel') return pictureOf('pic-bobby');
    if (k === 'hospital') return pictureOf('pic-bobby', true);
    if (card.def === 'suspect' || card.def === 'witness' || card.def === 'informant' || card.def === 'atlarge') {
      return pictureOf(PEOPLE[hash(card.data.name || e.labelOf(card)) % PEOPLE.length]);
    }
    if (CARD_ICONS[card.def]) return { art: CARD_ICONS[card.def], fit: 'icon', gray: card.def === 'wound' };
    return null;
  }

  var UI = (CF.UI = {
    e: null, openVerbs: [], selected: null, hover: null, hoverSlot: null,
    speed: 1, paused: false, modal: false, drag: null,
    view: { x: 16, y: 16, z: 1 }, winPos: {}, lifted: null, spawn: {},
    onGameOver: null, onSave: null,
  });

  var T = CF.TABLE;
  var cardEls = {};   // top card uid -> board element
  var verbEls = {};   // verb id -> token element
  var winEls = {};    // verb id -> window element
  var liveCards = []; // [el, uid] for cards with timers

  function $(sel) { return document.querySelector(sel); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------- Setup
  UI.attach = function (engine) {
    UI.e = engine;
    UI.openVerbs = [];
    UI.selected = null;
    UI.hover = null;
    UI.lifted = null;
    UI.spawn = {};
    UI.winPos = {};
    UI.seenVerbs = {};
    UI.newVerbs = {};
    UI.lastRank = engine.s.rank;
    UI.journalLen = -1;
    CF.VERB_ORDER.forEach(function (id) { if (engine.verb(id).unlocked) UI.seenVerbs[id] = true; });
    ['#board', '#windows'].forEach(function (sel) { $(sel).innerHTML = ''; });
    cardEls = {}; verbEls = {}; winEls = {}; liveCards = [];
    engine.on(onEvent);
    engine.dirty = true;
    requestAnimationFrame(UI.fitView);
  };

  UI.setPaused = function (p) { UI.paused = p; renderControls(); };
  UI.setSpeed = function (sp) { UI.speed = sp; UI.paused = false; renderControls(); };

  UI.init = function () {
    $('#controls').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-speed]');
      if (!b) return;
      var sp = +b.dataset.speed;
      if (sp === 0) UI.setPaused(!UI.paused); else UI.setSpeed(sp);
    });
    $('#zoom').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-zoom]');
      if (!b) return;
      var r = $('#table').getBoundingClientRect();
      if (b.dataset.zoom === 'fit') UI.fitView();
      else zoomAt(r.left + r.width / 2, r.top + r.height / 2, b.dataset.zoom === 'in' ? 1.15 : 1 / 1.15);
    });
    document.addEventListener('keydown', function (ev) {
      if (UI.modal || ev.target.tagName === 'INPUT') return;
      if (ev.code === 'Space') { ev.preventDefault(); UI.setPaused(!UI.paused); }
      else if (ev.key === '1' || ev.key === '2' || ev.key === '3') UI.setSpeed(+ev.key);
      else if (ev.key === 'Escape') { if (UI.drag) cancelDrag(); else if (UI.openVerbs.length) closeWindow(UI.openVerbs[UI.openVerbs.length - 1]); }
      else if (ev.key === '+' || ev.key === '=') $('#zoom [data-zoom=in]').click();
      else if (ev.key === '-') $('#zoom [data-zoom=out]').click();
      else if (ev.key === '0') UI.fitView();
    });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', function () { cancelDrag(); });
    document.addEventListener('dblclick', onDoubleClick);
    $('#table').addEventListener('wheel', function (ev) {
      if (UI.modal) return;
      // Inside a verb window the wheel scrolls the window, not the table.
      if (ev.target.closest && ev.target.closest('.vwin')) return;
      ev.preventDefault();
      zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });
    window.addEventListener('resize', function () {
      // Keep open windows inside the (possibly smaller) table.
      Object.keys(winEls).forEach(function (vid) { positionWindow(vid, winEls[vid]); });
      if (UI.e) UI.e.dirty = true;
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && CF.Settings.get('pauseOnBlur') && UI.e && !UI.e.s.over) UI.setPaused(true);
    });

    var last = performance.now();
    var saveT = 0;
    function frame(now) {
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      var e = UI.e;
      if (e) {
        if (!e.s.over && !UI.paused && !UI.modal) {
          e.tick(dt * UI.speed);
          saveT += dt;
          if (saveT > 8 && UI.onSave) { saveT = 0; UI.onSave(); }
        }
        if (e.dirty) { e.dirty = false; render(); }
        updateLive();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // ---------------------------------------------------------------- Events
  var STORY_SOUNDS = { case: 'case', danger: 'danger', week: 'week', major: 'complete', victory: 'complete' };
  function shake() {
    if (!CF.Settings.get('shake')) return;
    var app = $('#app');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  }

  function onEvent(type, payload) {
    if (type === 'resolved' && UI.onResolved) UI.onResolved(payload);
    if (type === 'story') {
      var k = payload.kind;
      if (!UI.modal && STORY_SOUNDS[k]) CF.Audio.play(STORY_SOUNDS[k]);
      if (!UI.modal && k === 'danger') shake();
      if (k === 'case' || k === 'danger' || k === 'major' || k === 'victory' || k === 'week') toast(payload);
      if (k === 'case' && CF.Settings.get('pauseOnCase')) UI.setPaused(true);
    }
    if (type === 'complete') {
      CF.Audio.play('complete');
      var v = UI.e.verb(payload.verb);
      if (UI.openVerbs.indexOf(payload.verb) < 0 && v.story) toast({ title: CF.VERBS[payload.verb].label + ': ' + v.story.title, text: v.story.text, kind: 'verb', verb: payload.verb });
      if (CF.Settings.get('pauseOnVerb')) UI.setPaused(true);
    }
    if (type === 'over' && UI.onGameOver) setTimeout(function () { UI.onGameOver(UI.e.s.over); }, 600);
  }

  function toast(entry) {
    if (UI.modal) return;
    var box = $('#toasts');
    var t = h('div', 'toast k-' + (entry.kind || 'event'));
    t.style.backgroundImage = art(TOAST_BARS[entry.kind] || 'bar-search');
    t.innerHTML = '<b>' + esc(entry.title) + '</b><span>' + esc(entry.text || '') + '</span>';
    t.addEventListener('click', function () {
      if (entry.verb) openWindow(entry.verb);
      else $('#journal').scrollTop = 0;
      t.remove();
    });
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('leaving'); setTimeout(function () { t.remove(); }, 300); }, 6000);
  }

  // ---------------------------------------------------------------- Render
  function render() {
    renderTop();
    syncBoard();
    syncWindows();
    markFits();
    renderJournal();
    renderInspector();
    renderControls();
  }

  function renderControls() {
    document.querySelectorAll('#controls button[data-speed]').forEach(function (b) {
      var sp = +b.dataset.speed;
      b.classList.toggle('on', sp === 0 ? UI.paused : !UI.paused && UI.speed === sp);
    });
    $('#table').classList.toggle('paused', !!UI.paused);
  }

  function meter(key, label, val, max, shown) {
    var pct = Math.min(100, (val / max) * 100);
    var state = key === 'reputation' ? ' rep' : val >= max * 0.8 ? ' crit' : val >= max * 0.6 ? ' warn' : '';
    var full = { pressure: 'Public Pressure', scrutiny: 'Scrutiny (Internal Affairs)', retaliation: 'Retaliation', reputation: 'Reputation' }[key];
    return '<div class="meter' + state + '" title="' + esc(full || label) + '"><span class="m-icon" style="background-image:' + art(METER_ICONS[key]) + '"></span>' +
      '<div class="m-main"><div class="m-label"><span>' + label + '</span><span>' + shown +
      '</span></div><div class="m-bar"><div class="m-fill" style="width:' + pct + '%"></div></div></div></div>';
  }

  function renderTop() {
    var e = UI.e, s = e.s, m = s.meters;
    var nextRep = s.rank < CF.TOP_RANK ? CF.RANK_REP[s.rank + 1] : (s.calling === 'commissioner' ? CF.COMMISSIONER_REP : Math.max(m.reputation, 1));
    var mm = function (k, label) { var max = e.meterMax(k); return meter(k, label, m[k], max, m[k] + '/' + max); };
    $('#meters').innerHTML = mm('pressure', 'Pressure') + mm('scrutiny', 'Scrutiny') + mm('retaliation', 'Retaliation') +
      meter('reputation', 'Reputation', m.reputation, nextRep, m.reputation + (s.rank < CF.TOP_RANK || s.calling === 'commissioner' ? '/' + nextRep : ''));
    $('#rank').textContent = s.detective + ' · ' + CF.CALLINGS[s.calling].label.replace('The ', '');
    $('#rank-badge').style.backgroundImage = art('rank-' + (CF.RANK_DEFS[s.rank] || {}).badge || 1);
    $('#rank-badge').title = CF.RANKS[s.rank];
    if (UI.lastRank !== undefined && s.rank > UI.lastRank && UI.onPromotion) UI.onPromotion(s.rank);
    UI.lastRank = s.rank;
    updateWeekBar();
  }

  function aspectChip(k, v) {
    var b = h('span', 'chip');
    b.title = CF.ASPECTS[k].label;
    var i = h('span', 'chip-icon');
    i.style.backgroundImage = art('aspect-' + k);
    b.appendChild(i);
    b.appendChild(h('span', null, String(v)));
    return b;
  }

  // ---------------------------------------------------------------- Cards
  function caseTitle(card) {
    var rec = card.caseId && UI.e.caseRec(card.caseId);
    return rec ? rec.title : '';
  }

  // What a card looks like; if this string changes the face is rebuilt.
  function cardSig(card, count) {
    return [card.def, UI.e.labelOf(card), JSON.stringify(card.aspects || ''), card.caseId || '', count, !!card.maxLife,
      card.def === 'coldcase' ? card.data.template : ''].join('|');
  }

  // A card element: shadow cards underneath (for stacks) and the face.
  function buildCard(card, count, mini) {
    var n = h('div', 'card' + (mini ? ' mini' : ''));
    n.dataset.uid = card.uid;
    fillCard(n, card, count);
    return n;
  }

  function fillCard(n, card, count) {
    var e = UI.e;
    var def = CF.CARDS[card.def];
    var kind = CF.KINDS[def.kind] || { label: def.kind };
    var frame = FRAME_COLOR[def.kind] || 'gold';
    n.dataset.sig = cardSig(card, count);
    n.dataset.uid = card.uid;
    n.className = n.className.replace(/\b(frame|kind)-\S+/g, '').replace(/\bstack-\d\b/g, '').trim() +
      ' frame-' + frame + ' kind-' + def.kind + (count > 1 ? ' stack-' + Math.min(3, count) : '');
    n.innerHTML = '';
    for (var i = Math.min(2, count - 1); i > 0; i--) {
      var u = h('div', 'c-under u' + i);
      u.style.backgroundImage = art('cardframe-' + frame);
      n.appendChild(u);
    }
    var face = h('div', 'c-face');
    face.style.backgroundImage = art('cardframe-' + frame);
    var body = h('div', 'c-body');
    var pic = cardPicture(card);
    if (pic) {
      var win = h('div', 'c-window ' + pic.fit + (pic.gray ? ' gray' : ''));
      var img = h('div', 'c-img');
      img.style.backgroundImage = art(pic.art);
      win.appendChild(img);
      body.appendChild(win);
    }
    body.appendChild(h('div', 'c-kind', kind.label));
    body.appendChild(h('div', 'c-title', e.labelOf(card)));
    var sub = '';
    if (card.caseId && def.kind !== 'case') sub = 're: ' + caseTitle(card);
    else if (def.kind === 'case') { var r = e.caseRec(card.caseId); sub = r ? CF.DISTRICTS[r.district].label : ''; }
    if (sub) body.appendChild(h('div', 'c-sub', sub));
    var asp = h('div', 'c-aspects');
    var a = CF.aspectsOf(card);
    CF.CLUE_ASPECTS.forEach(function (k) { if (a[k]) asp.appendChild(aspectChip(k, a[k])); });
    if (asp.children.length) body.appendChild(asp);
    if (card.maxLife) {
      if (def.kind === 'case' || def.kind === 'court' || def.kind === 'threat' || card.def === 'witness' || card.def === 'bribe') {
        body.appendChild(h('div', 'c-timer', U.fmtTime(card.life)));
      }
      var life = h('div', 'c-life');
      life.appendChild(h('div'));
      body.appendChild(life);
    }
    face.appendChild(body);
    n.appendChild(face);
    if (count > 1) n.appendChild(h('div', 'c-count', '×' + count));
    updateCardLive(n, card);
  }

  function updateCardLive(n, card) {
    if (!card || !card.maxLife) return;
    var t = n.querySelector('.c-timer');
    if (t) t.textContent = U.fmtTime(card.life);
    var lf = n.querySelector('.c-life > div');
    if (lf) lf.style.width = Math.max(0, (card.life / card.maxLife) * 100) + '%';
    var k = CF.CARDS[card.def].kind;
    n.classList.toggle('urgent', (k === 'case' && card.life < 60) || ((k === 'clue' || k === 'evidence' || k === 'witness') && card.life < 30));
  }

  // ---------------------------------------------------------------- Board
  function applyView() {
    var v = UI.view;
    $('#board').style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
    $('#table').style.setProperty('--z', v.z);
  }

  function boardBounds() {
    var e = UI.e, x0 = 0, y0 = 0, x1 = T.COLS * (T.CW + T.GAP), y1 = T.TOP + 3 * (T.CH + T.GAP);
    e.tableCards().forEach(function (c) { x1 = Math.max(x1, c.loc.x + T.CW); y1 = Math.max(y1, c.loc.y + T.CH); });
    CF.VERB_ORDER.forEach(function (id) { var v = e.verb(id); if (v.unlocked) { x1 = Math.max(x1, v.x + T.VW); y1 = Math.max(y1, v.y + T.VH); } });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Fit the whole board into the table area.
  UI.fitView = function () {
    if (!UI.e) return;
    var r = $('#table').getBoundingClientRect();
    var b = boardBounds();
    // Fit the width; the board can be panned vertically.
    var z = U.clamp((r.width - 40) / b.w, 0.5, 1);
    UI.view = { x: Math.max(20, (r.width - b.w * z) / 2) - b.x * z, y: 16 - b.y * z, z: z };
    applyView();
  };

  function zoomAt(cx, cy, factor) {
    var r = $('#table').getBoundingClientRect();
    var v = UI.view, z = U.clamp(v.z * factor, 0.4, 1.6);
    var px = cx - r.left, py = cy - r.top;
    v.x = px - (px - v.x) * (z / v.z);
    v.y = py - (py - v.y) * (z / v.z);
    v.z = z;
    applyView();
  }

  function toBoard(cx, cy) {
    var r = $('#table').getBoundingClientRect();
    return { x: (cx - r.left - UI.view.x) / UI.view.z, y: (cy - r.top - UI.view.y) / UI.view.z };
  }

  function place(el, x, y) { el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)'; }

  // Keep one element per stack on the board, moving (not rebuilding) them.
  function syncBoard() {
    var e = UI.e, board = $('#board');
    var lifted = UI.lifted || {};
    var groups = {}, usable = {};
    e.tableCards().forEach(function (c) {
      if (lifted[c.uid]) return;
      usable[c.uid] = !e.unavailableReason(c);
      var k = c.loc.x + ',' + c.loc.y;
      (groups[k] = groups[k] || []).push(c);
    });
    var keep = {};
    liveCards = [];
    Object.keys(groups).forEach(function (k) {
      var list = groups[k].sort(function (a, b) { return a.uid - b.uid; });
      var top = list[0];
      keep[top.uid] = true;
      var el = cardEls[top.uid];
      var sig = cardSig(top, list.length);
      if (!el) {
        el = buildCard(top, list.length);
        cardEls[top.uid] = el;
        var sp = UI.spawn[top.uid];
        if (sp) {
          // Fly in from where it came from (a verb window, the drag layer...).
          var p0 = toBoard(sp.cx, sp.cy);
          place(el, p0.x - sp.gx, p0.y - sp.gy);
          el.classList.add('flying');
          delete UI.spawn[top.uid];
        } else {
          place(el, top.loc.x, top.loc.y);
          if (top.fresh) el.classList.add('arrive');
        }
        board.appendChild(el);
        if (sp) { void el.offsetWidth; }
      } else if (el.dataset.sig !== sig) {
        fillCard(el, top, list.length);
      }
      if (el.parentNode === board) place(el, top.loc.x, top.loc.y);
      el.classList.toggle('selected', UI.selected === top.uid);
      el.classList.toggle('unavailable', usable[top.uid] === false);
      if (top.maxLife) liveCards.push([el, top.uid]);
      list.forEach(function (c) { c.fresh = false; });
    });
    Object.keys(cardEls).forEach(function (uid) {
      if (keep[uid] || lifted[uid]) return;
      var el = cardEls[uid];
      delete cardEls[uid];
      if (el.parentNode !== board) return;
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 220);
    });
    syncVerbs();
  }

  function verbStatus(vid) {
    var e = UI.e, v = e.verb(vid);
    if (vid === 'time') return 'Week ' + e.s.week;
    if (v.status === 'running') return U.fmtTime(v.duration - v.elapsed);
    if (v.status === 'done') return 'Ready';
    if (e.lockReason(vid)) return 'Locked';
    var n = Object.keys(v.slots).length;
    return n ? n + ' card' + (n > 1 ? 's' : '') : '';
  }

  function syncVerbs() {
    var e = UI.e, board = $('#board');
    CF.VERB_ORDER.forEach(function (vid) {
      var v = e.verb(vid);
      var el = verbEls[vid];
      if (!v.unlocked) { if (el) { el.remove(); delete verbEls[vid]; } return; }
      var def = CF.VERBS[vid];
      if (!el) {
        el = h('div', 'verb ' + vid + (def.auto ? ' time' : ''));
        el.dataset.verb = vid;
        el.title = def.desc;
        var tok = h('div', 'v-token');
        tok.style.backgroundImage = art(VERB_TOKENS[vid] || 'token-' + vid);
        tok.insertAdjacentHTML('beforeend', '<svg class="v-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" /></svg>');
        if (vid === 'time') tok.appendChild(h('div', 'v-week', 'Wk ' + e.s.week));
        else tok.appendChild(h('div', 'v-plate', def.label));
        el.appendChild(tok);
        if (vid === 'time') el.appendChild(h('div', 'v-name', def.label));
        el.appendChild(h('div', 'v-status'));
        el.appendChild(h('div', 'v-badge', '!'));
        place(el, v.x, v.y);
        board.appendChild(el);
        verbEls[vid] = el;
        if (!UI.seenVerbs[vid]) { UI.seenVerbs[vid] = true; el.classList.add('new'); }
      }
      if (!(UI.drag && UI.drag.verb === vid)) place(el, v.x, v.y);
      el.classList.toggle('running', v.status === 'running');
      el.classList.toggle('done', v.status === 'done');
      el.classList.toggle('open', UI.openVerbs.indexOf(vid) >= 0);
      el.classList.toggle('locked', !!e.lockReason(vid) && v.status === 'idle');
      el.classList.toggle('loaded', v.status === 'idle' && Object.keys(v.slots).length > 0);
    });
  }

  function updateVerbRings() {
    var e = UI.e;
    Object.keys(verbEls).forEach(function (vid) {
      var el = verbEls[vid], v = e.verb(vid);
      var pct = vid === 'time' ? e.s.weekT / CF.WEEK : v.status === 'running' ? v.elapsed / v.duration : v.status === 'done' ? 1 : 0;
      var ring = el.querySelector('.v-ring circle');
      ring.style.strokeDasharray = (Math.min(1, pct) * RING_LEN) + ' ' + RING_LEN;
      el.querySelector('.v-status').textContent = vid === 'time' ? '' : verbStatus(vid);
      var wk = el.querySelector('.v-week');
      if (wk) wk.textContent = 'Wk ' + e.s.week;
    });
  }

  // The sun-to-moon bar: six dots light up as the week passes.
  function updateWeekBar() {
    var sh = document.querySelector('#weekbar .wb-shade');
    if (sh && UI.e) sh.style.left = (19 + 62 * Math.min(1, UI.e.s.weekT / CF.WEEK)) + '%';
  }

  function updateLive() {
    var e = UI.e;
    updateWeekBar();
    advanceTyping();
    updateVerbRings();
    for (var i = 0; i < liveCards.length; i++) updateCardLive(liveCards[i][0], e.card(liveCards[i][1]));
    UI.openVerbs.forEach(function (vid) {
      var w = winEls[vid], v = e.verb(vid);
      if (!w) return;
      if (v.status === 'running') {
        var pr = w.querySelector('.progress > div');
        if (pr) pr.style.width = (v.elapsed / v.duration) * 100 + '%';
        var tl = w.querySelector('.p-time');
        if (tl) tl.textContent = U.fmtTime(v.duration - v.elapsed) + ' remaining';
      }
      w.querySelectorAll('.card[data-uid]').forEach(function (n) { updateCardLive(n, e.card(+n.dataset.uid)); });
    });
  }

  // Cards on the table that could go into an open window's empty slots.
  function slotFits(vid, slotKey) {
    var e = UI.e, out = {};
    var sl = CF.VERBS[vid].slots.filter(function (x) { return x.key === slotKey; })[0];
    if (!sl) return out;
    e.tableCards().forEach(function (c) { if (e.slotAccepts(sl, c)) out[c.uid] = true; });
    return out;
  }
  function markFits() {
    var e = UI.e;
    var soft = {}, strong = UI.hoverSlot ? slotFits(UI.hoverSlot.verb, UI.hoverSlot.slot) : {};
    if (!UI.drag) {
      UI.openVerbs.forEach(function (vid) {
        var v = e.verb(vid);
        if (v.status !== 'idle' || CF.VERBS[vid].auto) return;
        var pk = e.primaryKey(vid);
        var slots = v.slots[pk] ? e.visibleSlots(vid).filter(function (sl) { return !v.slots[sl.key]; }) : [CF.VERBS[vid].slots[0]];
        slots.forEach(function (sl) { var f = slotFits(vid, sl.key); for (var k in f) soft[k] = true; });
      });
    }
    Object.keys(cardEls).forEach(function (uid) {
      var el = cardEls[uid], c = e.card(+uid);
      var stackUids = c ? e.stackOf(c).map(function (x) { return x.uid; }) : [+uid];
      el.classList.toggle('fits', stackUids.some(function (u) { return soft[u]; }));
      el.classList.toggle('fits-strong', stackUids.some(function (u) { return strong[u]; }));
    });
  }

  // ---------------------------------------------------------------- Windows
  function openWindow(vid) {
    var i = UI.openVerbs.indexOf(vid);
    if (i >= 0) UI.openVerbs.splice(i, 1);
    UI.openVerbs.push(vid);
    if (verbEls[vid]) verbEls[vid].classList.remove('new');
    UI.e.dirty = true;
  }
  function closeWindow(vid) {
    UI.openVerbs = UI.openVerbs.filter(function (x) { return x !== vid; });
    UI.hoverSlot = null;
    UI.e.dirty = true;
  }
  UI.openWindow = openWindow;

  function windowSig(vid) {
    var e = UI.e, v = e.verb(vid), pv = v.status === 'idle' ? e.preview(vid) : null;
    return [v.status, JSON.stringify(v.slots), v.out.join(','), v.held.join(','), v.story ? v.story.title : '',
      pv ? pv.label + '|' + pv.blocked + '|' + pv.text : '', e.lockReason(vid) || '', v.recipe || '',
      vid === 'time' ? e.s.week : ''].join('#');
  }

  function syncWindows() {
    var e = UI.e, layer = $('#windows');
    Object.keys(winEls).forEach(function (vid) {
      if (UI.openVerbs.indexOf(vid) < 0 || !e.verb(vid).unlocked) {
        var w = winEls[vid];
        delete winEls[vid];
        w.classList.add('closing');
        setTimeout(function () { w.remove(); }, 160);
      }
    });
    UI.openVerbs = UI.openVerbs.filter(function (vid) { return e.verb(vid).unlocked; });
    UI.openVerbs.forEach(function (vid, i) {
      var w = winEls[vid];
      if (!w) {
        w = h('div', 'vwin');
        w.dataset.win = vid;
        w.innerHTML = '<div class="vw-head"><div class="vw-icon"></div><h3></h3><button class="vw-close" title="Close (Esc)">×</button></div><div class="divider"></div><div class="vw-body"></div>';
        w.querySelector('.vw-icon').style.backgroundImage = art(VERB_TOKENS[vid] || 'token-' + vid);
        w.querySelector('h3').textContent = CF.VERBS[vid].label;
        w.querySelector('.vw-close').addEventListener('click', function () { closeWindow(vid); });
        layer.appendChild(w);
        winEls[vid] = w;
        positionWindow(vid, w);
      }
      w.style.zIndex = 10 + i;
      var sig = windowSig(vid);
      if (w.dataset.sig !== sig) {
        w.dataset.sig = sig;
        var body = w.querySelector('.vw-body');
        body.innerHTML = '';
        buildWindowBody(body, vid);
      }
    });
  }

  function positionWindow(vid, w) {
    var tr = $('#table').getBoundingClientRect();
    var W = 356, pos = UI.winPos[vid];
    if (!pos) {
      var tok = verbEls[vid] && verbEls[vid].getBoundingClientRect();
      var x = tok ? tok.right - tr.left + 14 : 40, y = tok ? tok.top - tr.top : 40;
      if (x + W > tr.width - 8 && tok) x = tok.left - tr.left - W - 14;
      // Stagger below any open window whose title bar this one would cover,
      // so every window can still be grabbed.
      for (var i = 0; i < 10; i++) {
        var over = UI.openVerbs.filter(function (o) {
          var q = UI.winPos[o];
          return o !== vid && winEls[o] && q && x < q.x + W && q.x < x + W && y < q.y + 46 && q.y < y + 46;
        })[0];
        if (!over) break;
        y = UI.winPos[over].y + 50;
      }
      pos = { x: x, y: y };
    }
    pos.x = U.clamp(pos.x, 4, Math.max(4, tr.width - W - 4));
    pos.y = U.clamp(pos.y, 4, Math.max(4, tr.height - 120));
    UI.winPos[vid] = pos;
    w.style.left = pos.x + 'px';
    w.style.top = pos.y + 'px';
  }

  function miniCard(card) {
    var wrap = h('div', 'mini-wrap');
    wrap.appendChild(buildCard(card, 1, true));
    return wrap;
  }

  function buildWindowBody(pane, vid) {
    var e = UI.e;
    var v = e.verb(vid);
    var def = CF.VERBS[vid];

    if (def.auto) {
      pane.appendChild(h('p', 'vw-desc', def.desc));
      var wk = e.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
      if (wk) pane.appendChild(storyBox(wk));
      var open = e.openCases().slice().sort(function (a, b) { return caseLife(a) - caseLife(b); });
      var money = e.cardsOf('funds').filter(function (c) { return c.loc.t === 'table'; }).length;
      pane.appendChild(h('p', 'vw-desc', 'Funds on the table: ' + money + '. Every week pays ' + (CF.ECONOMY.salary[e.s.rank] || 1) + ' in salary and takes ' + CF.ECONOMY.rent + ' in rent; miss the rent and you sleep in the car.'));
      pane.appendChild(h('p', 'vw-desc', open.length ? 'Open cases, most urgent first.' : 'No open cases.'));
      open.forEach(function (rec) {
        var cc = e.caseCard(rec.id);
        if (!cc) return;
        var life = cc.life / cc.maxLife;
        var row = h('div', 'clock' + (cc.life < 60 ? ' urgent' : ''));
        row.innerHTML = '<span class="ck-title">' + esc(rec.title) + '</span><span class="ck-bar"><i style="width:' + Math.round(life * 100) + '%"></i></span>' +
          '<span class="ck-days">' + CF.daysLeft(cc.life) + ' day' + (CF.daysLeft(cc.life) === 1 ? '' : 's') + '</span>';
        pane.appendChild(row);
      });
      return;
    }

    if (v.status === 'running') {
      var rec = CF.RECIPES_BY_ID[v.recipe];
      var ctx = e.makeCtx(vid, v.ctxSlots);
      var r = h('div', 'recipe');
      r.innerHTML = '<h5>' + esc(typeof rec.label === 'function' ? rec.label(ctx) : rec.label) + '</h5>';
      pane.appendChild(r);
      var pr = h('div', 'progress');
      var fill = h('div');
      fill.style.width = (v.elapsed / v.duration) * 100 + '%';
      pr.appendChild(fill);
      pane.appendChild(pr);
      pane.appendChild(h('div', 'vw-desc p-time', U.fmtTime(v.duration - v.elapsed) + ' remaining'));
      var held = h('div', 'held');
      v.held.forEach(function (u) { var c = e.card(u); if (c) held.appendChild(miniCard(c)); });
      pane.appendChild(held);
      return;
    }

    if (v.status === 'done') {
      if (v.story) pane.appendChild(storyBox(v.story));
      var outs = h('div', 'outputs');
      outs.dataset.verb = vid;
      v.out.forEach(function (u) { var c = e.card(u); if (c) outs.appendChild(miniCard(c)); });
      pane.appendChild(outs);
      var act = h('div', 'actions');
      var col = h('button', 'plate-btn gold', 'Collect all');
      col.addEventListener('click', function () { collectAll(vid); });
      act.appendChild(col);
      act.appendChild(h('span', 'vw-desc', 'or drag them out'));
      pane.appendChild(act);
      return;
    }

    // Idle.
    if (v.story) pane.appendChild(storyBox(v.story));
    var primaryCard = v.slots[e.primaryKey(vid)];
    if (!primaryCard) pane.appendChild(h('p', 'vw-desc', def.desc));
    var lock = e.lockReason(vid);
    var slots = h('div', 'slots');
    e.visibleSlots(vid).forEach(function (sl) {
      var s = h('div', 'slot' + (sl.primary ? ' primary' : ''));
      s.dataset.verb = vid;
      s.dataset.slot = sl.key;
      var box = h('div', 's-box');
      var uid = v.slots[sl.key];
      if (uid && e.card(uid)) box.appendChild(miniCard(e.card(uid)));
      else box.appendChild(h('div', 's-hint', sl.accepts.map(prettyAspect).join(' / ')));
      s.appendChild(box);
      s.appendChild(h('div', 's-label', sl.label));
      s.addEventListener('pointerenter', function () { UI.hoverSlot = { verb: vid, slot: sl.key }; markFits(); });
      s.addEventListener('pointerleave', function () { UI.hoverSlot = null; markFits(); });
      slots.appendChild(s);
    });
    pane.appendChild(slots);

    var pv = e.preview(vid);
    var rbox = h('div', 'recipe');
    if (pv) {
      rbox.innerHTML = '<h5>' + esc(pv.label) + '</h5><p>' + esc(pv.text || '') + '</p>' +
        (pv.detail && pv.detail.charge ? chargeHtml(pv.detail.charge) : '') +
        (pv.strain ? '<div class="r-strain">' + esc(pv.strain) + '</div>' : '') +
        (pv.danger ? '<div class="r-danger">⚠ ' + esc(pv.danger) + '</div>' : '') +
        (pv.blocked ? '<div class="r-blocked">' + esc(pv.blocked) + '</div>' : '');
    } else if (primaryCard) {
      // The slots took the cards, but no recipe wants them. Say so, vaguely.
      rbox.classList.add('mystery');
      rbox.innerHTML = '<p class="r-none">' + esc(U.pick(Math.random, ['The pieces sit there. Nothing comes of it. Not yet.',
        'You turn it over and over. Something is missing.', 'It feels like the start of something. Just not this.'])) + '</p>';
    } else {
      rbox.innerHTML = '<p class="r-none">' + (lock ? esc(lock) : 'Drag a card into the first slot.') + '</p>';
    }
    pane.appendChild(rbox);

    var act2 = h('div', 'actions');
    var go = h('button', 'plate-btn redfill', pv ? 'Begin · ' + Math.round(pv.duration) + 's' : 'Begin');
    go.disabled = !pv || !!pv.blocked;
    go.addEventListener('click', function () { if (e.start(vid)) { CF.Audio.play('start'); e.dirty = true; } });
    act2.appendChild(go);
    if (Object.keys(v.slots).length) {
      var clr = h('button', 'plate-btn dark', 'Clear');
      clr.addEventListener('click', function () { returnSlots(vid); });
      act2.appendChild(clr);
    }
    pane.appendChild(act2);
  }

  // Cards leaving a window fly from where they are to where they land.
  function markSpawn(uid, fromEl) {
    if (!fromEl) return;
    var r = fromEl.getBoundingClientRect();
    UI.spawn[uid] = { cx: r.left, cy: r.top, gx: 0, gy: 0 };
  }
  function collectAll(vid) {
    var e = UI.e, w = winEls[vid];
    e.verb(vid).out.forEach(function (u) { markSpawn(u, w && w.querySelector('.card[data-uid="' + u + '"]')); });
    e.collect(vid);
    CF.Audio.play('drop');
    e.dirty = true;
  }
  function returnSlots(vid) {
    var e = UI.e, w = winEls[vid], v = e.verb(vid);
    Object.keys(v.slots).forEach(function (k) { markSpawn(v.slots[k], w && w.querySelector('.card[data-uid="' + v.slots[k] + '"]')); });
    e.clearSlots(vid);
    e.dirty = true;
  }

  // Story text types itself out at the player's chosen text speed.
  var typed = typeof WeakSet !== 'undefined' ? new WeakSet() : { has: function () { return true; }, add: function () {} };
  UI.typing = null;
  function storyBox(story) {
    var d = h('div', 'story');
    d.innerHTML = '<h5>' + esc(story.title) + '</h5>';
    var p = h('p');
    d.appendChild(p);
    if (typed.has(story) || CF.Settings.typeRate() === Infinity || !story.text) {
      p.textContent = story.text;
      typed.add(story);
    } else {
      if (!UI.typing || UI.typing.story !== story) UI.typing = { story: story, t0: performance.now() };
      UI.typing.el = p;
      d.title = 'Click to show all';
      d.addEventListener('click', function () { typed.add(story); p.textContent = story.text; UI.typing = null; });
      advanceTyping();
    }
    return d;
  }
  function advanceTyping() {
    var t = UI.typing;
    if (!t || !t.el) return;
    var n = Math.floor(((performance.now() - t.t0) / 1000) * CF.Settings.typeRate());
    if (n >= t.story.text.length) { t.el.textContent = t.story.text; typed.add(t.story); UI.typing = null; return; }
    t.el.textContent = t.story.text.slice(0, n);
  }

  function prettyAspect(a) {
    var map = { tool: 'Equipment', teammate: 'Officer', atlarge: 'At Large', coldcase: 'Cold Case', looseend: 'Loose End', promotion: 'Promotion', chair: 'The Chair' };
    if (map[a]) return map[a];
    if (CF.ASPECTS[a]) return CF.ASPECTS[a].label;
    if (CF.KINDS[a]) return CF.KINDS[a].label;
    if (CF.CARDS[a]) return CF.CARDS[a].label;
    return a.charAt(0).toUpperCase() + a.slice(1);
  }

  var shownJournal = null;
  function renderJournal() {
    var e = UI.e, j = e.s.journal;
    if (shownJournal === j[0] && UI.journalLen === j.length) return;
    shownJournal = j[0];
    UI.journalLen = j.length;
    var pane = $('#journal');
    pane.innerHTML = '';
    j.slice(0, 120).forEach(function (x) {
      var d = h('div', 'journal-entry k-' + x.kind);
      d.innerHTML = '<div class="j-meta">Week ' + x.week + '</div><h6>' + esc(x.title) + '</h6><p>' + esc(x.text) + '</p>';
      pane.appendChild(d);
    });
  }

  function caseLife(rec) { var cc = UI.e.caseCard(rec.id); return cc ? cc.life : Infinity; }

  // The charge breakdown in the Arrest window: what the case needs proven
  // against what the clues give, then the bonuses and penalties.
  function chargeHtml(d) {
    var html = '<div class="charge tier-' + d.tier + '"><div class="ch-head"><span>' + esc(d.tierLabel) + ' charge</span><span class="ch-score">' + d.score + ' / ' + d.need + '</span></div>';
    d.rows.forEach(function (r) {
      var pct = Math.min(100, (r.have / r.need) * 100);
      html += '<div class="ch-row' + (r.have >= r.need ? ' met' : r.have ? ' part' : '') + '"><span class="chip-icon" style="background-image:' + art('aspect-' + r.aspect) + '"></span>' +
        '<span class="ch-name">' + esc(CF.ASPECTS[r.aspect].label) + '</span><span class="ch-bar"><i style="width:' + pct + '%"></i></span><span class="ch-num">' + r.have + ' / ' + r.need + '</span></div>';
    });
    d.notes.forEach(function (n) { html += '<div class="ch-note ' + n.kind + '">' + esc(n.text) + '</div>'; });
    return html + '</div>';
  }

  // Short handwritten notes for the inspector's dossier.
  function dossierNotes(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind, lines = [];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var a = CF.clueAspects(card);
    var asp = Object.keys(a).map(function (x) { return CF.ASPECTS[x].label + ' ' + a[x]; }).join(', ');
    if (k === 'case' && rec) {
      var met = rec.suspects.filter(function (x) { return x.revealed; });
      lines.push(rec.scene + ', ' + CF.DISTRICTS[rec.district].label);
      lines.push('Suspects met: ' + (met.length ? met.map(function (x) { return x.name.split(' ')[1] + (x.cleared ? ' ✗' : rec.identified === x.key ? ' ★' : ''); }).join(', ') : 'none'));
      lines.push('Scene: ' + (rec.found >= rec.items.length ? 'searched out' : rec.searches ? 'partly searched' : 'not searched') + (rec.delegate ? ' · ' + rec.delegate.card.label + ' on it' : '') + (rec.major ? ' · Major Crime' : ''));
      lines.push(CF.daysLeft(card.life) + ' days left (' + U.fmtTime(card.life) + ')' + (rec.highProfile ? ' · high-profile' : ''));
    } else if (card.def === 'suspect') {
      var sus = e.suspectOf(card);
      if (sus) lines.push(sus.role.charAt(0).toUpperCase() + sus.role.slice(1) + (rec && rec.identified === card.data.key ? ' · prime suspect' : ''));
      if (rec) lines.push('Case: ' + rec.title);
      if (rec) { var prof = CF.Charge.profileOf(rec); lines.push('To charge: ' + Object.keys(prof).map(function (k) { return CF.ASPECTS[k].short + ' ' + prof[k]; }).join(', ')); }
    } else if (k === 'clue' || k === 'evidence' || card.def === 'witness') {
      if (rec) lines.push('Case: ' + rec.title);
      if (asp) lines.push(asp);
      if (card.maxLife) lines.push('Keeps for ' + U.fmtTime(card.life));
      if (k === 'evidence' && card.data.item && card.data.item.needs) lines.push('Needs special equipment');
    } else if (k === 'teammate' || k === 'personnel') {
      if (card.data.name) lines.push(card.data.name);
      if (asp) lines.push(asp);
      if (card.data.traits && card.data.traits.length) lines.push(card.data.traits.map(function (t) { return CF.OFFICER_TRAITS[t].label; }).join(', '));
      if (card.data.level) lines.push('Level ' + card.data.level);
    } else if (k === 'equipment') {
      var m = def.mods || {};
      if (m.boost) lines.push(Object.keys(m.boost.aspects).map(function (x) { return CF.ASPECTS[x].label + ' +' + m.boost.aspects[x]; }).join(', ') + ' on ' + m.boost.tags.join('/'));
      if (m.gate) lines.push('Reads evidence that needs it');
      if (m.extraEvidence) lines.push('Finds more physical evidence');
      if (m.unlocks) lines.push('Opens: ' + ((CF.RECIPES_BY_ID[m.unlocks] || {}).label || m.unlocks));
      if (m.unlocksVerb) lines.push('Opens the ' + CF.VERBS[m.unlocksVerb].label + ' verb');
    } else if (k === 'informant') {
      lines.push('Works ' + CF.DISTRICTS[card.data.district].label);
      lines.push('Trust ' + (card.data.trust || 0) + '/3 · heat ' + (card.data.heat || 0) + '/' + CF.INFORMANT.compromisedAt);
      lines.push(e.informantStatus(card) === 'compromised' ? 'Compromised: gone quiet' : 'Next word in ' + U.fmtTime(Math.max(0, card.data.tipT || 0)));
    } else if (k === 'calling') {
      e.initPaths();
      lines.push(CF.Callings.summary(e));
      lines.push('Leaning: ' + CF.CALLINGS[e.dominantPath()].label + (e.dominantPath() !== e.s.calling ? ' (drifting)' : ''));
      if (e.s.origin !== e.s.calling) lines.push('Set out as ' + CF.CALLINGS[e.s.origin].label);
    } else if (card.def === 'front') {
      var fr = e.fronts()[card.data.front];
      if (fr) {
        lines.push(CF.DISTRICTS[fr.district].label + ' · ' + fr.gang.replace(/^the /, 'The '));
        lines.push('Open cases through here: ' + e.casesAtFront(fr.id).length);
        lines.push(fr.watched ? 'Watched: a safer way in' : 'Not yet watched');
      }
    } else if (card.def === 'atlarge') {
      var crim = card.data.criminalId && e.criminal(card.data.criminalId);
      if (crim) {
        lines.push(CF.Criminals.rankOf(crim).label + ' · ' + crim.crimes + ' crime' + (crim.crimes === 1 ? '' : 's'));
        if (crim.traits.length) lines.push(crim.traits.map(function (t) { return CF.CRIMINAL_TRAITS[t].label; }).join(', '));
        if (crim.organization !== 'none') lines.push('Runs with: ' + crim.organization);
        var last = crim.history[crim.history.length - 1];
        if (last && last.title) lines.push('Last: ' + last.title);
      }
    } else if (card.maxLife) {
      lines.push('Time left: ' + U.fmtTime(card.life));
    }
    return lines.slice(0, 4);
  }

  function renderInspector() {
    var e = UI.e;
    var box = $('#inspector');
    var uid = UI.hover || UI.selected;
    var card = uid && e.card(uid);
    if (!card) {
      box.innerHTML = '<div class="i-note">Hover or click a card to inspect it.</div>';
      return;
    }
    var def = CF.CARDS[card.def];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var dz = def.kind === 'case' && rec ? CASE_DOSSIER[rec.template] : KIND_DOSSIER[def.kind] || (def.kind === 'criminal' ? 'redprint' : null);
    var html = '';
    if (dz) {
      html += '<div class="dossier dossier-' + dz + '" style="background-image:' + art('dossier-' + dz) + '">' +
        '<div class="d-plate"><span>' + esc(e.labelOf(card)) + '</span></div>' +
        '<div class="d-lines">' + dossierNotes(card).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div></div>';
    } else {
      html += '<div class="i-kind">' + esc((CF.KINDS[def.kind] || {}).label || def.kind) + '</div><h4>' + esc(e.labelOf(card)) + '</h4>';
    }
    var a = CF.aspectsOf(card);
    var badges = CF.CLUE_ASPECTS.filter(function (k) { return a[k]; }).map(function (k) {
      return '<span class="chip big" title="' + esc(CF.ASPECTS[k].meaning) + '"><span class="chip-icon" style="background-image:' + art('aspect-' + k) + '"></span>' + CF.ASPECTS[k].label + ' ' + a[k] + '</span>';
    }).join('');
    if (badges && !dz) html += '<div class="i-aspects">' + badges + '</div>';
    html += '<p>' + esc(e.descOf(card)) + '</p>';
    if (!dz && card.maxLife) html += '<div class="i-note">Time left: ' + U.fmtTime(card.life) + '</div>';
    var why = card.loc && card.loc.t === 'table' && e.unavailableReason(card);
    if (why) html += '<div class="i-note i-unavailable">' + esc(why) + '</div>';
    box.innerHTML = html;
  }

  // ---------------------------------------------------------------- Input
  // Drags: a card (from the table, a slot, or a verb's output), a verb token,
  // a window, or the table itself (panning). Cards are lifted into a layer
  // above everything, tilt as they move, and settle when dropped.
  function cardAt(target) { return target.closest && target.closest('.card[data-uid]'); }

  function canTake(vid, card) {
    var e = UI.e, v = e.verb(vid);
    if (!v.unlocked || CF.VERBS[vid].auto || v.status === 'running') return false;
    var slots = v.status === 'done' ? [CF.VERBS[vid].slots[0]] : e.visibleSlots(vid);
    return slots.some(function (sl) { return e.slotAccepts(sl, card); }) || e.slotAccepts(CF.VERBS[vid].slots[0], card);
  }

  function select(uid) {
    UI.selected = uid;
    renderInspector();
    Object.keys(cardEls).forEach(function (k) { cardEls[k].classList.toggle('selected', +k === uid); });
  }

  // The how-to hint goes away for good once the player has moved something.
  function hideHint() {
    var hint = $('#hint');
    if (hint && !hint.classList.contains('gone')) {
      hint.classList.add('gone');
      try { localStorage.setItem('casefile.hinted', '1'); } catch (err) { /* ignore */ }
    }
  }
  try { if (localStorage.getItem('casefile.hinted')) document.addEventListener('DOMContentLoaded', hideHint); } catch (err) { /* ignore */ }
  UI.hideHint = hideHint;

  function onPointerDown(ev) {
    if (UI.modal || (ev.button !== 0 && ev.button !== 1)) return;
    var t = ev.target;
    var winHead = t.closest && t.closest('.vw-head');
    var win = t.closest && t.closest('.vwin');
    if (win) {
      var wid = win.dataset.win;
      if (UI.openVerbs[UI.openVerbs.length - 1] !== wid) { openWindow(wid); }
      if (winHead && !t.closest('.vw-close')) {
        UI.drag = { kind: 'window', verb: wid, el: win, x0: ev.clientX, y0: ev.clientY, px: UI.winPos[wid].x, py: UI.winPos[wid].y, started: true };
        ev.preventDefault();
        return;
      }
    }
    var n = cardAt(t);
    if (n && ev.button === 0) {
      var uid = +n.dataset.uid;
      var card = UI.e.card(uid);
      if (!card || !card.loc || card.loc.t === 'held') { select(uid); return; }
      UI.drag = { kind: 'card', uid: uid, src: n, x0: ev.clientX, y0: ev.clientY, started: false, whole: ev.shiftKey };
      ev.preventDefault();
      return;
    }
    var vn = t.closest && t.closest('.verb[data-verb]');
    if (vn && ev.button === 0) {
      UI.drag = { kind: 'verb', verb: vn.dataset.verb, el: vn, x0: ev.clientX, y0: ev.clientY, started: false };
      ev.preventDefault();
      return;
    }
    if (t.closest && t.closest('#table') && !win && !t.closest('#zoom')) {
      UI.drag = { kind: 'pan', x0: ev.clientX, y0: ev.clientY, vx: UI.view.x, vy: UI.view.y, started: false };
      ev.preventDefault();
    }
  }

  function onPointerMove(ev) {
    var d = UI.drag;
    if (!d) {
      var n = cardAt(ev.target);
      var uid = n ? +n.dataset.uid : null;
      if (uid !== UI.hover) { UI.hover = uid; renderInspector(); }
      return;
    }
    var dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
    if (!d.started && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (d.kind === 'window') {
      var tr = $('#table').getBoundingClientRect();
      UI.winPos[d.verb] = { x: U.clamp(d.px + dx, 4 - 300, tr.width - 60), y: U.clamp(d.py + dy, 4, tr.height - 40) };
      d.el.style.left = UI.winPos[d.verb].x + 'px';
      d.el.style.top = UI.winPos[d.verb].y + 'px';
      return;
    }
    if (d.kind === 'pan') {
      d.started = true;
      UI.view.x = d.vx + dx;
      UI.view.y = d.vy + dy;
      $('#table').classList.add('panning');
      applyView();
      return;
    }
    if (d.kind === 'verb') {
      if (!d.started) { d.started = true; d.el.classList.add('dragging'); d.b0 = { x: UI.e.verb(d.verb).x, y: UI.e.verb(d.verb).y }; }
      place(d.el, d.b0.x + dx / UI.view.z, d.b0.y + dy / UI.view.z);
      return;
    }
    if (!d.started) liftCard(d, ev);
    moveLifted(d, ev);
  }

  // Pick a card up: move its element into the drag layer, lifted and tilting.
  function liftCard(d, ev) {
    var e = UI.e;
    hideHint();
    var card = e.card(d.uid);
    d.started = true;
    d.from = card.loc.t;
    d.fromVerb = card.loc.verb;
    var r = d.src.getBoundingClientRect();
    var z = d.from === 'table' ? UI.view.z : Math.max(UI.view.z, 0.7);
    d.z = z;
    d.gx = (d.x0 - r.left) / (r.width / T.CW);
    d.gy = (d.y0 - r.top) / (r.height / T.CH);
    d.origin = { left: r.left, top: r.top, w: r.width, h: r.height };
    if (d.from === 'table') {
      d.uids = d.whole ? e.stackOf(card).map(function (c) { return c.uid; }) : [d.uid];
      UI.lifted = {};
      d.uids.forEach(function (u) { UI.lifted[u] = true; });
      d.el = d.src;
      if (d.uids.length !== e.stackOf(card).length || d.uids.length > 1) fillCard(d.el, card, d.uids.length);
      syncBoard();
    } else {
      d.uids = [d.uid];
      d.el = buildCard(card, 1);
      d.src.classList.add('dragging-src');
    }
    d.el.classList.remove('arrive', 'leaving', 'flying', 'fits', 'fits-strong');
    d.el.classList.add('lifted');
    d.el.style.transformOrigin = d.gx + 'px ' + d.gy + 'px';
    $('#drag-layer').appendChild(d.el);
    d.rot = 0;
    d.lastX = ev.clientX;
    CF.Audio.play('pick');
    markDropTargets(card);
  }

  function moveLifted(d, ev) {
    d.lastEv = { clientX: ev.clientX, clientY: ev.clientY };
    var vx = ev.clientX - d.lastX;
    d.lastX = ev.clientX;
    d.rot = U.clamp(d.rot * 0.7 + vx * 0.9, -14, 14);
    d.el.style.left = (ev.clientX - d.gx) + 'px';
    d.el.style.top = (ev.clientY - d.gy) + 'px';
    d.el.style.transform = 'scale(' + (d.z * 1.07) + ') rotate(' + d.rot.toFixed(1) + 'deg)';
    document.querySelectorAll('.drop-hover').forEach(function (x) { x.classList.remove('drop-hover'); });
    var t = dropTarget(ev);
    if (t && t.node) t.node.classList.add('drop-hover');
    clearTimeout(d.settleT);
    d.settleT = setTimeout(function () { if (UI.drag === d) { d.rot = 0; d.el.style.transform = 'scale(' + (d.z * 1.07) + ') rotate(0deg)'; } }, 90);
  }

  function dropTarget(ev) {
    var under = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!under) return null;
    var slot = under.closest('.slot[data-slot]');
    if (slot) return { slot: slot.dataset.slot, verb: slot.dataset.verb, node: slot };
    var win = under.closest('.vwin');
    if (win) return { verb: win.dataset.win, node: win, window: true };
    var verb = under.closest('.verb[data-verb]');
    if (verb) return { verb: verb.dataset.verb, node: verb, token: true };
    var c = under.closest('#board .card[data-uid]');
    if (c && c.classList.contains('can-stack')) return { table: true, node: c };
    if (under.closest('#table')) return { table: true };
    return null;
  }

  function markDropTargets(card) {
    var e = UI.e;
    Object.keys(verbEls).forEach(function (vid) { if (canTake(vid, card)) verbEls[vid].classList.add('can-drop'); });
    document.querySelectorAll('#windows .slot').forEach(function (n) {
      var sl = CF.VERBS[n.dataset.verb].slots.filter(function (x) { return x.key === n.dataset.slot; })[0];
      if (sl && e.slotAccepts(sl, card) && e.verb(n.dataset.verb).status === 'idle') n.classList.add('can-drop');
    });
    var key = e.stackKey(card);
    if (key) Object.keys(cardEls).forEach(function (uid) { var c = e.card(+uid); if (c && e.stackKey(c) === key) cardEls[uid].classList.add('can-stack'); });
  }

  function clearMarks() {
    document.querySelectorAll('.can-drop, .drop-hover, .can-stack, .dragging-src').forEach(function (x) { x.classList.remove('can-drop', 'drop-hover', 'can-stack', 'dragging-src'); });
    $('#table').classList.remove('panning');
  }

  // Put a lifted table element back on the board and glide it to (x, y).
  function settleOnBoard(d, x, y, ev) {
    var el = d.el, board = $('#board');
    var p = toBoard(ev ? ev.clientX : d.origin.left, ev ? ev.clientY : d.origin.top);
    el.classList.remove('lifted');
    el.style.left = el.style.top = '';
    el.style.transformOrigin = '';
    el.classList.add('no-anim');
    place(el, ev ? p.x - d.gx : x, ev ? p.y - d.gy : y);
    board.appendChild(el);
    void el.offsetWidth;
    el.classList.remove('no-anim');
    el.classList.add('settle');
    place(el, x, y);
    setTimeout(function () { el.classList.remove('settle'); }, 400);
  }

  // Send a dragged card back where it came from.
  function flyBack(d) {
    if (d.from === 'table') {
      var c = UI.e.card(d.uid);
      UI.lifted = null;
      if (c && c.loc && c.loc.t === 'table') settleOnBoard(d, c.loc.x, c.loc.y, d.lastEv);
      else d.el.remove();
    } else {
      var el = d.el;
      el.classList.add('returning');
      el.style.left = d.origin.left + 'px';
      el.style.top = d.origin.top + 'px';
      el.style.transform = 'scale(' + (d.origin.w / T.CW) + ')';
      el.style.transformOrigin = '0 0';
      setTimeout(function () { el.remove(); }, 260);
    }
  }

  function cancelDrag() {
    var d = UI.drag;
    UI.drag = null;
    clearMarks();
    if (!d) return;
    if (d.kind === 'card' && d.started) { flyBack(d); UI.e.dirty = true; }
    if (d.kind === 'verb' && d.started) { d.el.classList.remove('dragging'); UI.e.dirty = true; }
  }

  function onPointerUp(ev) {
    var d = UI.drag;
    if (!d) return;
    var e = UI.e;
    UI.drag = null;
    clearMarks();
    if (d.kind === 'window') return;
    if (d.kind === 'pan') { if (!d.started) select(null); return; }
    if (d.kind === 'verb') {
      d.el.classList.remove('dragging');
      if (!d.started) {
        if (UI.openVerbs.indexOf(d.verb) >= 0 && UI.openVerbs[UI.openVerbs.length - 1] === d.verb) closeWindow(d.verb);
        else openWindow(d.verb);
        CF.Audio.play('click');
      } else {
        var v = e.verb(d.verb);
        var p = toBoard(ev.clientX, ev.clientY);
        e.moveVerb(d.verb, v.x + (p.x - toBoard(d.x0, d.y0).x), v.y + (p.y - toBoard(d.x0, d.y0).y));
        CF.Audio.play('drop');
      }
      e.dirty = true;
      return;
    }
    // Card.
    var card = e.card(d.uid);
    if (!d.started) {
      select(d.uid);
      // Clicking a card in a slot sends it back to the table.
      if (card && card.loc && card.loc.t === 'slot' && ev.target.closest('.vwin')) {
        markSpawn(card.uid, d.src);
        e.unslot(card.loc.verb, card.loc.slot);
        e.dirty = true;
      }
      return;
    }
    var t = dropTarget(ev);
    if (!card || !t) { flyBack(d); e.dirty = true; return; }
    var loc = card.loc;
    var ok = false;
    if (t.slot || t.verb) {
      if (loc.t === 'out') { e.takeOutput(loc.verb, card.uid); }
      if (t.slot) ok = e.slotCard(t.verb, t.slot, card.uid);
      else ok = !!e.autoSlot(t.verb, card.uid);
      if (ok) {
        openWindow(t.verb);
        CF.Audio.play('drop');
        absorb(d, t);
      } else {
        if (card.loc.t === 'table' && d.from === 'out') {
          // It left the verb's output but found no slot: drop it by the pointer.
          UI.spawn[card.uid] = { cx: ev.clientX, cy: ev.clientY, gx: d.gx, gy: d.gy };
          d.el.remove();
        } else flyBack(d);
      }
    } else if (t.table) {
      var p = toBoard(ev.clientX, ev.clientY);
      var target = { x: p.x - d.gx, y: p.y - d.gy };
      var fin;
      if (loc.t === 'table') {
        fin = e.moveCard(card.uid, target.x, target.y, d.uids.length > 1);
        UI.lifted = null;
        settleOnBoard(d, fin.x, fin.y, ev);
      } else {
        if (loc.t === 'slot') { e.unslot(loc.verb, loc.slot); fin = e.moveCard(card.uid, target.x, target.y); }
        else if (loc.t === 'out') { e.takeOutput(loc.verb, card.uid, target); }
        UI.spawn[card.uid] = { cx: ev.clientX, cy: ev.clientY, gx: d.gx, gy: d.gy };
        d.el.remove();
      }
      CF.Audio.play('drop');
    }
    UI.lifted = null;
    e.dirty = true;
  }

  // A card dropped into a slot shrinks into it.
  function absorb(d, t) {
    var el = d.el;
    UI.lifted = null;
    if (d.from === 'table') delete cardEls[d.uid];
    var r = t.node.getBoundingClientRect();
    el.classList.add('absorbing');
    el.style.left = (r.left + r.width / 2 - T.CW / 2) + 'px';
    el.style.top = (r.top + r.height / 2 - T.CH / 2) + 'px';
    el.style.transformOrigin = '50% 50%';
    el.style.transform = 'scale(0.4)';
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 240);
  }

  function onDoubleClick(ev) {
    if (UI.modal) return;
    var n = cardAt(ev.target);
    var e = UI.e;
    if (!n) return;
    var card = e.card(+n.dataset.uid);
    if (!card || !card.loc) return;
    if (card.loc.t === 'out') { markSpawn(card.uid, n); e.takeOutput(card.loc.verb, card.uid); e.dirty = true; return; }
    if (card.loc.t !== 'table') return;
    var tries = UI.openVerbs.slice().reverse().concat(CF.VERB_ORDER);
    for (var i = 0; i < tries.length; i++) {
      var id = tries[i], v = e.verb(id);
      var fresh = UI.openVerbs.indexOf(id) >= 0 || (v.status === 'idle' && !Object.keys(v.slots).length);
      if (fresh && canTake(id, card) && e.autoSlot(id, card.uid)) { openWindow(id); CF.Audio.play('drop'); e.dirty = true; return; }
    }
  }
})();
