// DOM rendering and input. Reads engine state, renders the table, verbs and
// side panel, and turns drags/clicks into engine calls.
(function () {
  var CF = window.CF;
  var U = CF.util;

  // Art lives in css/art/*.css as --art-* custom properties (see tools/build_art.py).
  function art(name) { return 'var(--art-' + name + ')'; }
  function hash(str) { var x = 0; str = String(str); for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
  // ---- The Candlemark art (css/art/cm-*.css, cut by tools/build_cm_art.py).
  // One style for everything: cream paper, a coloured frame, a black ink
  // picture. Two families of card face (css: .card.face-<family>):
  //   full   a whole painted card from the sheets; the name sits on a strip at its foot
  //   icon   a square icon from the sheets on an empty framed card, in the kind's colour
  var PIC_TONE = { case: 'red', coldcase: 'grey', clue: 'blue', evidence: 'blue', witness: 'blue', suspect: 'red', informant: 'gold',
    district: 'gold', place: 'gold', room: 'grey', equipment: 'teal', teammate: 'teal', personnel: 'teal', hospital: 'grey',
    criminal: 'red', condemned: 'dark', court: 'dark', threat: 'red', career: 'gold', intel: 'blue', order: 'gold', ability: 'gold', funds: 'gold',
    insight: 'teal', sentence: 'dark', plea: 'blue', paper: 'gold', temptation: 'gold', calling: 'gold' };
  // Square icons on a framed card.
  var ICONS = {
    health: 'imed-01', wound: 'imed-09', focus: 'iinv-20', instinct: 'iinv-06', spent_health: 'imed-08', spent_focus: 'iinv-09', spent_instinct: 'imed-22', funds: 'itrade-20',
    fatigue: 'imed-13', burnout: 'imed-10', hunger: 'imed-20', sickness: 'imed-07', stress: 'imed-21', obsession: 'imyst-05', tunnel: 'iinv-13',
    kit: 'iinv-16', labpass: 'ilaw-19', plea: 'ilaw-13',
  };
  // Whole painted cards.
  var FULLS = {
    calling_commissioner: 'ctrade-04', calling_master: 'ctrade-06', calling_crusader: 'ctrade-05',
    camera: 'cstory-04', prints: 'cstory-02', surveillance: 'cverb-08',
    gang: 'ccrime-05', syndicate: 'cherald2-07', insight: 'cstory-05', watchq: 'csign-01',
    order: 'ccrime-07', intel: 'cstory-03', thread: 'cstory-02', paperwork: 'ccourt-06', bribe: 'cverb-07', promotion: 'cstory-06', promo_inspector: 'cstory-06', promo_chief: 'cstory-06',
    chair: 'cherald2-04', looseend: 'citem-07', ledger: 'cmyst-08', notes: 'citem2-02', writsale: 'ccrime-07', tribute: 'citem-03', dagger: 'citem2-07',
    personnel: 'citem2-08', condemned: 'ccourt-07', atlarge: 'ccrime-08', trial: 'ccourt-04',
  };
  // A case: the crime as a card, and a stamp of its kind on the corner.
  var CASE_ART = { burglary: ['ccrime-02', 'icrime-10'], missing: ['csign-01', 'icrime-12'], harbor: ['ccrime-06', 'icrime-03'], arson: ['ccrime-03', 'icrime-09'],
    fraud: ['ccrime-07', 'icrime-07'], extortion: ['ccrime-01', 'icrime-08'], poison: ['ccrime-04', 'icrime-04'], coining: ['citem-03', 'icrime-21'],
    scriptorium: ['citem2-02', 'ilaw-12'], witch: ['coccult-07', 'icrime-19'], highway: ['citem-01', 'icrime-16'], contract: ['citem2-07', 'icrime-01'],
    eumenides: ['coccult-03', 'imyst-07'], pattern: ['coccult-06', 'icrime-05'], threedays: ['csign-06', 'icrime-02'], manhunt: ['ccrime-08', 'ilaw-18'],
    gang: ['ccrime-05', 'icrime-22'], syndicate: ['cherald2-07', 'icrime-19'], architect: ['csign-04', 'icrime-16'] };
  var CASE_DEFAULT = ['csign-01', 'imark-16'];
  // Tokens about the body: an icon of the case's kind of death.
  var BODY_ART = { harbor: ['icrime-03', 'iev-21'], poison: ['icrime-04', 'iev-07'], contract: ['icrime-01', 'iev-21'], highway: ['icrime-16', 'iev-21'], eumenides: ['icrime-05', 'iev-20'],
    pattern: ['icrime-13', 'iev-21'], threedays: ['icrime-02', 'iev-21'], scriptorium: ['iev-21', 'iev-03'], missing: ['imark-09', 'iev-21'], witch: ['icrime-02', 'iev-20'], manhunt: ['iev-21', 'icrime-13'] };
  var BODY_WORDS = /body|corpse|wound|blood|dead|drown|hang|poison|shot|stab|bruise|throat|lungs|stitched|cut\b|marks on/i;
  // The ladder: each rung has its picture.
  var RUNG_ART = { pardon: 'ccourt-06', fine: 'citem-03', pillory: 'ccourt-07', banish: 'cverb-05', brand: 'citem2-04', sword: 'ccourt-08', rope: 'citem-07', wheel: 'ccourt-05' };
  var DISTRICT_ART = { docks: 'cplace-02', market: 'cplace-05', neon: 'cplace-01', uptown: 'cplace-04', warrens: 'cplace-06', canal: 'cplace-03' };
  var FRONT_POOL = ['cplace3-07', 'cplace3-11', 'cplace3-15', 'cplace3-01', 'cplace3-03', 'cplace3-10'];
  var ROOM_ART = { intel: 'cplace3-08', lab: 'cplace3-06', locker: 'charb2-05', suite: 'cplace3-13' };
  // People: the portrait cards, in pools by trade. A named person keeps one face (by their name).
  var POOL = {
    noble: ['cnoble-01', 'cnoble-02', 'cnoble-03', 'cnoble-04', 'cnoble-05', 'cnoble-06', 'cnoble-07', 'cnoble-08', 'cnoble2-01', 'cnoble2-02', 'cnoble2-03', 'cnoble2-04', 'cnoble2-05', 'cnoble2-06', 'cnoble2-07', 'cnoble2-08', 'cink-06'],
    judge: ['cclerk-06', 'cink-02', 'ctrade-02'],
    cleric: ['cclerk-07', 'cclerk-08', 'cwoman-02', 'ctrade-05'],
    clerk: ['cclerk-01', 'cclerk-03', 'cclerk-04', 'cclerk-05', 'cink-07', 'ctrade-06', 'cwoman-06'],
    watch: ['cwatch-01', 'cwatch-02', 'cwatch-03', 'cwatch-04', 'cwatch-05', 'cwatch-06', 'cwatch-07', 'cwatch-08'],
    rogue: ['crogue-01', 'crogue-02', 'crogue-06', 'coutlaw-01', 'coutlaw-02', 'coutlaw-03', 'coutlaw-04', 'coutlaw-05', 'coutlaw-06', 'coutlaw-07', 'coutlaw-08', 'cink-03'],
    sailor: ['crogue-04', 'cink-05', 'ctrade-08', 'cfolk-07'],
    poor: ['crogue-07', 'crogue-08', 'cink-08', 'cfolk-08', 'cink-01'],
    woman: ['cwoman-01', 'cwoman-03', 'cwoman-04', 'cwoman-05', 'cwoman-07', 'cwoman-08', 'cfolk-01', 'cfolk-03', 'cfolk-05', 'crogue-05', 'cink-04', 'ctrade-07'],
    trader: ['crogue-03', 'cfolk-02', 'cfolk-04', 'cfolk-06', 'cink-06', 'cnoble-05'],
  };
  POOL.any = [].concat(POOL.noble, POOL.judge, POOL.cleric, POOL.clerk, POOL.rogue, POOL.sailor, POOL.poor, POOL.woman, POOL.trader);
  var ROLE_POOL = [
    [/judge|magistrat|justice|recorder|advocate|lawyer|doctor of laws|alderman/i, 'judge'],
    [/priest|vicar|curate|parson|chaplain|friar|monk|deacon|sexton|preacher|\bnun\b|novice|abbess|confessor|cardinal|bishop|cellarer|of the abbey/i, 'cleric'],
    [/patrician|councillor|heir|benefactor|gentleman|burgomaster|nephew of the house|jilted|\blady\b|dame\b|countess|mistress|of the hill/i, 'noble'],
    [/watch|sergeant|constable|soldier|lieutenant|beadle|guard|warden|gaoler|turnkey|night porter|night-clerk/i, 'watch'],
    [/smuggler|thief|cutpurse|burglar|bravo|fire-setter|fugitive|upright man|receiver|coquille|thunes|brotherhood|band\b|highway|footpad|beffleur|envoyeur|planteur|espieur|desrocheur|crocheteur|coulon|rival|discharged|fence\b/i, 'rogue'],
    [/sailor|seaman|boatman|lighterman|docker|bargee|mariner|captain|shipwright|waterman|harbourmaster|crane-walker|fisherman/i, 'sailor'],
    [/beggar|tenant|servant|journeyman|vagrant|apprentice|porter/i, 'poor'],
    [/widow|midwife|laundress|spouse|wife|maid|nurse|lover|daughter|barmaid|herb|cook|housekeeper|spinning-house|wise woman/i, 'woman'],
    [/clerk|scholar|scrivener|notary|librarian|tutor|schoolmaster|copyist|bookseller|printer|student|physician|surgeon|apothecar|barber|counting-house/i, 'clerk'],
    [/merchant|trader|dealer|broker|pawn|grocer|vintner|goldsmith|draper|mercer|shopkeeper|innkeeper|landlord|factor|moneychanger|miller|stallholder|carrier|perfumer|wool|tavern|bathhouse|owner/i, 'trader'],
  ];
  function personArt(name, role) {
    var pool = POOL.any;
    for (var i = 0; i < ROLE_POOL.length && role; i++) if (ROLE_POOL[i][0].test(role)) { pool = POOL[ROLE_POOL[i][1]]; break; }
    return pool[hash(name || role || '') % pool.length];
  }
  // Evidence pictures, chosen by what a token is about: a painted card where
  // there is one, a square icon otherwise (['key', 'icon']).
  var EV_RULES = [
    [/deposition|word from|confession|cover story|slip of|own account|statement|rumour/i, ['citem2-02']],
    [/rope|noose|cord|hanged|strangl|garrott/i, ['citem-07']],
    [/relic|saint|prayer|rosary|holy|church|chapel|shrine/i, ['coccult-01']],
    [/letter|correspondence|bond|unfinished|message|note\b|notes|casebook|commonplace/i, ['citem-08']],
    [/blood|stitched|wound/i, ['iev-03', 'icon']],
    [/glove/i, ['citem2-05']],
    [/hand\b|thumb|print|surfaces/i, ['iev-01', 'icon']],
    [/\bkey|entry|lodging|house|home|door|shutter|latch/i, ['citem2-03']],
    [/lock\b|padlock|chest|strongbox/i, ['citem2-06']],
    [/ledger|account|tally|investors|profits|spending|goldsmith|will\b/i, ['cmyst-08']],
    [/coin|clipping|mould|silver|pledged|pawn|chit|purse|jointure|wage/i, ['citem-03']],
    [/powder|poison|needle|phial|oil|smell|tobacco|clove|scent|herb/i, ['citem-04']],
    [/\bcup\b|chalice|wine|goblet|drink/i, ['citem-02']],
    [/hours|night|tide|bell|timeline|reckoned|meeting|round|schedule|curfew|watch|clock|hour/i, ['csign-06']],
    [/cipher|code|book|leaf|register|roll|hand read|hand matched|hand examined/i, ['cmyst-08']],
    [/paper|prospectus|papers|sketch|drawn/i, ['citem2-02']],
    [/seen|sighting|face|likeness|caught|identification|witness|placed/i, ['csign-04']],
    [/carrier|ticket|wagon|ferry|token|seal|writ|warrant|licence/i, ['ccrime-07']],
    [/pistol|shot\b|gun|musket/i, ['citem-01']],
    [/pick|blade|chisel|crow|tool|marks|forced|pried|knife|dagger|cut\b/i, ['citem2-07']],
    [/kindling|fire|match|taper|ash|burn|candle|wax/i, ['citem2-04']],
    [/map|quarter|front|place|thread|where/i, ['charb-06']],
    [/locket|ring|signet|scratch|jewel/i, ['citem-06']],
    [/lantern|light|lamp/i, ['charb2-02']],
    [/barrel|cask|cellar/i, ['charb2-03']],
    [/crate|cargo|bale|warehouse/i, ['charb-04']],
    [/compass|harbour|quay|barge|boat|water|drown|street|city|ship|sail/i, ['charb-05']],
    [/raven|bird|crow|feather/i, ['coccult-03']],
    [/mask|disguise/i, ['iev-19', 'icon']],
    [/cloak|cloth|rag|dress|coat/i, ['iev-17', 'icon']],
    [/boot|footprint|track|mud/i, ['iev-02', 'icon']],
    [/ink|pen\b|quill/i, ['iev-30', 'icon']],
  ];
  var EV_BY_ASPECT = { forensic: 'citem2-01', testimony: 'csign-02', motive: 'citem-08', opportunity: 'csign-06', digital: 'cmyst-08', financial: 'citem-03' };
  // The verbs: square tiles, one glyph each.
  var VERB_TOKENS = { time: 'cvtok-time', duty: 'cvtok-duty', investigate: 'cvtok-investigate', analyze: 'cvtok-analyze', interrogate: 'cvtok-interrogate', reflect: 'cvtok-reflect', arrest: 'cvtok-arrest' };
  var ASK_ART = { instinct: 'iinv-06', focus: 'cres-05', funds: 'itrade-20', teammate: 'rrole-03', health: 'imed-01' };
  var ASPECT_ART = { forensic: 'iev-01', testimony: 'cwit-01', motive: 'icrime-06', opportunity: 'iev-02', digital: 'ilaw-12', financial: 'itrade-20' };
  var METER_ICONS = { pressure: 'imark-08', scrutiny: 'iinv-13', retaliation: 'icrime-01', reputation: 'ilaw-17', dread: 'icrime-19' };
  var TOAST_BARS = { case: 'clabel-01', danger: 'clabel-01', defeat: 'clabel-01', major: 'clabel-02', victory: 'clabel-02', week: 'clabel-04', verb: 'clabel-03', minor: 'clabel-05' };
  var TOAST_ICONS = { case: 'imark-01', danger: 'cmark-04', defeat: 'imark-04', major: 'cwax-02', victory: 'imark-12', week: 'ccirc-02', verb: 'cwit-02', minor: 'cmark-05' };
  var RANK_ART = ['cwax-01', 'cwax-03', 'cwax-02'];
  // The tokens are cards too: a tall rounded ring drawn just outside their edge.
  var RING_LEN = 2 * (240 + 240) - 8 * 20 + 2 * Math.PI * 20;

  // The face of a card: {art, fam, tone, gray, banded}.
  function full(art, tone, gray) { return { art: art, fam: 'full', tone: tone || 'gold', gray: !!gray, banded: /^(cplace3|cstory)-/.test(art) }; }
  function icon(art, tone, gray) { return { art: art, fam: 'icon', tone: tone || 'gold', gray: !!gray }; }
  function cardPicture(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind, tone = PIC_TONE[k] || 'gold';
    if (k === 'case') { var r = e.caseRec(card.caseId); return full((CASE_ART[r && r.template] || CASE_DEFAULT)[0], r && r.highProfile ? 'gold' : tone); }
    if (k === 'coldcase') return full((CASE_ART[card.data.template] || CASE_DEFAULT)[0], tone, true);
    if (k === 'clue' || k === 'evidence') {
      var label = e.labelOf(card);
      var a = CF.clueAspects(card), best = null;
      for (var key in a) if (!best || a[key] > a[best]) best = key;
      var crec = card.caseId && e.caseRec(card.caseId), body = crec && BODY_ART[crec.template];
      if (body && (BODY_WORDS.test(label) || (best === 'forensic' && !/print|hand|thumb|letter|ledger|paper|key|coin/i.test(label)))) return icon(body[hash(label) % body.length], 'dark');
      for (var i = 0; i < EV_RULES.length; i++) if (EV_RULES[i][0].test(label)) { var ev = EV_RULES[i][1]; return ev[1] ? icon(ev[0], tone) : full(ev[0], tone); }
      return full(EV_BY_ASPECT[best] || 'citem2-01', tone);
    }
    if (k === 'district') return full(DISTRICT_ART[card.data.district] || 'cplace-05', tone);
    if (card.def === 'front') return full(FRONT_POOL[hash(e.labelOf(card)) % FRONT_POOL.length], tone);
    if (card.def === 'room') return full(ROOM_ART[card.data.room || card.data.key] || 'cplace3-09', tone);
    if (k === 'teammate' || k === 'hospital') return full(personArt(card.data.name || e.labelOf(card), 'watch'), tone, k === 'hospital');
    if (card.def === 'rival') return full(personArt(card.data.name || 'rival', card.data.role || 'rival'), 'dark');
    if (card.def === 'suspect' || card.def === 'witness' || card.def === 'informant') {
      var srec = card.caseId && e.caseRec(card.caseId), sus = srec && card.data.key && srec.suspects.filter(function (x) { return x.key === card.data.key; })[0];
      var role = card.data.role || (sus && sus.role) || (card.def === 'informant' ? 'smuggler' : '');
      return full(personArt(card.data.name || e.labelOf(card), role), /Prime Suspect/.test(e.labelOf(card)) ? 'red' : tone);
    }
    if (card.def === 'rung') return full(RUNG_ART[card.data.rung] || 'ccourt-01', 'dark');
    if (FULLS[card.def]) return full(FULLS[card.def], tone);
    if (ICONS[card.def]) return icon(ICONS[card.def], card.def === 'wound' || card.def === 'burnout' || /^spent_/.test(card.def) ? 'red' : tone, /^spent_/.test(card.def));
    return full('csign-01', tone);
  }

  var UI = (CF.UI = {
    e: null, openVerbs: [], selected: null, hover: null, hoverSlot: null,
    speed: 1, paused: false, modal: false, drag: null,
    view: { x: 16, y: 16, z: 1 }, winPos: {}, lifted: null, spawn: {},
    onGameOver: null, onSave: null,
  });
  UI.personArt = personArt;

  var T = CF.TABLE;
  UI.verbArt = function (v) { return VERB_TOKENS[v] || 'cvtok-investigate'; };
  var wheelAcc = 0, wheelAt = null, wheelRaf = 0;
  var cardEls = {};   // top card uid -> board element
  var pileEl = null;  // the collection pile's zone on the board
  var verbEls = {};   // verb id -> token element
  var winEls = {};    // verb id -> window element
  var liveCards = []; // [el, uid] for cards with timers

  function $(sel) { return document.querySelector(sel); }
  var tr = CF.T;
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = tr(text);
    return n;
  }
  function esc(s) { return String(tr(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------- Setup
  UI.attach = function (engine) {
    UI.e = engine;
    UI.openVerbs = [];
    UI.selected = null;
    UI.hover = null;
    UI.lifted = null;
    UI.hoverSlot = null;
    UI.drag = null;
    UI.typing = null;
    UI.spawn = {};
    UI.winPos = {};
    UI.seenVerbs = {};
    UI.newVerbs = {};
    UI.lastRank = engine.s.rank;
    UI.journalLen = -1;
    CF.VERB_ORDER.forEach(function (id) { if (engine.verb(id).unlocked) UI.seenVerbs[id] = true; });
    ['#board', '#windows'].forEach(function (sel) { $(sel).innerHTML = ''; });
    pileEl = null; choiceEl = null; linkEl = null; pinEl = null;
    // The grid over the whole table: its cells line up with the tidy layout.
    var B = T.BOUNDS, grid = h('div', 'grid');
    grid.style.left = B.x + 'px'; grid.style.top = B.y + 'px'; grid.style.width = B.w + 'px'; grid.style.height = B.h + 'px';
    $('#board').appendChild(grid);
    applyTableSettings();
    UI.journalSeen = engine.s.journal.length;
    UI.hintMode = null;
    UI.tidyUndo = null;
    UI.pick = null;
    UI.autoPaused = false;
    renderTools();
    UI.dockH = undefined;
    $('#btn-journal').classList.remove('unread');
    $('#journal-drawer').classList.remove('open');
    $('#peek').classList.remove('open');
    cardEls = {}; verbEls = {}; winEls = {}; liveCards = [];
    engine.on(onEvent);
    engine.dirty = true;
    requestAnimationFrame(UI.fitView);
  };

  // The panel scale from Settings (1 = as designed).
  // Settings that shape the table: the grid's visibility and whether cards settle on it.
  function applyTableSettings() {
    T.snap = CF.Settings.get('snap') !== false;
    var gap = CF.Settings.get('gap') || T.GAP;
    if (gap !== T.GAP || !UI.gridPitch) {
      T.setGap(gap);
      // The pile strip is sized by the pitch: it is rebuilt on the next sync.
      if (pileEl) { pileEl.remove(); pileEl = null; }
    }
    var g = document.querySelector('#board .grid'), B = T.BOUNDS;
    if (g) {
      g.classList.toggle('hidden', CF.Settings.get('grid') === false);
      g.style.backgroundSize = T.PX + 'px ' + T.PY + 'px';
      g.style.backgroundPosition = (((0 - B.x) % T.PX) + T.PX) % T.PX + 'px ' + (((T.TOP - B.y) % T.PY) + T.PY) % T.PY + 'px';
    }
    UI.gridPitch = T.PX + 'x' + T.PY;
  }
  CF.Settings.onChange(applyTableSettings);
  // The language: every word on the page is re-read through CF.T, and the
  // table is rebuilt so the cards and verbs pick up their new names.
  UI.applyLang = function () {
    var want = CF.Settings.get('lang') || 'en';
    if (want === CF.lang() && UI.langApplied) return;
    UI.langApplied = true;
    CF.setLang(want);
    if (!UI.e) return;
    ['#board', '#windows'].forEach(function (sel) { $(sel).innerHTML = ''; });
    cardEls = {}; verbEls = {}; winEls = {}; liveCards = []; pileEl = null; choiceEl = null; linkEl = null; pinEl = null;
    UI.openVerbs = []; UI.hintMode = null; shownJournal = null; UI.gridPitch = null;
    applyTableSettings();
    UI.e.dirty = true;
  };
  CF.Settings.onChange(UI.applyLang);
  UI.scale = function () { return U.clamp((CF.Settings.get('uiScale') || 100) / 100, 0.8, 1.6); };
  UI.applyScale = function () {
    document.documentElement.style.setProperty('--ui-scale', UI.scale());
    // Open windows grow or shrink in place; keep them inside the table.
    Object.keys(winEls).forEach(function (vid) { positionWindow(vid, winEls[vid]); });
  };
  UI.setPaused = function (p) { UI.paused = p; renderControls(); };
  // A light tick on touches (the Vibration setting). The app's own vibrator
  // first, the web Vibration API otherwise, nothing where there is neither.
  UI.haptic = function (ms) {
    if (CF.Settings.get('haptics') === false) return;
    try {
      if (window.CaseFileAndroid && CaseFileAndroid.vibrate) CaseFileAndroid.vibrate(ms || 10);
      else if (navigator.vibrate) navigator.vibrate(ms || 10);
    } catch (err) { /* no haptics */ }
  };
  // The screen stays on only while a game is running, unpaused, with no menu open.
  UI.wake = function () {
    try {
      if (window.CaseFileAndroid && CaseFileAndroid.keepAwake) CaseFileAndroid.keepAwake(!!(UI.e && !UI.e.s.over && !UI.paused && !UI.modal));
    } catch (err) { /* not the app */ }
  };
  // The app tells the page where the notch and the gesture bar are (CSS px).
  UI.setInsets = function (l, t, r, b) {
    var st = document.documentElement.style;
    st.setProperty('--inset-l', (l || 0) + 'px'); st.setProperty('--inset-t', (t || 0) + 'px');
    st.setProperty('--inset-r', (r || 0) + 'px'); st.setProperty('--inset-b', (b || 0) + 'px');
  };
  UI.onForeground = function () { UI.wake(); };
  UI.onBackground = function () { if (UI.e && !UI.e.s.over && CF.Settings.get('pauseOnBlur')) UI.setPaused(true); if (UI.onSave) UI.onSave(); };
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
      // Enter on a focused button is that button's click, not Begin.
      if (ev.key === 'Enter' && /^(BUTTON|SELECT|TEXTAREA|A)$/.test(ev.target.tagName)) return;
      if (ev.code === 'Space') { ev.preventDefault(); UI.setPaused(!UI.paused); }
      else if (ev.key === '1' || ev.key === '2' || ev.key === '3') UI.setSpeed(+ev.key);
      else if (ev.key === 'Escape') { if (UI.drag) cancelDrag(); else if (UI.openVerbs.length) closeWindow(UI.openVerbs[UI.openVerbs.length - 1]); }
      else if (ev.key === '+' || ev.key === '=') $('#zoom [data-zoom=in]').click();
      else if (ev.key === '-') $('#zoom [data-zoom=out]').click();
      else if (ev.key === '0') UI.fitView();
      else if (ev.key === 'Tab') { ev.preventDefault(); UI.stackAll(); }
      else if (ev.key === 't' || ev.key === 'T') UI.tidy();
      else if (ev.key === 'c' || ev.key === 'C') UI.collectAll();
      else if (ev.key === 'z' || ev.key === 'Z') UI.undoTidy();
      else if (ev.key === 'j' || ev.key === 'J') UI.toggleJournal();
      else if (ev.key === 's' || ev.key === 'S' || ev.key === 'Enter') goTopWindow();
    });
    $('#zoom').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-tool]');
      if (!b) return;
      if (b.dataset.tool === 'stack') UI.stackAll();
      else if (b.dataset.tool === 'collect') UI.collectAll();
      else if (b.dataset.tool === 'tidy') UI.tidy();
      else if (b.dataset.tool === 'undo') UI.undoTidy();
    });
    UI.applyScale();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', function (ev) { delete pointers[ev.pointerId]; cancelDrag(); });
    // Long presses on a tablet must not open the browser's context menu.
    document.addEventListener('contextmenu', function (ev) { if (ev.target.closest && ev.target.closest('#table')) ev.preventDefault(); });
    document.addEventListener('dblclick', onDoubleClick);
    $('#table').addEventListener('wheel', function (ev) {
      if (UI.modal) return;
      // Inside a verb window the wheel scrolls the window, not the table.
      if (ev.target.closest && ev.target.closest('.vwin')) return;
      ev.preventDefault();
      wheelAcc += ev.deltaY; wheelAt = { x: ev.clientX, y: ev.clientY };
      if (!wheelRaf) wheelRaf = requestAnimationFrame(function () { wheelRaf = 0; var d = wheelAcc; wheelAcc = 0; zoomAt(wheelAt.x, wheelAt.y, Math.exp(-d * 0.0015)); });
    }, { passive: false });
    $('#btn-journal').addEventListener('click', function () { UI.toggleJournal(); });
    $('#meters').addEventListener('click', function (ev) { var m = ev.target.closest('.meter[data-meter]'); if (m) UI.showMeterInfo(m.dataset.meter); });
    $('#journal-close').addEventListener('click', function () { UI.toggleJournal(false); });
    window.addEventListener('resize', function () {
      // Keep open windows inside the (possibly smaller) table.
      Object.keys(winEls).forEach(function (vid) { positionWindow(vid, winEls[vid]); });
      if (UI.e) UI.e.dirty = true;
    });
    window.addEventListener('blur', cancelDrag);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && CF.Settings.get('pauseOnBlur') && UI.e && !UI.e.s.over) UI.setPaused(true);
    });

    var last = performance.now();
    var saveT = 0;
    function frame(now) {
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      var e = UI.e;
      // One bad frame must never stop the clock: log it and keep going.
      try {
        if (e) {
          if (!e.s.over && !UI.paused && !UI.modal) {
            e.tick(dt * UI.speed);
            saveT += dt;
            if (saveT > 8 && UI.onSave) { saveT = 0; UI.onSave(); }
          }
          if (e.dirty) { e.dirty = false; render(); }
          updateLive();
        }
      } catch (err) {
        if (typeof console !== 'undefined') console.error(err);
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
    if (type === 'ask') {
      CF.Audio.play('click');
      toast({ title: CF.VERBS[payload.verb].label + ' asks: ' + payload.label, text: payload.text, kind: 'verb', verb: payload.verb });
      if (CF.Settings.get('pauseOnVerb')) UI.setPaused(true);
    }
    if (type === 'choice') {
      CF.Audio.play('start');
      if (UI.openVerbs.length) closeAllWindows();
      var sp = UI.e.choiceSpot();
      UI.viewBefore = { x: UI.view.x, y: UI.view.y, z: UI.view.z };
      panToBoard(sp.x, sp.y, 380, 300);
    }
    if (type === 'chosen' && UI.viewBefore) {
      // Back to exactly where you were looking, at the same zoom.
      var back = UI.viewBefore; UI.viewBefore = null;
      tweenView(back);
    }
    if (type === 'autorun') {
      // An event runs a verb by itself: the cards are pulled in, the window opens.
      var tokEl = verbEls[payload.verb];
      payload.uids.forEach(function (u, i) { var c = UI.e.card(u); var el = cardEls[u]; if (c && el && tokEl) setTimeout(function () { flyTo(el, tokEl, c); el.remove(); delete cardEls[u]; }, i * 160); });
      CF.Audio.play('start');
      setTimeout(function () { openWindow(payload.verb); UI.notice({ verb: payload.verb, label: CF.VERBS[payload.verb].label }); }, 300);
    }
    if (type === 'unlock') UI.notice({ verb: payload.verb, label: CF.VERBS[payload.verb].label, fresh: true });
    if (type === 'story' && payload.kind === 'case') {
      var cases = UI.e.tableCards().filter(function (c) { return CF.CARDS[c.def].kind === 'case'; }).sort(function (a, b) { return b.uid - a.uid; });
      if (cases[0]) UI.notice({ uid: cases[0].uid, label: cardTitle(cases[0]), fresh: true, kind: 'case' });
    }
    if (type === 'story' && /^An Insight/.test(payload.title)) {
      var ins = UI.e.tableCards().filter(function (c) { return c.def === 'insight'; }).sort(function (a, b) { return b.uid - a.uid; });
      if (ins[0]) UI.notice({ uid: ins[0].uid, label: cardTitle(ins[0]), fresh: true, kind: 'insight' });
    }
    if (type === 'dues') {
      var bell = verbEls.time;
      payload.uids.forEach(function (u, i) { var c = UI.e.card(u); var el = cardEls[u] || (c && cardEls[UI.e.stackOf(c)[0].uid]); if (c && el) setTimeout(function () { flyTo(el, bell, c); }, i * 220); });
    }
    if (type === 'expiring') {
      var fc = UI.e.card(payload.uid), need = fc && CF.NEEDS && CF.NEEDS[fc.def];
      toast({ title: (need ? 'Pressing: ' : 'Fading: ') + payload.label, text: need ? 'Half a minute before it takes its due. Into Rest, now: Coin, or what you have.' : 'Half a minute before it is gone. Use it or lose it.', kind: 'danger', uid: payload.uid, verb: payload.verb });
    }
    if (type === 'over' && UI.onGameOver) setTimeout(function () { UI.onGameOver(UI.e.s.over); }, 600);
  }

  function toast(entry) {
    if (UI.modal) return;
    var box = $('#toasts');
    var t = h('div', 'toast k-' + (entry.kind || 'event'));
    t.style.backgroundImage = art(TOAST_BARS[entry.kind] || 'clabel-06');
    t.style.setProperty('--icon', art(TOAST_ICONS[entry.kind] || 'ccirc-01'));
    t.innerHTML = '<b>' + esc(entry.title) + '</b><span>' + esc(entry.text || '') + '</span>';
    t.addEventListener('click', function () {
      if (entry.verb) openWindow(entry.verb);
      else if (entry.uid) { if (!UI.panTo(entry.uid) && entry.verb) openWindow(entry.verb); }
      else if (entry.kind === 'minor') { /* nothing to show */ }
      else { UI.toggleJournal(true); $('#journal').scrollTop = 0; }
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
    syncLinks();
    syncWindows();
    markFits();
    renderJournal();
    renderInspector();
    renderControls();
    renderHint();
  }

  // The journal is a drawer over the table, shown only when asked for.
  UI.toggleJournal = function (on) {
    var open = on === undefined ? !$('#journal-drawer').classList.contains('open') : !!on;
    $('#journal-drawer').classList.toggle('open', open);
    $('#btn-journal').classList.toggle('on', open);
    if (open) { UI.journalSeen = UI.e ? UI.e.s.journal.length : 0; $('#btn-journal').classList.remove('unread'); }
  };

  // A line under the dock that tells a new player what to try next: the
  // guided start's hint while it runs, then the plain how-to until the
  // player has moved something (remembered across games).
  var PLAIN_HINT = 'Drag cards onto the verbs above, or tap an empty slot to pick a card for it. Drag the table to look around, pinch or scroll to zoom. Drag a stack by its number to move all of it.';
  // What to do next, read off the table: the first thing that applies.
  UI.advice = function () {
    var e = UI.e, s = e.s;
    if (!e || s.over || s.choice) return null;
    var verbs = CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; });
    var can = function (v) { return e.verb(v).unlocked && !e.lockReason(v); };
    var running = verbs.filter(function (v) { return e.verb(v).status === 'running'; });
    var asking = running.filter(function (v) { return e.verb(v).ask && !e.verb(v).ask.filled; });
    if (asking.length) return tr('{verb} asks for something: open it, or drop the card on it.', { verb: CF.VERBS[asking[0]].label });
    var done = verbs.filter(function (v) { return e.verb(v).status === 'done'; });
    if (done.length) return tr('{verb} has finished: open it and take what it found.', { verb: CF.VERBS[done[0]].label });
    if (running.length) return null;
    var table = e.tableCards(), has = function (d) { return table.filter(function (c) { return c.def === d && !e.unavailableReason(c); }); };
    var cases = table.filter(function (c) { return c.def === 'case'; });
    var open = cases.map(function (c) { return { card: c, rec: e.caseRec(c.caseId) }; }).filter(function (x) { return x.rec && x.rec.status === 'open'; });
    var wit = has('focus')[0], hp = has('health')[0];
    // The fever locks the street: Rest comes before anything the locked verbs would do.
    if (e.countOf('burnout') && can('reflect')) return tr('The fever has you: put Fever into Rest before anything else.');
    var insight = table.filter(function (c) { return c.def === 'insight' && c.data && CF.INSIGHTS[c.data.insight] && !e.unavailableReason(c); })[0];
    if (insight && can('reflect')) return tr('An Insight waits: put {label} into Rest alone to learn it, or with your {ability} to keep it as a trick.', { label: e.labelOf(insight), ability: tr(CF.CARDS[CF.INSIGHTS[insight.data.insight].trains].label) });
    if (can('investigate')) for (var i = 0; i < open.length; i++) if (open[i].rec.searches === 0) return tr('A new case: put {title} into Explore to search the scene.', { title: open[i].rec.title });
    var raw = has('evidence')[0];
    if (raw && can('analyze')) return tr('Raw proof waits: put {label} into Study to read it.', { label: e.labelOf(raw) });
    var w = has('witness').filter(function (c) { return !c.data.asked; })[0];
    if (w && wit && can('interrogate')) return tr('A witness: put {name} into Question with Wit.', { name: e.labelOf(w) });
    if (can('arrest')) for (var j = 0; j < open.length; j++) {
      var rec = open[j].rec, sc = table.filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; });
      var tokens = table.filter(function (c) { return (c.def === 'clue') && c.caseId === rec.id; });
      for (var k = 0; k < sc.length; k++) { var a = e.assessCharge(sc[k], tokens); if (a && a.tier === 'strong') return tr('The proof is enough: put {name} and the tokens into the Court.', { name: e.labelOf(sc[k]) }); }
    }
    var unasked = table.filter(function (c) { if (c.def !== 'suspect' || e.unavailableReason(c)) return false; var su = e.suspectOf(c); return su && !su.questioned; })[0];
    if (unasked && wit && can('interrogate')) return tr('Question {name} with Wit: people say more than they mean to.', { name: e.labelOf(unasked) });
    if (can('investigate')) for (var m = 0; m < open.length; m++) if (open[m].rec.found < open[m].rec.items.length) return tr('The scene has more to give: search {title} again.', { title: open[m].rec.title });
    var fat = has('fatigue').length;
    if (fat >= 2 && can('reflect')) return tr('Weariness is piling up: put one into Rest before the fever takes you.');
    if (has('funds').length < 2 && hp && can('duty')) return tr('Coin is short: Attend with Health earns your keep.');
    if (!open.length && can('duty') && hp) return tr('Nothing on the desk. A case will come; Attend with Health meanwhile.');
    if (open.length && can('investigate')) return tr('The trail is thin. Search the scene again, or go door to door with the Quarter.');
    // Nothing pressing: the nearest way to grow.
    if (CF.growthWays) {
      var best = null;
      ['health', 'focus', 'instinct'].forEach(function (ab) { CF.growthWays(e, ab).forEach(function (w) { if (w.state === 'open' && (!best || w.n / w.need > best.n / best.need)) best = w; }); });
      if (best) return tr('{ability} can grow: {how}', { ability: tr(CF.CARDS[CF.INSIGHTS[best.id].trains].label), how: tr(best.how) });
    }
    return null;
  };
  var adviceShown = null;
  function renderHint() {
    var e = UI.e, hint = $('#hint');
    var text = e.introHint ? e.introHint() : null;
    if (text) {
      if (UI.hintMode !== 'intro' || hint.textContent !== tr(text)) { hint.textContent = tr(text); hint.classList.remove('gone'); UI.hintMode = 'intro'; }
      return;
    }
    // Idle for a while with nothing running: a nudge, read off the table.
    var idle = performance.now() - (UI.lastInput || 0) > 6000 && !UI.drag && !UI.openVerbs.length && !UI.modal;
    var advice = idle ? UI.advice() : null;
    if (advice) {
      if (UI.hintMode !== 'advice' || adviceShown !== advice) { hint.textContent = advice; hint.classList.remove('gone'); hint.classList.add('advice'); UI.hintMode = 'advice'; adviceShown = advice; }
      return;
    }
    if (UI.hintMode === 'advice') { hint.classList.add('gone'); hint.classList.remove('advice'); UI.hintMode = 'gone'; adviceShown = null; return; }
    if (UI.hintMode === 'plain' || UI.hintMode === 'gone') return;
    UI.hintMode = 'plain';
    var seen = false;
    try { seen = !!localStorage.getItem('casefile.hinted'); } catch (err) { /* ignore */ }
    hint.textContent = tr(PLAIN_HINT);
    hint.classList.toggle('gone', seen);
  }

  function renderControls() {
    UI.wake();
    document.querySelectorAll('#controls button[data-speed]').forEach(function (b) {
      var sp = +b.dataset.speed;
      b.classList.toggle('on', sp === 0 ? UI.paused : !UI.paused && UI.speed === sp);
    });
    $('#table').classList.toggle('paused', !!UI.paused);
  }

  function meter(key, label, val, max, shown) {
    void shown;
    var level = Math.min(4, Math.floor((val / Math.max(1, max)) * 4.999));
    var state = key === 'reputation' ? ' rep' : level >= 4 ? ' crit' : level >= 3 ? ' warn' : '';
    var full = { pressure: 'The Crowd: the city\'s patience with you', scrutiny: 'Suspicion: the Council\'s eye on your methods', retaliation: 'Vendetta: the underworld\'s grudge', dread: 'Dread: what the city fears you are', reputation: 'Standing: your name in the Council chamber' }[key];
    var word = (CF.METER_WORDS && CF.METER_WORDS[key] || [])[level] || '';
    return '<div class="meter lvl-' + level + state + '" data-meter="' + key + '" title="' + esc(full || label) + '"><span class="m-icon" style="background-image:' + art(METER_ICONS[key]) + '"></span>' +
      '<div class="m-main"><div class="m-label"><span>' + esc(label) + '</span></div><div class="m-word">' + esc(word) + '</div></div></div>';
  }

  var METER_INFO = {
    pressure: { title: 'The Crowd', what: 'The city\'s patience with you. It rises with every case that goes unanswered and every name the crier sings that walks free; it falls with convictions and with Coin given where the clerks can see it.', ends: 'Let it boil and the Council dismisses you. Quiet, and the city leaves you to work.' },
    scrutiny: { title: 'Suspicion', what: 'The Council\'s eye on your methods: searches without a writ, proof arranged, purses pocketed, questions put with Health. It falls when the Rolls are entered and time passes.', ends: 'Marked, and the Council\'s clerks start asking your watchmen about you; higher still, and the Burgomaster calls you in.' },
    retaliation: { title: 'Vendetta', what: 'The underworld\'s grudge. Everyone who walks from one of your cases feeds it; so do the bands they form and the Coquille you cross. Convictions and treaties cool it.', ends: 'Condemned, and they come for you and yours: a watchman in the Abbey hospital, a dagger on the pillow.' },
    dread: { title: 'Dread', what: 'What the city fears you are. Leaning on people, cruelty on the ladder and hard choices raise it; mercy and fair dealing lower it.', ends: 'A feared examiner gets confessions and shut doors in equal measure; terrified, and the city turns against the next execution.' },
    reputation: { title: 'Standing', what: 'Your name in the Council chamber. Convictions, full proof, commissions answered and the city\'s trust raise it.', ends: 'At each threshold the Council writes: a new office, more cases, a bigger stipend, and the powers that come with the rank.' },
  };
  UI.showMeterInfo = function (key) {
    var info = METER_INFO[key]; if (!info) return;
    var box = $('#peek');
    UI.selected = null; UI.hover = null;
    box.dataset.uid = 'meter:' + key; box.dataset.sig = '';
    box.innerHTML = '<button class="peek-close" title="' + esc('Close') + '">×</button>' +
      '<div class="i-meter"><span class="m-icon" style="background-image:' + art(METER_ICONS[key]) + '"></span><h4>' + esc(info.title) + '</h4></div>' +
      '<div class="i-kind">' + esc(tr('Now: {word}', { word: (CF.METER_WORDS[key] || [])[meterLevel(key)] || '' })) + '</div>' +
      '<p>' + esc(info.what) + '</p><p>' + esc(info.ends) + '</p>';
    box.classList.add('open', 'pinned');
    box.querySelector('.peek-close').addEventListener('click', function () { box.classList.remove('open', 'pinned'); box.dataset.uid = ''; });
  };
  function meterLevel(key) {
    var e = UI.e, m = e.s.meters, max = e.meterMax(key);
    if (key === 'reputation') return Math.min(4, Math.floor(m.reputation / Math.max(1, CF.COMMISSIONER_REP) * 4.999));
    return Math.min(4, Math.floor((m[key] / Math.max(1, max)) * 4.999));
  }
  function renderTop() {
    var e = UI.e, s = e.s, m = s.meters;
    var nextRep = s.rank < CF.TOP_RANK ? CF.RANK_REP[s.rank + 1] : (s.calling === 'commissioner' ? CF.COMMISSIONER_REP : Math.max(m.reputation, 1));
    var mm = function (k, label) { var max = e.meterMax(k); return meter(k, label, m[k], max, m[k] + '/' + max); };
    $('#meters').innerHTML = mm('pressure', 'Crowd') + mm('scrutiny', 'Suspicion') + mm('retaliation', 'Vendetta') + mm('dread', 'Dread') +
      meter('reputation', 'Standing', m.reputation, nextRep, m.reputation + (s.rank < CF.TOP_RANK || s.calling === 'commissioner' ? '/' + nextRep : ''));
    $('#rank').textContent = tr(s.detective + (s.who && CF.ORIGINS[s.who] ? ', ' + CF.ORIGINS[s.who].label.toLowerCase() : '') + (s.flags.callingOpen ? '' : ' · ' + CF.CALLINGS[s.calling].label.replace('The ', '')));
    $('#rank-badge').style.backgroundImage = art(RANK_ART[((CF.RANK_DEFS[s.rank] || {}).badge || 1) - 1] || 'cwax-01');
    $('#rank-badge').title = tr(CF.RANKS[s.rank]);
    if (UI.lastRank !== undefined && s.rank > UI.lastRank && UI.onPromotion) UI.onPromotion(s.rank);
    UI.lastRank = s.rank;
    updateWeekBar();
  }

  function aspectChip(k, v) {
    var b = h('span', 'chip');
    b.title = tr(CF.ASPECTS[k].label);
    var i = h('span', 'chip-icon');
    i.style.backgroundImage = art(ASPECT_ART[k] || 'aspect-' + k);
    b.appendChild(i);
    b.appendChild(h('span', null, String(v)));
    return b;
  }

  // ---------------------------------------------------------------- Cards
  function caseTitle(card) {
    var rec = card.caseId && UI.e.caseRec(card.caseId);
    return rec ? rec.title : '';
  }

  // The few words on the face of a card. The full label and the exposition
  // live in the dossier: a person's card is their name, a token's card is
  // what kind of token it is, a case's card is the crime.
  // The seal beside the kind of card in the dossier (a wax seal or a square icon from the deck).
  var KIND_ART = { case: 'cwax-01', coldcase: 'imark-06', witness: 'cwit-01', suspect: 'csus-01', informant: 'csus-02', clue: 'iinv-02', evidence: 'iinv-16',
    threat: 'imed-10', court: 'cwax-03', order: 'ilaw-05', career: 'ilaw-17', district: 'iinv-17', place: 'iplace-16', room: 'iplace-10', teammate: 'rrole-03', personnel: 'ilaw-11', hospital: 'imed-02',
    equipment: 'iinv-16', intel: 'cwit-01', criminal: 'csus-02', condemned: 'ilaw-06', calling: 'cwax-02', ability: 'cres-02', funds: 'itrade-20', health: 'imed-01', focus: 'cres-05', instinct: 'iinv-06',
    trial: 'cwax-03', atlarge: 'ilaw-18', rung: 'ilaw-01', sentence: 'ilaw-01', plea: 'ilaw-13', paper: 'ilaw-21', temptation: 'itrade-20', insight: 'imyst-05', fatigue: 'imed-13', burnout: 'imed-10', wound: 'imed-09' };
  var PERSONS = { witness: 1, suspect: 1, informant: 1, atlarge: 1, condemned: 1, teammate: 1, hospital: 1, injured: 1, personnel: 1 };
  var SHORTS = [
    [/^Word from /, 'A Word'], [/^Rumour from /, 'A Rumour'], [/^Sighting: |^Seen at /, 'A Sighting'], [/^Found at .*Lodging$/, 'The Lodging'],
    [/^Found at .*House$/, 'The House'], [/^Corroborated: /, 'Corroborated'], [/^Thread: /, 'A Thread'], [/^Blood Court: /, 'The Blood Court'],
    [/^Confession Under the Question: /, 'The Question'], [/^Unanswered: /, 'Unanswered'], [/^The Hand Matched: /, 'The Hand Matched'],
  ];
  function cardTitle(card) {
    var e = UI.e, def = CF.CARDS[card.def], label = e.labelOf(card);
    if (def.kind === 'case') { var rec = e.caseRec(card.caseId); return (rec && rec.highProfile ? '★ ' : '') + (rec ? rec.short : label); }
    for (var i = 0; i < SHORTS.length; i++) if (SHORTS[i][0].test(label)) return SHORTS[i][1];
    var at = label.indexOf(': ');
    if (at < 0) return label;
    var head = label.slice(0, at), tail = label.slice(at + 2);
    if (PERSONS[card.def]) return (head === 'Prime Suspect' ? '★ ' : '') + tail;
    if (card.def === 'order' || card.def === 'personnel' || def.kind === 'calling' || card.def === 'gang') return tail;
    return head;
  }
  UI.cardTitle = cardTitle;

  // What a card looks like; if this string changes the face is rebuilt.
  function cardSig(card, count) {
    return [card.def, UI.e.labelOf(card), JSON.stringify(card.aspects || ''), card.caseId || '', count, !!card.maxLife, !!card.hidden, card.data && card.data.trust, card.data && card.data.heat, card.data && card.data.mark ? 'm' : '',
      card.def === 'coldcase' ? card.data.template : ''].join('|');
  }

  // A card element: shadow cards underneath (for stacks) and the face.
  function buildCard(card, count, mini) {
    var n = h('div', 'card' + (mini ? ' mini' : '') + (card.hidden ? ' facedown' : ''));
    n.dataset.uid = card.uid;
    fillCard(n, card, count);
    return n;
  }

  function fillCard(n, card, count) {
    var e = UI.e;
    var def = CF.CARDS[card.def];
    var kind = CF.KINDS[def.kind] || { label: def.kind };
    var pic = cardPicture(card);
    n.dataset.sig = cardSig(card, count);
    n.dataset.uid = card.uid;
    n.classList.toggle('facedown', !!card.hidden);
    n.className = n.className.replace(/\b(kind|face|tone)-\S+/g, '').replace(/\bstack-\d\b|\bbanded\b/g, '').trim() +
      ' kind-' + def.kind + ' face-' + pic.fam + ' tone-' + pic.tone + (pic.banded ? ' banded' : '') + (count > 1 ? ' stack-' + Math.min(3, count) : '');
    n.innerHTML = '';
    for (var i = Math.min(2, count - 1); i > 0; i--) {
      var u = h('div', 'c-under u' + i);
      u.style.setProperty('--pic', art(pic.art));
      n.appendChild(u);
    }
    var face = h('div', 'c-face' + (pic.gray ? ' gray' : ''));
    face.style.setProperty('--pic', art(pic.art));
    var body = h('div', 'c-body');
    var band = null;
    body.appendChild(h('div', 'c-title', cardTitle(card)));
    void kind;
    var asp = h('div', 'c-aspects');
    var a = CF.aspectsOf(card);
    CF.CLUE_ASPECTS.forEach(function (k) { if (a[k]) asp.appendChild(aspectChip(k, a[k])); });
    var into = band || body;
    if (asp.children.length) into.appendChild(asp);
    if (card.def === 'informant') {
      var st = h('div', 'c-stats');
      st.innerHTML = '<span class="c-stat trust" title="' + esc(tr('Trust {n} of 3', { n: card.data.trust || 0 })) + '"><i style="background-image:' + art('crel-02') + '"></i>' + (card.data.trust || 0) + '</span>' +
        '<span class="c-stat heat" title="' + esc(tr('Heat {n} of {max}', { n: card.data.heat || 0, max: CF.INFORMANT.compromisedAt })) + '"><i style="background-image:' + art('icrime-24') + '"></i>' + (card.data.heat || 0) + '</span>';
      into.appendChild(st);
    }
    if (card.maxLife) {
      n.classList.add('timed');
      n.insertAdjacentHTML('afterbegin', '<svg class="c-ringsvg" viewBox="0 0 128 180"><rect class="track" x="3" y="3" width="122" height="174" rx="12" /><rect x="3" y="3" width="122" height="174" rx="12" /></svg>');
      var tm = h('div', 'c-time', U.fmtTime(card.life));
      face.appendChild(tm);
    }
    if (band) face.appendChild(band);
    face.appendChild(body);
    if (def.kind === 'case' || def.kind === 'coldcase') {
      var crec2 = def.kind === 'case' ? e.caseRec(card.caseId) : { template: card.data.template };
      var seal = h('div', 'c-seal');
      seal.style.backgroundImage = art((CASE_ART[crec2 && crec2.template] || CASE_DEFAULT)[1]);
      face.appendChild(seal);
    }
    n.appendChild(face);
    if (card.data && card.data.mark) { var pin = h('div', 'c-pin'); pin.title = tr('Marked: yours to remember'); pin.style.backgroundImage = art('cmark-03'); n.appendChild(pin); }
    if (count > 1) n.appendChild(h('div', 'c-count', '×' + count));
    updateCardLive(n, card);
  }

  var CARD_RING_LEN = 2 * (122 + 174) - 8 * 12 + 2 * Math.PI * 12;
  function updateCardLive(n, card) {
    if (!card || !card.maxLife) return;
    var t = n.querySelector('.c-timer');
    if (t) t.textContent = tr(U.fmtTime(card.life));
    var ct = n.querySelector('.c-time');
    if (ct) ct.textContent = U.fmtTime(card.life);
    var pct = Math.max(0, Math.min(1, card.life / card.maxLife));
    var ring = n.querySelector('.c-ringsvg rect:not(.track)');
    if (ring) ring.style.strokeDasharray = (pct * CARD_RING_LEN) + ' ' + CARD_RING_LEN;
    n.style.setProperty('--pct', (pct * 100).toFixed(1) + '%');
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
    var e = UI.e, cards = e.tableCards();
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    cards.forEach(function (c) { x0 = Math.min(x0, c.loc.x); y0 = Math.min(y0, c.loc.y); x1 = Math.max(x1, c.loc.x + T.CW); y1 = Math.max(y1, c.loc.y + T.CH); });
    CF.VERB_ORDER.forEach(function (id) { var v = e.verb(id); if (!v.unlocked || v.x === undefined) return; x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x + T.VW); y1 = Math.max(y1, v.y + T.VH); });
    var pile = e.pile();
    x0 = Math.min(x0, pile.x); y0 = Math.min(y0, pile.y); x1 = Math.max(x1, pile.x + T.PILE_COLS * T.PX); y1 = Math.max(y1, pile.y + T.CH);
    if (!cards.length) { x0 = 0; y0 = T.TOP; x1 = 4 * (T.CW + T.GAP); y1 = T.TOP + T.CH; }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Fit the whole board into the table area.
  UI.fitView = function () {
    if (!UI.e) return;
    var r = $('#table').getBoundingClientRect();
    var b = boardBounds();
    var dockH = 0;
    // Fit what is on the table, and lean in when there is little of it.
    var z = U.clamp(Math.min((r.width - 60) / b.w, (r.height - dockH - 60) / b.h), 0.5, 1.25);
    UI.view = { x: (r.width - b.w * z) / 2 - b.x * z, y: dockH + Math.max(20, (r.height - dockH - b.h * z) / 2) - b.y * z, z: z };
    applyView();
  };

  // ---- Table tools: stack like cards, tidy everything, and undo either.
  function rememberTable() { UI.tidyUndo = UI.e.snapshotTable(); renderTools(); }
  function renderTools() {
    var b = $('#zoom [data-tool=undo]');
    if (b) b.classList.toggle('hidden', !UI.tidyUndo);
  }
  // Every finished verb gives up its cards.
  // Collect: turn over what is face down first; the next press takes it all.
  UI.collectAll = function () {
    var e = UI.e, n = 0, turned = 0;
    CF.VERB_ORDER.forEach(function (vid) {
      var v = e.verb(vid);
      if (v.status !== 'done') return;
      collectAll(vid); n++;
    });
    if (!n && !turned) toast({ title: 'Nothing waiting', text: 'No verb has finished.', kind: 'minor' });
  };
  UI.stackAll = function () {
    if (!UI.e || UI.drag) return;
    var e = UI.e, before = e.snapshotTable();
    var moved = e.mergeStacks();
    if (!moved.length) { toast({ title: 'Nothing to stack', text: 'Every like card is already together.', kind: 'minor' }); return; }
    UI.tidyUndo = before;
    renderTools();
    syncBoard();
    // The stacks that grew glow for a moment, so the eye can find them.
    var homes = {};
    moved.forEach(function (u) { var c = e.card(u); if (c && c.loc) homes[c.loc.x + ',' + c.loc.y] = true; });
    Object.keys(cardEls).forEach(function (uid) {
      var c = e.card(+uid);
      if (c && c.loc && homes[c.loc.x + ',' + c.loc.y]) {
        cardEls[uid].classList.add('merged');
        setTimeout(function () { cardEls[uid] && cardEls[uid].classList.remove('merged'); }, 1000);
      }
    });
    CF.Audio.play('drop');
  };
  UI.tidy = function () {
    if (!UI.e || UI.drag) return;
    rememberTable();
    UI.e.tidy();
    UI.fitView();
    CF.Audio.play('drop');
  };
  UI.undoTidy = function () {
    if (!UI.e || !UI.tidyUndo || UI.drag) return;
    UI.e.restoreTable(UI.tidyUndo);
    UI.tidyUndo = null;
    renderTools();
    clampView(); applyView();
    CF.Audio.play('drop');
  };

  // Bring a card into the middle of the view (and pick it up in the dossier).
  UI.panTo = function (uid) {
    var e = UI.e, c = e && e.card(uid);
    if (!c || !c.loc || c.loc.t !== 'table') return false;
    var r = $('#table').getBoundingClientRect(), v = UI.view;
    if (v.z < 0.9) v.z = 1;
    var dockH = 0;
    v.x = r.width / 2 - (c.loc.x + T.CW / 2) * v.z;
    v.y = dockH + (r.height - dockH) / 2 - (c.loc.y + T.CH / 2) * v.z;
    clampView(); applyView();
    select(uid);
    return true;
  };

  // The keyboard's Begin: start the top window's recipe, or collect its results.
  function goTopWindow() {
    var vid = UI.openVerbs[UI.openVerbs.length - 1];
    if (!vid) return;
    var e = UI.e, v = e.verb(vid);
    if (v.status === 'done') {
      if (v.out.some(function (u) { var c = e.card(u); return c && c.hidden; })) revealAll(vid); else collectAll(vid);
      return;
    }
    if (v.status === 'idle' && e.start(vid)) { CF.Audio.play('start'); e.dirty = true; }
  }

  function zoomAt(cx, cy, factor) {
    var r = $('#table').getBoundingClientRect();
    var v = UI.view, z = U.clamp(v.z * factor, 0.4, 1.6);
    var pp = toPlane(cx - r.left, cy - r.top), px = pp.x, py = pp.y;
    v.x = px - (px - v.x) * (z / v.z);
    v.y = py - (py - v.y) * (z / v.z);
    v.z = z;
    clampView();
    applyView();
  }

  // Never let the whole board leave the table area: some of it stays in view.
  function clampView() {
    if (!UI.e) return;
    var r = $('#table').getBoundingClientRect(), v = UI.view, b = boardBounds();
    var margin = 80, dockH = 0;
    v.x = U.clamp(v.x, margin - (b.x + b.w) * v.z, r.width - margin - b.x * v.z);
    v.y = U.clamp(v.y, dockH + margin - (b.y + b.h) * v.z, r.height - margin - b.y * v.z);
  }

  // The table plane is tilted (css: #tilt rotateX under #table's perspective),
  // so a screen point maps to the plane through the inverse of that
  // projection: the same 4x4 matrix the browser builds from the stylesheet.
  var tiltM = null, tiltKey = '';
  function mat4mul(a, b) {
    var o = [];
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var v = 0; for (var k = 0; k < 4; k++) v += a[i * 4 + k] * b[k * 4 + j]; o[i * 4 + j] = v; }
    return o;
  }
  function translate(x, y, z) { return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1]; }
  function tiltMatrix() {
    var t = $('#table'), r = t.getBoundingClientRect();
    var cs = getComputedStyle(t);
    var key = r.width + 'x' + r.height + cs.perspective + cs.perspectiveOrigin + getComputedStyle($('#tilt')).transform;
    if (tiltM && key === tiltKey) return tiltM;
    tiltKey = key;
    var d = parseFloat(cs.perspective);
    var po = cs.perspectiveOrigin.split(' ').map(parseFloat);
    var ts = getComputedStyle($('#tilt')), to = ts.transformOrigin.split(' ').map(parseFloat);
    var m = ts.transform.match(/matrix3d\(([^)]*)\)/);
    var R;
    if (m) {
      var v = m[1].split(',').map(parseFloat); // column-major
      R = [v[0], v[4], v[8], v[12], v[1], v[5], v[9], v[13], v[2], v[6], v[10], v[14], v[3], v[7], v[11], v[15]];
    } else R = translate(0, 0, 0);
    var P = isFinite(d) && d > 0 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / d, 1] : translate(0, 0, 0);
    tiltM = mat4mul(translate(po[0], po[1], 0), mat4mul(P, mat4mul(translate(-po[0], -po[1], 0), mat4mul(translate(to[0], to[1], 0), mat4mul(R, translate(-to[0], -to[1], 0))))));
    return tiltM;
  }
  // Screen (relative to the table) -> point on the tilted plane.
  function toPlane(sx, sy) {
    var m = tiltMatrix();
    var a = m[0] - sx * m[12], b = m[1] - sx * m[13], c = sx * m[15] - m[3];
    var d = m[4] - sy * m[12], e2 = m[5] - sy * m[13], f = sy * m[15] - m[7];
    var det = a * e2 - b * d;
    if (Math.abs(det) < 1e-9) return { x: sx, y: sy };
    return { x: (c * e2 - b * f) / det, y: (a * f - c * d) / det };
  }
  // Point on the plane -> screen (relative to the table).
  function fromPlane(px, py) {
    var m = tiltMatrix();
    var w = m[12] * px + m[13] * py + m[15];
    return { x: (m[0] * px + m[1] * py + m[3]) / w, y: (m[4] * px + m[5] * py + m[7]) / w };
  }
  UI.toPlane = toPlane; UI.fromPlane = fromPlane;
  function toBoard(cx, cy) {
    var r = $('#table').getBoundingClientRect();
    var p = toPlane(cx - r.left, cy - r.top);
    return { x: (p.x - UI.view.x) / UI.view.z, y: (p.y - UI.view.y) / UI.view.z };
  }

  function place(el, x, y) { el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)'; }

  // Keep one element per stack on the board, moving (not rebuilding) them.
  function syncPile() {
    var e = UI.e, board = $('#board'), pile = e.pile();
    if (!pileEl) {
      pileEl = h('div', 'pile-zone');
      pileEl.title = tr('The collection pile: new cards land here. Drag it anywhere.');
      pileEl.style.width = (T.PILE_COLS * T.PX + 4) + 'px';
      pileEl.style.height = (T.CH + 16) + 'px';
      pileEl.appendChild(h('span', 'pz-label', 'New cards'));
      board.appendChild(pileEl);
    }
    if (!(UI.drag && UI.drag.kind === 'pile')) place(pileEl, pile.x - 9, pile.y - 8);
  }
  // Glide the camera to a point on the board.
  // A notice: a pulse on something worth a look, or, when it is off the
  // screen, a marker at the table's edge pointing to it. Tapping it goes there.
  UI.notices = [];
  UI.notice = function (spec) {
    setTimeout(function () {
      var el = spec.verb ? verbEls[spec.verb] : spec.uid ? cardEls[spec.uid] : null;
      if (!el) return;
      el.classList.add('noticed');
      setTimeout(function () { el.classList.remove('noticed'); }, 4000);
      var mark = h('div', 'edge-mark');
      var flag = spec.verb ? 'cmark-04' : spec.kind === 'case' ? 'cmark-03' : spec.kind === 'insight' ? 'cmark-05' : spec.kind === 'place' ? 'ctab-03' : 'cmark-04';
      mark.innerHTML = '<b style="background-image:' + art(flag) + '"></b><span>' + esc(spec.label || '') + '</span>';
      mark.addEventListener('click', function () {
        if (spec.uid) UI.panTo(spec.uid);
        else if (spec.verb) { var v = UI.e.s.verbs[spec.verb]; panToBoard(v.x, v.y, T.VW, T.VH); }
        removeMark(mark);
      });
      $('#table').appendChild(mark);
      var entry = { el: el, mark: mark, until: performance.now() + 12000 };
      UI.notices.push(entry);
      placeMark(entry);
    }, spec.fresh ? 450 : 50);
  };
  function removeMark(mark) { mark.remove(); UI.notices = UI.notices.filter(function (n) { return n.mark !== mark; }); }
  function placeMark(n) {
    var tr2 = $('#table').getBoundingClientRect(), r = n.el.getBoundingClientRect();
    var cx = r.left + r.width / 2 - tr2.left, cy = r.top + r.height / 2 - tr2.top;
    var inside = cx > 0 && cx < tr2.width && cy > 0 && cy < tr2.height;
    n.mark.classList.toggle('hidden', inside);
    if (inside) return;
    var mx = Math.max(24, Math.min(tr2.width - 24, cx)), my = Math.max(80, Math.min(tr2.height - 90, cy));
    n.mark.style.left = mx + 'px'; n.mark.style.top = my + 'px';
    n.mark.style.setProperty('--ang', (Math.atan2(cy - my, cx - mx) * 180 / Math.PI) + 'deg');
  }
  function updateNotices() {
    var now = performance.now();
    UI.notices.slice().forEach(function (n) {
      if (now > n.until || !n.el.isConnected) { removeMark(n.mark); return; }
      placeMark(n);
    });
  }
  // Glide the view to an exact position and zoom.
  function tweenView(to, done) {
    var v = UI.view, from = { x: v.x, y: v.y, z: v.z }, t0 = null;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 600), ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.x = from.x + (to.x - from.x) * ease; v.y = from.y + (to.y - from.y) * ease; v.z = from.z + (to.z - from.z) * ease;
      applyView();
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }
  function panToBoard(x, y, w, h, done) {
    var r = $('#table').getBoundingClientRect(), v = UI.view;
    var z = Math.max(v.z, 0.95);
    var tx = r.width / 2 - (x + w / 2) * z, ty = r.height / 2 - (y + h / 2) * z;
    var from = { x: v.x, y: v.y, z: v.z }, t0 = null;
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 650), ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.x = from.x + (tx - from.x) * ease; v.y = from.y + (ty - from.y) * ease; v.z = from.z + (z - from.z) * ease;
      applyView();
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }
  var choiceEl = null;
  function syncChoice() {
    var e = UI.e, board = $('#board'), c = e.s.choice;
    if (!c) { if (choiceEl) { choiceEl.classList.add('gone'); var old = choiceEl; setTimeout(function () { old.remove(); }, 300); choiceEl = null; } return; }
    if (choiceEl && choiceEl.dataset.id === c.id) {
      choiceEl.querySelectorAll('.ch-opt').forEach(function (b, i) { b.classList.toggle('cant', !e.canChoose(i)); });
      return;
    }
    if (choiceEl) choiceEl.remove();
    var spot = e.choiceSpot();
    var el = h('div', 'choice');
    el.dataset.id = c.id;
    el.innerHTML = '<div class="ch-title">' + esc(c.title) + '</div><p class="ch-text">' + esc(c.text) + '</p>';
    var opts = h('div', 'ch-options');
    c.options.forEach(function (o, i) {
      var b = h('button', 'ch-opt' + (e.canChoose(i) ? '' : ' cant'));
      var cost = o.cost ? '<i class="ch-cost" style="background-image:' + art(ASK_ART[o.cost] || 'itrade-20') + '" title="' + esc(tr('Takes {card}', { card: CF.CARDS[o.cost].label })) + '"></i>' : '';
      b.innerHTML = cost + '<b>' + esc(o.label) + '</b><span>' + esc(o.text) + (o.cost ? ' <em>' + esc(tr('Takes {card}.', { card: CF.CARDS[o.cost].label })) + '</em>' : '') + '</span>' + (o.gain ? '<span class="ch-gain">' + esc(tr(o.gain)) + '</span>' : '');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (e.choose(i)) { CF.Audio.play('drop'); UI.haptic(15); e.dirty = true; } else if (o.cost) toast({ title: 'You cannot pay for that', text: tr('It takes {card}, and there is none on the table.', { card: CF.CARDS[o.cost].label }), kind: 'minor' }); });
      opts.appendChild(b);
    });
    el.appendChild(opts);
    el.appendChild(h('div', 'ch-note', 'The clock waits for your answer.'));
    place(el, spot.x, spot.y);
    board.appendChild(el);
    choiceEl = el;
  }
  // ---- Case strings: a rope from a case card to every card that belongs
  // to it, pinned at both ends, in the case's own colour. Cards inside a verb
  // are tied to the verb's token; a card being dragged pulls its string along.
  var LINK_COLORS = ['#d0342c', '#3aa76d', '#3b7fd1', '#e0b64a', '#b45cd6', '#e0783a'];
  var linkEl = null, pinEl = null;
  function linkPoint(c, drag) {
    var e = UI.e;
    if (drag && drag.uids && drag.uids.indexOf(c.uid) >= 0 && drag.lastEv) {
      var p = toBoard(drag.lastEv.clientX, drag.lastEv.clientY);
      return { x: p.x - drag.gx + T.CW / 2, y: p.y - drag.gy + 12, held: true };
    }
    if (!c.loc) return null;
    if (c.loc.t === 'table') return { x: c.loc.x + T.CW / 2, y: c.loc.y + 12 };
    if (c.loc.verb && e.s.verbs[c.loc.verb]) { var v = e.s.verbs[c.loc.verb]; return { x: v.x + T.VW / 2, y: v.y + 8 }; }
    return null;
  }
  function svgLayer(cls, before) {
    var board = $('#board'), B = T.BOUNDS;
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', cls);
    el.setAttribute('viewBox', B.x + ' ' + B.y + ' ' + B.w + ' ' + B.h);
    el.style.left = B.x + 'px'; el.style.top = B.y + 'px'; el.style.width = B.w + 'px'; el.style.height = B.h + 'px';
    if (before) board.insertBefore(el, before); else board.appendChild(el);
    return el;
  }
  function syncLinks() {
    var e = UI.e, board = $('#board');
    if (!linkEl || linkEl.parentNode !== board) {
      var grid = board.querySelector('.grid');
      linkEl = svgLayer('links', grid ? grid.nextSibling : board.firstChild);
    }
    if (!pinEl || pinEl.parentNode !== board) pinEl = svgLayer('links pins', null);
    board.appendChild(pinEl); // the pins stay above the cards
    if (CF.Settings.get('strings') === false) { linkEl.innerHTML = ''; pinEl.innerHTML = ''; return; }
    var drag = UI.drag && UI.drag.kind === 'card' && UI.drag.started ? UI.drag : null;
    var cases = {}, order = [];
    Object.keys(e.s.cards).forEach(function (uid) {
      var c = e.s.cards[uid], k = CF.CARDS[c.def].kind;
      if (!c.caseId || c.hidden) return;
      if (k === 'case' || k === 'coldcase') { cases[c.caseId] = cases[c.caseId] || { card: c, kids: [] }; cases[c.caseId].card = c; }
      else if (k === 'clue' || k === 'evidence' || k === 'witness' || k === 'suspect' || k === 'condemned' || c.def === 'atlarge' || c.def === 'trial' || c.def === 'thread') {
        (cases[c.caseId] = cases[c.caseId] || { card: null, kids: [] }).kids.push(c);
      }
    });
    Object.keys(e.s.cases).forEach(function (id) { order.push(id); });
    var html = '', pins = '';
    function pin(pt, col, r) {
      // A card in hand carries its pin with it (it is drawn in the drag layer's place).
      if (pt.held) return '';
      return '<circle class="pin" cx="' + pt.x.toFixed(0) + '" cy="' + pt.y.toFixed(0) + '" r="' + r + '" fill="' + col + '"/><circle class="pin-hi" cx="' + (pt.x - r / 3).toFixed(0) + '" cy="' + (pt.y - r / 3).toFixed(0) + '" r="' + (r / 3) + '"/>';
    }
    Object.keys(cases).forEach(function (id) {
      var g = cases[id];
      if (!g.card || !g.kids.length) return;
      var a = linkPoint(g.card, drag);
      if (!a) return;
      var col = LINK_COLORS[order.indexOf(id) >= 0 ? order.indexOf(id) % LINK_COLORS.length : 0];
      var any = false;
      g.kids.forEach(function (c) {
        var b = linkPoint(c, drag);
        if (!b || (b.x === a.x && b.y === a.y)) return;
        any = true;
        // A rope sags between its pins.
        var mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + Math.min(40, Math.abs(b.x - a.x) * 0.1 + 14);
        html += '<path d="M' + a.x.toFixed(0) + ' ' + a.y.toFixed(0) + ' Q' + mx.toFixed(0) + ' ' + my.toFixed(0) + ' ' + b.x.toFixed(0) + ' ' + b.y.toFixed(0) + '" stroke="' + col + '"/>';
        pins += pin(b, col, 6);
      });
      if (any) pins += pin(a, col, 7);
    });
    if (linkEl.__html !== html) { linkEl.innerHTML = html; linkEl.__html = html; }
    if (pinEl.__html !== pins) { pinEl.innerHTML = pins; pinEl.__html = pins; }
  }
  UI.syncLinks = syncLinks;

  function syncBoard() {
    var e = UI.e, board = $('#board');
    syncPile();
    syncChoice();
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
    if (vid === 'time') return 'Pay in ' + U.fmtTime(Math.max(0, CF.WEEK - e.s.weekT));
    if (v.status === 'running') return U.fmtTime(v.duration - v.elapsed);
    if (v.status === 'done') return 'Ready';
    if (e.lockReason(vid)) return 'Locked';
    var n = Object.keys(v.slots).length;
    return n ? n + ' card' + (n > 1 ? 's' : '') : '';
  }

  // The verbs are tokens on the felt, movable like cards. A new verb takes
  // the first free place along the top row.
  function syncVerbs() {
    var e = UI.e, board = $('#board');
    if (CF.VERB_ORDER.some(function (id) { var v = e.verb(id); return v.unlocked && v.x === undefined; })) e.layoutVerbs();
    CF.VERB_ORDER.forEach(function (vid) {
      var v = e.verb(vid), el = verbEls[vid], def = CF.VERBS[vid];
      if (!v.unlocked) { if (el) { el.remove(); delete verbEls[vid]; } return; }
      if (!el) {
        el = h('div', 'verb ' + vid + (def.auto ? ' time' : ''));
        el.dataset.verb = vid;
        el.title = tr(def.label + ': ' + def.desc);
        var tok = h('div', 'v-token');
        tok.style.backgroundImage = art(VERB_TOKENS[vid] || 'cvtok-investigate');
        tok.insertAdjacentHTML('beforeend', '<svg class="v-ring" viewBox="0 0 248 248"><rect class="track" x="4" y="4" width="240" height="240" rx="20" /><rect x="4" y="4" width="240" height="240" rx="20" /></svg>');
        if (vid === 'time') tok.appendChild(h('div', 'v-week', 'Wk ' + e.s.week));
        tok.appendChild(h('div', 'v-plate' + (def.label.length > 9 ? ' long' : ''), def.label));
        el.appendChild(tok);
        el.appendChild(h('div', 'v-status'));
        el.appendChild(h('div', 'v-badge', '!'));
        el.appendChild(h('div', 'v-count'));
        el.appendChild(h('div', 'v-back'));
        var mag = h('div', 'v-magnet');
        mag.title = tr(vid === 'time' ? 'Dues: what the Bell draws from the table each week' : 'Magnet: pull in the cards this verb\'s open slots take');
        el.appendChild(mag);
        place(el, v.x, v.y);
        board.appendChild(el);
        verbEls[vid] = el;
        if (!UI.seenVerbs[vid]) { UI.seenVerbs[vid] = true; el.classList.add('new'); }
      }
      if (!(UI.drag && UI.drag.verb === vid)) place(el, v.x, v.y);
      var n = Object.keys(v.slots).length;
      el.classList.toggle('running', v.status === 'running');
      el.classList.toggle('done', v.status === 'done');
      el.classList.toggle('open', UI.openVerbs.indexOf(vid) >= 0);
      el.classList.toggle('locked', !!e.lockReason(vid) && v.status === 'idle');
      el.classList.toggle('loaded', v.status === 'idle' && n > 0);
      el.querySelector('.v-count').textContent = tr(n || '');
      // The token's small box: hidden until the verb, part-way through its
      // work, asks for one more card. It shows what kind, and a tap pulls a
      // fitting card in from the table. The Bell's shows the dues when due.
      var mag = el.querySelector('.v-magnet');
      if (vid === 'time') { mag.textContent = String(e.dues()); mag.classList.toggle('due', e.dues() > CF.ECONOMY.rent || CF.WEEK - e.s.weekT <= 10); }
      else {
        var ask = v.status === 'running' && v.ask && !v.ask.filled ? v.ask : null;
        mag.classList.toggle('asks', !!ask);
        mag.style.backgroundImage = ask ? art(ASK_ART[ask.accepts[0]] || 'iinv-05') : '';
        mag.textContent = '';
        mag.title = tr(ask ? ask.label + ': ' + ask.text : '');
        el.classList.toggle('asking', !!ask);
      }
      el.querySelector('.v-badge').textContent = tr(v.status === 'done' && v.out.length ? String(v.out.length) : '!');
    });
  }

  // A card flies from where it is to a target element and vanishes into it.
  function flyTo(fromEl, toEl, card) {
    if (!fromEl || !toEl) return;
    var r = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
    var ghost = buildCard(card, 1);
    ghost.classList.add('ghost');
    ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
    ghost.style.transformOrigin = '0 0';
    ghost.style.transform = 'scale(' + (r.width / T.CW) + ')';
    $('#drag-layer').appendChild(ghost);
    void ghost.offsetWidth;
    ghost.style.left = (t.left + t.width / 2 - T.CW * 0.15) + 'px'; ghost.style.top = (t.top + t.height / 2 - T.CH * 0.15) + 'px';
    ghost.style.transform = 'scale(0.3) rotate(12deg)';
    ghost.style.opacity = '0.2';
    setTimeout(function () { ghost.remove(); }, 380);
  }
  // Answer a verb's mid-work ask with the first fitting card on the table.
  UI.answerAsk = function (vid, uid) {
    var e = UI.e, tok = verbEls[vid];
    var card = uid ? e.card(uid) : e.askCandidates(vid)[0];
    if (!card) { toast({ title: 'Nothing fits', text: 'No card on the table answers what ' + CF.VERBS[vid].label + ' asks for.', kind: 'minor' }); return false; }
    var el = cardEls[uid || card.uid] || cardEls[e.stackOf(card)[0].uid];
    if (!e.answerAsk(vid, card.uid)) return false;
    if (el && tok) { flyTo(el, tok, card); if (e.stackOf(card).length === 0 && cardEls[card.uid]) { cardEls[card.uid].remove(); delete cardEls[card.uid]; } }
    CF.Audio.play('drop');
    e.dirty = true;
    return true;
  };
  // The magnet: the verb pulls in what its open slots take, and opens.
  UI.magnet = function (vid) {
    var e = UI.e, tok = verbEls[vid];
    var pulled = e.magnet(vid);
    if (!pulled.length) { toast({ title: 'Nothing to pull', text: 'No card on the table fits this verb\'s open slots.', kind: 'minor' }); return; }
    pulled.forEach(function (it) { var el = cardEls[it.uid]; var c = e.card(it.uid); if (el && c) { flyTo(el, tok, c); el.remove(); delete cardEls[it.uid]; } });
    CF.Audio.play('drop');
    openWindow(vid);
    e.dirty = true;
  };

  function updateVerbRings() {
    var e = UI.e;
    Object.keys(verbEls).forEach(function (vid) {
      var el = verbEls[vid], v = e.verb(vid);
      var pct = vid === 'time' ? e.s.weekT / CF.WEEK : v.status === 'running' ? v.elapsed / v.duration : v.status === 'done' ? 1 : 0;
      var ring = el.querySelector('.v-ring rect:not(.track)');
      ring.style.strokeDasharray = (Math.min(1, pct) * RING_LEN) + ' ' + RING_LEN;
      el.querySelector('.v-status').textContent = tr(verbStatus(vid));
      var wk = el.querySelector('.v-week');
      if (wk) { wk.textContent = tr('Wk {n}', { n: e.s.week }); el.querySelector('.v-magnet').classList.toggle('due', e.dues() > CF.ECONOMY.rent || CF.WEEK - e.s.weekT <= 10); }
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
    if (!UI.drag) renderHint();
    advanceTyping();
    if (UI.notices.length) updateNotices();
    // The dossier's clock, and the card pictured in it.
    var peekUid = UI.hover || UI.selected, peekCard = peekUid && e.card(peekUid);
    if (peekCard && peekCard.maxLife) {
      var pt = $('#peek .i-time'); if (pt) pt.textContent = tr('Time left: {t}', { t: U.fmtTime(peekCard.life) });
      var pc = $('#peek .i-card .card'); if (pc) updateCardLive(pc, peekCard);
    }
    updateVerbRings();
    for (var i = 0; i < liveCards.length; i++) updateCardLive(liveCards[i][0], e.card(liveCards[i][1]));
    UI.openVerbs.forEach(function (vid) {
      var w = winEls[vid], v = e.verb(vid);
      if (!w) return;
      if (v.status === 'running') {
        var pr = w.querySelector('.progress > div');
        if (pr) pr.style.width = (v.elapsed / v.duration) * 100 + '%';
        var tl = w.querySelector('.p-time');
        if (tl) tl.textContent = tr(U.fmtTime(v.duration - v.elapsed) + ' remaining');
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
    UI.openVerbs.slice().forEach(function (o) { if (o !== vid) closeWindow(o); });
    var i = UI.openVerbs.indexOf(vid);
    if (i >= 0) UI.openVerbs.splice(i, 1);
    UI.openVerbs.push(vid);
    if (verbEls[vid]) verbEls[vid].classList.remove('new');
    UI.e.dirty = true;
  }
  function closeWindow(vid) {
    var e = UI.e;
    // Whatever the verb found stays in it, face down, until it is looked at;
    // cards in its slots stay put, and the token counts them.
    UI.openVerbs = UI.openVerbs.filter(function (x) { return x !== vid; });
    UI.hoverSlot = null;
    if (UI.pick && UI.pick.verb === vid) UI.pick = null;
    e.dirty = true;
  }
  function closeAllWindows() { UI.openVerbs.slice().forEach(closeWindow); }
  UI.openWindow = openWindow;

  function windowSig(vid) {
    var e = UI.e, v = e.verb(vid), pv = v.status === 'idle' ? e.preview(vid) : null;
    // The finds' face-down state is part of it, so a turned card redraws (with its flip) at once.
    return [v.status, JSON.stringify(v.slots), v.out.map(function (u) { var c = e.card(u); return u + (c && c.hidden ? 'h' : ''); }).join(','), v.held.join(','), v.story ? v.story.title : '', v.ask ? (v.ask.filled || 'open') : '',
      pv ? pv.label + '|' + pv.blocked + '|' + pv.text : '', e.lockReason(vid) || '', v.recipe || '',
      vid === 'time' ? e.s.week : '', UI.pick && UI.pick.verb === vid ? UI.pick.slot + ':' + e.tableCards().length : '', UI.about === vid ? 'about' : ''].join('#');
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
        w.innerHTML = '<div class="vw-head"><div class="vw-icon"></div><h3></h3><button class="vw-info" title="' + esc('What this verb does') + '">i</button><button class="vw-close" title="' + esc('Close (Esc)') + '">×</button></div><div class="divider"></div><div class="vw-body"></div>';
        w.querySelector('.vw-info').addEventListener('click', function (ev) { ev.stopPropagation(); UI.about = UI.about === vid ? null : vid; UI.e.dirty = true; });
        w.querySelector('.vw-icon').style.backgroundImage = art(VERB_TOKENS[vid] || 'cvtok-investigate');
        w.querySelector('h3').textContent = tr(CF.VERBS[vid].label);
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

  // The window stands at the side of the table, fitted to it.
  function positionWindow(vid, w) { void vid; w.classList.add('docked'); }

  function miniCard(card) {
    var mc = miniCard0(card);
    // The flip plays on the wrapper: the card inside keeps its mini scale.
    if (UI.flipIn[card.uid]) { mc.classList.add('flip-in'); delete UI.flipIn[card.uid]; }
    return mc;
  }
  function miniCard0(card) {
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
      pane.appendChild(h('p', 'vw-desc', 'Coin on the table: ' + money + '. Every week the Council pays ' + ((CF.RANK_DEFS[e.s.rank] || {}).salary || 1) + ' in stipend and the Bell draws ' + e.dues() + ' in dues (lodging ' + CF.ECONOMY.rent + (e.dues() > CF.ECONOMY.rent ? ', and ' + (e.dues() - CF.ECONOMY.rent) + ' for the watchmen you keep' : '') + '); miss it and you sleep on the Watch-house bench.'));
      var needs = e.tableCards().filter(function (c) { return CF.NEEDS && CF.NEEDS[c.def]; }).sort(function (a, b) { return a.life - b.life; });
      if (needs.length) {
        pane.appendChild(h('p', 'vw-desc', 'On your back: deal with these in Rest before their clocks run out.'));
        needs.forEach(function (nc) {
          var nrow = h('div', 'clock' + (nc.life < 30 ? ' urgent' : ''));
          nrow.innerHTML = '<span class="ck-title">' + esc(e.labelOf(nc)) + '</span><span class="ck-bar"><i style="width:' + Math.round((nc.life / nc.maxLife) * 100) + '%"></i></span><span class="ck-days">' + U.fmtTime(nc.life) + '</span>';
          nrow.addEventListener('click', function () { UI.panTo(nc.uid); });
          pane.appendChild(nrow);
        });
      }
      var rv = e.cardsOf('rival', true)[0];
      if (rv) pane.appendChild(h('p', 'vw-desc', 'The Provost\'s Examiner is in the city' + (rv.data.stalled >= e.s.week ? ', and lying low for now.' : '. Every week they act against you unless you act first.')));
      pane.appendChild(h('p', 'vw-desc', open.length ? 'Open cases, most urgent first.' : 'No open cases.'));
      open.forEach(function (rec) {
        var cc = e.caseCard(rec.id);
        if (!cc) return;
        var life = cc.life / cc.maxLife;
        var row = h('div', 'clock' + (cc.life < 60 ? ' urgent' : ''));
        row.innerHTML = '<span class="ck-title">' + esc(rec.title) + '</span><span class="ck-bar"><i style="width:' + Math.round(life * 100) + '%"></i></span>' +
          '<span class="ck-days">' + esc(CF.daysLeft(cc.life) === 1 ? tr('1 day') : tr('{n} days', { n: CF.daysLeft(cc.life) })) + '</span>';
        row.title = tr('Show this case on the table');
        row.addEventListener('click', function () { UI.panTo(cc.uid); });
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
      if (v.ask) {
        var ab = h('div', 'ask' + (v.ask.filled ? ' answered' : ''));
        ab.appendChild(h('div', 'ask-head', v.ask.label));
        ab.appendChild(h('p', null, v.ask.text));
        if (!v.ask.filled) {
          var cand = e.askCandidates(vid)[0];
          var ans = h('button', 'plate-btn gold', cand ? 'Answer with ' + cardTitle(cand) : 'Nothing on the table fits');
          ans.disabled = !cand;
          ans.addEventListener('click', function () { UI.answerAsk(vid); });
          ab.appendChild(ans);
          ab.appendChild(h('div', 'vw-desc', 'or drop a card on the token. Ignore it and the work finishes as it would have.'));
        } else ab.appendChild(h('div', 'vw-desc', 'Answered with ' + cardTitle(e.card(v.ask.filled)) + '.'));
        pane.appendChild(ab);
      }
      var held = h('div', 'held');
      v.held.forEach(function (u) { var c = e.card(u); if (c) held.appendChild(miniCard(c)); });
      pane.appendChild(held);
      return;
    }

    if (v.status === 'done') {
      if (v.story) pane.appendChild(storyBox(v.story));
      var outs = h('div', 'outputs');
      outs.dataset.verb = vid;
      var hiddenN = 0;
      v.out.forEach(function (u) { var c = e.card(u); if (c) { outs.appendChild(miniCard(c)); if (c.hidden) hiddenN++; } });
      pane.appendChild(outs);
      var act = h('div', 'actions');
      if (hiddenN) { var turn = h('button', 'plate-btn dark', 'Turn them over'); turn.addEventListener('click', function () { revealAll(vid); }); act.appendChild(turn); }
      var col = h('button', 'plate-btn gold', 'Take all');
      col.addEventListener('click', function () { collectAll(vid); });
      act.appendChild(col);
      act.appendChild(h('span', 'vw-desc', hiddenN ? 'tap a card to turn it; double-tap to take it' : 'tap a card to read it; double-tap to take it, or drag it out'));
      pane.appendChild(act);
      return;
    }

    // Idle.
    if (v.story) pane.appendChild(storyBox(v.story));
    var primaryCard = v.slots[e.primaryKey(vid)];
    if (UI.about === vid) {
      pane.appendChild(h('p', 'vw-desc vw-about', def.desc));
      var sr = e.s.stats.recipes || {};
      var ways = e.s.stats.ways || {};
      var known = (CF.RECIPES_BY_VERB[vid] || []).filter(function (r) { return sr[r.id] && (ways[r.id] || typeof r.label === 'string'); }).map(function (r) { return tr(ways[r.id] || r.label) + (sr[r.id] > 1 ? ' ×' + sr[r.id] : ''); });
      pane.appendChild(h('p', 'vw-desc vw-about', known.length ? tr('Ways you have found here: {list}.', { list: known.join(', ') }) : tr('You have not found a way here yet: put a card in and see what it offers.')));
    }
    var lock = e.lockReason(vid);
    var slots = h('div', 'slots');
    e.visibleSlots(vid).forEach(function (sl) {
      var s = h('div', 'slot' + (sl.primary ? ' primary' : ''));
      s.dataset.verb = vid;
      s.dataset.slot = sl.key;
      var box = h('div', 's-box');
      var uid = v.slots[sl.key];
      if (uid && e.card(uid)) box.appendChild(miniCard(e.card(uid)));
      else {
        // An empty slot, tapped, says what it takes and offers the cards that fit.
        box.classList.add('empty');
        box.title = tr('Pick a card for this slot');
        box.addEventListener('click', function () {
          var same = UI.pick && UI.pick.verb === vid && UI.pick.slot === sl.key;
          UI.pick = same ? null : { verb: vid, slot: sl.key };
          e.dirty = true;
        });
        if (UI.pick && UI.pick.verb === vid && UI.pick.slot === sl.key) s.classList.add('picking');
      }
      s.appendChild(box);
      var lab = h('div', 's-label', sl.label);
      lab.title = tr(sl.accepts.map(prettyAspect).join(' / '));
      var slotIcon = slotArt(sl);
      if (slotIcon) { var si = h('i', 's-icon'); si.style.backgroundImage = art(slotIcon); si.title = lab.title; s.appendChild(si); }
      s.appendChild(lab);
      s.addEventListener('pointerenter', function () { UI.hoverSlot = { verb: vid, slot: sl.key }; markFits(); });
      s.addEventListener('pointerleave', function () { UI.hoverSlot = null; markFits(); });
      slots.appendChild(s);
    });
    pane.appendChild(slots);
    var cands = e.magnetCandidates(vid);
    if (cands.length) {
      var pull = h('button', 'plate-btn gold pull', 'Pull in ' + cands.map(function (it) { return cardTitle(e.card(it.uid)); }).join(', '));
      pull.addEventListener('click', function () { UI.magnet(vid); });
      pane.appendChild(pull);
    }
    if (UI.pick && UI.pick.verb === vid) {
      if (v.slots[UI.pick.slot]) UI.pick = null; // the slot got its card another way
      else pane.appendChild(slotPicker(vid, UI.pick.slot));
    }

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
      rbox.innerHTML = '<p class="r-none">' + (lock ? esc(lock) : esc('Put a card in the first slot.')) + '</p>';
    }
    pane.appendChild(rbox);

    var act2 = h('div', 'actions');
    var go = h('button', 'plate-btn redfill go', pv ? pv.label + ' · ' + Math.round(pv.duration) + 's' : (primaryCard ? 'Nothing comes of it' : 'Put a card in'));
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

  // What an empty slot takes, and every card on the table that fits it.
  function slotPicker(vid, slotKey) {
    var e = UI.e;
    var sl = CF.VERBS[vid].slots.filter(function (x) { return x.key === slotKey; })[0];
    var box = h('div', 'picker');
    if (!sl) return box;
    var fits = e.tableCards().filter(function (c) { return e.slotAccepts(sl, c); }).sort(function (a, b) { return a.uid - b.uid; });
    var seen = {}, shown = [];
    fits.forEach(function (c) { var k = e.stackKey(c) || c.uid; if (!seen[k]) { seen[k] = true; shown.push(c); } });
    box.innerHTML = '<div class="pk-head"><span>' + esc(tr('{slot} takes: {kinds}', { slot: sl.label, kinds: sl.accepts.map(prettyAspect).join(', ') })) + '</span><button class="pk-close" title="' + esc('Close') + '">×</button></div>';
    box.querySelector('.pk-close').addEventListener('click', function () { UI.pick = null; e.dirty = true; });
    if (!shown.length) { box.appendChild(h('p', 'pk-none', 'Nothing on the table fits this slot yet.')); return box; }
    var row = h('div', 'pk-cards');
    shown.forEach(function (c) {
      var m = miniCard(c);
      m.classList.add('pk-card');
      m.title = tr('Put ' + e.labelOf(c) + ' in the slot');
      m.addEventListener('click', function () {
        if (e.slotCard(vid, slotKey, c.uid)) { UI.pick = null; CF.Audio.play('drop'); e.dirty = true; }
      });
      row.appendChild(m);
    });
    box.appendChild(row);
    return box;
  }

  // Cards leaving a window fly from where they are to where they land.
  function markSpawn(uid, fromEl) {
    if (!fromEl) return;
    var r = fromEl.getBoundingClientRect();
    UI.spawn[uid] = { cx: r.left, cy: r.top, gx: 0, gy: 0 };
  }
  // Turn a find over with a flip: the back turns edge-on, then the face turns out.
  UI.flipIn = {};
  function flipReveal(card, el) {
    var e = UI.e;
    var wrap = el && (el.closest('.mini-wrap') || el);
    if (wrap) wrap.classList.add('flip-out');
    CF.Audio.play('click');
    UI.haptic(12);
    UI.hoverBlock = card.uid;   // the mouse resting on it does not open the inspect: a tap does
    if (UI.hover === card.uid) UI.hover = null;
    setTimeout(function () {
      UI.flipIn[card.uid] = true;
      e.reveal(card.uid);
      e.dirty = true;   // the window redraws the card face up, where it lies; a tap on it then reads it
    }, 180);
  }
  function revealAll(vid) {
    var e = UI.e, w = winEls[vid];
    var hidden = e.verb(vid).out.filter(function (u) { var c = e.card(u); return c && c.hidden; });
    if (!hidden.length) return;
    if (w) hidden.forEach(function (u) { var el = w.querySelector('.card[data-uid="' + u + '"]'); var wrap = el && (el.closest('.mini-wrap') || el); if (wrap) wrap.classList.add('flip-out'); });
    CF.Audio.play('click');
    UI.haptic(12);
    setTimeout(function () {
      hidden.forEach(function (u) { UI.flipIn[u] = true; e.reveal(u); });
      e.dirty = true;
    }, 180);
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
      p.textContent = tr(story.text);
      typed.add(story);
    } else {
      if (!UI.typing || UI.typing.story !== story) UI.typing = { story: story, t0: performance.now() };
      UI.typing.el = p;
      d.title = tr('Click to show all');
      d.addEventListener('click', function () { typed.add(story); p.textContent = tr(story.text); UI.typing = null; });
      advanceTyping();
    }
    return d;
  }
  function advanceTyping() {
    var t = UI.typing;
    if (!t || !t.el) return;
    var n = Math.floor(((performance.now() - t.t0) / 1000) * CF.Settings.typeRate());
    var full = tr(t.story.text);
    if (n >= full.length) { t.el.textContent = full; typed.add(t.story); UI.typing = null; return; }
    t.el.textContent = full.slice(0, n);
  }

  // A picture of what a slot takes, from its first accepted kind.
  var SLOT_ART = { health: 'imed-01', focus: 'cres-05', instinct: 'iinv-06', funds: 'itrade-20', teammate: 'rrole-03', case: 'imark-01', witness: 'rrole-01', suspect: 'rrole-02', rival: 'csus-02',
    clue: 'iinv-02', evidence: 'iinv-16', district: 'iinv-17', order: 'ilaw-05', personnel: 'ilaw-11', informant: 'cwit-01', condemned: 'ilaw-06', rung: 'ilaw-01', trial: 'ilaw-02', coldcase: 'imark-06',
    fatigue: 'imed-13', hunger: 'imed-20', sickness: 'imed-07', stress: 'imed-21', spent: 'imed-08', lesson: 'iinv-20', kit_bio: 'iinv-16', tool: 'iinv-16', paperwork: 'ilaw-21', watchq: 'iinv-05', intel: 'cwit-01', thread: 'iinv-24', looseend: 'iinv-24', bribe: 'itrade-20', gang: 'icrime-22', syndicate: 'imyst-09' };
  function slotArt(sl) {
    for (var i = 0; i < sl.accepts.length; i++) if (SLOT_ART[sl.accepts[i]]) return SLOT_ART[sl.accepts[i]];
    return null;
  }
  function prettyAspect(a) {
    var map = { tool: 'Instrument', teammate: 'Watchman', atlarge: 'Abroad', coldcase: 'Unanswered', looseend: 'Loose End', promotion: 'The Council\'s Letter', chair: 'The Seat', funds: 'Coin', focus: 'Wit' };
    if (map[a]) return map[a];
    if (CF.ASPECTS[a]) return CF.ASPECTS[a].label;
    if (CF.KINDS[a]) return CF.KINDS[a].label;
    if (CF.CARDS[a]) return CF.CARDS[a].label;
    return a.charAt(0).toUpperCase() + a.slice(1);
  }

  var shownJournal = null;
  // Firsts: the small milestones of an examiner's career, ticked off in the journal.
  var FIRSTS = [
    { id: 'labour', label: 'A day\'s labour', done: function (e) { return (e.s.stats.verbs || {}).duty >= 1; } },
    { id: 'scene', label: 'A scene searched', done: function (e) { return (e.s.stats.verbs || {}).investigate >= 1; } },
    { id: 'proof', label: 'Raw proof read', done: function (e) { return (e.s.stats.verbs || {}).analyze >= 1; } },
    { id: 'question', label: 'Someone questioned', done: function (e) { return (e.s.stats.verbs || {}).interrogate >= 1; } },
    { id: 'rest', label: 'An evening in Rest', done: function (e) { return (e.s.stats.verbs || {}).reflect >= 1; } },
    { id: 'charge', label: 'A charge laid', done: function (e) { return (e.s.stats.verbs || {}).arrest >= 1; } },
    { id: 'conviction', label: 'A conviction', done: function (e) { return (e.s.stats.convictions || 0) >= 1; } },
    { id: 'solid', label: 'Full proof before the Court', done: function (e) { return (e.s.stats.solid || 0) >= 1; } },
    { id: 'sentence', label: 'A sentence passed', done: function (e) { return Object.keys(e.s.stats.recipes || {}).some(function (k) { return /^sen_/.test(k) && k !== 'sen_none'; }); } },
    { id: 'informer', label: 'An informer of your own', done: function (e) { return !!e.s.flags.hadInformer; } },
    { id: 'insight', label: 'An Insight taken to Rest', done: function (e) { return Object.keys(e.s.perks || {}).some(function (k) { return e.s.perks[k]; }) || Object.keys(e.s.stats.recipes || {}).some(function (k) { return k === 'ref_insight_train' || k === 'ref_insight_keep'; }); } },
    { id: 'week', label: 'A week survived', done: function (e) { return e.s.week >= 2; } },
  ];
  function firstsSig(e) { return FIRSTS.map(function (f) { return f.done(e) ? 1 : 0; }).join(''); }
  function renderJournal() {
    var e = UI.e, j = e.s.journal;
    var fsig = firstsSig(e);
    if (shownJournal === j[0] && UI.journalLen === j.length && UI.firstsSig === fsig) return;
    shownJournal = j[0];
    UI.journalLen = j.length;
    UI.firstsSig = fsig;
    if (!$('#journal-drawer').classList.contains('open') && j.length > (UI.journalSeen || 0)) $('#btn-journal').classList.add('unread');
    var pane = $('#journal');
    pane.innerHTML = '';
    var fb = h('div', 'firsts');
    var done = FIRSTS.filter(function (f) { return f.done(e); }).length;
    fb.innerHTML = '<h6>' + esc(tr('Firsts: {n} of {total}', { n: done, total: FIRSTS.length })) + '</h6>';
    FIRSTS.forEach(function (f) { var ok = f.done(e); fb.appendChild(h('span', 'first' + (ok ? ' done' : ''), (ok ? '\u2713 ' : '\u25CB ') + tr(f.label))); });
    pane.appendChild(fb);
    j.slice(0, 120).forEach(function (x) {
      var d = h('div', 'journal-entry k-' + x.kind);
      d.innerHTML = '<div class="j-meta">' + esc(tr('Week {n}', { n: x.week })) + '</div><h6>' + esc(x.title) + '</h6><p>' + esc(x.text) + '</p>';
      pane.appendChild(d);
    });
  }

  function caseLife(rec) { var cc = UI.e.caseCard(rec.id); return cc ? cc.life : Infinity; }

  // The charge breakdown in the Arrest window: what the case needs proven
  // against what the clues give, then the bonuses and penalties.
  function chargeHtml(d) {
    var html = '<div class="charge tier-' + d.tier + '"><div class="ch-head"><span>' + esc(tr('{tier} charge', { tier: d.tierLabel })) + '</span><span class="ch-score">' + d.score + ' / ' + d.need + '</span></div>';
    d.rows.forEach(function (r) {
      var pct = Math.min(100, (r.have / r.need) * 100);
      html += '<div class="ch-row' + (r.have >= r.need ? ' met' : r.have ? ' part' : '') + '"><span class="chip-icon" style="background-image:' + art(ASPECT_ART[r.aspect] || 'iinv-05') + '"></span>' +
        '<span class="ch-name">' + esc(CF.ASPECTS[r.aspect].label) + '</span><span class="ch-bar"><i style="width:' + pct + '%"></i></span><span class="ch-num">' + r.have + ' / ' + r.need + '</span></div>';
    });
    d.notes.forEach(function (n) { html += '<div class="ch-note ' + n.kind + '">' + esc(n.text) + '</div>'; });
    return html + '</div>';
  }

  // Short handwritten notes for the inspector's dossier.
  // Health, Wit and Instinct: the tricks you keep, and how the ability grows.
  function abilityNotes(card) {
    var e = UI.e, lines = e.perkList().map(function (k) { return tr('Trick: {perk}', { perk: e.perkLabel(k) }); });
    var ab = /^spent_/.test(card.def) ? CF.CARDS[card.def].restores : card.def;
    if (!CF.growthWays || !CF.CARDS[ab] || CF.CARDS[ab].kind !== 'ability') return lines;
    var ways = CF.growthWays(e, ab);
    if (!ways.length) return lines;
    lines.push(tr('How {ability} grows (an Insight, taken to Rest):', { ability: tr(CF.CARDS[ab].label) }));
    ways.forEach(function (w) {
      if (w.state === 'learned') lines.push(tr('{label}: learned.', { label: tr(w.label) }));
      else if (w.state === 'waiting') lines.push(tr('{label}: the Insight is on the table. Put it into Rest.', { label: tr(w.label) }));
      else lines.push(tr('{label}: {how} ({n} of {need})', { label: tr(w.label), how: tr(w.how), n: w.n, need: w.need }));
    });
    return lines;
  }
  function dossierNotes(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind, lines = [];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var a = CF.clueAspects(card);
    var asp = Object.keys(a).map(function (x) { return CF.ASPECTS[x].label + ' ' + a[x]; }).join(', ');
    if (k === 'case' && rec) {
      var met = rec.suspects.filter(function (x) { return x.revealed; });
      lines.push(rec.scene + ', ' + CF.DISTRICTS[rec.district].label);
      lines.push('Accused met: ' + (met.length ? met.map(function (x) { return x.name.split(' ')[1] + (x.cleared ? ' ✗' : rec.identified === x.key ? ' ★' : ''); }).join(', ') : 'none'));
      lines.push('Scene: ' + (rec.found >= rec.items.length ? 'searched out' : rec.searches ? 'partly searched' : 'not searched') + (rec.delegate ? ' · ' + rec.delegate.card.label + ' on it' : '') + (rec.major ? ' · cried' : ''));
      lines.push(CF.daysLeft(card.life) + ' days left (' + U.fmtTime(card.life) + ')' + (rec.highProfile ? ' · the city watches' : ''));
      var cprof = CF.Charge.profileOf(rec); lines.push('To convict: ' + Object.keys(cprof).map(function (k) { return CF.ASPECTS[k].label + ' ' + cprof[k]; }).join(', '));
      if (rec.commission) lines.push('Commission: ' + CF.PATRONS[rec.commission.from].label + ' wants ' + { quiet: 'it quiet', mercy: 'mercy', square: 'the square' }[rec.commission.wants]);
    } else if (card.def === 'suspect') {
      var sus = e.suspectOf(card);
      if (sus) lines.push(sus.role.charAt(0).toUpperCase() + sus.role.slice(1) + (rec && rec.identified === card.data.key ? ' · the one it points to' : ''));
      if (rec) lines.push('Case: ' + rec.title);
      if (rec) { var prof = CF.Charge.profileOf(rec); lines.push('To convict: ' + Object.keys(prof).map(function (k) { return CF.ASPECTS[k].label + ' ' + prof[k]; }).join(', ')); }
      if (sus && sus.questioned) lines.push('Questioned already'); else lines.push('Question them with Wit');
    } else if (k === 'clue' || k === 'evidence' || card.def === 'witness') {
      if (rec) lines.push('Case: ' + rec.title);
      if (k === 'evidence') lines.push(card.data.item && card.data.item.needs ? 'Raw proof: read it in Study with the right instrument' : 'Raw proof: read it in Study before it counts');
      else if (k === 'clue') lines.push(asp ? tr('Proves {asp}: into the Court with the Accused', { asp: asp }) : 'Into the Court with the Accused');
      else if (card.def === 'witness') lines.push(card.data.asked ? 'Questioned already' : 'Question them with Wit for their word');
      if (card.data.points) { var pto = rec && rec.suspects.filter(function (x) { return x.key === card.data.points; })[0]; if (pto) lines.push(tr('Names {name}', { name: pto.name })); }
      if (card.data.trait && !card.data.points) { var ptr = CF.TRAITS.filter(function (t) { return t.id === card.data.trait; })[0]; if (ptr) lines.push(tr('Describes someone who: {desc}', { desc: tr(ptr.desc).replace(/\.$/, '').toLowerCase() })); }
      if (card.data.stake && CF.STAKES[card.data.stake]) lines.push(CF.STAKES[card.data.stake].label + (card.data.againstInterest ? ' · against interest' : '') + (card.data.coerced ? ' · not credible' : ''));
      if (card.data.confession) lines.push(card.data.confession === 'free' ? 'Confessed freely' : 'Under the question');
      if (card.data.frame) lines.push('The thief-takers\' men');
      if (card.maxLife) lines.push('Keeps for ' + U.fmtTime(card.life));
      if (k === 'evidence' && card.data.item && card.data.item.needs) lines.push('Needs an instrument');
    } else if (k === 'teammate' || k === 'personnel') {
      if (card.data.name) lines.push(card.data.name);
      if (asp) lines.push(asp);
      if (card.data.traits && card.data.traits.length) lines.push(card.data.traits.map(function (t) { return CF.OFFICER_TRAITS[t].label; }).join(', '));
      if (card.data.level) lines.push('Level ' + card.data.level);
    } else if (k === 'equipment') {
      var m = def.mods || {};
      if (m.boost) lines.push(Object.keys(m.boost.aspects).map(function (x) { return CF.ASPECTS[x].label + ' +' + m.boost.aspects[x]; }).join(', ') + ' on ' + m.boost.tags.join('/'));
      if (m.gate) lines.push('Reads raw proof that needs it');
      if (m.extraEvidence) lines.push('Finds more at a scene');
      if (m.unlocks) lines.push('Opens: ' + ((CF.RECIPES_BY_ID[m.unlocks] || {}).label || m.unlocks));
      if (m.unlocksVerb) lines.push('Opens ' + ((CF.POWERS && CF.POWERS[m.unlocksVerb]) || CF.VERBS[m.unlocksVerb] || { label: m.unlocksVerb }).label + ' at any office');
    } else if (k === 'informant') {
      lines.push('Works ' + CF.DISTRICTS[card.data.district].label);
      lines.push('Trust ' + (card.data.trust || 0) + '/3 · heat ' + (card.data.heat || 0) + '/' + CF.INFORMANT.compromisedAt);
      lines.push(e.informantStatus(card) === 'compromised' ? 'Marked: gone quiet' : 'Next word in ' + U.fmtTime(Math.max(0, card.data.tipT || 0)));
    } else if (k === 'calling') {
      e.initPaths();
      lines.push(CF.Callings.summary(e));
      var cnt = e.s.counts || {};
      lines.push('Cruelty ' + (cnt.cruelty || 0) + ' · Mercy ' + (cnt.mercy || 0) + ' · Purse ' + (cnt.purse || 0) + (cnt.debt ? ' · Debt ' + cnt.debt : ''));
      if (e.s.court && e.s.court.stance) lines.push(e.s.court.stance === 'treaty' ? 'A Treaty with the Court' : 'Inside the Court, week ' + e.s.court.insideWeeks);
      var fv = e.favour();
      lines.push('Favour: Council ' + fv.council + ' · Bishop ' + fv.bishop + ' · Guilds ' + fv.guild);
      lines.push('Leaning: ' + CF.CALLINGS[e.dominantPath()].label + (e.dominantPath() !== e.s.calling ? ' (drifting)' : ''));
      if (e.s.origin !== e.s.calling) lines.push('Set out as ' + CF.CALLINGS[e.s.origin].label);
      if (e.s.who && CF.ORIGINS[e.s.who]) lines.push('Once ' + CF.ORIGINS[e.s.who].label.toLowerCase());
    } else if (card.def === 'condemned') {
      lines.push(card.data.role ? card.data.role.charAt(0).toUpperCase() + card.data.role.slice(1) : 'Convicted');
      lines.push('Custom: ' + CF.Sentence.rungLabel(card.data.template, card.data.custom));
      lines.push((card.data.penitent ? 'Penitent · ' : '') + 'Council speaks in ' + U.fmtTime(card.life));
    } else if (card.def === 'rung') {
      lines.push((CF.RUNGS[card.data.rung] || {}).cost || '');
    } else if (card.def === 'plea') {
      lines.push({ church: 'From the Bishop', guild: 'From the Guild', family: 'From the family' }[card.data.from] || 'A plea');
      lines.push('A reason for mercy');
    } else if (card.def === 'syndicate') {
      var court = e.s.court || {};
      if (court.king) lines.push('King of Thunes: ' + court.king.name);
      lines.push(court.stance === 'treaty' ? 'A Treaty stands' : court.stance === 'rule' ? 'You are inside, week ' + court.insideWeeks : 'No stance yet');
      lines.push('Disguise: ledger, Wit, or Instinct and Coin');
    } else if (card.def === 'gang') {
      lines.push((card.data.members || []).length + ' sworn');
      lines.push('Disguise to go among them');
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

  // The dossier: a card floating at the top right of the table while a card
  // is hovered, pinned while one is selected.
  function renderInspector() {
    var e = UI.e;
    var box = $('#peek');
    var uid = UI.hover || UI.selected;
    var card = uid && e.card(uid);
    // A face-down find keeps its secret: nothing to read until it is turned over.
    if (!card || card.hidden) { box.classList.remove('open'); box.dataset.uid = ''; return; }
    box.classList.add('open');
    box.classList.toggle('pinned', UI.selected === uid);
    if (box.dataset.uid === String(uid) && box.dataset.sig === cardSig(card, 1)) return;
    box.dataset.uid = uid; box.dataset.sig = cardSig(card, 1);
    var def = CF.CARDS[card.def];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var dz = ['case', 'suspect', 'witness', 'clue', 'evidence', 'teammate', 'personnel', 'equipment', 'intel', 'place', 'hospital', 'informant', 'district', 'criminal', 'coldcase', 'court', 'calling'].indexOf(def.kind) >= 0 || card.def === 'front' || card.def === 'atlarge' ? 'paper' : null;
    var html = '<div class="i-card"></div>';
    var notes = dz ? dossierNotes(card) : def.kind === 'ability' ? abilityNotes(card) : [];
    var kindArt = KIND_ART[card.def] || KIND_ART[def.kind];
    html += '<div class="i-kind">' + (kindArt ? '<span class="k-icon" style="background-image:' + art(kindArt) + '"></span>' : '') + esc((CF.KINDS[def.kind] || {}).label || def.kind) + (rec && def.kind !== 'case' ? ' · ' + esc(rec.title) : '') + '</div><h4>' + esc(e.labelOf(card)) + '</h4>';
    var a = CF.aspectsOf(card);
    var badges = CF.CLUE_ASPECTS.filter(function (k) { return a[k]; }).map(function (k) {
      return '<span class="chip big" data-aspect="' + k + '" title="' + esc('Tap for what this means') + '"><span class="chip-icon" style="background-image:' + art(ASPECT_ART[k] || 'iinv-05') + '"></span>' + esc(CF.ASPECTS[k].label) + ' ' + a[k] + '</span>';
    }).join('');
    if (badges) html += '<div class="i-aspects">' + badges + '</div>';
    html += '<p>' + esc(e.descOf(card)) + '</p>';
    if (notes.length) html += '<div class="i-lines">' + notes.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
    if (card.maxLife) html += '<div class="i-note i-time">' + esc(tr('Time left: {t}', { t: U.fmtTime(card.life) })) + '</div>';
    var why = card.loc && card.loc.t === 'table' && e.unavailableReason(card);
    if (why) html += '<div class="i-note i-unavailable">' + esc(why) + '</div>';
    var canMark = card.loc && (card.loc.t === 'table' || card.loc.t === 'slot');
    box.innerHTML = '<button class="peek-close" title="' + esc('Close') + '">×</button>' + html +
      (canMark ? '<button class="peek-mark plate-btn' + (card.data && card.data.mark ? ' dark' : '') + '">' + esc(card.data && card.data.mark ? 'Unmark' : 'Mark') + '</button>' : '');
    var mk = box.querySelector('.peek-mark');
    if (mk) mk.addEventListener('click', function (ev) { ev.stopPropagation(); card.data = card.data || {}; card.data.mark = !card.data.mark; box.dataset.sig = ''; e.dirty = true; renderInspector(); CF.Audio.play('click'); });
    var shown = buildCard(card, 1);
    delete shown.dataset.uid; // a picture of the card, not a card to drag
    box.querySelector('.i-card').appendChild(shown);
    box.querySelector('.peek-close').addEventListener('click', function () { select(null); UI.hover = null; renderInspector(); });
    box.querySelectorAll('.chip[data-aspect]').forEach(function (chip) {
      chip.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var k = chip.dataset.aspect, A = CF.ASPECTS[k];
        var old = box.querySelector('.aspect-pop');
        if (old) { var was = old.dataset.aspect; old.remove(); if (was === k) return; }
        var pop = h('div', 'aspect-pop');
        pop.dataset.aspect = k;
        pop.innerHTML = '<b>' + esc(A.label) + '</b><p>' + esc(A.meaning) + '</p><p class="ap-note">' + esc('Proof of this kind counts toward a charge that asks for it. The number is how much of it the token carries.') + '</p>';
        var find = h('button', 'ap-find', 'Show on the table');
        find.addEventListener('click', function (ev2) { ev2.stopPropagation(); UI.showAspect(k); });
        pop.appendChild(find);
        chip.parentNode.insertAdjacentElement('afterend', pop);
      });
    });
  }

  // Every card on the table that carries an aspect lights up for a moment.
  UI.showAspect = function (k) {
    var e = UI.e, n = 0;
    Object.keys(cardEls).forEach(function (uid) {
      var c = e.card(+uid);
      if (!c || !CF.aspectsOf(c)[k]) return;
      var el = cardEls[uid]; el.classList.remove('noticed'); void el.offsetWidth; el.classList.add('noticed'); n++;
      setTimeout(function () { el.classList.remove('noticed'); }, 4000);
    });
    if (!n) toast({ title: CF.ASPECTS[k].label, text: 'Nothing on the table carries it.', kind: 'minor' });
  };

  // ---------------------------------------------------------------- Input
  // Drags: a card (from the table, a slot, or a verb's output), a verb token,
  // a window, or the table itself (panning). Cards are lifted into a layer
  // above everything, tilt as they move, and settle when dropped.
  function cardAt(target) { return target.closest && target.closest('.card[data-uid]'); }

  function canTake(vid, card) {
    var e = UI.e, v = e.verb(vid);
    if (!v.unlocked || CF.VERBS[vid].auto) return false;
    if (v.status === 'running') return e.askAccepts(vid, card);
    var slots = v.status === 'done' ? [CF.VERBS[vid].slots[0]] : e.visibleSlots(vid);
    return slots.some(function (sl) { return e.slotAccepts(sl, card); }) || e.slotAccepts(CF.VERBS[vid].slots[0], card);
  }

  function select(uid) {
    UI.selected = uid;
    UI.hoverBlock = null;
    renderInspector();
    Object.keys(cardEls).forEach(function (k) { cardEls[k].classList.toggle('selected', +k === uid); });
  }

  // The how-to hint goes away for good once the player has moved something.
  function hideHint() {
    var hint = $('#hint');
    if (UI.hintMode === 'intro') return; // the guided start's hints stay until the step is done
    if (hint && !hint.classList.contains('gone')) hint.classList.add('gone');
    UI.hintMode = 'gone';
    try { localStorage.setItem('casefile.hinted', '1'); } catch (err) { /* ignore */ }
  }
  UI.hideHint = hideHint;

  // Touch: every active pointer, so two fingers on the felt can pinch.
  var pointers = {};
  function pinchState() {
    var ids = Object.keys(pointers);
    if (ids.length !== 2) return null;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  function onPointerDown(ev) {
    UI.lastInput = performance.now();
    if (UI.modal || (ev.button !== 0 && ev.button !== 1)) return;
    if (ev.pointerType === 'touch') {
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var pinch = pinchState();
      if (pinch) {
        // A second finger: whatever the first was doing becomes a pinch.
        if (UI.drag) cancelDrag();
        UI.drag = { kind: 'pinch', d0: pinch.d, z0: UI.view.z, started: true };
        return;
      }
    }
    if (UI.drag) cancelDrag(); // a second pointer, or a pointerup we never saw
    var t = ev.target;
    var winHead = t.closest && t.closest('.vw-head');
    var win = t.closest && t.closest('.vwin');
    if (win) {
      var wid = win.dataset.win;
      if (UI.openVerbs[UI.openVerbs.length - 1] !== wid) { openWindow(wid); }
      void winHead;
    }
    var n = cardAt(t);
    if (n && n.closest('.pk-card')) return; // picker cards are buttons, not cards
    if (n && ev.button === 0) {
      var uid = +n.dataset.uid;
      var card = UI.e.card(uid);
      if (!card || !card.loc || card.loc.t === 'held') { select(uid); return; }
      // The number badge is the handle for the whole stack; the card is one card.
      var whole = ev.shiftKey || !!(t.closest && t.closest('.c-count'));
      UI.drag = { kind: 'card', uid: uid, src: n, x0: ev.clientX, y0: ev.clientY, started: false, whole: whole };
      ev.preventDefault();
      return;
    }
    var vn = t.closest && t.closest('.verb[data-verb]');
    // The box, while the verb asks: a tap answers it from the table.
    if (vn && ev.button === 0 && t.closest('.v-magnet.asks')) { UI.answerAsk(vn.dataset.verb); ev.preventDefault(); return; }
    if (vn && ev.button === 0) {
      UI.drag = { kind: 'verb', verb: vn.dataset.verb, el: vn, x0: ev.clientX, y0: ev.clientY, started: false };
      ev.preventDefault();
      return;
    }
    if (t.closest && t.closest('.choice')) return;
    var pz = t.closest && t.closest('.pile-zone');
    if (pz && ev.button === 0) {
      var pl = UI.e.pile();
      UI.drag = { kind: 'pile', el: pz, x0: ev.clientX, y0: ev.clientY, b0: { x: pl.x, y: pl.y }, started: false };
      ev.preventDefault();
      return;
    }
    if (t.closest && t.closest('#table') && !win && !t.closest('#zoom') && !t.closest('#peek')) {
      // Touching the felt puts away the windows and the pinned dossier.
      if (UI.openVerbs.length) closeAllWindows();
      UI.drag = { kind: 'pan', x0: ev.clientX, y0: ev.clientY, vx: UI.view.x, vy: UI.view.y, started: false };
      ev.preventDefault();
    }
  }

  function onPointerMove(ev) {
    if (pointers[ev.pointerId]) pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    if (UI.drag && UI.drag.kind === 'pinch') {
      var pinch = pinchState();
      if (!pinch) return;
      var want = U.clamp(UI.drag.z0 * (pinch.d / UI.drag.d0), 0.4, 1.6);
      zoomAt(pinch.cx, pinch.cy, want / UI.view.z);
      return;
    }
    var d = UI.drag;
    if (!d) {
      if (ev.target.closest && ev.target.closest('#peek')) return;
      var n = cardAt(ev.target);
      var uid = n ? +n.dataset.uid : null;
      if (uid === UI.hoverBlock) uid = null; else UI.hoverBlock = null;
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
      var tr0 = $('#table').getBoundingClientRect();
      var p0 = toPlane(d.x0 - tr0.left, d.y0 - tr0.top), p1 = toPlane(ev.clientX - tr0.left, ev.clientY - tr0.top);
      UI.view.x = d.vx + (p1.x - p0.x);
      UI.view.y = d.vy + (p1.y - p0.y);
      clampView();
      $('#table').classList.add('panning');
      applyView();
      return;
    }
    if (d.kind !== 'pan' && !d.started && Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 7) return; // a tap, not a drag
    if (d.kind === 'verb' || d.kind === 'pile') {
      if (!d.started) {
        d.started = true; d.el.classList.add('dragging'); hideHint(); UI.haptic(8);
        if (d.kind === 'verb') { var vv = UI.e.verb(d.verb); d.b0 = { x: vv.x, y: vv.y }; }
        if (UI.openVerbs.length) closeAllWindows();
      }
      var q0 = toBoard(d.x0, d.y0), q1 = toBoard(ev.clientX, ev.clientY);
      d.at = { x: d.b0.x + (q1.x - q0.x), y: d.b0.y + (q1.y - q0.y) };
      place(d.el, d.kind === 'pile' ? d.at.x - 9 : d.at.x, d.kind === 'pile' ? d.at.y - 8 : d.at.y);
      if (d.kind === 'verb') { var mv = UI.e.s.verbs[d.verb]; if (mv) { mv.x = d.at.x; mv.y = d.at.y; syncLinks(); } }
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
    UI.haptic(8);
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
    if (CF.Settings.get('pauseOnDrag') && !UI.paused && !e.s.over) { UI.autoPaused = true; UI.setPaused(true); }
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
    syncLinks();
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

  // The tablet's Back button: undo the most recent thing that can be undone.
  // Returns false when there is nothing left to close (the host may leave).
  UI.back = function () {
    if (UI.drag) { cancelDrag(); return true; }
    if (UI.openVerbs.length) { closeWindow(UI.openVerbs[UI.openVerbs.length - 1]); return true; }
    if (UI.onBack) return UI.onBack();
    return false;
  };

  function resumeAfterDrag() {
    if (UI.autoPaused) { UI.autoPaused = false; UI.setPaused(false); }
  }
  function cancelDrag() {
    var d = UI.drag;
    UI.drag = null;
    clearMarks();
    resumeAfterDrag();
    if (!d) return;
    if (d.kind === 'pinch') return;
    if (d.kind === 'card' && d.started) { flyBack(d); UI.e.dirty = true; }
    if ((d.kind === 'verb' || d.kind === 'pile') && d.started) { d.el.classList.remove('dragging'); UI.e.dirty = true; }
  }

  function onPointerUp(ev) {
    delete pointers[ev.pointerId];
    var d = UI.drag;
    if (!d) return;
    if (d.kind === 'pinch') { if (!pinchState()) UI.drag = null; return; }
    var e = UI.e;
    UI.drag = null;
    clearMarks();
    resumeAfterDrag();
    if (d.kind === 'window') return;
    if (d.kind === 'pan') { if (!d.started) select(null); return; }
    if (d.kind === 'pile') {
      d.el.classList.remove('dragging');
      if (d.started) { e.movePile(d.at.x, d.at.y); CF.Audio.play('drop'); UI.haptic(10); }
      e.dirty = true;
      return;
    }
    if (d.kind === 'verb') {
      d.el.classList.remove('dragging');
      if (!d.started) {
        if (UI.openVerbs.indexOf(d.verb) >= 0) closeWindow(d.verb);
        else openWindow(d.verb);
        CF.Audio.play('click');
      } else {
        e.moveVerb(d.verb, d.at.x, d.at.y);
        CF.Audio.play('drop'); UI.haptic(10);
      }
      e.dirty = true;
      return;
    }
    // Card.
    var card = e.card(d.uid);
    if (!d.started) {
      // A finished verb's card: face down, a tap turns it over; face up, a tap takes it.
      if (card && card.loc && card.loc.t === 'out' && ev.target.closest('.vwin')) {
        if (card.hidden) flipReveal(card, d.src); else select(d.uid);
        return;
      }
      // With a verb open, a tap on a card that fits puts it in; the window stays.
      if (card && card.loc && card.loc.t === 'table' && UI.openVerbs.length) {
        var openVid = UI.openVerbs[UI.openVerbs.length - 1];
        if (e.verb(openVid).status === 'idle' && e.autoSlot(openVid, card.uid)) { markSpawn(card.uid, d.src); CF.Audio.play('drop'); UI.haptic(10); e.dirty = true; return; }
      }
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
      else if (e.verb(t.verb).status === 'running') ok = e.answerAsk(t.verb, card.uid);
      else ok = !!e.autoSlot(t.verb, card.uid);
      if (ok) {
        openWindow(t.verb);
        CF.Audio.play('drop'); UI.haptic(10);
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
      if (UI.tidyUndo) { UI.tidyUndo = null; renderTools(); }
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
      CF.Audio.play('drop'); UI.haptic(10);
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
    // A verb asking for this card mid-work comes first.
    for (var a = 0; a < CF.VERB_ORDER.length; a++) if (e.askAccepts(CF.VERB_ORDER[a], card)) { UI.answerAsk(CF.VERB_ORDER[a], card.uid); return; }
    var tries = UI.openVerbs.slice().reverse().concat(CF.VERB_ORDER);
    for (var i = 0; i < tries.length; i++) {
      var id = tries[i], v = e.verb(id);
      var fresh = UI.openVerbs.indexOf(id) >= 0 || (v.status === 'idle' && !Object.keys(v.slots).length);
      if (fresh && canTake(id, card) && e.autoSlot(id, card.uid)) { openWindow(id); CF.Audio.play('drop'); e.dirty = true; return; }
    }
  }
})();
