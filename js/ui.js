// DOM rendering and input. Reads engine state, renders the table, verbs and
// side panel, and turns drags/clicks into engine calls.
(function () {
  var CF = window.CF;
  var U = CF.util;
  var CW = 116, CH = 158, GAP = 10;

  // Art lives in css/art/*.css as --art-* custom properties (see tools/build_art.py).
  function art(name) { return 'var(--art-' + name + ')'; }
  function hash(str) { var x = 0; str = String(str); for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
  // Which frame each card kind is drawn in.
  var FRAMES = {
    case: 'case', coldcase: 'case', court: 'case',
    clue: 'evidence', evidence: 'evidence', paper: 'evidence',
    witness: 'character', suspect: 'character', informant: 'character', teammate: 'character',
    personnel: 'character', hospital: 'character', criminal: 'character',
    district: 'location', room: 'location',
  };
  // Icons shown in the medallion of cards that have no picture.
  var CARD_ICONS = {
    health: 'icon-health', wound: 'icon-health', focus: 'icon-focus', instinct: 'icon-instinct', funds: 'icon-funds',
    fatigue: 'icon-fatigue', burnout: 'icon-burnout', obsession: 'icon-obsession', tunnel: 'icon-redeye',
    bribe: 'icon-handshake', gang: 'icon-roots', syndicate: 'icon-pyramid', trial: 'icon-gavel',
    promo_inspector: 'icon-star', promo_chief: 'icon-star', chair: 'icon-court', room: 'icon-court',
    looseend: 'icon-hook', ledger: 'icon-scales', paperwork: 'icon-folder', order: 'icon-folder', notes: 'icon-folder',
    camera: 'icon-camera', prints: 'aspect-forensic', kit: 'icon-search', surveillance: 'icon-binoculars', labpass: 'icon-mind',
    calling_commissioner: 'icon-star', calling_master: 'icon-mind', calling_crusader: 'icon-scales',
  };
  // Evidence pictures, chosen by what a clue is about.
  var EV_RULES = [
    [/victim's account|statement|word from|confession|cover story|slip of|testimony/i, 'ev-memo'],
    [/motive|hide|signature/i, 'ev-sketch'],
    [/convenient|knife|weapon/i, 'ev-bloodtag'],
    [/corroborated/i, 'ev-snapshots'],
    [/finger|print|ink/i, 'ev-fingerprint'],
    [/blood|fibre|stroke/i, 'ev-blood'],
    [/accelerant|paraffin|residue|vial/i, 'ev-vial'],
    [/call|phone|wiretap|record|cassette/i, 'ev-cassette'],
    [/letter|correspondence|iou|diary|note/i, 'ev-letter'],
    [/ledger|account|bank|money|payment|insurance|prospectus|shell|payroll|discrepanc|spending|books|owner/i, 'ev-documents'],
    [/photo|caught|sighting|seen|ghost/i, 'ev-photos'],
    [/window|glass|latch|frame|tool|scratch|dent|dust|room|paint/i, 'ev-glass'],
    [/key|entry|found at|home/i, 'ev-key'],
    [/timing|tide|timetable|schedule|pattern|suitcase/i, 'ev-notepad'],
    [/pawn|gem|ring|goods|stock|wallet|chip/i, 'ev-gem'],
    [/cigarette|wrapper|scent|butt|licorice|footprint|boot/i, 'ev-tag'],
    [/file|typewriter|newspaper/i, 'ev-newspaper'],
  ];
  var EV_BY_ASPECT = { forensic: 'ev-fingerprint', testimony: 'ev-memo', motive: 'ev-letter', opportunity: 'ev-photos', digital: 'ev-cassette', financial: 'ev-documents' };
  var CASE_ART = { burglary: 'ev-house', missing: 'ev-mugshot', harbor: 'ev-chalk', arson: 'ev-newspaper', fraud: 'ev-documents',
    extortion: 'ev-bloodtag', manhunt: 'ev-pair', gang: 'ev-snapshots', syndicate: 'ev-badge', architect: 'ev-sketch' };
  var DISTRICT_ART = { docks: 'ev-alley', market: 'ev-snapshots', neon: 'ev-cassette', uptown: 'ev-badge', warrens: 'ev-house', canal: 'ev-leaf' };
  var CASE_DOSSIER = { burglary: 'house', missing: 'map', harbor: 'knife', arson: 'alley', fraud: 'city', extortion: 'redprint',
    manhunt: 'tower', gang: 'redprint', syndicate: 'fedora', architect: 'man' };
  var KIND_DOSSIER = { suspect: 'man', witness: 'woman', clue: 'print', evidence: 'print', teammate: 'badge', personnel: 'badge',
    hospital: 'badge', informant: 'fedora', district: 'city', criminal: 'redprint', coldcase: 'tower', court: 'knife' };
  var VERB_TOKENS = { time: 'token-time' };
  var METER_ICONS = { pressure: 'icon-group', scrutiny: 'icon-search', retaliation: 'icon-retaliation', reputation: 'icon-star' };
  var TOAST_ICONS = { case: 'toast-case', danger: 'toast-danger', major: 'toast-major', victory: 'toast-victory', defeat: 'toast-danger', week: 'token-time' };
  var RING_LEN = 2 * Math.PI * 47;

  // The picture in a card's medallion: {art, portrait?, gray?}
  function cardPicture(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind;
    if (k === 'case') { var r = e.caseRec(card.caseId); return { art: CASE_ART[r && r.template] || 'ev-house' }; }
    if (k === 'coldcase') return { art: CASE_ART[card.data.template] || 'ev-house', gray: true };
    if (k === 'clue' || k === 'evidence') {
      var label = e.labelOf(card);
      for (var i = 0; i < EV_RULES.length; i++) if (EV_RULES[i][0].test(label)) return { art: EV_RULES[i][1] };
      var a = CF.clueAspects(card), best = null;
      for (var key in a) if (!best || a[key] > a[best]) best = key;
      return { art: EV_BY_ASPECT[best] || 'ev-tag' };
    }
    if (k === 'district') return { art: DISTRICT_ART[card.data.district] || 'ev-alley' };
    if (k === 'teammate' || k === 'personnel') return { art: 'portrait-2', portrait: true };
    if (k === 'hospital') return { art: 'portrait-2', portrait: true, gray: true };
    if (card.def === 'suspect' || card.def === 'witness' || card.def === 'informant' || card.def === 'atlarge') {
      var n = [0, 1, 3, 4, 5, 6, 7, 8][hash(card.data.name || e.labelOf(card)) % 8];
      return { art: 'portrait-' + n, portrait: true };
    }
    if (CARD_ICONS[card.def]) return { art: CARD_ICONS[card.def], icon: true, gray: card.def === 'wound' };
    return null;
  }

  var UI = (CF.UI = {
    e: null, openVerb: null, selected: null, hover: null, tab: 'desk',
    speed: 1, paused: false, modal: false, scale: 1, drag: null, unreadJournal: false,
    onGameOver: null, onSave: null,
  });

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
    UI.openVerb = null;
    UI.selected = null;
    UI.tab = 'desk';
    UI.seenVerbs = {};
    UI.newVerbs = {};
    CF.VERB_ORDER.forEach(function (id) { if (engine.verb(id).unlocked) UI.seenVerbs[id] = true; });
    engine.on(onEvent);
    engine.dirty = true;
  };

  UI.init = function () {
    $('#tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-tab]');
      if (!b) return;
      UI.tab = b.dataset.tab;
      if (UI.tab === 'journal') UI.unreadJournal = false;
      renderSide();
      renderTabs();
    });
    $('#controls').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-speed]');
      if (!b) return;
      var sp = +b.dataset.speed;
      if (sp === 0) UI.paused = !UI.paused;
      else { UI.speed = sp; UI.paused = false; }
      renderControls();
    });
    document.addEventListener('keydown', function (ev) {
      if (UI.modal || ev.target.tagName === 'INPUT') return;
      if (ev.code === 'Space') { ev.preventDefault(); UI.paused = !UI.paused; renderControls(); }
      else if (ev.key === '1' || ev.key === '2' || ev.key === '3') { UI.speed = +ev.key; UI.paused = false; renderControls(); }
      else if (ev.key === 'Escape') { UI.openVerb = null; UI.e.dirty = true; }
      else if (ev.key === 'j' || ev.key === 'J') { UI.tab = UI.tab === 'journal' ? 'desk' : 'journal'; UI.unreadJournal = false; UI.e.dirty = true; }
    });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', cancelDrag);
    document.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('resize', function () { if (UI.e) UI.e.dirty = true; });

    var last = performance.now();
    var saveT = 0;
    function frame(now) {
      var dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      var e = UI.e;
      if (e) {
        if (!e.s.over && !UI.paused && !UI.modal) {
          e.tick(dt * UI.speed);
          saveT += dt;
          if (saveT > 8 && UI.onSave) { saveT = 0; UI.onSave(); }
        }
        if (e.dirty) { e.dirty = false; render(); }
        else updateLive();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

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
      if (UI.tab !== 'journal') UI.unreadJournal = true;
      var k = payload.kind;
      if (!UI.modal && STORY_SOUNDS[k]) CF.Audio.play(STORY_SOUNDS[k]);
      if (!UI.modal && k === 'danger') shake();
      if (k === 'case' || k === 'danger' || k === 'major' || k === 'victory' || k === 'week') toast(payload);
    }
    if (type === 'complete') CF.Audio.play('complete');
    if (type === 'complete' && payload.verb !== UI.openVerb) {
      var v = UI.e.verb(payload.verb);
      if (v.story) toast({ title: CF.VERBS[payload.verb].label + ': ' + v.story.title, text: v.story.text, kind: 'verb', verb: payload.verb });
    }
    if (type === 'over' && UI.onGameOver) setTimeout(function () { UI.onGameOver(UI.e.s.over); }, 600);
  }

  function toast(entry) {
    if (UI.modal) return;
    var box = $('#toasts');
    var t = h('div', 'toast k-' + (entry.kind || 'event'));
    var ti = entry.verb ? (VERB_TOKENS[entry.verb] || 'token-' + entry.verb) : TOAST_ICONS[entry.kind];
    if (ti) { t.classList.add('has-icon'); t.style.setProperty('--toast-icon', art(ti)); }
    t.innerHTML = '<b>' + esc(entry.title) + '</b><span>' + esc(entry.text || '') + '</span>';
    t.addEventListener('click', function () {
      if (entry.verb) { UI.openVerb = entry.verb; UI.tab = 'desk'; }
      else { UI.tab = 'journal'; UI.unreadJournal = false; }
      UI.e.dirty = true;
      t.remove();
    });
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.remove(); }, 6000);
  }

  // --------------------------------------------------------------- Render
  function render() {
    renderTop();
    renderVerbs();
    renderTable();
    renderTabs();
    renderSide();
    renderInspector();
    renderControls();
  }

  function renderControls() {
    var btns = document.querySelectorAll('#controls button[data-speed]');
    btns.forEach(function (b) {
      var sp = +b.dataset.speed;
      b.classList.toggle('on', sp === 0 ? UI.paused : !UI.paused && UI.speed === sp);
    });
  }

  function meter(key, label, val, max, shown) {
    var pct = Math.min(100, (val / max) * 100);
    var state = key === 'reputation' ? ' rep' : val >= max * 0.8 ? ' crit' : val >= max * 0.6 ? ' warn' : '';
    return '<div class="meter' + state + '" title="' + esc(label) + '"><span class="m-icon" style="background-image:' + art(METER_ICONS[key]) + '"></span>' +
      '<div class="m-main"><div class="m-label"><span>' + label + '</span><span>' + shown +
      '</span></div><div class="m-bar"><div class="m-fill" style="width:' + pct + '%"></div></div></div></div>';
  }

  function renderTop() {
    var e = UI.e, s = e.s, m = s.meters;
    var nextRep = s.rank < 2 ? CF.RANK_REP[s.rank + 1] : (s.calling === 'commissioner' ? CF.COMMISSIONER_REP : Math.max(m.reputation, 1));
    var mm = function (k, label) { var max = e.meterMax(k); return meter(k, label, m[k], max, m[k] + '/' + max); };
    $('#meters').innerHTML = mm('pressure', 'Public Pressure') + mm('scrutiny', 'Scrutiny') + mm('retaliation', 'Retaliation') +
      meter('reputation', 'Reputation', m.reputation, nextRep, m.reputation + (s.rank < 2 || s.calling === 'commissioner' ? '/' + nextRep : ''));
    $('#rank').textContent = CF.RANKS[s.rank] + ' ' + s.detective + ' · ' + CF.CALLINGS[s.calling].label;
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

  function renderVerbs() {
    var e = UI.e;
    var box = $('#verbs');
    box.innerHTML = '';
    CF.VERB_ORDER.forEach(function (vid) {
      var v = e.verb(vid);
      if (!v.unlocked) return;
      var def = CF.VERBS[vid];
      var n = h('div', 'verb ' + vid + ' ' + v.status + (UI.openVerb === vid ? ' open' : '') + (e.lockReason(vid) && v.status === 'idle' ? ' locked' : '') + (def.auto ? ' time' : ''));
      n.dataset.verb = vid;
      n.title = def.desc;
      var tok = h('div', 'v-token');
      tok.style.backgroundImage = art(VERB_TOKENS[vid] || 'token-' + vid);
      tok.insertAdjacentHTML('beforeend', '<svg class="v-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" /></svg>');
      if (vid === 'time') tok.appendChild(h('div', 'v-week', 'Wk ' + e.s.week));
      else tok.appendChild(h('div', 'v-plate', def.label));
      n.appendChild(tok);
      if (vid === 'time') n.appendChild(h('div', 'v-name', def.label));
      n.appendChild(h('div', 'v-status', verbStatus(vid)));
      if (!UI.seenVerbs[vid]) { UI.seenVerbs[vid] = true; UI.newVerbs[vid] = true; }
      if (UI.newVerbs[vid]) n.classList.add('new');
      box.appendChild(n);
    });
    updateVerbBars();
  }

  function updateVerbBars() {
    var e = UI.e;
    document.querySelectorAll('#verbs .verb').forEach(function (n) {
      var vid = n.dataset.verb;
      var v = e.verb(vid);
      var ring = n.querySelector('.v-ring circle');
      var pct = vid === 'time' ? e.s.weekT / CF.WEEK : v.status === 'running' ? v.elapsed / v.duration : v.status === 'done' ? 1 : 0;
      ring.style.strokeDasharray = (Math.min(1, pct) * RING_LEN) + ' ' + RING_LEN;
      n.querySelector('.v-status').textContent = vid === 'time' ? '' : verbStatus(vid);
      var wk = n.querySelector('.v-week');
      if (wk) wk.textContent = 'Wk ' + e.s.week;
    });
  }

  function caseTitle(card) {
    var rec = card.caseId && UI.e.caseRec(card.caseId);
    return rec ? rec.title : '';
  }

  // Build a card element. opts: {count, mini}
  function aspectChip(k, v) {
    var b = h('span', 'chip');
    b.title = CF.ASPECTS[k].label;
    var i = h('span', 'chip-icon');
    i.style.backgroundImage = art('aspect-' + k);
    b.appendChild(i);
    b.appendChild(h('span', null, String(v)));
    return b;
  }

  // Build a card element. opts: {count, mini}
  function cardEl(card, opts) {
    opts = opts || {};
    var e = UI.e;
    var def = CF.CARDS[card.def];
    var kind = CF.KINDS[def.kind] || { label: def.kind, color: '#777' };
    var frame = FRAMES[def.kind] || 'status';
    var n = h('div', 'card frame-' + frame + ' kind-' + def.kind + (opts.mini ? ' mini' : '') + (card.fresh ? ' fresh' : '') + (UI.selected === card.uid ? ' selected' : ''));
    n.dataset.uid = card.uid;
    n.style.backgroundImage = art('frame-' + frame);
    var pic = cardPicture(card);
    if (pic) {
      var medal = h('div', 'c-medal' + (pic.portrait ? ' portrait' : pic.icon ? ' icon' : '') + (pic.gray ? ' gray' : ''));
      medal.style.backgroundImage = art(pic.art);
      n.appendChild(medal);
    }
    var body = h('div', 'c-body');
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
      var lf = h('div');
      lf.style.width = Math.max(0, (card.life / card.maxLife) * 100) + '%';
      life.appendChild(lf);
      body.appendChild(life);
      if (def.kind === 'case' && card.life < 45) n.classList.add('urgent');
    }
    n.appendChild(body);
    if (opts.count > 1) n.appendChild(h('div', 'c-count', '×' + opts.count));
    return n;
  }

  function updateCardLive(n, card) {
    if (!card || !card.maxLife) return;
    var t = n.querySelector('.c-timer');
    if (t) t.textContent = U.fmtTime(card.life);
    var lf = n.querySelector('.c-life > div');
    if (lf) lf.style.width = Math.max(0, (card.life / card.maxLife) * 100) + '%';
    if (CF.CARDS[card.def].kind === 'case') n.classList.toggle('urgent', card.life < 45);
  }

  function updateLive() {
    var e = UI.e;
    advanceTyping();
    updateVerbBars();
    document.querySelectorAll('.card[data-uid]').forEach(function (n) {
      if (n.classList.contains('ghost')) return;
      updateCardLive(n, e.card(+n.dataset.uid));
    });
    var pr = document.querySelector('#pane .progress > div');
    if (pr && UI.openVerb) {
      var v = e.verb(UI.openVerb);
      if (v.status === 'running') {
        pr.style.width = (v.elapsed / v.duration) * 100 + '%';
        var tl = document.querySelector('#pane .p-time');
        if (tl) tl.textContent = U.fmtTime(v.duration - v.elapsed) + ' remaining';
      }
    }
  }

  function renderTable() {
    var e = UI.e;
    var inner = $('#table-inner');
    inner.innerHTML = '';
    var groups = {};
    e.tableCards().forEach(function (c) { (groups[c.loc.cell] = groups[c.loc.cell] || []).push(c); });
    var maxRow = 0;
    Object.keys(groups).forEach(function (cell) {
      var list = groups[cell];
      list.sort(function (a, b) { return (a.life || 1e9) - (b.life || 1e9); });
      var top = list[0];
      var col = cell % CF.COLS, row = Math.floor(cell / CF.COLS);
      maxRow = Math.max(maxRow, row);
      var n = cardEl(top, { count: list.length });
      n.style.left = col * (CW + GAP) + 'px';
      n.style.top = row * (CH + GAP) + 'px';
      inner.appendChild(n);
    });
    var w = CF.COLS * (CW + GAP);
    inner.style.width = w + 'px';
    inner.style.height = (maxRow + 2) * (CH + GAP) + 'px';
    var avail = $('#table').clientWidth - 32;
    UI.scale = Math.max(0.45, Math.min(1, avail / w));
    inner.style.transform = 'scale(' + UI.scale + ')';
    // Fresh highlight only plays once.
    e.tableCards().forEach(function (c) { c.fresh = false; });
  }

  function renderTabs() {
    var tabs = $('#tabs');
    tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === UI.tab); });
    var jb = tabs.querySelector('[data-tab=journal]');
    jb.innerHTML = 'Journal' + (UI.unreadJournal ? '<span class="dot"></span>' : '');
  }

  function renderSide() {
    var pane = $('#pane');
    var keep = pane.scrollTop;
    pane.innerHTML = '';
    if (UI.tab === 'journal') { renderJournal(pane); pane.scrollTop = keep; return; }
    if (!UI.openVerb) {
      pane.innerHTML = '<div class="empty-pane"><p><b>Your desk.</b> Click a verb above to open it, then drag cards into its slots. ' +
        'Or drag a card straight onto a verb.</p><p>Hover or click any card to read it. Double-click a card to send it to the open verb.</p>' +
        '<p>Cases have a countdown. When it runs out, the trail goes cold and the criminal walks. You cannot solve everything. Choose.</p>' +
        '<p style="color:var(--ink-faint);font-size:13px">Space: pause · 1/2/3: speed · J: journal · Esc: close</p></div>';
      return;
    }
    renderVerbWindow(pane, UI.openVerb);
    pane.scrollTop = keep;
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

  function renderVerbWindow(pane, vid) {
    var e = UI.e;
    var v = e.verb(vid);
    var def = CF.VERBS[vid];
    var head = h('div', 'vw-head');
    head.appendChild(h('h3', null, def.label));
    var close = h('button', 'close', '×');
    close.title = 'Close';
    close.addEventListener('click', function () { UI.openVerb = null; e.dirty = true; });
    head.appendChild(close);
    pane.appendChild(head);
    pane.appendChild(h('div', 'divider'));

    if (def.auto) {
      pane.appendChild(h('p', 'vw-desc', def.desc));
      var wk = e.s.journal.filter(function (j) { return j.kind === 'week'; })[0];
      if (wk) pane.appendChild(storyBox(wk));
      var nextRent = CF.WEEK - e.s.weekT;
      pane.appendChild(h('p', 'vw-desc', 'Next rent in ' + U.fmtTime(nextRent) + '. Open cases: ' + e.openCases().length + '.'));
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
      v.held.forEach(function (u) { var c = e.card(u); if (c) held.appendChild(cardEl(c, { mini: true })); });
      pane.appendChild(held);
      return;
    }

    if (v.status === 'done') {
      if (v.story) pane.appendChild(storyBox(v.story));
      var outs = h('div', 'outputs');
      v.out.forEach(function (u) { var c = e.card(u); if (c) outs.appendChild(cardEl(c, { mini: true })); });
      pane.appendChild(outs);
      var act = h('div', 'actions');
      var col = h('button', 'btn', 'Collect all');
      col.addEventListener('click', function () { e.collect(vid); e.dirty = true; });
      act.appendChild(col);
      act.appendChild(h('span', 'vw-desc', 'or drag cards out'));
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
      if (uid && e.card(uid)) box.appendChild(cardEl(e.card(uid), { mini: true }));
      else box.appendChild(h('div', 's-hint', sl.accepts.map(prettyAspect).join(' / ')));
      s.appendChild(box);
      s.appendChild(h('div', 's-label', sl.label));
      slots.appendChild(s);
    });
    pane.appendChild(slots);

    var pv = e.preview(vid);
    var rbox = h('div', 'recipe');
    if (pv) {
      rbox.innerHTML = '<h5>' + esc(pv.label) + '</h5><p>' + esc(pv.text || '') + '</p>' +
        (pv.danger ? '<div class="r-danger">⚠ ' + esc(pv.danger) + '</div>' : '') +
        (pv.blocked ? '<div class="r-blocked">' + esc(pv.blocked) + '</div>' : '');
    } else if (primaryCard) {
      rbox.innerHTML = '<p class="r-none">Nothing comes of this combination.</p>';
    } else {
      rbox.innerHTML = '<p class="r-none">' + (lock ? esc(lock) : 'Drag a card into the first slot.') + '</p>';
    }
    pane.appendChild(rbox);

    var act2 = h('div', 'actions');
    var go = h('button', 'btn', pv ? 'Begin (' + Math.round(pv.duration) + 's)' : 'Begin');
    go.disabled = !pv || !!pv.blocked;
    go.addEventListener('click', function () { if (e.start(vid)) { CF.Audio.play('start'); e.dirty = true; } });
    act2.appendChild(go);
    if (Object.keys(v.slots).length) {
      var clr = h('button', 'btn ghost', 'Clear');
      clr.addEventListener('click', function () { e.clearSlots(vid); e.dirty = true; });
      act2.appendChild(clr);
    }
    pane.appendChild(act2);
  }

  function prettyAspect(a) {
    var map = { tool: 'Equipment', teammate: 'Officer', atlarge: 'At Large', coldcase: 'Cold Case', looseend: 'Loose End', promotion: 'Promotion', chair: 'The Chair' };
    if (map[a]) return map[a];
    if (CF.ASPECTS[a]) return CF.ASPECTS[a].label;
    if (CF.KINDS[a]) return CF.KINDS[a].label;
    if (CF.CARDS[a]) return CF.CARDS[a].label;
    return a.charAt(0).toUpperCase() + a.slice(1);
  }

  function renderJournal(pane) {
    var e = UI.e;
    e.s.journal.slice(0, 120).forEach(function (j) {
      var d = h('div', 'journal-entry k-' + j.kind);
      d.innerHTML = '<div class="j-meta">Week ' + j.week + '</div><h6>' + esc(j.title) + '</h6><p>' + esc(j.text) + '</p>';
      pane.appendChild(d);
    });
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
      lines.push('Scene: ' + (rec.found >= rec.items.length ? 'searched out' : rec.searches ? 'partly searched' : 'not searched'));
      lines.push('Time left: ' + U.fmtTime(card.life) + (rec.highProfile ? ' · high-profile' : ''));
    } else if (card.def === 'suspect') {
      var sus = e.suspectOf(card);
      if (sus) lines.push(sus.role.charAt(0).toUpperCase() + sus.role.slice(1));
      if (rec) lines.push('Case: ' + rec.title);
      if (rec && rec.identified === card.data.key) lines.push('Prime suspect');
    } else if (k === 'clue' || k === 'evidence' || card.def === 'witness') {
      if (rec) lines.push('Case: ' + rec.title);
      if (asp) lines.push(asp);
      if (card.maxLife) lines.push('Keeps for ' + U.fmtTime(card.life));
      if (k === 'evidence' && card.data.item && card.data.item.needs) lines.push('Needs special equipment');
    } else if (k === 'teammate' || k === 'personnel') {
      if (card.data.name) lines.push(card.data.name);
      if (asp) lines.push(asp);
      if (card.data.level) lines.push('Level ' + card.data.level);
    } else if (k === 'informant') {
      lines.push('Works ' + CF.DISTRICTS[card.data.district].label);
      lines.push('Exposure: ' + (card.data.heat || 0));
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
      return '<span class="chip big"><span class="chip-icon" style="background-image:' + art('aspect-' + k) + '"></span>' + CF.ASPECTS[k].label + ' ' + a[k] + '</span>';
    }).join('');
    if (badges && !dz) html += '<div class="i-aspects">' + badges + '</div>';
    html += '<p>' + esc(e.descOf(card)) + '</p>';
    if (!dz && card.maxLife) html += '<div class="i-note">Time left: ' + U.fmtTime(card.life) + '</div>';
    box.innerHTML = html;
  }

  // ---------------------------------------------------------------- Input
  function cardAt(target) {
    var n = target.closest && target.closest('.card[data-uid]');
    return n && !n.classList.contains('ghost') ? n : null;
  }

  function onPointerDown(ev) {
    if (UI.modal || ev.button > 0) return;
    var n = cardAt(ev.target);
    var verbN = ev.target.closest && ev.target.closest('.verb[data-verb]');
    if (!n) {
      if (verbN) {
        var vid = verbN.dataset.verb;
        UI.openVerb = UI.openVerb === vid && !ev.shiftKey ? null : vid;
        if (UI.openVerb) UI.tab = 'desk';
        if (UI.newVerbs) delete UI.newVerbs[vid];
        UI.e.dirty = true;
      }
      return;
    }
    var uid = +n.dataset.uid;
    var card = UI.e.card(uid);
    if (!card || !card.loc || card.loc.t === 'held') { select(uid); return; }
    UI.drag = { uid: uid, x0: ev.clientX, y0: ev.clientY, src: n, started: false, ghost: null };
    ev.preventDefault();
  }

  function select(uid) {
    UI.selected = uid;
    renderInspector();
    document.querySelectorAll('.card.selected').forEach(function (x) { x.classList.remove('selected'); });
    document.querySelectorAll('.card[data-uid="' + uid + '"]').forEach(function (x) { if (!x.classList.contains('ghost')) x.classList.add('selected'); });
  }

  function onPointerMove(ev) {
    var d = UI.drag;
    if (!d) {
      var n = cardAt(ev.target);
      var uid = n ? +n.dataset.uid : null;
      if (uid !== UI.hover) { UI.hover = uid; renderInspector(); }
      return;
    }
    if (!d.started) {
      if (Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 6) return;
      d.started = true;
      var card = UI.e.card(d.uid);
      d.ghost = cardEl(card);
      d.ghost.classList.add('ghost');
      d.ghost.classList.remove('fresh', 'selected');
      document.body.appendChild(d.ghost);
      d.src.classList.add('dragging-src');
      CF.Audio.play('pick');
      markDropTargets(card);
    }
    d.ghost.style.left = ev.clientX - CW / 2 + 'px';
    d.ghost.style.top = ev.clientY - 24 + 'px';
    document.querySelectorAll('.drop-hover').forEach(function (x) { x.classList.remove('drop-hover'); });
    var t = dropTarget(ev);
    if (t && (t.slot || t.verb)) t.node.classList.add('drop-hover');
  }

  function dropTarget(ev) {
    var under = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!under) return null;
    var slot = under.closest('.slot[data-slot]');
    if (slot) return { slot: slot.dataset.slot, verb: slot.dataset.verb, node: slot };
    var verb = under.closest('.verb[data-verb]');
    if (verb) return { verb: verb.dataset.verb, node: verb, token: true };
    if (under.closest('#table')) return { table: true };
    return null;
  }

  function canTake(vid, card) {
    var e = UI.e, v = e.verb(vid);
    if (!v.unlocked || CF.VERBS[vid].auto || v.status === 'running') return false;
    var slots = v.status === 'done' ? [CF.VERBS[vid].slots[0]] : e.visibleSlots(vid);
    return slots.some(function (sl) { return e.slotAccepts(sl, card); }) || e.slotAccepts(CF.VERBS[vid].slots[0], card);
  }

  function markDropTargets(card) {
    var e = UI.e;
    document.querySelectorAll('#verbs .verb').forEach(function (n) { if (canTake(n.dataset.verb, card)) n.classList.add('can-drop'); });
    document.querySelectorAll('#pane .slot').forEach(function (n) {
      var sl = CF.VERBS[n.dataset.verb].slots.filter(function (x) { return x.key === n.dataset.slot; })[0];
      if (sl && e.slotAccepts(sl, card)) n.classList.add('can-drop');
    });
  }

  function cancelDrag() {
    var d = UI.drag;
    UI.drag = null;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    if (d.src) d.src.classList.remove('dragging-src');
    document.querySelectorAll('.can-drop, .drop-hover').forEach(function (x) { x.classList.remove('can-drop', 'drop-hover'); });
  }

  function onPointerUp(ev) {
    var d = UI.drag;
    if (!d) return;
    var e = UI.e;
    var card = e.card(d.uid);
    if (!d.started) {
      cancelDrag();
      select(d.uid);
      // Clicking a slotted card sends it back to the table.
      if (card && card.loc && card.loc.t === 'slot' && ev.target.closest('#pane')) { e.unslot(card.loc.verb, card.loc.slot); e.dirty = true; }
      return;
    }
    var t = dropTarget(ev);
    cancelDrag();
    if (!card || !t) { e.dirty = true; return; }
    var loc = card.loc;
    if (t.slot) {
      if (e.slotCard(t.verb, t.slot, card.uid)) { UI.openVerb = t.verb; CF.Audio.play('drop'); }
    } else if (t.token) {
      if (loc.t === 'out') {
        // Dragging an output back onto its own verb: just leave it.
      } else if (e.autoSlot(t.verb, card.uid)) { UI.openVerb = t.verb; UI.tab = 'desk'; CF.Audio.play('drop'); }
    } else if (t.table) {
      var inner = $('#table-inner').getBoundingClientRect();
      var x = (ev.clientX - inner.left) / UI.scale, y = (ev.clientY - inner.top) / UI.scale;
      var col = U.clamp(Math.floor(x / (CW + GAP)), 0, CF.COLS - 1);
      var row = Math.max(0, Math.floor(y / (CH + GAP)));
      var cell = row * CF.COLS + col;
      if (loc.t === 'table') e.moveCard(card.uid, cell);
      else if (loc.t === 'slot') { e.unslot(loc.verb, loc.slot); e.moveCard(card.uid, cell); }
      else if (loc.t === 'out') e.takeOutput(loc.verb, card.uid, cell);
    }
    e.dirty = true;
  }

  function onDoubleClick(ev) {
    if (UI.modal) return;
    var n = cardAt(ev.target);
    if (!n) return;
    var e = UI.e;
    var card = e.card(+n.dataset.uid);
    if (!card || !card.loc) return;
    if (card.loc.t === 'out') { e.takeOutput(card.loc.verb, card.uid); e.dirty = true; return; }
    if (card.loc.t !== 'table') return;
    var vid = UI.openVerb;
    if (vid && e.autoSlot(vid, card.uid)) { e.dirty = true; return; }
    // Otherwise, find the first verb that will take it.
    for (var i = 0; i < CF.VERB_ORDER.length; i++) {
      var id = CF.VERB_ORDER[i];
      var v = e.verb(id);
      if (v.status === 'idle' && !Object.keys(v.slots).length && canTake(id, card) && e.autoSlot(id, card.uid)) {
        UI.openVerb = id; UI.tab = 'desk'; e.dirty = true; return;
      }
    }
  }
})();
