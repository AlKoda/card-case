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
    councilwrit: 'citem-08', chair: 'cherald2-04', looseend: 'citem-07', ledger: 'cmyst-08', notes: 'citem2-02', writsale: 'ccrime-07', tribute: 'citem-03', dagger: 'citem2-07',
    personnel: 'citem2-08', condemned: 'ccourt-07', atlarge: 'ccrime-08', trial: 'ccourt-04',
  };
  // A case: the crime as a card, and a stamp of its kind on the corner.
  var CASE_ART = { burglary: ['ccrime-02', 'icrime-10'], missing: ['csign-01', 'icrime-12'], harbor: ['ccrime-06', 'icrime-03'], arson: ['ccrime-03', 'icrime-09'],
    fraud: ['ccrime-07', 'icrime-07'], extortion: ['ccrime-01', 'icrime-08'], poison: ['ccrime-04', 'icrime-04'], coining: ['citem-03', 'icrime-21'],
    scriptorium: ['citem2-02', 'ilaw-12'], witch: ['coccult-07', 'icrime-19'], highway: ['citem-01', 'icrime-16'], contract: ['citem2-07', 'icrime-01'],
    eumenides: ['coccult-03', 'imyst-07'], pattern: ['coccult-06', 'icrime-05'], threedays: ['csign-06', 'icrime-02'], manhunt: ['ccrime-08', 'ilaw-18'],
    gang: ['ccrime-05', 'icrime-22'], syndicate: ['cherald2-07', 'icrime-19'], architect: ['csign-04', 'icrime-16'],
    // The weigh-house and its scales; the churchyard and the stone the searchers' cart goes to.
    weights: ['cplace3-04', 'iplace2-04'], searchers: ['cplace2-06', 'iplace2-14'],
    // The light gulden's purse, the hanged man's hand, the receiver's crates on the quay.
    mint: ['citem-02', 'icrime-21'], gloryhand: ['csign-08', 'icrime-19'], receiver: ['charb-04', 'icrime-10'] };
  var CASE_DEFAULT = ['csign-01', 'imark-16'];
  // The Harbourmaster's own case, where the rules open one: a ship at the quay and the harbour's stamp.
  var HARBOUR_CASE_ART = ['charb2-01', 'icrime-03'];
  function caseArtOf(tpl) { return CASE_ART[tpl] || (harbourTemplate(tpl) ? HARBOUR_CASE_ART : CASE_DEFAULT); }
  // Tokens about the body: an icon of the case's kind of death.
  var BODY_ART = { harbor: ['icrime-03', 'iev-21'], poison: ['icrime-04', 'iev-07'], contract: ['icrime-01', 'iev-21'], highway: ['icrime-16', 'iev-21'], eumenides: ['icrime-05', 'iev-20'],
    pattern: ['icrime-13', 'iev-21'], threedays: ['icrime-02', 'iev-21'], scriptorium: ['iev-21', 'iev-03'], missing: ['imark-09', 'iev-21'], witch: ['icrime-02', 'iev-20'], manhunt: ['iev-21', 'icrime-13'],
    searchers: ['icrime-13', 'iplace2-14'] };
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
  // The faces that are women's, wherever their sheet put them: a person whose sex is known gets a face
  // of that sex from their trade's pool, or from all the faces of that sex when the trade has none.
  var WOMEN = {};
  ['cclerk-08', 'cfolk-03', 'cfolk-05', 'cink-01', 'cink-04', 'cnoble2-02', 'cnoble2-04', 'cnoble2-06', 'cnoble2-08', 'coutlaw-05', 'crogue-02', 'crogue-04', 'crogue-06', 'ctrade-07',
    'cwoman-01', 'cwoman-02', 'cwoman-03', 'cwoman-04', 'cwoman-05', 'cwoman-06', 'cwoman-07', 'cwoman-08'].forEach(function (k) { WOMEN[k] = true; });
  function ofSex(pool, sex) { return pool.filter(function (k) { return !!WOMEN[k] === (sex === 'f'); }); }
  function personArt(name, role, sex) {
    var pool = POOL.any;
    for (var i = 0; i < ROLE_POOL.length && role; i++) if (ROLE_POOL[i][0].test(role)) { pool = POOL[ROLE_POOL[i][1]]; break; }
    if (sex === 'f' || sex === 'm') {
      var own = ofSex(pool, sex);
      pool = own.length ? own : ofSex([].concat(POOL.any, POOL.watch), sex);
    }
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
  // Where each kind of proof is found, for the popover, the Help and the advisor: the engine's
  // CF.ASPECT_SOURCES. With an engine, only the ways open to this player now (rec, the case in
  // question, may be null); without one (the Help), every way.
  var FROM_NONE = 'nothing in your reach yet: charge on what you have, or confront the accused with a token in Question';
  // In English, joined; CF.T reads each way of a '; ' list on its own.
  function aspectFrom(k, e, rec) {
    var ways = e ? e.aspectSources(k, rec || null) : (CF.ASPECT_SOURCES[k] || []).map(function (w) { return U.fill(w.text, { quarter: 'its Quarter' }); });
    return ways.length ? ways.join('; ') : FROM_NONE;
  }
  // The stamp the Court token takes when a case ends. A wrongful verdict wears the same wax as a true one.
  var VERDICT_ART = { convicted: 'cwax-01', wrongful: 'cwax-01', acquitted: 'cok-02', cold: 'ccirc-05' };
  var VERDICT_DEFAULT = 'ccirc-05';
  // The mark of an accused: its icon comes with the trait (CF.TRAITS[].icon); this stands in until it does.
  var TRAIT_ART = 'imark-11';
  var PATH_HINTS = { commissioner: 'offices, rooms, calm weeks', master: 'threads, identifications, reopened cases', crusader: 'bands broken, the abroad put away, disguises' };
  var RIVAL_TITLES = /Rival|Scene Spoiled|Paid to Forget/;
  // The Harbourmaster's arc, where the rules have it: the leaf an exposed Rival leaves (an Insight named for the
  // Customs House) and the case its leaves open (a template named for the Harbourmaster). Read by name, so the
  // interface waits for the rules and says nothing of an arc that is not there.
  var LEAVES_NEED = 2, LOOSE_NEED = 3;
  function customsLeafDef() {
    if (UI.leafDef !== undefined) return UI.leafDef;
    UI.leafDef = null;
    for (var k in CF.CARDS) if (CF.CARDS[k].kind === 'insight' && /Customs House/.test(CF.CARDS[k].label || '')) { UI.leafDef = k; break; }
    return UI.leafDef;
  }
  function harbourTemplate(tpl) {
    var t = tpl && CF.CASE_TEMPLATES && CF.CASE_TEMPLATES[tpl];
    return !!t && /Harbourmaster/.test((t.title || '') + ' ' + (t.label || ''));
  }
  function harbourArc() { if (!customsLeafDef()) return false; for (var k in CF.CASE_TEMPLATES || {}) if (harbourTemplate(k)) return true; return !!recipeOf(customsLeafDef()); }
  // The recipe that takes this kind of card as its first: where a pile of them goes.
  function recipeOf(def) { return def ? (CF.RECIPES || []).filter(function (r) { return r.requires && r.requires.primary === def; })[0] || null : null; }
  // Cards of a kind free to use (on the table or in a verb's open slot).
  function freeOf(def) { var e = UI.e; return def ? e.cardsOf(def, true).filter(function (c) { return c.loc && (c.loc.t === 'table' || c.loc.t === 'slot') && !e.unavailableReason(c); }) : []; }
  // The Rival is hunted a thread a week: careful until the Bell after the last one was found.
  function rivalCareful(card) { var d = card.data || {}; return d.heatWeek !== undefined && d.heatWeek !== null && UI.e.s.week <= d.heatWeek; }
  // The way the next thread must come: the other verb from the first one's, or either.
  // Whether the rules want the Rival caught at it for the second thread: Question then has a slot, beside the
  // Rival, for their own dirty work (a token, a witness or a case). Read off the verb, so the interface follows
  // the rules whether or not they carry it.
  function rivalCatch(rival) {
    var v = CF.VERBS.interrogate;
    if (!v || !rival) return false;
    return v.slots.some(function (sl) {
      var open = false;
      try { open = !sl.primary && !!sl.when && !!sl.when(rival); } catch (err) { open = false; }
      return open && (sl.accepts || []).some(function (a) { return a === 'clue' || a === 'witness' || a === 'case'; });
    });
  }
  // The Rival's dirty work on the table: a token they spoiled (data.tampered), a witness they paid (data.bribed),
  // a case they took (the case's rec.rival).
  function rivalDirt(e) {
    if (typeof e.rivalWork === 'function') return e.tableCards().filter(function (c) { return e.rivalWork(c) && !e.unavailableReason(c); });
    return e.tableCards().filter(function (c) {
      var d = c.data || {}, rec = CF.CARDS[c.def].kind === 'case' && c.caseId ? e.caseRec(c.caseId) : null;
      return ((c.def === 'clue' && d.tampered) || (c.def === 'witness' && d.bribed) || (rec && rec.rival && rec.status === 'open')) && !e.unavailableReason(c);
    });
  }
  // The meters are the coloured counters: fire for the Crowd, the eye for Suspicion, the masked man for Vendetta, the moon for Dread, the crown for Standing.
  var METER_ICONS = { pressure: 'cres-04', scrutiny: 'cres-03', retaliation: 'casp-01', dread: 'cres-12', reputation: 'cres-09' };
  var TOAST_BARS = { case: 'clabel-01', danger: 'clabel-01', harm: 'clabel-01', need: 'clabel-01', defeat: 'clabel-01', major: 'clabel-02', victory: 'clabel-02', week: 'clabel-04', verb: 'clabel-03', minor: 'clabel-05' };
  var TOAST_ICONS = { case: 'imark-01', danger: 'cmark-04', harm: 'cmark-04', need: 'cmark-04', defeat: 'imark-04', major: 'cwax-02', victory: 'imark-12', week: 'ccirc-02', verb: 'cwit-02', minor: 'cmark-05' };
  var TOAST_LONG = { major: 1, case: 1, danger: 1, harm: 1, need: 1, victory: 1, defeat: 1 };
  var RANK_ART = ['cwax-01', 'cwax-03', 'cwax-02'];
  // The tokens are cards too: a tall rounded ring drawn just outside their edge.
  var RING_LEN = 2 * (240 + 240) - 8 * 20 + 2 * Math.PI * 20;

  // The face of a card: {art, fam, tone, gray, banded}.
  function full(art, tone, gray) { return { art: art, fam: 'full', tone: tone || 'gold', gray: !!gray, banded: /^(cplace3|cstory)-/.test(art), storyBand: /^cstory-/.test(art) }; }
  function icon(art, tone, gray) { return { art: art, fam: 'icon', tone: tone || 'gold', gray: !!gray }; }
  function cardPicture(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind, tone = PIC_TONE[k] || 'gold';
    if (k === 'case') { var r = e.caseRec(card.caseId); return full(caseArtOf(r && r.template)[0], r && r.highProfile ? 'gold' : tone); }
    if (k === 'coldcase') return full(caseArtOf(card.data.template)[0], tone, true);
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
      var who = card.data.name || e.labelOf(card), sex = card.data.sex || (sus && sus.sex) || (e.sexOf && (e.sexOf(role) || e.sexOfName(who)));
      return full(personArt(who, role, sex), /Prime Suspect/.test(e.labelOf(card)) ? 'red' : tone);
    }
    if (card.def === 'rung') return full(RUNG_ART[card.data.rung] || 'ccourt-01', 'dark');
    if (FULLS[card.def]) return full(FULLS[card.def], tone);
    // A patron's seal wears that patron's own (the crown, the church, the coins).
    if (card.def === 'seal') return icon(PATRON_ART[card.data && card.data.patron] || 'cwax-04', tone);
    // A leaf from the Customs House wears the Customs House's seal: the crown over the anchor.
    if (card.def === customsLeafDef()) return full('charb2-06', tone);
    if (ICONS[card.def]) return icon(ICONS[card.def], card.def === 'wound' || card.def === 'burnout' || /^spent_/.test(card.def) ? 'red' : tone, /^spent_/.test(card.def));
    return full('csign-01', tone);
  }

  var UI = (CF.UI = {
    e: null, openVerbs: [], selected: null, hover: null, hoverSlot: null,
    speed: 1, paused: false, modal: false, drag: null,
    view: { x: 16, y: 16, z: 1 }, lifted: null, spawn: {},
    onGameOver: null, onSave: null,
  });
  UI.personArt = personArt;
  UI.womansFace = function (k) { return !!WOMEN[k]; };
  UI.customsLeafDef = customsLeafDef;
  // A case's own crime card, the picture it wears on the table (the Rolls reuse it).
  UI.caseArt = function (tpl) { return caseArtOf(tpl)[0]; };

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
  // Escape text already in the reader's language: read again, a line left part English costs the whole lookup twice.
  function escText(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function esc(s) { return escText(tr(s)); }

  // ---------------------------------------------------------------- Setup
  UI.attach = function (engine) {
    UI.e = engine;
    // A table dealt again has its music again (the ending stopped it).
    if (CF.Audio && CF.Audio.music && !engine.s.over) CF.Audio.music(true);
    UI.openVerbs = [];
    UI.selected = null;
    UI.hover = null;
    UI.lifted = null;
    UI.hoverSlot = null;
    UI.drag = null;
    UI.typing = null;
    boundsCache = null;
    UI.spawn = {};
    UI.seenVerbs = {};
    UI.newVerbs = {};
    UI.lastRank = engine.s.rank;
    weekScale = -1; // a game opened is not a week turned
    UI.lastMeter = null; // a game just opened shows its meters as they are, without a bump
    UI.journalLen = -1;
    CF.VERB_ORDER.forEach(function (id) { if (engine.verb(id).unlocked) UI.seenVerbs[id] = true; });
    ['#board', '#windows'].forEach(function (sel) { $(sel).innerHTML = ''; });
    pileEl = null; choiceEl = null; linkEl = null; pinEl = null;
    Object.keys(goneWhy).forEach(function (k) { delete goneWhy[k]; });
    applyTableSettings();
    UI.journalSeen = engine.s.journal.length;
    UI.hintMode = null;
    UI.introKey = null;
    UI.keepWeek = null;
    UI.tidyUndo = null;
    UI.pick = null;
    UI.autoPaused = false;
    renderTools();
    UI.dockH = undefined;
    $('#btn-journal').classList.remove('unread');
    $('#journal-drawer').classList.remove('open');
    if (document.body) document.body.classList.remove('has-journal');
    $('#peek').classList.remove('open');
    cardEls = {}; verbEls = {}; winEls = {}; liveCards = []; UI.verdictWait = null; UI.strainSeen = null;
    engine.on(onEvent);
    engine.dirty = true;
    requestAnimationFrame(UI.fitView);
    // A new game: the opening prose was written before anyone was watching.
    // Once the title has closed, replay it so it toasts and the book shows unread.
    if (engine.s.t === 0) {
      UI.journalSeen = 0;
      setTimeout(function () {
        if (UI.e !== engine) return;
        UI.replaying = true;
        engine.s.journal.filter(function (j) { return j.t === 0; }).reverse().forEach(function (j) { onEvent('story', j); });
        UI.replaying = false;
      }, 300);
    }
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
    var g = document.querySelector('#board .grid'), B = T.BOUNDS, board = document.querySelector('#board');
    // The grid over the whole table: its cells line up with the tidy layout. A board emptied (a new game, a change
    // of language) gets it again, first under everything else on the table.
    if (!g && board && UI.e) {
      g = h('div', 'grid');
      g.style.left = B.x + 'px'; g.style.top = B.y + 'px'; g.style.width = B.w + 'px'; g.style.height = B.h + 'px';
      board.insertBefore(g, board.firstChild);
    }
    if (g) {
      g.classList.toggle('hidden', CF.Settings.get('grid') === false);
      g.style.backgroundSize = T.PX + 'px ' + T.PY + 'px';
      g.style.backgroundPosition = (((0 - B.x) % T.PX) + T.PX) % T.PX + 'px ' + (((T.TOP - B.y) % T.PY) + T.PY) % T.PY + 'px';
    }
    UI.gridPitch = T.PX + 'x' + T.PY;
    // The case strings (and anything else a setting shapes on the table) are drawn by the next render, at once.
    if (UI.e) UI.e.dirty = true;
  }
  CF.Settings.onChange(applyTableSettings);
  UI.applyTableSettings = applyTableSettings;
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
    tiltChanged();
    // Open windows grow or shrink in place; keep them inside the table.
    Object.keys(winEls).forEach(function (vid) { positionWindow(vid, winEls[vid]); });
  };
  // A pause by the player (not the brief one under a drag) is a moment to write the save: the next frame does it.
  UI.setPaused = function (p) { UI.paused = p; if (p && !UI.autoPaused) UI.saveSoon = true; renderControls(); UI.hushSync(); };
  // The pad is muffled while the player has paused (not the brief pause under a drag) or a menu is over the table;
  // the title has the music whole.
  UI.hushSync = function () {
    if (!CF.Audio || !CF.Audio.hush) return;
    var title = null;
    try { title = document.getElementById('title'); } catch (err) { /* no page */ }
    var onTitle = !!(title && title.classList && !title.classList.contains('hidden'));
    CF.Audio.hush(!!((UI.paused && !UI.autoPaused) || (UI.modal && !onTitle)));
  };
  // The music's mood, once a second: darker when a meter is at its worst word or a threat lies on the table, and
  // a low drone under it when Vendetta or Dread is there with a threat beside it.
  var moodAt = 0;
  function moodTick() {
    var now = Date.now();
    if (!CF.Audio || !CF.Audio.mood || now - moodAt < 1000) return;
    moodAt = now;
    var e = UI.e, crit = {};
    ['pressure', 'scrutiny', 'retaliation', 'dread'].forEach(function (k) { crit[k] = meterLevel(k) >= 4; });
    var threat = e.tableCards().some(function (c) { return CF.CARDS[c.def] && CF.CARDS[c.def].kind === 'threat'; });
    var n = (crit.retaliation || crit.dread) && threat ? 2 : threat || crit.pressure || crit.scrutiny || crit.retaliation || crit.dread ? 1 : 0;
    CF.Audio.mood(n);
  }
  // A felt cue (the Vibration setting). By name: a pick-up's tick, a card slotted home, a drop refused, the
  // verdict and the new office (heavy), the week's toll, harm done. The app plays a name through the system's own
  // feedback (CaseFileAndroid.haptic, which keeps to the phone's touch-feedback setting); elsewhere the name is a
  // pattern for the web Vibration API. Milliseconds or a pattern [on, off, on, ...] still work: the app's vibrator
  // first, pulse by pulse, the web's otherwise, nothing where there is neither.
  var HAPTICS = { tick: 8, confirm: 12, reject: [8, 40, 8], heavy: 30, toll: [12, 140, 12], harm: [30, 60, 30] };
  UI.HAPTICS = HAPTICS;
  UI.haptic = function (ms) {
    if (CF.Settings.get('haptics') === false) return;
    try {
      if (typeof ms === 'string') {
        if (window.CaseFileAndroid && CaseFileAndroid.haptic) { CaseFileAndroid.haptic(ms); return; }
        if (!HAPTICS.hasOwnProperty(ms)) return;
        ms = HAPTICS[ms];
      }
      if (window.CaseFileAndroid && CaseFileAndroid.vibrate) {
        if (!(ms instanceof Array)) { CaseFileAndroid.vibrate(ms || 10); return; }
        var at = 0;
        ms.forEach(function (d, i) {
          if (i % 2 === 0) { if (at) setTimeout(function () { CaseFileAndroid.vibrate(d); }, at); else CaseFileAndroid.vibrate(d); }
          at += d;
        });
      } else if (navigator.vibrate) navigator.vibrate(ms || 10);
    } catch (err) { /* no haptics */ }
  };
  // The screen stays on only while a game is running, unpaused, with no menu
  // open. The bridge (or the browser's wake lock) is crossed only when that
  // changes; the browser drops its lock when the page is hidden, so it is
  // asked for again when the page is seen.
  var wakeLock = null, wakeAsking = false;
  function applyWake(want) {
    try {
      if (window.CaseFileAndroid && CaseFileAndroid.keepAwake) { CaseFileAndroid.keepAwake(want); return; }
      if (!navigator.wakeLock || !navigator.wakeLock.request) return;
      if (want) {
        if (wakeLock || wakeAsking) return;
        wakeAsking = true;
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeAsking = false;
          wakeLock = lock;
          if (lock.addEventListener) lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; });
          if (!UI.wakeWant) { wakeLock = null; lock.release(); }
        }, function () { wakeAsking = false; });
      } else if (wakeLock) {
        var held = wakeLock;
        wakeLock = null;
        held.release();
      }
    } catch (err) { wakeAsking = false; /* no wake lock here */ }
  }
  UI.wake = function () {
    var want = !!(UI.e && !UI.e.s.over && !UI.paused && !UI.modal && !UI.upright);
    if (want === UI.wakeWant) return;
    UI.wakeWant = want;
    applyWake(want);
  };
  // The app tells the page where the notch and the gesture bar are (CSS px).
  UI.setInsets = function (l, t, r, b) {
    var st = document.documentElement.style;
    st.setProperty('--inset-l', (l || 0) + 'px'); st.setProperty('--inset-t', (t || 0) + 'px');
    st.setProperty('--inset-r', (r || 0) + 'px'); st.setProperty('--inset-b', (b || 0) + 'px');
  };
  UI.onForeground = function () { UI.wake(); };
  UI.onBackground = function () { if (UI.e && !UI.e.s.over && CF.Settings.get('pauseOnBlur')) UI.setPaused(true); if (UI.onSave) UI.onSave(); };
  // A phone held upright (portrait, narrow): the turn card covers the felt and the clock waits, until the phone
  // is turned or the player chooses to play upright (remembered on this device).
  function portraitPhone() {
    try { return typeof matchMedia === 'function' && !!matchMedia('(orientation:portrait)').matches && !!matchMedia('(max-width:600px)').matches; } catch (err) { return false; }
  }
  function uprightChosen() {
    try { return localStorage.getItem('casefile.upright') === '1'; } catch (err) { return !!UI.uprightOk; }
  }
  function checkUpright() {
    var on = portraitPhone() && !UI.uprightOk && !uprightChosen();
    if (on === !!UI.upright) return;
    UI.upright = on;
    var t = $('#table');
    if (t) t.classList.toggle('upright', on);
    UI.wake();
    // Turned on its side: the table is fitted afresh to the new shape.
    if (!on && UI.e && portraitPhone() === false) UI.fitView();
  }
  UI.checkUpright = checkUpright;
  UI.playUpright = function () {
    UI.uprightOk = true;
    try { localStorage.setItem('casefile.upright', '1'); } catch (err) { /* this visit only */ }
    checkUpright();
    if (UI.e) UI.fitView();
  };
  UI.setSpeed = function (sp) { UI.speed = sp; UI.paused = false; renderControls(); };

  UI.init = function () {
    $('#hint').addEventListener('click', function () { UI.hintTap(); });
    renderHelpAspects();
    // The Help tells of the Harbourmaster's Books only where the rules have them.
    var hh = $('#help-harbour');
    if (hh) hh.classList.toggle('hidden', !harbourArc());
    // And of the offices' own Insights only where the rules give an Insight an office.
    var ho = $('#help-office-growth');
    if (ho) ho.classList.toggle('hidden', !Object.keys(CF.INSIGHTS || {}).some(function (id) { return typeof CF.INSIGHTS[id].rank === 'number'; }));
    $('#controls').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-speed]');
      if (!b) return;
      var sp = +b.dataset.speed;
      // On a narrow screen the play button is the only speed button: it cycles 1, 2, 3.
      if (sp === 1 && narrow() && !UI.paused) sp = UI.speed >= 3 ? 1 : (UI.speed || 1) + 1;
      if (sp === 0) UI.setPaused(!UI.paused); else UI.setSpeed(sp);
    });
    // Under a finger the banner itself is the way back: it says 'Tap to resume' and means it.
    var pb = $('#pause-banner');
    if (pb) {
      pb.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      pb.addEventListener('click', function (ev) { ev.stopPropagation(); if (UI.paused) { UI.setPaused(false); CF.Audio.play('click'); } });
    }
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
      else if (ev.key === 'Escape') closeNearest();
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
    UI.wheelScrolls = function (t) { return !!(t && t.closest && t.closest('.vwin, #journal-drawer, #peek.pinned')); };
    $('#table').addEventListener('wheel', function (ev) {
      if (UI.modal) return;
      // Inside a verb window, the Journal or a pinned dossier the wheel scrolls that paper, not the table.
      if (UI.wheelScrolls(ev.target)) return;
      ev.preventDefault();
      wheelAcc += ev.deltaY; wheelAt = { x: ev.clientX, y: ev.clientY };
      if (!wheelRaf) wheelRaf = requestAnimationFrame(function () { wheelRaf = 0; var d = wheelAcc; wheelAcc = 0; zoomAt(wheelAt.x, wheelAt.y, Math.exp(-d * 0.0015)); });
    }, { passive: false });
    $('#btn-journal').addEventListener('click', function () { UI.toggleJournal(); });
    $('#meters').addEventListener('click', function (ev) { var m = ev.target.closest('.meter[data-meter]'); if (m) UI.showMeterInfo(m.dataset.meter); });
    $('#journal-close').addEventListener('click', function () { UI.toggleJournal(false); });
    window.addEventListener('resize', function () {
      tiltChanged();
      checkUpright();
      // Keep open windows inside the (possibly smaller) table.
      Object.keys(winEls).forEach(function (vid) { positionWindow(vid, winEls[vid]); });
      checkHint();
      if (UI.e) UI.e.dirty = true;
    });
    var turnOk = $('#turn-ok');
    if (turnOk) turnOk.addEventListener('click', function () { UI.playUpright(); });
    checkUpright();
    // A hidden hint (narrow screens) gets no advisor at all; looked at again on resize.
    function checkHint() { UI.hintHidden = $('#hint').offsetParent === null; }
    checkHint();
    window.addEventListener('blur', cancelDrag);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && CF.Settings.get('pauseOnBlur') && UI.e && !UI.e.s.over) UI.setPaused(true);
      if (!document.hidden && UI.wakeWant) applyWake(true);
    });

    var last = performance.now();
    var saveT = 0, liveAt = 0;
    function frame(now) {
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      var e = UI.e;
      // One bad frame must never stop the clock: log it and keep going.
      try {
        if (e) {
          UI.tickUid = e.s.nextUid; // what this frame's tick makes is newer than this (the Bell's stipend flies out of the Bell)
          if (!e.s.over && !UI.paused && !UI.modal && !UI.upright) {
            e.tick(dt * UI.speed);
            saveT += dt;
            if (saveT > 8 && UI.onSave) { saveT = 0; UI.onSave(); }
          }
          // An answered choice or a pause is saved at once, after the tick, never in the middle of one.
          if (UI.saveSoon) { UI.saveSoon = false; saveT = 0; if (UI.onSave) UI.onSave(); }
          var dirty = e.dirty;
          if (dirty) { e.dirty = false; render(); }
          // Nothing moves under a modal, and little while paused: the idle
          // frame touches no DOM (a paused table still gets four looks a second).
          var live = dirty || (!UI.modal && (!UI.paused || now - liveAt >= 250));
          if (live) { liveAt = now; updateLive(); }
        }
      } catch (err) {
        if (typeof console !== 'undefined') console.error(err);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // ---------------------------------------------------------------- Events
  // A verdict is heard from its stamp, so the story of it is silent; a major story turns a page.
  var STORY_SOUNDS = { case: 'case', week: 'week', major: 'page' };
  // Bad news comes in three weights: harm done to you or yours (the alarm and the shake), a need
  // arriving (a heartbeat), and the rest (an omen). The engine may mark harm by kind or flag;
  // until it does, the titles of harm are known here.
  var HARM_TITLES = /^(A Watchman Dead|A Watchman Hurt|Wounded|Beaten on the Stair|Fever|Lost: .+)$/;
  function dangerWeight(entry) {
    var k = entry.kind;
    // The rules mark how loud a bad story lands (engine story(): entry.cue): a body hurt, a need come, or quiet.
    if (k === 'danger' && entry.cue) return entry.cue === 'harm' || entry.cue === 'need' || entry.cue === 'quiet' ? entry.cue : 'omen';
    if (k === 'harm' || (k === 'danger' && (entry.harm || HARM_TITLES.test(entry.title || '')))) return 'harm';
    if (k === 'need') return 'need';
    if (k !== 'danger') return null;
    if (CF.NEEDS) for (var n in CF.NEEDS) if (CF.CARDS[n] && CF.CARDS[n].label === entry.title) return 'need';
    // The verdict's own stamp speaks for a man found not guilty.
    if (/^Not Guilty\b/.test(entry.title || '')) return 'quiet';
    return 'omen';
  }
  UI.dangerWeight = dangerWeight;
  function storySound(entry) {
    var w = dangerWeight(entry);
    if (w === 'harm') return 'danger';
    if (w === 'need') return 'heartbeat';
    if (w === 'omen') return 'omen';
    if (w === 'quiet') return null;
    return STORY_SOUNDS[entry.kind] || null;
  }
  UI.storySound = storySound;
  UI.aspectFrom = aspectFrom;
  function shake() {
    if (!CF.Settings.get('shake')) return;
    var app = $('#app');
    app.classList.remove('shake');
    void app.offsetWidth;
    app.classList.add('shake');
  }

  // What ignoring an ask costs: the spec's penalty, as the engine reads the ask (a case's own door, 'A battened
  // hatch', is the plain 'A locked door' under its scene's words: e.askSpec puts them together).
  function askPenalty(vid) {
    var e = UI.e, v = e.verb(vid);
    if (!v || !v.ask) return null;
    if (v.ask.penalty !== undefined) return v.ask.penalty || null;
    var spec = e.askSpec ? e.askSpec(v) : null;
    if (!spec) spec = (CF.ASKS || []).filter(function (a) { return a.label === v.ask.label && (!a.when || a.when(v.recipe, vid)); })[0];
    return spec && spec.penalty ? spec.penalty : null;
  }
  UI.askPenalty = askPenalty;

  // The verdict has its moment where the player was watching: on the Blood Court card whose clock ran out (for a case
  // gone cold, on the case card), kept a moment as a ghost after the engine has taken it. The stamp is a wax unlike the
  // Court tile's own: red for a conviction, the ribbon for an acquittal, the eye for a case gone cold. Then the
  // Condemned or the Abroad card the verdict makes comes out of it, and the ghost goes. No court sits for a cold case,
  // so its stamp is never on the Court; only when the trial card is not on the board does the Court's tile take it.
  var VERDICT_HOLD = 1400;
  var TRIAL_OUTCOMES = { convicted: 1, wrongful: 1, acquitted: 1 };
  // The card the verdict was given on. The engine may name it (payload.uid, payload.at); else it is the card of that
  // case and kind that has just left the state but is still on the board.
  function verdictCard(rec) {
    var e = UI.e;
    if (rec.uid !== undefined && rec.uid !== null && cardEls[rec.uid]) return String(rec.uid);
    var cid = rec.caseId || (rec.id ? String(rec.id).replace(/-[^-]*$/, '') : null), want = rec.outcome === 'cold' ? 'case' : 'trial', found = null;
    if (!cid) return null;
    Object.keys(cardEls).forEach(function (uid) { var el = cardEls[uid]; if (!e.card(+uid) && el.cfCase === cid && el.cfDef === want) found = uid; });
    return found;
  }
  function stampVerdict(rec) {
    if (!rec) return;
    var e = UI.e, board = $('#board'), outcome = rec.outcome, key = VERDICT_ART[outcome] || VERDICT_DEFAULT, trial = !!TRIAL_OUTCOMES[outcome];
    var uid = verdictCard(rec), el = uid !== null ? cardEls[uid] : null;
    if (el && el.parentNode === board) {
      delete cardEls[uid]; // the board's sync leaves it be: it is the stamp's, not the state's
      el.classList.remove('leaving', 'selected', 'noticed', 'drop-hover', 'can-stack');
      el.classList.add('judged');
      var st = h('div', 'verdict stamp');
      st.style.backgroundImage = art(key);
      el.appendChild(st);
      var at = rec.at && rec.at.x !== undefined ? rec.at : el.cfAt;
      var from = e.s.nextUid || 0;
      // What the verdict makes waits under the stamp until the ghost gives it up.
      var wait = UI.verdictWait = trial ? { from: from } : null;
      setTimeout(function () {
        if (UI.e !== e) { el.remove(); return; } // another game since
        // A later verdict in the same hold keeps its own wait (and its cards) until its stamp lifts.
        var later = UI.verdictWait && UI.verdictWait !== wait ? UI.verdictWait.from : Infinity;
        if (UI.verdictWait === wait) UI.verdictWait = null;
        var made = e.tableCards().filter(function (c) { return c.uid >= from && (c.def === 'condemned' || c.def === 'atlarge'); }).sort(function (a, b) { return b.uid - a.uid; })[0];
        var mel = made && cardEls[made.uid];
        // Every card that waited under the stamp shows now, not only the one the ghost gives up: two verdicts in
        // one hold, or a Condemned that joined a stack meanwhile, are never left unseen.
        Object.keys(cardEls).forEach(function (k) { if (+k < later && cardEls[k].classList.contains('awaiting')) cardEls[k].classList.remove('awaiting'); });
        if (mel) {
          if (at && !calm()) {
            mel.classList.add('no-anim');
            place(mel, at.x, at.y);
            void mel.offsetWidth;
            mel.classList.remove('no-anim');
            mel.classList.add('settle');
            place(mel, made.loc.x, made.loc.y);
            setTimeout(function () { mel.classList.remove('settle'); }, 400);
          }
          // On a phone the trial card is often off the screen: an edge mark says where the verdict landed.
          UI.notice({ uid: made.uid, label: cardTitle(made), kind: 'verdict' });
        }
        el.classList.add('leaving');
        setTimeout(function () { el.remove(); }, 300);
        e.dirty = true;
      }, VERDICT_HOLD);
    } else if (trial && verbEls.arrest) {
      var tok = verbEls.arrest, old = tok.querySelector('.verdict');
      if (old) old.remove();
      var ts = h('div', 'verdict stamp');
      ts.style.backgroundImage = art(key);
      tok.appendChild(ts);
      setTimeout(function () { ts.remove(); }, 2000);
    }
    // The gavel, twice, as the stamp comes down; a bell tolls for the condemned, the crowd murmurs for the acquitted.
    if (trial) { CF.Audio.play(outcome === 'acquitted' ? 'acquit' : 'convict'); UI.haptic('heavy'); }
  }

  // A strain card (the Fever, a Fixation) that a story just announced: the card the story names (entry.uid).
  var STRAIN_DEFS = ['burnout', 'tunnel'];
  function strainOfStory(entry) {
    if (!entry || entry.kind !== 'danger' || !entry.uid || !UI.e) return null;
    var c = UI.e.card(entry.uid);
    return c && STRAIN_DEFS.indexOf(c.def) >= 0 ? c.uid : null;
  }
  function strainArrived(uid) {
    var e = UI.e, c = e && e.card(uid);
    if (!c || UI.strainSeen === uid || UI.replaying) return;
    UI.strainSeen = uid;
    UI.notice({ uid: uid, label: cardTitle(c), kind: 'danger', fresh: true });
    if (c.loc && c.loc.t === 'table' && !UI.drag && !UI.modal && !e.s.choice) panToBoard(c.loc.x, c.loc.y, T.CW, T.CH);
    // At speed on a phone the Fever's two minutes pass in forty seconds: the clock drops to a walk.
    if (narrow() && UI.speed > 1) { UI.speed = 1; renderControls(); }
  }

  function onEvent(type, payload) {
    if (type === 'gone') cardGone(payload);
    if (type === 'resolved' && UI.onResolved) UI.onResolved(payload);
    if (type === 'resolved') stampVerdict(payload);
    // The Fever or a Fixation has come (the engine's 'strain' event where it sends one, else its story): an edge mark,
    // the camera on it, and a phone's clock back to a walk. The toast, tapped, goes to the card.
    if (type === 'strain' && payload && payload.uid) strainArrived(payload.uid);
    var strainUid = type === 'story' ? strainOfStory(payload) : null;
    if (strainUid) strainArrived(strainUid);
    if (type === 'story' && payload.kind === 'week' && !UI.replaying) weekTurns(payload);
    if (type === 'story') {
      var k = payload.kind, cue = k === 'week' ? null : storySound(payload);
      if (!UI.modal && cue) CF.Audio.play(cue);
      if (!UI.modal && dangerWeight(payload) === 'harm') { shake(); UI.haptic('harm'); }
      if (k === 'case' || k === 'danger' || k === 'harm' || k === 'need' || k === 'major' || k === 'victory' || k === 'week') toast(strainUid ? { title: payload.title, text: payload.text, parts: payload.parts, kind: k, uid: strainUid } : payload);
      if (k === 'case' && !UI.replaying && CF.Settings.get('pauseOnCase')) UI.setPaused(true);
    }
    if (type === 'complete') {
      // The finish lands in the pad's chord, in the verb's own voice; the slab rises once before it glows.
      if (payload.verb !== 'time') CF.Audio.play('complete', { vol: UI.speed > 1 ? 0.7 : 1, verb: payload.verb });
      slabMove(payload.verb, 'risen', 320);
      var v = UI.e.verb(payload.verb);
      if (UI.openVerbs.indexOf(payload.verb) < 0 && v.story) toast({ title: CF.VERBS[payload.verb].label + ': ' + v.story.title, text: v.story.text, kind: 'verb', verb: payload.verb });
      if (CF.Settings.get('pauseOnVerb')) UI.setPaused(true);
    }
    if (type === 'ask') {
      // Someone at the door: two knocks, not a menu's click.
      CF.Audio.play('knock');
      var askPen = askPenalty(payload.verb);
      toast({ title: CF.VERBS[payload.verb].label + ' asks: ' + payload.label, text: payload.text + (askPen === 'fatigue' ? ' ' + tr('Answer it, or come back wearier.') : askPen === 'thin' ? ' ' + tr('Answer it, or find less.') : ''), kind: 'verb', verb: payload.verb });
      if (CF.Settings.get('pauseOnVerb')) UI.setPaused(true);
    }
    if (type === 'choice') {
      CF.Audio.play('start');
      // The question stands on the table with its words: its story's toast (the Journal keeps it) would only lie
      // over the answers, at the right of the table where the choice is put.
      Array.prototype.slice.call($('#toasts').children).forEach(function (t) { if (t.dataset && t.dataset.title === payload.title) t.remove(); });
      if (UI.openVerbs.length) closeAllWindows();
      UI.viewBefore = { x: UI.view.x, y: UI.view.y, z: UI.view.z };
      // The camera goes once the question stands on the table (the render after this), so it is framed whole.
      UI.choicePan = true;
    }
    if (type === 'chosen') UI.saveSoon = true;
    if (type === 'chosen' && UI.viewBefore) {
      // Back to exactly where you were looking, at the same zoom, once the answer's seal has been seen.
      var back = UI.viewBefore; UI.viewBefore = null;
      setTimeout(function () { tweenView(back); }, CHOICE_HOLD);
    }
    if (type === 'autorun') {
      // An event runs a verb by itself: the cards are pulled in, the window opens.
      var tokEl = verbEls[payload.verb];
      payload.uids.forEach(function (u, i) { var c = UI.e.card(u); var el = cardEls[u]; if (c && el && tokEl) setTimeout(function () { flyTo(el, tokEl, c); el.remove(); delete cardEls[u]; }, i * 160); });
      verbStarted(payload.verb);
      setTimeout(function () { openWindow(payload.verb); UI.notice({ verb: payload.verb, label: CF.VERBS[payload.verb].label }); }, 300);
    }
    if (type === 'unlock') UI.notice({ verb: payload.verb, label: CF.VERBS[payload.verb].label, fresh: true });
    if (type === 'story' && payload.kind === 'case') {
      var cases = UI.e.tableCards().filter(function (c) { return CF.CARDS[c.def].kind === 'case'; }).sort(function (a, b) { return b.uid - a.uid; });
      if (cases[0]) UI.notice({ uid: cases[0].uid, label: cardTitle(cases[0]), fresh: true, kind: 'case' });
    }
    if (type === 'story' && CF.OPENING_TEXT && payload.title === CF.OPENING_TEXT.keep) UI.keepWeek = UI.e.s.week;
    // A leaf from the Customs House left by an examiner sent home is marked like an Insight.
    if (type === 'story' && customsLeafDef() && typeof UI.tickUid === 'number') {
      var leaf = UI.e.cardsOf(customsLeafDef()).filter(function (c) { return c.uid >= UI.tickUid && c.loc.t === 'table'; })[0];
      if (leaf) UI.notice({ uid: leaf.uid, label: cardTitle(leaf), fresh: true, kind: 'insight' });
    }
    if (type === 'story' && /^An Insight/.test(payload.title)) {
      var ins = UI.e.tableCards().filter(function (c) { return c.def === 'insight'; }).sort(function (a, b) { return b.uid - a.uid; });
      if (ins[0]) UI.notice({ uid: ins[0].uid, label: cardTitle(ins[0]), fresh: true, kind: 'insight' });
    }
    if (type === 'dues') {
      var bell = verbEls.time;
      UI.duesWeek = UI.e.s.week;
      // Each Coin flies to the Bell and rings as it lands.
      payload.uids.forEach(function (u, i) {
        var c = UI.e.card(u); var el = cardEls[u] || (c && cardEls[UI.e.stackOf(c)[0].uid]);
        markFlown(u);
        if (c && el) setTimeout(function () { flyTo(el, bell, c); setTimeout(function () { CF.Audio.play('coin'); }, 350); }, i * 220);
      });
    }
    if (type === 'expiring') {
      var fc = UI.e.card(payload.uid), need = fc && CF.NEEDS && CF.NEEDS[fc.def];
      // A token under a charge that would stand at half proof or better says whom to take to the Court.
      var fch = fc && fc.def === 'clue' && UI.e.verb('arrest').unlocked ? chargeable(UI.e, fc.caseId, fc) : null;
      // The time left in the city's days, read off the card and the week's length.
      var fdays = CF.daysLeft(fc ? fc.life : 0), fleft = fdays <= 1 ? tr('A day') : tr('{n} days', { n: fdays });
      // The Fever's clock ends the file: it says so, and where to go.
      var fever = fc && fc.def === 'burnout';
      var ftext = fever ? tr('Into Rest now, or the file ends.') : need ? tr('{left} before it takes its due. Into Rest, now: Coin, or what you have.', { left: fleft })
        : fch ? tr('Into The Court with {accused} now, or lay it in a verb: a card\'s clock stops while a verb works on it.', { accused: UI.e.labelOf(fch.card) })
        : tr('{left} before it is gone. A card\'s clock stops while a verb works on it.', { left: fleft });
      toast({ title: (need || fever ? 'Pressing: ' : 'Fading: ') + payload.label, text: ftext, kind: 'danger', uid: payload.uid, verb: payload.verb });
      // A need or an affliction about to take its due is heard once; a fading token or witness stays quiet.
      if (need || (fc && CF.CARDS[fc.def] && CF.CARDS[fc.def].kind === 'threat')) { CF.Audio.play('heartbeat'); UI.haptic([15, 90, 15]); }
    }
    // The Fever half a minute from the end (engine 'pressing'): its story toasts with the card; this is the heartbeat
    // and the mark on it, once.
    if (type === 'pressing' && payload && payload.uid && !UI.replaying && UI.pressedUid !== payload.uid) {
      UI.pressedUid = payload.uid;
      CF.Audio.play('heartbeat'); UI.haptic([15, 90, 15]);
      var pc = UI.e.card(payload.uid);
      if (pc) UI.notice({ uid: pc.uid, label: cardTitle(pc), kind: 'danger', fresh: true });
    }
    if (type === 'over' && UI.onGameOver) setTimeout(function () { UI.onGameOver(UI.e.s.over); }, 600);
  }

  // The week turns: the Bell tolls (cracked, when the lodging went unpaid), its tile swings, the hourglass on the
  // bar turns over and the bar flashes full instead of running back, the music starts again from its first
  // chord, and the stipend comes out of the Bell. Less motion keeps the sound and drops the swing and the turn.
  // A verb set to work: the start's two notes, and its slab pressed down into the felt. Under less motion it keeps
  // still and the sound is enough.
  function verbStarted(vid) {
    CF.Audio.play('start');
    slabMove(vid, 'pressed', 250);
  }
  function slabMove(vid, cls, ms) {
    var el = verbEls[vid];
    if (!el || calm()) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  UI.verbStarted = verbStarted;
  function weekTurns(payload) {
    var e = UI.e;
    var paid = payload.paid !== undefined ? payload.paid !== false : UI.duesWeek === e.s.week;
    CF.Audio.play(paid ? 'week' : 'weekUnpaid');
    if (CF.Audio.downbeat) CF.Audio.downbeat();
    UI.haptic('toll');
    var bell = verbEls.time;
    if (bell && !calm()) { bell.classList.remove('toll'); void bell.offsetWidth; bell.classList.add('toll'); setTimeout(function () { bell.classList.remove('toll'); }, 1300); }
    var glass = document.querySelector('#weekbar .wb-glass');
    if (glass && !calm()) { glass.classList.remove('turn'); void glass.offsetWidth; glass.classList.add('turn'); setTimeout(function () { glass.classList.remove('turn'); }, 800); }
    var wb = document.querySelector('#weekbar');
    if (wb) { wb.classList.remove('flash'); void wb.offsetWidth; wb.classList.add('flash'); setTimeout(function () { wb.classList.remove('flash'); }, 700); }
    // The stipend: the rules' own list where the story carries it, else the Coin this tick made.
    var salary = payload.uids || payload.salary || (typeof UI.tickUid === 'number' ? e.cardsOf('funds', true).filter(function (c) { return c.uid >= UI.tickUid && c.loc && c.loc.t === 'table'; }).map(function (c) { return c.uid; }) : []);
    if (bell) salary.forEach(function (u) { markSpawn(u, bell); });
  }

  function toast(entry) {
    if (UI.modal) return;
    var box = $('#toasts');
    var t = h('div', 'toast k-' + (entry.kind || 'event'));
    // The bar is the stylesheet's border-image, read from --bar; a verb's toast
    // is title-only (the window has the text); a story stays longer.
    t.style.setProperty('--bar', art(TOAST_BARS[entry.kind] || 'clabel-06'));
    t.style.setProperty('--icon', art(TOAST_ICONS[entry.kind] || 'ccirc-01'));
    var text = entry.kind === 'verb' ? 'Tap to read' : entry.parts ? storyText(entry) : entry.text || '';
    // The medallion is its own element, so a right-to-left bar can be mirrored under it while the icon is not.
    t.innerHTML = '<i class="t-icon"></i><b>' + esc(entry.title) + '</b><span>' + esc(text) + '</span>';
    t.dataset.title = entry.title || '';
    var stay = TOAST_LONG[entry.kind] ? 9000 : 6000;
    t.addEventListener('click', function () {
      if (entry.verb) openWindow(entry.verb);
      else if (entry.uid) { if (!UI.panTo(entry.uid) && entry.verb) openWindow(entry.verb); }
      else if (entry.kind === 'minor') { /* nothing to show */ }
      // On a phone the toasts sit over the lowest cards: a thumb going for a card puts the toast away and no more.
      // The Journal keeps the story (the menu opens it).
      else if (narrow()) { /* dismissed */ }
      else { UI.toggleJournal(true); $('#journal').scrollTop = 0; }
      t.remove();
    });
    box.appendChild(t);
    // Until the stylesheet paints the bar from --bar, it is the background.
    try { if (typeof getComputedStyle === 'function' && /^(none)?$/.test(getComputedStyle(t).borderImageSource || '')) t.style.backgroundImage = 'var(--bar)'; } catch (err) { /* no layout here */ }
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('leaving'); setTimeout(function () { t.remove(); }, 300); }, stay);
  }

  // ---------------------------------------------------------------- Render
  function render() {
    UI.adviceAt = undefined; UI.urgentAt = undefined; // the table changed: the advisor reads it afresh
    boundsCache = null;
    // One pass, one memo: the rules may keep what they work out for this render (which cards reach a slot, why
    // a verb is locked) in e._memo, and forget it when the pass ends. Nothing in a render changes the state.
    var e = UI.e;
    e._memo = {};
    try {
      renderTop();
      syncBoard();
      syncLinks();
      syncWindows();
      markFits();
      renderJournal();
      renderInspector();
      renderControls();
      renderHint();
      if (UI.choicePan) { UI.choicePan = false; if (e.s.choice) panToChoice(); }
    } finally { e._memo = null; }
  }

  // One render, now: for the tests, which have no frame loop.
  UI.renderNow = function () { if (UI.e) { UI.e.dirty = false; render(); } };
  // The pointer, by hand: for the tests, which have no pointer.
  UI.pointer = { down: function (ev) { onPointerDown(ev); }, move: function (ev) { onPointerMove(ev); }, up: function (ev) { onPointerUp(ev); } };
  // One live frame's writes, now: for the tests, which have no frame loop.
  UI.updateLive = function () { if (UI.e) updateLive(); };

  // The journal is a drawer over the table, shown only when asked for.
  UI.toggleJournal = function (on) {
    var open = on === undefined ? !$('#journal-drawer').classList.contains('open') : !!on;
    $('#journal-drawer').classList.toggle('open', open);
    // The toasts stand clear of the open drawer (the stylesheet), not over the Roads at its head.
    if (document.body) document.body.classList.toggle('has-journal', open);
    $('#btn-journal').classList.toggle('on', open);
    if (open) { UI.journalSeen = UI.e ? UI.e.s.journal.length : 0; $('#btn-journal').classList.remove('unread'); }
  };

  // A line under the dock that tells a new player what to try next: the
  // guided start's hint while it runs, then the plain how-to until the
  // player has moved something (remembered across games).
  var PLAIN_HINT = 'Drag cards onto the verbs above, or tap an empty slot to pick a card for it. Drag the table to look around, pinch or scroll to zoom. Drag a stack by its number to move all of it.';
  // A verb waiting on the player: an unanswered ask, then finished work.
  function pressingLine() {
    var e = UI.e, verbs = CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; });
    var asking = verbs.filter(function (v) { var x = e.verb(v); return x.status === 'running' && x.ask && !x.ask.filled; });
    if (asking.length) return tr('{verb} asks for something: open it, or drop the card on it.', { verb: CF.VERBS[asking[0]].label });
    var done = verbs.filter(function (v) { return e.verb(v).status === 'done'; });
    if (done.length) return tr('{verb} has finished: tap its tile, turn the cards over, then double-tap or Take all.', { verb: CF.VERBS[done[0]].label });
    return null;
  }
  // What costs dearly within the minute, and speaks even while verbs run (it outranks a finished verb in the hint):
  // the fever, the Bell with the purse short, a need about to take its due. Null when none applies.
  function urgentLine() {
    var e = UI.e, s = e.s;
    if (s.over) return null;
    // Only while the verb that answers it is free to take it: a Rest already at work is the answer in hand.
    var can = function (v) { return e.verb(v).unlocked && !e.lockReason(v) && e.verb(v).status === 'idle'; };
    var table = e.tableCards();
    // The fever locks the street: Rest comes before anything the locked verbs would do.
    if (e.countOf('burnout') && can('reflect')) return tr('The fever has you: put Fever into Rest before anything else.');
    // The Bell is near and the purse is short.
    var money = table.filter(function (c) { return c.def === 'funds'; }).length, bellIn = CF.WEEK - s.weekT;
    if (e.verb('time').unlocked && !s.flags.bellSilent && money < e.dues() && bellIn < 60 && can('duty')) return tr('The Bell rings in {t} and wants {n} Coin; you have {m}. Attend with Health or Wit, now.', { t: U.fmtTime(bellIn), n: e.dues(), m: money });
    // A need about to take its due.
    var need = can('reflect') && table.filter(function (c) { return CF.NEEDS && CF.NEEDS[c.def] && c.maxLife && c.life < 60; }).sort(function (a, b) { return a.life - b.life; })[0];
    if (need) { UI.hintGo = { uid: need.uid }; return tr('{need} is on the table with {t} left: into Rest with a Coin, or a watchman, a Quarter, an informer.', { need: e.labelOf(need), t: U.fmtTime(need.life) }); }
    return null;
  }
  // Read twice a second at most (render() forgets it), with the place it names.
  function cachedUrgent() {
    var now = performance.now();
    if (UI.urgentAt === undefined || now - UI.urgentAt >= 500) { UI.hintGo = null; UI.urgentCache = urgentLine(); UI.urgentGo = UI.hintGo; UI.urgentAt = now; }
    UI.hintGo = UI.urgentCache ? UI.urgentGo || null : null;
    return UI.urgentCache;
  }
  // Every row met and still half proof: full proof wants word behind it (a witness, a confession, a token that
  // names them), and nothing on the table says they did it.
  var WORD_WANTED = 'a witness, a confession, or proof that names them';
  // What the best charge against an accused still lacks: the short rows, or (all met) word behind it.
  function stillWanted(e, suspectCard) {
    var rec = e.caseRec(suspectCard.caseId);
    if (!rec || !e.assessCharge) return null;
    var tokens = e.tableCards().filter(function (c) { return c.def === 'clue' && c.caseId === rec.id; });
    var a = e.assessCharge(suspectCard, tokens);
    if (!a || a.tier === 'strong') return null;
    var rows = CF.Charge.describe(a).rows.filter(function (r) { return r.have < r.need; });
    if (rows.length) return { a: a, rows: rows };
    return a.wordWanted ? { a: a, rows: [], word: true } : null;
  }
  // The accused a case's tokens on the table (and `extra`, a token elsewhere) would carry at half proof or better:
  // the Prime Suspect first, then the best score. Null when nobody is chargeable.
  function chargeable(e, caseId, extra) {
    var rec = caseId && e.caseRec(caseId);
    if (!rec || rec.status !== 'open' || !e.assessCharge) return null;
    var table = e.tableCards(), best = null;
    var toks = table.filter(function (c) { return c.def === 'clue' && c.caseId === rec.id; });
    if (extra && toks.indexOf(extra) < 0) toks.push(extra);
    table.forEach(function (c) {
      if (c.def !== 'suspect' || c.caseId !== rec.id || e.unavailableReason(c)) return;
      var su = e.suspectOf(c);
      if (su && su.cleared) return;
      var a = e.assessCharge(c, toks);
      if (!a || (a.tier !== 'reasonable' && a.tier !== 'strong')) return;
      var prime = !!rec.identified && c.data.key === rec.identified;
      if (!best || (prime && !best.prime) || (prime === best.prime && a.score > best.a.score)) best = { card: c, a: a, prime: prime };
    });
    return best;
  }
  // Whether Attend takes the Order's dagger (Double the Guard, with a watchman): read off the verb, so the
  // interface follows the rules whether or not they carry it.
  function daggerGuard() {
    var v = CF.VERBS.duty;
    return !!(v && v.slots && v.slots.some(function (sl) { return (sl.accepts || []).indexOf('dagger') >= 0; }));
  }
  UI.chargeable = function (caseId, extra) { return UI.e ? chargeable(UI.e, caseId, extra) : null; };
  // What to do next, read off the table: the first thing that applies.
  UI.advice = function () {
    var e = UI.e, s = e.s;
    UI.hintGo = null;
    if (!e || s.over) return null;
    if (s.choice) { UI.hintGo = { spot: e.choiceSpot() }; return tr('The city is asking you something and the clock waits. Tap the question to answer it.'); }
    var verbs = CF.VERB_ORDER.filter(function (v) { return e.verb(v).unlocked; });
    // A line speaks only while the verb it sends to is free: a busy verb keeps its own counsel, the idle ones are
    // still told what waits for them.
    var idle = function (v) { return e.verb(v).status === 'idle'; };
    var can = function (v) { return e.verb(v).unlocked && !e.lockReason(v) && idle(v); };
    var running = verbs.filter(function (v) { return e.verb(v).status === 'running'; });
    // What will cost the player dearly in a minute outranks a verb that has finished or asks.
    var urgent = urgentLine();
    if (urgent) return urgent;
    UI.hintGo = null;
    var pressing = pressingLine();
    if (pressing) return pressing;
    var table = e.tableCards(), has = function (d) { return table.filter(function (c) { return c.def === d && !e.unavailableReason(c); }); };
    // A spent ability, the one nearest coming back: what a rule that wanted it says instead of falling silent.
    var spentOf = function (ab) { return has(CF.CARDS[ab].spends || 'spent_' + ab).sort(function (a, b) { return a.life - b.life; })[0]; };
    var cases = table.filter(function (c) { return c.def === 'case'; });
    var open = cases.map(function (c) { return { card: c, rec: e.caseRec(c.caseId) }; }).filter(function (x) { return x.rec && x.rec.status === 'open'; });
    // An open case's card lying in an idle verb's slot is still in hand: the desk is not empty.
    var held = e.cardsOf('case', true).filter(function (c) { return c.loc.t === 'slot' && idle(c.loc.verb); }).map(function (c) { return { card: c, rec: e.caseRec(c.caseId) }; }).filter(function (x) { return x.rec && x.rec.status === 'open'; });
    var inHand = open.length + held.length;
    var wit = has('focus')[0], hp = has('health')[0];
    // A case about to go cold with somebody to charge.
    if (e.verb('arrest').unlocked && idle('arrest')) for (var ci = 0; ci < open.length; ci++) {
      if (open[ci].card.life >= 120) continue;
      var accused = table.filter(function (c) { return c.def === 'suspect' && c.caseId === open[ci].rec.id && !e.unavailableReason(c); })[0];
      if (accused) { UI.hintGo = { uid: accused.uid }; return tr('{title} has {d} days left. Charge {name} with what you have, or let it go.', { title: open[ci].rec.title, d: CF.daysLeft(open[ci].card.life), name: e.labelOf(accused) }); }
    }
    // A token about to fade from under a charge that would stand at half proof or better.
    if (e.verb('arrest').unlocked && idle('arrest')) {
      var fading = table.filter(function (c) { return c.def === 'clue' && c.caseId && c.maxLife && c.life < 60 && !e.unavailableReason(c); }).sort(function (a, b) { return a.life - b.life; });
      for (var fi = 0; fi < fading.length; fi++) {
        var ch = chargeable(e, fading[fi].caseId);
        if (ch) { UI.hintGo = { uid: fading[fi].uid }; return tr('The proof against {name} fades in {t}. Charge now, or lose it.', { name: e.labelOf(ch.card), t: U.fmtTime(fading[fi].life) }); }
      }
    }
    // The Order's dagger: Rest answers it, and Attend with a watchman where the rules allow it.
    var dagger = has('dagger')[0], guardable = dagger && daggerGuard() && has('teammate').length && can('duty');
    if (dagger && (guardable || idle('reflect'))) {
      UI.hintGo = { uid: dagger.uid };
      if (guardable) return tr('A dagger on the pillow, {t} left: into Rest with two Coin to buy a season, or into Attend with a watchman.', { t: U.fmtTime(dagger.life) });
      return tr('A dagger on the pillow, {t} left: into Rest with two Coin to buy a season, or alone to endure it.', { t: U.fmtTime(dagger.life) });
    }
    // The underworld's grudge, and nothing to meet it with.
    if (meterLevel('retaliation') >= 3 && !hp && idle('reflect')) return tr('The Vendetta is high and you are Winded: an attack now would find you without Health. Rest before the Bell.');
    // The Rival has acted twice and still has their desk.
    // One thread a week (data.heatWeek); the second is the Rival caught at their own work (rivalCatch), where the
    // rules want it; without that, Wit or Instinct again.
    var rival = table.filter(function (c) { return c.def === 'rival'; })[0];
    if (rival && (rival.data.heat || 0) < 2 && !rivalCareful(rival) && s.journal.filter(function (j) { return RIVAL_TITLES.test(j.title); }).length >= 2) {
      var rname = rival.data.name || e.labelOf(rival), inst = has('instinct')[0];
      // Caught at it: the second thread is their own dirty work, put before them in Question.
      if (rival.data.heat && rivalCatch(rival)) {
        var dirt = rivalDirt(e)[0];
        if (dirt && can('interrogate')) { UI.hintGo = { uid: dirt.uid }; return tr('One thread on the Rival. Now catch them at it: Question {name} with {label}.', { name: rname, label: e.labelOf(dirt) }); }
      } else if (wit && can('interrogate')) { UI.hintGo = { uid: rival.uid }; return rival.data.heat ? tr('One thread on the Rival. Pull it: Question {name} with Wit.', { name: rname }) : tr('The Rival has moved twice. Question {name} with Wit to find their weakness.', { name: rname }); }
      else if (inst && can('investigate')) { UI.hintGo = { uid: rival.uid }; return rival.data.heat ? tr('One thread on the Rival. Pull it: shadow {name} in Explore with Instinct.', { name: rname }) : tr('The Rival has moved twice. Shadow {name} in Explore with Instinct to find their weakness.', { name: rname }); }
      else if (!wit && spentOf('focus') && CF.VERBS.interrogate && e.verb('interrogate').unlocked) return spentLine('focus', spentOf('focus'));
      else if (!inst && spentOf('instinct') && e.verb('investigate').unlocked) return spentLine('instinct', spentOf('instinct'));
    }
    // Two leaves from the Customs House open the Harbourmaster's Books, where the rules have that case.
    var leafDef = customsLeafDef(), leafRec = recipeOf(leafDef), leaves = leafRec ? freeOf(leafDef).filter(function (c) { return c.loc.t === 'table'; }) : [];
    if (leaves.length >= LEAVES_NEED && can(leafRec.verb) && e.verb(leafRec.verb).status === 'idle') {
      UI.hintGo = { uid: leaves[0].uid };
      return tr('Two leaves from the Customs House: lay them in {verb} to open the Harbourmaster\'s Books.', { verb: tr(CF.VERBS[leafRec.verb].label) });
    }
    var insight = table.filter(function (c) { return c.def === 'insight' && c.data && CF.INSIGHTS[c.data.insight] && !e.unavailableReason(c); })[0];
    if (insight && can('reflect')) return tr('An Insight waits: put {label} into Rest alone to learn it, or with your {ability} to keep it as a trick.', { label: e.labelOf(insight), ability: tr(CF.CARDS[CF.INSIGHTS[insight.data.insight].trains].label) });
    // A case laid in an idle verb's slot and left there: the plate is waiting to be pressed.
    var laid = held.filter(function (x) { var pv = e.preview(x.card.loc.verb); return pv && pv.label && !pv.blocked; })[0];
    if (laid) return tr('{title} lies in {verb}: press {recipe}.', { title: laid.rec.title, verb: tr(CF.VERBS[laid.card.loc.verb].label), recipe: tr(e.preview(laid.card.loc.verb).label) });
    if (can('investigate')) for (var i = 0; i < open.length; i++) if (open[i].rec.searches === 0) return tr('A new case: put {title} into Explore to search the scene.', { title: open[i].rec.title });
    var raw = has('evidence')[0];
    if (raw && can('analyze')) return tr('Raw proof waits: put {label} into Study to read it.', { label: e.labelOf(raw) });
    var w = has('witness').filter(function (c) { return !c.data.asked; })[0];
    if (w && wit && can('interrogate')) return tr('A witness: put {name} into Question with Wit.', { name: e.labelOf(w) });
    var lacking = null, confront = null;
    if (can('arrest')) for (var j = 0; j < open.length; j++) {
      var rec = open[j].rec, sc = table.filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; });
      var tokens = table.filter(function (c) { return (c.def === 'clue') && c.caseId === rec.id; });
      var standing = sc.filter(function (c) { var su = e.suspectOf(c); return !su || !su.cleared; });
      // Your own reasoning named somebody (Prime Suspect): full proof against anyone else is not offered.
      var prime = rec.identified ? standing.filter(function (c) { return c.data.key === rec.identified; })[0] : null;
      if (prime) { var pa = e.assessCharge(prime, tokens); if (pa && pa.tier === 'strong') { UI.hintGo = { uid: prime.uid }; return tr('The proof is enough: put {name} and the tokens into the Court.', { name: e.labelOf(prime) }); } }
      for (var k = 0; k < sc.length; k++) {
        var a = e.assessCharge(sc[k], tokens);
        if (a && a.tier === 'strong' && !prime) return tr('The proof is enough: put {name} and the tokens into the Court.', { name: e.labelOf(sc[k]) });
        var sw = stillWanted(e, sc[k]);
        if (sw && sw.rows.length && (!lacking || sw.a.score > lacking.a.score)) lacking = { a: sw.a, row: sw.rows[0], card: sc[k] };
        // Every row met, and no word behind it: the accused it points to (or the only one left) can be confronted
        // with a token of their own case (e.confrontFor). A confession freely given is full proof.
        var only = standing.length === 1 && standing[0] === sc[k];
        if (sw && sw.word && !confront && (rec.identified === sc[k].data.key || only) && !e.unavailableReason(sc[k]) && e.confrontFor(sc[k])) confront = sc[k];
      }
    }
    if (confront && wit && can('interrogate')) { UI.hintGo = { uid: confront.uid }; return tr('Confront {name}: put them into Question with a token of the case and Wit. A confession freely given is full proof.', { name: e.labelOf(confront) }); }
    if (lacking) return tr('To charge {name} you still want {kind} {n}: {from}.', { name: e.labelOf(lacking.card), kind: tr(CF.ASPECTS[lacking.row.aspect].label), n: lacking.row.need - lacking.row.have, from: tr(aspectFrom(lacking.row.aspect, e, e.caseRec(lacking.card.caseId))) });
    var unasked = table.filter(function (c) { if (c.def !== 'suspect' || e.unavailableReason(c)) return false; var su = e.suspectOf(c); return su && !su.questioned; })[0];
    if (unasked && wit && can('interrogate')) return tr('Question {name} with Wit: people say more than they mean to.', { name: e.labelOf(unasked) });
    // Somebody waits to be questioned and the Wit is spent: when it comes back, and what to do meanwhile.
    if ((w || unasked || confront) && !wit && spentOf('focus') && e.verb('interrogate').unlocked) return spentLine('focus', spentOf('focus'));
    if (can('investigate')) for (var m = 0; m < open.length; m++) if (open[m].rec.found < open[m].rec.items.length) return tr('The scene has more to give: search {title} again.', { title: open[m].rec.title });
    var fat = has('fatigue').length;
    if (fat >= 2 && can('reflect')) return tr('Weariness is piling up: put one into Rest before the fever takes you.');
    if ((has('funds').length < 2 || !inHand) && !hp && spentOf('health') && can('duty')) return spentLine('health', spentOf('health'));
    if (has('funds').length < 2 && hp && can('duty')) return tr('Coin is short: Attend with Health earns your keep.');
    if (!inHand && can('duty') && hp) return tr('Nothing on the desk. A case will come; Attend with Health meanwhile.');
    // The scene is searched out (the rule above caught every other): another search only feeds an Obsession. Door to
    // door, if the case's own Quarter is on the table and somebody there is still to be met; else charge or let go.
    if (can('investigate')) for (var dd = 0; dd < open.length; dd++) {
      var orec = open[dd].rec;
      var quarter = has('district').filter(function (c) { return c.data.district === orec.district; })[0];
      if (quarter && ((orec.witnesses || []).length || (orec.suspects || []).some(function (x) { return !x.revealed && !x.cleared; }))) { UI.hintGo = { uid: open[dd].card.uid }; return tr('Go door to door: {title} with {quarter} in Explore.', { title: orec.title, quarter: e.labelOf(quarter) }); }
    }
    if (can('arrest')) {
      var half = null;
      open.forEach(function (o) {
        var toks = table.filter(function (c) { return c.def === 'clue' && c.caseId === o.rec.id; });
        table.forEach(function (c) {
          if (c.def !== 'suspect' || c.caseId !== o.rec.id || e.unavailableReason(c)) return;
          var su = e.suspectOf(c), ha = !(su && su.cleared) && e.assessCharge(c, toks);
          if (ha && ha.tier === 'reasonable' && (!half || ha.score > half.a.score)) half = { a: ha, card: c };
        });
      });
      if (half) { UI.hintGo = { uid: half.card.uid }; return tr('Charge {name} on half proof, or let it go.', { name: e.labelOf(half.card) }); }
    }
    // Nothing pressing and nothing at work: the nearest way to grow.
    if (CF.growthWays && !running.length) {
      var best = null;
      ['health', 'focus', 'instinct'].forEach(function (ab) { CF.growthWays(e, ab).forEach(function (w) { var at = wayRank(w); if (at !== null && (s.rank || 0) < at) return; if (w.state === 'open' && (!best || w.n / w.need > best.n / best.need)) best = w; }); });
      if (best) return tr('{ability} can grow: {how}', { ability: tr(CF.CARDS[CF.INSIGHTS[best.id].trains].label), how: tr(best.how) });
    }
    return null;
  };
  // A spent ability's line: when it comes back on its own, that Rest brings it sooner, and the work the other
  // ability can do for a Coin meanwhile, where it is on the table and Attend is free.
  function spentLine(ab, card) {
    var e = UI.e, t = U.fmtTime(card.life);
    var other = ab === 'focus' ? 'health' : ab === 'health' ? 'focus' : null;
    var free = other && e.tableCards().some(function (c) { return c.def === other && !e.unavailableReason(c); }) &&
      e.verb('duty').unlocked && !e.lockReason('duty') && e.verb('duty').status === 'idle';
    UI.hintGo = { uid: card.uid };
    if (ab === 'focus') return free ? tr('Wits\' End: your Wit is back in {t}, sooner in Rest. Meanwhile Attend with Health for a Coin.', { t: t }) : tr('Wits\' End: your Wit is back in {t}, sooner in Rest.', { t: t });
    if (ab === 'health') return free ? tr('Winded: your Health is back in {t}, sooner in Rest. Meanwhile Attend with Wit for a Coin.', { t: t }) : tr('Winded: your Health is back in {t}, sooner in Rest.', { t: t });
    return tr('Restless: your Instinct is back in {t}, sooner in Rest.', { t: t });
  }
  // The hint names a place on the table: a tap goes there.
  UI.hintTap = function () {
    var go = UI.hintGo;
    if (!go || !UI.e) return;
    if (go.uid !== undefined) { if (UI.panTo(go.uid)) return; }
    if (go.spot) { if (choiceEl && UI.e.s.choice) panToChoice(); else panToBoard(go.spot.x, go.spot.y, 380, 300); }
  };
  var adviceShown = null;
  function showAdvice(hint, text) {
    if (UI.hintMode !== 'advice' || adviceShown !== text) { hint.textContent = text; hint.classList.remove('gone'); hint.classList.add('advice'); UI.hintMode = 'advice'; adviceShown = text; }
    hint.classList.toggle('go', !!UI.hintGo);
  }
  // The advisor reads the whole table: once a second is enough, and not at all
  // while the hint is hidden (narrow screens); render() forgets the cached word.
  function cachedAdvice() {
    var now = performance.now();
    if (UI.adviceAt === undefined || now - UI.adviceAt >= 1000) { UI.adviceCache = UI.advice(); UI.adviceGo = UI.hintGo; UI.adviceAt = now; }
    else UI.hintGo = UI.adviceGo || null; // the word's target, kept with it
    return UI.adviceCache;
  }
  // The first Bell's lesson: the opening's first conviction sets it, and the
  // lessons after it may cover it in the same moment, so it stands once they
  // are done until that week's Bell rings and its own toast takes over. The
  // week it was set is the engine's (intro.keepWeek) where it keeps one, else
  // the one this page saw the keep arrive in.
  var BELL_LESSON = 'The Bell rings from now on: lodging and dues come out of your Coin at every turn of the week. Attend earns it.';
  function bellLesson(e) {
    var s = e.s, kw = s.intro && typeof s.intro.keepWeek === 'number' ? s.intro.keepWeek : UI.keepWeek;
    return s.flags.stage === 'keep' && !s.over && kw !== undefined && kw !== null && s.week === kw ? BELL_LESSON : null;
  }
  function renderHint() {
    var e = UI.e, hint = $('#hint');
    if (UI.hintHidden) return;
    // Why a drop was refused, for two seconds.
    if (UI.hintFlash && performance.now() < UI.hintFlash.until) { UI.hintGo = null; showAdvice(hint, UI.hintFlash.text); return; }
    UI.hintFlash = null;
    // The fever, the Bell short or a need about to take its due, then a finished verb or an unanswered ask, come
    // before any lesson: the guided start waits until they clear.
    var urgent = e.s.over ? null : cachedUrgent();
    if (urgent) { showAdvice(hint, urgent); return; }
    var pressing = e.s.over ? null : pressingLine();
    if (pressing) { UI.hintGo = null; showAdvice(hint, pressing); return; }
    var text = (e.introHint ? e.introHint() : null) || bellLesson(e);
    if (text) {
      // A lesson whose cue is long met gives way to the advisor while the player sits idle: the beat is twenty
      // seconds old, the same words have stood twenty seconds, and the advisor has something to say.
      if (UI.introKey !== text) { UI.introKey = text; UI.introAt = e.s.t; }
      var it = e.s.intro, stale = it && it.lastBeatT !== undefined && e.s.t - it.lastBeatT >= 20 && e.s.t - UI.introAt >= 20;
      if (stale && performance.now() - (UI.lastInput || 0) > 6000 && !UI.drag && !UI.openVerbs.length && !UI.modal) {
        var word = cachedAdvice();
        if (word) { showAdvice(hint, word); return; }
      }
      UI.hintGo = null; // a lesson names no place on the table
      if (UI.hintMode !== 'intro' || hint.textContent !== tr(text)) { hint.textContent = tr(text); hint.classList.remove('gone', 'advice', 'go'); UI.hintMode = 'intro'; adviceShown = null; }
      return;
    }
    // Idle for a while with nothing running: a nudge, read off the table.
    var idle = performance.now() - (UI.lastInput || 0) > 6000 && !UI.drag && !UI.openVerbs.length && !UI.modal;
    var advice = idle ? cachedAdvice() : null;
    if (advice) { showAdvice(hint, advice); return; }
    UI.hintGo = null;
    if (UI.hintMode === 'advice') { hint.classList.add('gone'); hint.classList.remove('advice', 'go'); UI.hintMode = 'gone'; adviceShown = null; return; }
    if (UI.hintMode === 'plain' || UI.hintMode === 'gone') return;
    UI.hintMode = 'plain';
    // A player who came through the opening has dragged cards already: no lesson in it.
    var seen = !!e.s.flags.stage || !!(e.introTaughtControls && e.introTaughtControls());
    try { seen = seen || !!localStorage.getItem('casefile.hinted'); } catch (err) { /* ignore */ }
    hint.textContent = tr(PLAIN_HINT);
    hint.classList.toggle('gone', seen);
  }

  // A phone-width screen: the stylesheet folds the speed buttons into one.
  function narrow() {
    try { return typeof matchMedia === 'function' && !!matchMedia('(max-width:980px)').matches; } catch (err) { return false; }
  }
  function renderControls() {
    UI.wake();
    var fold = narrow();
    document.querySelectorAll('#controls button[data-speed]').forEach(function (b) {
      var sp = +b.dataset.speed;
      b.classList.toggle('on', sp === 0 ? UI.paused : !UI.paused && (UI.speed === sp || (sp === 1 && fold)));
      if (sp === 1) {
        // The small badge on the play button shows the speed it cycled to.
        var small = b.querySelector('small');
        if (!small) { small = h('small', 'sp-badge'); b.appendChild(small); }
        small.textContent = fold && !UI.paused && UI.speed > 1 ? String(UI.speed) : '';
      }
    });
    $('#table').classList.toggle('paused', !!UI.paused);
  }

  var METER_FULL = { pressure: 'The Crowd: the city\'s patience with you', scrutiny: 'Suspicion: the Council\'s eye on your methods', retaliation: 'Vendetta: the underworld\'s grudge', dread: 'Dread: what the city fears you are', reputation: 'Standing: your name in the Council chamber' };
  var METER_KEYS = ['pressure', 'scrutiny', 'retaliation', 'dread', 'reputation'];
  var METER_LABELS = { pressure: 'Crowd', scrutiny: 'Suspicion', retaliation: 'Vendetta', dread: 'Dread', reputation: 'Standing' };
  // A meter's level, its class and its word.
  function meterState(key, val, max) {
    var level = Math.min(4, Math.floor((val / Math.max(1, max)) * 4.999));
    var state = key === 'reputation' ? ' rep' : level >= 4 ? ' crit' : level >= 3 ? ' warn' : '';
    return { level: level, cls: 'meter lvl-' + level + state, word: (CF.METER_WORDS && CF.METER_WORDS[key] || [])[level] || '' };
  }
  function meter(key, label, val, max) {
    var st = meterState(key, val, max);
    return '<div class="' + st.cls + '" data-meter="' + key + '" title="' + esc(METER_FULL[key] || label) + '"><span class="m-icon" style="background-image:' + art(METER_ICONS[key]) + '"></span>' +
      '<div class="m-main"><div class="m-label"><span>' + esc(label) + '</span></div><div class="m-word">' + esc(st.word) + '</div></div></div>';
  }
  // A meter that moves is seen to move: its icon swells and glows (red where it hurts, gold where it helps) and a
  // small arrow says which way. The Crowd, Suspicion, Vendetta and Dread on a change of word; Standing on every step.
  var BUMP_CLASSES = ['bump', 'bump-up', 'bump-down', 'bump-good', 'bump-bad'];
  function bumpMeter(el, key, up) {
    var good = key === 'reputation' ? up : !up;
    BUMP_CLASSES.forEach(function (c) { el.classList.remove(c); });
    void el.offsetWidth; // a second move while the first still shows starts it again
    el.classList.add('bump', up ? 'bump-up' : 'bump-down', good ? 'bump-good' : 'bump-bad');
    var n = (el.cfBump = (el.cfBump || 0) + 1);
    setTimeout(function () { if (el.cfBump === n) BUMP_CLASSES.forEach(function (c) { el.classList.remove(c); }); }, 1600);
  }
  // The five meters are built once and changed in place: a class and a word, never a rebuilt row (which would
  // wipe a bump and restart the pulse of a meter at its worst on every render).
  function syncMeters(vals) {
    var box = $('#meters'), lang = CF.lang ? CF.lang() : 'en';
    var built = box.children.length === METER_KEYS.length && UI.metersLang === lang && METER_KEYS.every(function (k, i) { return box.children[i].dataset && box.children[i].dataset.meter === k; });
    if (!built) {
      box.innerHTML = METER_KEYS.map(function (k) { return meter(k, METER_LABELS[k], vals[k].val, vals[k].max); }).join('');
      UI.metersLang = lang;
    }
    var last = UI.lastMeter;
    UI.lastMeter = {};
    METER_KEYS.forEach(function (k, i) {
      var el = box.children[i], st = meterState(k, vals[k].val, vals[k].max);
      if (built) {
        var keep = FX_CLASSES.filter(function (c) { return el.classList.contains(c); });
        if (el.className.split(/\s+/).filter(function (c) { return FX_CLASSES.indexOf(c) < 0; }).join(' ') !== st.cls) {
          el.className = st.cls;
          keep.forEach(function (c) { el.classList.add(c); });
        }
        var w = el.querySelector('.m-word'), word = tr(st.word);
        if (w && w.textContent !== word) w.textContent = word;
      }
      UI.lastMeter[k] = { level: st.level, val: vals[k].val };
      var was = last && last[k];
      if (!was) return;
      var moved = k === 'reputation' ? vals[k].val !== was.val : st.level !== was.level;
      var up = k === 'reputation' ? vals[k].val > was.val : st.level > was.level;
      if (moved) bumpMeter(el, k, up);
      // A step inside a word is seen too, smaller: the icon nudges the way it went and a small arrow fades.
      else if (vals[k].val !== was.val) nudgeMeter(el, k, vals[k].val > was.val);
      // A new word comes in spaced out and settles, with two soft notes: falling where it hurts, rising where it helps.
      if (st.level !== was.level && vals[k].val !== was.val) {
        var wd = el.querySelector('.m-word');
        if (wd) { wd.classList.remove('word-new'); void wd.offsetWidth; wd.classList.add('word-new'); setTimeout(function () { wd.classList.remove('word-new'); }, 600); }
        if (!UI.replaying) CF.Audio.play((k === 'reputation' ? up : !up) ? 'meterBetter' : 'meterWorse');
      }
    });
  }
  var NUDGE_CLASSES = ['nudge', 'nudge-up', 'nudge-down', 'nudge-good', 'nudge-bad'];
  var FX_CLASSES = BUMP_CLASSES.concat(NUDGE_CLASSES);
  function nudgeMeter(el, key, up) {
    var good = key === 'reputation' ? up : !up;
    NUDGE_CLASSES.forEach(function (c) { el.classList.remove(c); });
    void el.offsetWidth;
    el.classList.add('nudge', up ? 'nudge-up' : 'nudge-down', good ? 'nudge-good' : 'nudge-bad');
    var n = (el.cfNudge = (el.cfNudge || 0) + 1);
    setTimeout(function () { if (el.cfNudge === n) NUDGE_CLASSES.forEach(function (c) { el.classList.remove(c); }); }, 1000);
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
    box.classList.remove('far');
    box.dataset.uid = 'meter:' + key; box.dataset.sig = '';
    peekHead(METER_ICONS[key], info.title);
    var ends = key === 'reputation' && UI.e ? repTarget(UI.e).line : info.ends;
    box.innerHTML = '<button class="peek-close" title="' + esc('Close') + '">×</button>' +
      '<div class="i-kind">' + escText(tr('Now: {word}', { word: (CF.METER_WORDS[key] || [])[meterLevel(key)] || '' })) + '</div>' +
      '<p>' + esc(info.what) + '</p><p>' + esc(ends) + '</p>';
    if (key === 'pressure' && UI.e) {
      // The tally the broadsheet-sellers keep (engine weekTick): the count, the threshold, and the way to lower it.
      // The rules' own count where they keep it (engine abroadTally()): the Coquille one, none while its case is open.
      var ue = UI.e, tally = typeof ue.abroadTally === 'function' ? ue.abroadTally() : null;
      var abroad = tally ? tally.n : ue.cardsOf('atlarge').filter(function (c) { return !c.data.band && !c.data.innocent; }).length + ue.countOf('gang') * 2 + ue.countOf('syndicate');
      box.insertAdjacentHTML('beforeend', '<p class="i-tally">' + escText(tr('Thieves abroad: {n}. At four the Market sings them, and the Crowd rises every other week (every week from Bailiff). A band counts two, the Coquille one.', { n: abroad })) + '</p>' +
        '<p>' + esc('A hue and cry takes a name off the wall: Work the Quarter in Explore, or Old Ghosts in Rest.') + '</p>');
    }
    // The city remembers (engine dreadFloor, where the rules keep one): Dread fades at the Bell, but not below a
    // step for every three Cruelties.
    if (key === 'dread' && UI.e && typeof UI.e.dreadFloor === 'function') {
      var floor = UI.e.dreadFloor(), cru = (UI.e.s.counts && UI.e.s.counts.cruelty) || 0;
      box.insertAdjacentHTML('beforeend', '<p class="i-tally">' + esc('Fear fades, but not below what you have done: every three cruelties keep it one step higher.') + '</p>' +
        (floor > 0 ? '<p>' + escText(tr('Cruelties: {n}. Dread stays at {f} of {max} or above.', { n: cru, f: floor, max: UI.e.meterMax ? UI.e.meterMax('dread') : 10 })) + '</p>' : ''));
    }
    if (key === 'reputation') {
      // Where the ladder ends for you, and what holds the next letter back.
      var e = UI.e, s = e.s;
      if (s.who === 'hangman' && s.rank >= rankCap(e)) box.insertAdjacentHTML('beforeend', '<p class="i-cap">' + esc('Bailiff is the last office the Council will give a hangman.') + '</p>');
      // Blocked only while it is: the Standing is there, the office is open, and the Council will not write.
      var held = e.promotionHeld && e.promotionHeld() && s.rank < rankCap(e) && s.meters.reputation >= CF.RANK_REP[s.rank + 1];
      if (held) box.insertAdjacentHTML('beforeend', '<p class="i-blocked">' + esc('Blocked: the Council\'s displeasure. Answer a commission, or let the Bishop speak for you.') + '</p>');
      // The Standing is there, but the Council writes only for a record (engine recordShort(): cases still wanted).
      var recShort = !held && s.rank < rankCap(e) && s.meters.reputation >= CF.RANK_REP[s.rank + 1] && typeof e.recordShort === 'function' ? e.recordShort() : 0;
      if (recShort > 0) box.insertAdjacentHTML('beforeend', '<p class="i-blocked">' + esc(recShort === 1 ? tr('Held: the Council wants one more case answered first.') : tr('Held: the Council wants {n} more cases answered first.', { n: recShort })) + '</p>');
      box.insertAdjacentHTML('beforeend', favourRows(e));
    }
    box.classList.add('open', 'pinned');
    box.querySelector('.peek-close').addEventListener('click', function () { box.classList.remove('open', 'pinned'); box.dataset.uid = ''; });
  };
  // The patrons' seals under Standing: how warm each patron is, in a word, and what the next step brings, or
  // what it brings now (patrons.js favourSteps: a boon each week at 3; the Inquisitor, or the next office held, at -2).
  // A patron's favour in a word: the rules' own words (patrons.js Pat.WORDS: Cold, Cool, ...).
  function favourWord(f) {
    var W = CF.Patrons.WORDS;
    for (var i = 0; i < W.length; i++) if (f <= W[i][0]) return W[i][1];
    return 'Your patron';
  }
  var FAVOUR_TONE = { 'Your patron': 'patron', Warm: 'warm', Neutral: 'even', Cool: 'cool', Cold: 'cold' };
  function favourRows(e) {
    if (!CF.PATRONS || !e.favourSteps) return '';
    var html = '<div class="i-favour">';
    e.favourSteps().forEach(function (st) {
      var lines = [];
      if (st.upNow) lines.push(tr('Now: {what}', { what: st.upNow }));
      if (st.up) lines.push(st.up);
      // The step down is named only while the patron is not warm to you.
      if (st.downNow) lines.push(tr('Now: {what}', { what: st.downNow }));
      else if (st.down && st.n <= 0) lines.push(st.down);
      html += '<div class="fv-row fv-' + (FAVOUR_TONE[st.word] || 'even') + '"><i style="background-image:' + art(PATRON_ART[st.key]) + '"></i>' +
        '<b>' + esc(st.label) + '</b><em title="' + escText(tr('Favour {n}', { n: st.n })) + '">' + esc(st.word) + '</em>' +
        lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
    });
    // A patron at 3 sends a seal to call in, where the rules have one (the engine's 'seal' card).
    if (CF.CARDS && CF.CARDS.seal) html += '<p class="fv-seal">' + esc('At 3 the patron sends a Seal. Put it in Attend to call in a favour.') + '</p>';
    return html + '</div>';
  }
  UI.favourRows = favourRows;
  // Where each verb is told of in the Help (index.html): its heading.
  var HELP_AT = { duty: 'help-attend', investigate: 'help-explore', analyze: 'help-study', interrogate: 'help-question', reflect: 'help-rest', arrest: 'help-court-verb', time: 'help-time' };
  UI.HELP_AT = HELP_AT;
  // The highest office open to you: the origins system caps a hangman at Bailiff.
  function rankCap(e) { return e.rankCap ? e.rankCap() : CF.TOP_RANK; }
  // What Standing is climbing toward: the next office up to the cap (a hangman's ends at Bailiff); at the top, the
  // Seat for a Commissioner; past that, the Council's next favour where the rules grant them (CF.FAVOUR_STEP
  // Standing past the last office, s.flags.favourStep given so far); else nothing further. Its line says which.
  function repTarget(e) {
    var s = e.s, m = s.meters, cap = rankCap(e), every = CF.FAVOUR_STEP;
    if (s.rank < cap) return { max: CF.RANK_REP[s.rank + 1], line: 'At each threshold the Council writes: a new office, more cases, a bigger stipend, and the powers that come with the rank.' };
    if (s.calling === 'commissioner' && s.rank === CF.TOP_RANK && m.reputation < CF.COMMISSIONER_REP) return { max: CF.COMMISSIONER_REP, line: tr('At {n} Standing the Council offers you the Seat.', { n: CF.COMMISSIONER_REP }) };
    // The rules' own next writ (engine favourNext(): the Standing of the next Writ of the Council).
    var fav = null;
    try { fav = typeof e.favourNext === 'function' ? e.favourNext() : null; } catch (err) { fav = null; }
    if (fav && typeof fav.at === 'number') return { max: fav.at, line: tr('Past the last office, every {n} Standing the Council grants you a favour.', { n: every || 4 }) };
    if (typeof e.favourNext !== 'function' && typeof every === 'number' && every > 0) {
      var step = (s.flags && typeof s.flags.favourStep === 'number' ? s.flags.favourStep : 0) + 1;
      return { max: CF.RANK_REP[cap] + every * step, line: tr('Past the last office, every {n} Standing the Council grants you a favour.', { n: every }) };
    }
    return { max: Math.max(m.reputation, 1), line: 'You hold the last office open to you.' };
  }
  UI.repTarget = repTarget;
  function meterLevel(key) {
    var e = UI.e, m = e.s.meters, max = e.meterMax(key);
    if (key === 'reputation') return Math.min(4, Math.floor(m.reputation / Math.max(1, CF.COMMISSIONER_REP) * 4.999));
    return Math.min(4, Math.floor((m[key] / Math.max(1, max)) * 4.999));
  }
  function renderTop() {
    var e = UI.e, s = e.s, m = s.meters;
    // Standing's bar fills toward what it is climbing to (repTarget).
    var nextRep = repTarget(e).max;
    var vals = {};
    ['pressure', 'scrutiny', 'retaliation', 'dread'].forEach(function (k) { vals[k] = { val: m[k], max: e.meterMax(k) }; });
    vals.reputation = { val: m.reputation, max: nextRep };
    syncMeters(vals);
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
    trial: 'cwax-03', seal: 'cwax-04', atlarge: 'ilaw-18', rung: 'ilaw-01', sentence: 'ilaw-01', plea: 'ilaw-13', paper: 'ilaw-21', temptation: 'itrade-20', insight: 'imyst-05', fatigue: 'imed-13', burnout: 'imed-10', wound: 'imed-09' };
  // The seal of a token's later status: kept past its case (a key), matched to a hand (a tick), read only in part (a query).
  var STATUS_ART = { Kept: 'cstamp-04', Matched: 'cok-01', Partial: 'cmark-05', Staged: 'ccstamp-02' };
  // The patrons' seals: the Council's crown, the Bishop's church, the Guilds' coin.
  var PATRON_ART = { council: 'casp-05', bishop: 'casp-04', guild: 'cres-01' };
  // The rungs of a ladder that please the patron who commissioned the case: the rules mark them (data.patron),
  // and on a game whose rules do not, they are read off the commission (the Bishop asks a Pardon or a Fine, the
  // Guilds the Pillory or a Fine), while it is still to be answered.
  var PATRON_RUNGS = { bishop: ['pardon', 'fine'], guild: ['pillory', 'fine'] };
  function rungPatron(card) {
    if (!card || card.def !== 'rung' || !card.data) return null;
    if (card.data.patron) return PATRON_ART[card.data.patron] ? card.data.patron : null;
    var rec = card.caseId && UI.e && UI.e.caseRec(card.caseId), com = rec && rec.commission;
    if (!com || com.delivered || !PATRON_RUNGS[com.from]) return null;
    return PATRON_RUNGS[com.from].indexOf(card.data.rung) >= 0 ? com.from : null;
  }
  function orList(xs) { return xs.length > 1 ? tr('{a} or {b}', { a: xs.slice(0, -1).join(', '), b: xs[xs.length - 1] }) : xs[0] || ''; }
  // What the patron asked for, on the Condemned: the rungs of their ladder that would please them.
  function patronAsks(cond) {
    var e = UI.e, rungs = e.tableCards().concat(e.cardsOf('rung', true)).filter(function (c, i, all) { return c.def === 'rung' && c.data && c.data.condemned === cond.uid && all.indexOf(c) === i; });
    var who = null, names = [];
    rungs.forEach(function (r) { var p = rungPatron(r); if (!p) return; who = who || p; if (p === who) names.push(CF.Sentence && CF.Sentence.rungLabel ? CF.Sentence.rungLabel(cond.data.template, r.data.rung) : r.data.rung); });
    return who ? { who: who, names: names } : null;
  }
  // The face's words come from CF.cardFace (js/i18n.js); a case card is its crime.
  function cardTitle(card) {
    var e = UI.e, def = CF.CARDS[card.def];
    if (def.kind === 'case') { var rec = e.caseRec(card.caseId); return (rec && rec.highProfile ? '★ ' : '') + (rec ? rec.short : e.labelOf(card)); }
    return CF.cardFace(card, e.labelOf(card)).text;
  }
  UI.cardTitle = cardTitle;
  UI.cardPicture = cardPicture;

  // What a card looks like; if this string changes the face is rebuilt.
  function cardSig(card, count) {
    return [card.def, UI.e.labelOf(card), JSON.stringify(card.aspects || ''), card.caseId || '', count, !!card.maxLife, !!card.hidden, card.data && card.data.trust, card.data && card.data.heat, card.data && card.data.mark ? 'm' : '',
      card.def === 'coldcase' ? card.data.template : '', searchedOut(card) ? 'so' : '', card.data && card.data.about || '', rungPatron(card) || ''].join('|');
  }
  // The accused a token is about (data.about, a suspect's key: a Motive, a Confession, a Slip, a Deposition), with
  // the picture of their nameplate, so the face can wear a small portrait of whom it concerns. Display only:
  // the Court reads data.about itself. Null for a token about nobody, or from before tokens carried it.
  function aboutOf(card) {
    var e = UI.e;
    if (!e || !card || !card.data || !card.data.about || !card.caseId || card.def === 'suspect') return null;
    var rec = e.caseRec(card.caseId);
    var sus = rec && rec.suspects && rec.suspects.filter(function (x) { return x.key === card.data.about; })[0];
    if (!sus) return null;
    var plate = Object.keys(e.s.cards).map(function (u) { return e.s.cards[u]; })
      .filter(function (c) { return c.def === 'suspect' && c.caseId === card.caseId && c.data && c.data.key === sus.key; })[0];
    return { sus: sus, art: plate ? cardPicture(plate).art : personArt(sus.name, sus.role, sus.sex) };
  }
  UI.aboutOf = aboutOf;
  // A case whose scene has given all it had: another search only feeds an Obsession.
  function searchedOut(card) {
    if (!card.caseId || CF.CARDS[card.def].kind !== 'case' || !UI.e) return false;
    var rec = UI.e.caseRec(card.caseId);
    return !!(rec && rec.status === 'open' && rec.items && rec.items.length && rec.found >= rec.items.length);
  }
  UI.searchedOut = searchedOut;

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
    // What a verdict's stamp looks for once the card has left the state: its case, its kind, its place.
    n.cfCase = card.caseId || (card.data && card.data.caseId) || null; n.cfDef = card.def;
    n.classList.toggle('facedown', !!card.hidden);
    n.className = n.className.replace(/\b(kind|face|tone)-\S+/g, '').replace(/\bstack-\d\b|\bbanded\b|\bband-story\b/g, '').trim() +
      ' kind-' + def.kind + ' face-' + pic.fam + ' tone-' + pic.tone + (pic.banded ? ' banded' : '') + (pic.storyBand ? ' band-story' : '') + (count > 1 ? ' stack-' + Math.min(3, count) : '');
    n.innerHTML = '';
    n._time = undefined; n._ring = null; n._urgent = undefined; // the live children are rebuilt below
    for (var i = Math.min(2, count - 1); i > 0; i--) {
      var u = h('div', 'c-under u' + i);
      u.style.setProperty('--pic', art(pic.art));
      n.appendChild(u);
    }
    var face = h('div', 'c-face' + (pic.gray ? ' gray' : ''));
    face.style.setProperty('--pic', art(pic.art));
    var body = h('div', 'c-body');
    var band = null;
    var title = h('div', 'c-title', cardTitle(card));
    var tid = traitOfCard(card);
    if (tid && card.def === 'suspect') title.appendChild(traitChip(tid));
    body.appendChild(title);
    void kind;
    var asp = h('div', 'c-aspects');
    var a = CF.aspectsOf(card);
    CF.CLUE_ASPECTS.forEach(function (k) { if (a[k]) asp.appendChild(aspectChip(k, a[k])); });
    if (tid && card.def !== 'suspect') asp.appendChild(traitChip(tid));
    var into = band || body;
    if (asp.children.length) into.appendChild(asp);
    if (card.def === 'informant') {
      var st = h('div', 'c-stats');
      st.innerHTML = '<span class="c-stat trust" title="' + escText(tr('Trust {n} of 3', { n: card.data.trust || 0 })) + '"><i style="background-image:' + art('crel-02') + '"></i>' + (card.data.trust || 0) + '</span>' +
        '<span class="c-stat heat" title="' + escText(tr('Heat {n} of {max}', { n: card.data.heat || 0, max: CF.INFORMANT.compromisedAt })) + '"><i style="background-image:' + art('icrime-24') + '"></i>' + (card.data.heat || 0) + '</span>';
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
    // A status the token gained later is a small seal in the corner, not a word on the face.
    var face0 = def.kind === 'case' ? null : CF.cardFace(card, e.labelOf(card));
    if (face0 && face0.status.length && STATUS_ART[face0.status[0]]) {
      var stamp = h('div', 'c-seal c-status');
      stamp.style.backgroundImage = art(STATUS_ART[face0.status[0]]);
      stamp.title = face0.status.map(function (x) { return tr(x); }).join(' · ');
      face.appendChild(stamp);
    }
    // A token about one accused wears a small portrait of them on the corner, the picture of their nameplate.
    var about = def.kind === 'case' ? null : aboutOf(card);
    if (about) {
      var pip = h('div', 'c-about');
      pip.style.backgroundImage = art(about.art);
      pip.title = tr('About {name}', { name: about.sus.name });
      face.appendChild(pip);
    }
    // A rung that would please the patron who commissioned the case wears the patron's seal.
    var patron = rungPatron(card);
    if (patron) {
      var ps = h('div', 'c-patron');
      ps.style.backgroundImage = art(PATRON_ART[patron]);
      ps.title = tr('{patron} asks for this', { patron: tr(CF.PATRONS[patron].label) });
      face.appendChild(ps);
    }
    if (def.kind === 'case' || def.kind === 'coldcase') {
      var crec2 = def.kind === 'case' ? e.caseRec(card.caseId) : { template: card.data.template };
      var seal = h('div', 'c-seal');
      seal.style.backgroundImage = art(caseArtOf(crec2 && crec2.template)[1]);
      face.appendChild(seal);
      // The scene searched out: a stamp of the glass on the other corner, and no word.
      if (searchedOut(card)) {
        var so = h('div', 'c-seal c-status c-searched');
        so.style.backgroundImage = art('cstamp-02');
        so.title = tr('Searched out: nothing more here. Another search only feeds Obsession.');
        face.appendChild(so);
      }
    }
    n.appendChild(face);
    if (card.data && card.data.mark) { var pin = h('div', 'c-pin'); pin.title = tr('Marked: yours to remember'); pin.style.backgroundImage = art('cmark-03'); n.appendChild(pin); }
    if (count > 1) n.appendChild(h('div', 'c-count', '×' + count));
    updateCardLive(n, card);
  }

  var CARD_RING_LEN = 2 * (122 + 174) - 8 * 12 + 2 * Math.PI * 12;
  // A ring's dash in 200 steps a lap (under a pixel at table zoom): written only when it moves a step, so a running
  // verb repaints its token a few times a second, not every frame. A ring's glow (a wider pale stroke behind it,
  // in place of a filter) takes the same dash.
  function setDash(ring, len, total, step) {
    step = step || total / 200;
    var d = Math.round(Math.round(len / step) * step * 100) / 100;
    if (ring._dash === d) return;
    ring._dash = d;
    ring.style.strokeDasharray = d + ' ' + total;
    if (ring._glow) ring._glow.style.strokeDasharray = d + ' ' + total;
  }
  function setText(el, text) { if (el._txt !== text) { el._txt = text; el.textContent = text; } }
  // The card's clock and ring. The children are found once and kept on the element.
  function updateCardLive(n, card) {
    if (!card || !card.maxLife) return;
    if (n._time === undefined) { n._time = n.querySelector('.c-time'); n._ring = n.querySelector('.c-ringsvg rect:not(.track)'); }
    if (n._time) setText(n._time, U.fmtTime(card.life));
    var pct = Math.max(0, Math.min(1, card.life / card.maxLife));
    if (n._ring) setDash(n._ring, pct * CARD_RING_LEN, CARD_RING_LEN);
    var k = CF.CARDS[card.def].kind;
    // A case the crier sang is watched: it pulses from two minutes out, an ordinary one from one.
    var sung = k === 'case' && card.caseId && UI.e && UI.e.s.cases[card.caseId] && UI.e.s.cases[card.caseId].highProfile;
    var urgent = (k === 'case' && card.life < (sung ? 120 : 60)) || ((k === 'clue' || k === 'evidence' || k === 'witness') && card.life < 30);
    if (n._urgent !== urgent) { n._urgent = urgent; n.classList.toggle('urgent', urgent); }
  }

  // ---------------------------------------------------------------- Board
  // The clocks' counter-scale (css --zk, used on a phone): one step per tenth of zoom between 0.6 and 1, so it
  // is written, and the cards restyled, only when a step is crossed, never on every frame of a pinch.
  var zkShown = null;
  function applyView() {
    var v = UI.view, board = $('#board');
    // Only the board moves: a custom property set on #table would restyle every card under it on each zoom step.
    board.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
    var zk = Math.round(100 / U.clamp(Math.round(v.z * 10) / 10, 0.6, 1)) / 100;
    if (zk !== zkShown) { zkShown = zk; board.style.setProperty('--zk', String(zk)); }
    // The edge marks follow the camera here; their targets moving is caught by the frame's cheap check.
    if (UI.notices.length) updateNotices();
  }

  // Measured once per render; a pinch asks for it on every move.
  var boundsCache = null;
  function boardBounds() {
    if (boundsCache) return boundsCache;
    var e = UI.e, cards = e.tableCards();
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    cards.forEach(function (c) { x0 = Math.min(x0, c.loc.x); y0 = Math.min(y0, c.loc.y); x1 = Math.max(x1, c.loc.x + T.CW); y1 = Math.max(y1, c.loc.y + T.CH); });
    CF.VERB_ORDER.forEach(function (id) { var v = e.verb(id); if (!v.unlocked || v.x === undefined) return; x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x + T.VW); y1 = Math.max(y1, v.y + T.VH); });
    // The pile's strip counts only as far as cards lie in it (with its label above): its empty cells would hold a
    // phone's opening, two cards in the strip, at the farthest zoom.
    var pile = e.pile(), pw = T.PILE_COLS * T.PX, pileEnd = -Infinity;
    cards.forEach(function (c) { if (c.loc.x >= pile.x && c.loc.x < pile.x + pw && c.loc.y >= pile.y && c.loc.y < pile.y + T.CH) pileEnd = Math.max(pileEnd, c.loc.x + T.CW); });
    if (pileEnd > -Infinity) { x0 = Math.min(x0, pile.x); y0 = Math.min(y0, pile.y - 30); x1 = Math.max(x1, pileEnd); y1 = Math.max(y1, pile.y + T.CH); }
    if (!cards.length) { x0 = 0; y0 = T.TOP; x1 = 4 * (T.CW + T.GAP); y1 = T.TOP + T.CH; }
    // A choice waiting on the table is part of it: the Fit takes it in whole, its last answer with it.
    if (e.s.choice && choiceEl && choiceEl.offsetWidth && typeof e.choiceSpot === 'function') {
      var cs = e.choiceSpot();
      x0 = Math.min(x0, cs.x); y0 = Math.min(y0, cs.y); x1 = Math.max(x1, cs.x + choiceEl.offsetWidth); y1 = Math.max(y1, cs.y + choiceEl.offsetHeight);
    }
    return (boundsCache = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }

  // On a phone or a short window the tool row sits on the felt's top edge: the camera keeps the band under it free,
  // so no tile is ever under the buttons (a tap there would hit them).
  // Measured once per table rect (a pan or pinch asks on every move); forgotten with it (tiltChanged).
  var bandCache = null;
  function toolBand(r) {
    if (bandCache && bandCache.top === r.top) return bandCache.h;
    var short = false, h = 0;
    try { short = typeof matchMedia === 'function' && !!matchMedia('(max-height:520px)').matches; } catch (err) { short = false; }
    if (narrow() || short) { var z = $('#zoom'); h = z ? Math.max(0, z.getBoundingClientRect().bottom - r.top + 6) : 0; }
    bandCache = { top: r.top, h: h };
    return h;
  }
  // Fit the whole board into the table area, as the eye sees it: the table is tilted, so the near rows stand
  // wider and taller on the screen than on the plane. The fit is measured through the tilt (toPlane), not on the
  // flat plane, or the near corners would run off the sides while the far side of the felt stood empty.
  // Lean in when there is little on the table (to 1.25); stand back as far as a pinch can for a full one. A phone
  // on its side is short for the tiles' row and four rows of cards: the farthest zoom (0.3) still shows them whole
  // (pure icons, the clocks counter-scaled by --zk), so the Fit can keep its word there too.
  UI.Z_MIN = 0.3;
  UI.fitView = function () {
    if (!UI.e) return;
    tiltChanged();
    var r = $('#table').getBoundingClientRect();
    var b = boardBounds();
    var dockH = toolBand(r);
    var box = { l: 30, r: r.width - 30, t: dockH + 20, b: r.height - 20 }, cx = r.width / 2;
    // A phone on its side docks the hint at the foot of the felt: the fit stops above it while it shows.
    var hint = $('#hint');
    if (hint && !hint.classList.contains('gone') && hint.textContent && hint.getBoundingClientRect) {
      var hr = hint.getBoundingClientRect();
      if (hr.height > 0 && hr.top > r.top + r.height / 2) box.b = Math.min(box.b, hr.top - r.top - 6);
    }
    if (box.b - box.t < 40) box = { l: 0, r: r.width, t: dockH, b: r.height };
    var top = toPlane(cx, box.t).y, bot = toPlane(cx, box.b).y;
    var sy = function (py) { return fromPlane(0, py).y; };
    // Where the board stands at zoom z: its far edge on the plane (centred down the screen, or at the top when it
    // is too tall), and its left edge (centred across the narrower of its far and near rows).
    function at(z) {
      var W = b.w * z, H = b.h * z, y0 = top, lo = top, hi = bot - H;
      var fitsV = hi >= lo;
      if (fitsV) {
        for (var i = 0; i < 24; i++) { y0 = (lo + hi) / 2; if (sy(y0) - box.t < box.b - sy(y0 + H)) lo = y0; else hi = y0; }
        y0 = (lo + hi) / 2;
      }
      var ya = sy(y0), yb = Math.min(sy(y0 + H), r.height * 2);
      var l = Math.max(toPlane(box.l, ya).x, toPlane(box.l, yb).x), rr = Math.min(toPlane(box.r, ya).x, toPlane(box.r, yb).x);
      return { ok: fitsV && W <= rr - l, x0: (l + rr) / 2 - W / 2, y0: y0 };
    }
    var zLo = UI.Z_MIN, zHi = 1.25, z = zHi, best = at(zHi);
    if (!best.ok) {
      var low = at(zLo);
      if (!low.ok) { z = zLo; best = low; }
      else {
        for (var k = 0; k < 16; k++) { var zm = (zLo + zHi) / 2, m = at(zm); if (m.ok) { zLo = zm; low = m; } else zHi = zm; }
        z = zLo; best = low;
      }
    }
    UI.view = { x: best.x0 - b.x * z, y: best.y0 - b.y * z, z: z };
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
    var dockH = toolBand(r);
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
    if (v.status === 'idle' && e.start(vid)) { verbStarted(vid); e.dirty = true; }
  }

  function zoomAt(cx, cy, factor, rect) {
    var r = rect || $('#table').getBoundingClientRect();
    var v = UI.view, z = U.clamp(v.z * factor, UI.Z_MIN, 1.6);
    var pp = toPlane(cx - r.left, cy - r.top), px = pp.x, py = pp.y;
    v.x = px - (px - v.x) * (z / v.z);
    v.y = py - (py - v.y) * (z / v.z);
    v.z = z;
    clampView(r);
    applyView();
  }

  // Never let the whole board leave the table area: some of it stays in view.
  function clampView(rect) {
    if (!UI.e) return;
    var r = rect || $('#table').getBoundingClientRect(), v = UI.view, b = boardBounds();
    var margin = 80, dockH = toolBand(r);
    v.x = U.clamp(v.x, margin - (b.x + b.w) * v.z, r.width - margin - b.x * v.z);
    v.y = U.clamp(v.y, dockH + margin - (b.y + b.h) * v.z, r.height - margin - b.y * v.z);
  }

  // The table plane is tilted (css: #tilt rotateX under #table's perspective),
  // so a screen point maps to the plane through the inverse of that
  // projection: the same 4x4 matrix the browser builds from the stylesheet.
  var tiltM = null, tiltDirty = true;
  // The stylesheet is read again only when something could have moved the
  // plane: a resize, a change of scale, the start of a gesture.
  function tiltChanged() { tiltDirty = true; tableRectCache = null; bandCache = null; }
  function mat4mul(a, b) {
    var o = [];
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var v = 0; for (var k = 0; k < 4; k++) v += a[i * 4 + k] * b[k * 4 + j]; o[i * 4 + j] = v; }
    return o;
  }
  function translate(x, y, z) { return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1]; }
  function tiltMatrix() {
    if (tiltM && !tiltDirty) return tiltM;
    tiltDirty = false;
    var t = $('#table');
    var cs = getComputedStyle(t);
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
  // A drag passes the table's rect, measured once when it began.
  function toBoard(cx, cy, rect) {
    var r = rect || $('#table').getBoundingClientRect();
    var p = toPlane(cx - r.left, cy - r.top);
    return { x: (p.x - UI.view.x) / UI.view.z, y: (p.y - UI.view.y) / UI.view.z };
  }

  // A plain 2D translate: a card at rest carries no 3D hint, so the browser does not give it a layer of its own.
  function place(el, x, y) { el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; }
  // A card that flies or deals in is promoted only while it moves (.flying, .arrive carry will-change): the class
  // comes off once the move is over, as .settle's does, so nothing on the table stays a layer at rest.
  function settleAfter(el, cls, ms) { setTimeout(function () { el.classList.remove(cls); }, ms); }

  // Keep one element per stack on the board, moving (not rebuilding) them.
  function syncPile() {
    var e = UI.e, board = $('#board'), pile = e.pile();
    if (!pileEl) {
      pileEl = h('div', 'pile-zone');
      pileEl.title = tr('The collection pile: new cards land here. Drag it anywhere.');
      pileEl.style.width = (T.PILE_COLS * T.PX + 4) + 'px';
      pileEl.style.height = (T.CH + 16) + 'px';
      // A tab hangs off the corner and the label sits above the cards (both painted by the stylesheet).
      pileEl.appendChild(h('span', 'pz-tab'));
      pileEl.appendChild(h('span', 'pz-label', 'New cards'));
      board.appendChild(pileEl);
    }
    if (!(UI.drag && UI.drag.kind === 'pile')) placePile(pileEl, pile.x, pile.y);
  }
  // The pile is set by left and top, not a transform: a transform would make the strip a stacking context of its
  // own, and its tab and label (z-index 2 in the stylesheet) would sink under the cards (z-index 1) of the row
  // above, where a finger or the mouse could no longer take hold of them.
  function placePile(el, x, y) { el.style.left = Math.round(x - 9) + 'px'; el.style.top = Math.round(y - 8) + 'px'; }
  UI.placePile = placePile;
  // Glide the camera to a point on the board.
  // A notice: a pulse on something worth a look, or, when it is off the
  // screen, a marker at the table's edge pointing to it. Tapping it goes there.
  UI.notices = [];
  UI.notice = function (spec) {
    setTimeout(function () {
      var el = spec.verb ? verbEls[spec.verb] : spec.uid ? cardEls[spec.uid] : null;
      if (!el) return;
      // One mark a thing: a verb that unlocks and runs by itself in the same tick is marked once, for longer.
      var same = UI.notices.filter(function (n) { return spec.verb ? n.verb === spec.verb : n.uid === spec.uid; })[0];
      if (same) { same.el = el; same.until = Math.max(same.until, performance.now() + 12000); return; }
      el.classList.add('noticed');
      setTimeout(function () { el.classList.remove('noticed'); }, 4000);
      var mark = h('div', 'edge-mark');
      var flag = spec.verb ? 'cmark-04' : spec.kind === 'case' ? 'cmark-03' : spec.kind === 'insight' ? 'cmark-05' : spec.kind === 'place' ? 'ctab-03' : spec.kind === 'verdict' ? 'cwax-01' : 'cmark-04';
      mark.innerHTML = '<b style="background-image:' + art(flag) + '"></b><span>' + esc(spec.label || '') + '</span>';
      mark.addEventListener('click', function () {
        if (spec.uid) UI.panTo(spec.uid);
        else if (spec.verb) { var v = UI.e.s.verbs[spec.verb]; panToBoard(v.x, v.y, T.VW, T.VH); }
        removeMark(mark);
      });
      $('#table').appendChild(mark);
      var entry = { el: el, mark: mark, uid: spec.uid, verb: spec.verb, until: performance.now() + 12000 };
      UI.notices.push(entry);
      placeMark(entry);
      layoutMarks();
    }, spec.fresh ? 450 : 50);
  };
  function removeMark(mark) { mark.remove(); UI.notices = UI.notices.filter(function (n) { return n.mark !== mark; }); }
  // The table's size, read once and kept until a resize, a change of scale or a new gesture (tiltChanged).
  var tableRectCache = null;
  function tableRect() { return tableRectCache || (tableRectCache = $('#table').getBoundingClientRect()); }
  // Where a notice's target sits on the board: a verb's tile or a card on the table, read off the state, so no
  // element is measured. Null when it is not on the table (in a window, held): then it is in sight anyway.
  function markTarget(n) {
    var e = UI.e;
    if (!e) return null;
    if (n.verb) { var v = e.s.verbs[n.verb]; return v && v.x !== undefined ? { x: v.x + T.VW / 2, y: v.y + T.VH / 2 } : null; }
    var c = n.uid ? e.card(n.uid) : null;
    return c && c.loc && c.loc.t === 'table' ? { x: c.loc.x + T.CW / 2, y: c.loc.y + T.CH / 2 } : null;
  }
  // The mark is placed from the camera and the state alone, and written only when something it shows has moved.
  function placeMark(n) {
    var b = markTarget(n), v = UI.view;
    if (!b) { if (n.key !== 'off') { n.key = 'off'; n.mark.classList.add('hidden'); } return; }
    var tr2 = tableRect();
    var key = v.x + ',' + v.y + ',' + v.z + ',' + b.x + ',' + b.y + ',' + tr2.width + ',' + tr2.height;
    if (n.key === key) return;
    n.key = key;
    var sp = fromPlane(v.x + b.x * v.z, v.y + b.y * v.z), cx = sp.x, cy = sp.y;
    var inside = cx > 0 && cx < tr2.width && cy > 0 && cy < tr2.height;
    if (n.inside !== inside) { n.inside = inside; n.mark.classList.toggle('hidden', inside); }
    if (inside) return;
    // Kept on screen by its own width, measured once it shows: a long label (or an Arabic one) is not cut at the edge.
    if (!n.w) n.w = n.mark.offsetWidth || 0;
    var half = Math.max(24, Math.min(tr2.width / 2, Math.ceil(n.w / 2) + 4));
    // On a desk the foot of the felt has the tools and the pause banner; on a phone the tools take the top band
    // (toolBand) and a row of cards stands near the foot, so there the mark hugs the very edge and covers no more
    // than a card's rim.
    var band = toolBand(tr2), yLo = band ? band + 20 : 80, yHi = band ? tr2.height - 20 : tr2.height - 90;
    var mx = Math.round(Math.max(half, Math.min(tr2.width - half, cx))), my = Math.round(Math.max(yLo, Math.min(yHi, cy)));
    // Where it would stand alone, and the way it may give room to another mark: along the top or the foot when it
    // was held there, else up or down its side.
    n.bx = mx; n.by = my; n.cx = cx; n.cy = cy; n.half = half; n.yLo = yLo; n.yHi = yHi;
    n.along = cy < yLo || cy > yHi ? 'x' : 'y';
  }
  // Two marks that point the same way never lie on one another: each in turn takes the free place along its edge
  // (the top or foot sideways, a side up or down) nearest to where it would stand alone, beside the ones already
  // placed (spreadMarks, DOM-free for the tests).
  function spreadMarks(list, width) {
    var placed = [];
    list.forEach(function (n) {
      var w = n.w || 48, hgt = n.h || 30, ax = n.along === 'x';
      var clash = function (x, y) {
        for (var i = 0; i < placed.length; i++) {
          var p = placed[i];
          if (Math.abs(p.x - x) < (p.w + w) / 2 + 6 && Math.abs(p.y - y) < (p.h + hgt) / 2 + 4) return true;
        }
        return false;
      };
      var lo = ax ? n.half : n.yLo, hi = ax ? width - n.half : n.yHi, base = ax ? n.bx : n.by;
      var cands = [base];
      placed.forEach(function (p) {
        var gap = ax ? (p.w + w) / 2 + 6 : (p.h + hgt) / 2 + 4, at = ax ? p.x : p.y;
        cands.push(at + gap, at - gap);
      });
      var best = null;
      cands.forEach(function (c) {
        if (c < lo - 0.5 || c > hi + 0.5) return;
        if (clash(ax ? c : n.bx, ax ? n.by : c)) return;
        if (best === null || Math.abs(c - base) < Math.abs(best - base)) best = c;
      });
      if (best === null) best = base;
      n.mx2 = Math.round(ax ? best : n.bx); n.my2 = Math.round(ax ? n.by : best);
      placed.push({ x: n.mx2, y: n.my2, w: w, h: hgt });
    });
    return list;
  }
  UI.spreadMarks = spreadMarks;
  // Each frame: retire the old marks; the rest move only when the camera or their target has.
  function updateNotices() {
    var now = performance.now();
    UI.notices.slice().forEach(function (n) {
      if (now > n.until || !n.el.isConnected) { removeMark(n.mark); return; }
      placeMark(n);
    });
    layoutMarks();
  }
  // The marks that show, set apart and written where they changed.
  function layoutMarks() {
    var shown = UI.notices.filter(function (n) { return n.key !== 'off' && n.inside === false && n.bx !== undefined; });
    shown.forEach(function (n) { if (!n.h) n.h = n.mark.offsetHeight || 0; });
    spreadMarks(shown, tableRect().width).forEach(function (n) {
      var mx = n.mx2, my = n.my2, ang = Math.round(Math.atan2(n.cy - my, n.cx - mx) * 180 / Math.PI);
      if (n.mx !== mx) { n.mx = mx; n.mark.style.left = mx + 'px'; }
      if (n.my !== my) { n.my = my; n.mark.style.top = my + 'px'; }
      if (n.ang !== ang) { n.ang = ang; n.mark.style.setProperty('--ang', ang + 'deg'); }
    });
  }
  // Less motion: the camera is there at once, with no glide.
  function calm() { return !!(CF.Settings && CF.Settings.get && CF.Settings.get('calm')); }
  UI.calm = calm;
  // Glide the view to an exact position and zoom.
  function tweenView(to, done) {
    var v = UI.view, from = { x: v.x, y: v.y, z: v.z }, t0 = null;
    if (calm()) { v.x = to.x; v.y = to.y; v.z = to.z; applyView(); if (done) done(); return; }
    function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 600), ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.x = from.x + (to.x - from.x) * ease; v.y = from.y + (to.y - from.y) * ease; v.z = from.z + (to.z - from.z) * ease;
      applyView();
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }
  // The camera to a question on the table, framed whole: its real size (as tall as its answers make it, as the tilt
  // shows it), between the tool row and a hint docked at the foot (a phone on its side), every answer in reach. It
  // leans in to 0.95 as for anything else, and stands back as far as it must for a tall question on a short screen.
  function panToChoice(done) {
    var sp = UI.e.choiceSpot(), el = choiceEl, w = 380, ht = 300, k = 1;
    var r = $('#table').getBoundingClientRect(), v = UI.view, band = toolBand(r), foot = 0;
    if (el && el.offsetHeight) {
      w = el.offsetWidth || w; ht = el.offsetHeight;
      var er = el.getBoundingClientRect();
      if (er.height > 0 && v.z > 0) k = U.clamp(er.height / (ht * v.z), 0.7, 1.5);
    }
    var hint = $('#hint');
    if (hint && !hint.classList.contains('gone')) {
      var hr = hint.getBoundingClientRect();
      if (hr.height > 0 && hr.top > r.top + r.height / 2) foot = Math.max(0, r.bottom - hr.top + 6);
    }
    var room = r.height - band - foot - 12;
    var z = Math.max(UI.Z_MIN, Math.min(Math.max(v.z, 0.95), room / (ht * k), (r.width - 16) / (w * k)));
    tweenView({ x: r.width / 2 - (sp.x + w / 2) * z, y: band + (r.height - band - foot) / 2 - (sp.y + ht / 2) * z, z: z }, done);
  }
  UI.panToChoice = panToChoice;
  function panToBoard(x, y, w, h, done) {
    var r = $('#table').getBoundingClientRect(), v = UI.view;
    var z = Math.max(v.z, 0.95), band = toolBand(r);
    var tx = r.width / 2 - (x + w / 2) * z, ty = band + (r.height - band) / 2 - (y + h / 2) * z;
    var from = { x: v.x, y: v.y, z: v.z }, t0 = null;
    if (calm()) { v.x = tx; v.y = ty; v.z = z; applyView(); if (done) done(); return; }
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
  // An answered choice holds still this long: the price goes into the option, the wax comes down on it.
  var CHOICE_HOLD = 550;
  // The options a waiting choice shows: the save's copy, which the engine reads again from the question's own
  // spec when an old save loads (refreshChoice), so choose(i) runs what is shown and the free way out is never hidden.
  UI.choiceOptions = function (e, c) { return (c && c.options) || []; };
  // What an answer gives and takes, seen before it is given: the engine's dry run (e.choicePreview, on a copy
  // with the same dice, the card it pays with left out) as chips. Something the answer only sets in motion
  // shows no change: its sentence stays beside.
  function choiceDeltas(e, i) {
    var pv;
    try { pv = e.choicePreview(i); } catch (err) { return null; }
    if (!pv) return null;
    var out = [];
    Object.keys(METER_ICONS).forEach(function (k) {
      var d = pv.meters[k] || 0;
      if (d) out.push({ kind: 'meter', key: k, d: d, good: k === 'reputation' ? d > 0 : d < 0, art: METER_ICONS[k], title: tr(METER_INFO[k].title) });
    });
    Object.keys(PATRON_ART).forEach(function (k) {
      var d = pv.favour[k] || 0;
      if (d && CF.PATRONS && CF.PATRONS[k]) out.push({ kind: 'favour', key: k, d: d, good: d > 0, art: PATRON_ART[k], title: tr(CF.PATRONS[k].label) });
    });
    Object.keys(pv.cards).forEach(function (d) {
      if (!CF.CARDS[d]) return;
      var dd = pv.cards[d], kind = CF.CARDS[d].kind;
      if (!dd) return;
      var need = !!(CF.NEEDS && CF.NEEDS[d]) || kind === 'threat';
      out.push({ kind: 'card', key: d, d: dd, good: need ? dd < 0 : dd > 0, art: ICONS[d] || FULLS[d] || KIND_ART[d] || KIND_ART[kind] || 'iinv-02', title: tr(CF.CARDS[d].label) });
    });
    return out;
  }
  UI.choiceDeltas = function (i) { return UI.e ? choiceDeltas(UI.e, i) : null; };
  // The chips: a meter's or a patron's seal with the way it moves, a card's icon with how many.
  function deltaChips(list) {
    return list.map(function (x) {
      var mark = x.kind === 'card' ? (x.d > 0 ? '+' : '\u2212') + Math.abs(x.d) : '';
      return '<span class="ch-chip ' + (x.d > 0 ? 'up' : 'down') + (x.good ? ' good' : ' bad') + (x.kind === 'card' ? '' : ' moves') + '" title="' + esc(x.title) + '">' +
        '<i style="background-image:' + art(x.art) + '"></i>' + (mark ? '<b>' + mark + '</b>' : '') + '</span>';
    }).join('');
  }
  function syncChoice() {
    var e = UI.e, board = $('#board'), c = e.s.choice;
    if (!c) {
      if (choiceEl) {
        var old = choiceEl, hold = old.classList.contains('answered') ? CHOICE_HOLD : 0;
        choiceEl = null;
        setTimeout(function () { old.classList.add('gone'); setTimeout(function () { old.remove(); }, 300); }, hold);
      }
      return;
    }
    var shown = UI.choiceOptions(e, c);
    if (choiceEl && choiceEl.dataset.id === c.id && choiceEl.dataset.n === String(shown.length)) {
      choiceEl.querySelectorAll('.ch-opt').forEach(function (b, i) { b.classList.toggle('cant', !e.canChoose(i)); });
      return;
    }
    if (choiceEl) choiceEl.remove();
    var spot = e.choiceSpot();
    var el = h('div', 'choice');
    el.dataset.id = c.id;
    el.dataset.n = String(shown.length);
    el.innerHTML = '<div class="ch-title">' + esc(c.title) + '</div><p class="ch-text">' + esc(c.text) + '</p>';
    var opts = h('div', 'ch-options');
    shown.forEach(function (o, i) {
      var b = h('button', 'ch-opt' + (e.canChoose(i) ? '' : ' cant'));
      // What the option takes: an ability comes back spent, unless it is taken for good.
      var took = o.cost ? tr(o.forGood ? 'Takes {card}, for good.' : 'Takes {card}.', { card: CF.CARDS[o.cost].label }) : '';
      var cost = o.cost ? '<i class="ch-cost' + (o.forGood ? ' ch-cost-forgood' : '') + '" style="background-image:' + art(ASK_ART[o.cost] || 'itrade-20') + '" title="' + esc(took) + '"></i>' : '';
      // What it gives: the chips first, the sentence after them (for what only shows later).
      var deltas = choiceDeltas(e, i) || [];
      var gain = deltas.length || o.gain ? '<span class="ch-gain"' + (o.gain ? ' title="' + esc(o.gain) + '"' : '') + '>' + (deltas.length ? '<span class="ch-chips">' + deltaChips(deltas) + '</span>' : '') +
        (o.gain ? '<span class="ch-gain-text">' + esc(o.gain) + '</span>' : '') + '</span>' : '';
      b.innerHTML = cost + '<b>' + esc(o.label) + '</b><span>' + esc(o.text) + (o.cost ? ' <em class="ch-cost-read' + (o.forGood ? ' ch-cost-forgood' : '') + '">' + esc(took) + '</em>' : '') + '</span>' + gain;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (el.classList.contains('answered')) return; answerChoice(e, el, b, i, o); });
      opts.appendChild(b);
    });
    el.appendChild(opts);
    el.appendChild(h('div', 'ch-note', 'The clock waits for your answer.'));
    place(el, spot.x, spot.y);
    board.appendChild(el);
    choiceEl = el;
  }
  // An answer with a visible return: the price flies into the option, the wax comes down on it, the
  // other answers dim, and what the answer gives flies out of it onto the table.
  function answerChoice(e, el, b, i, o) {
    var c = e.s.choice, spec = c && CF.CHOICES && CF.CHOICES.filter(function (x) { return x.id === c.id; })[0];
    var pay = spec && spec.options[i] ? e.choicePayment(spec.options[i]) : null;
    var pel = null, ghost = null;
    if (pay && pay.loc && pay.loc.t === 'table') {
      pel = cardEls[pay.uid] || cardEls[e.stackOf(pay)[0].uid] || null;
      try { ghost = JSON.parse(JSON.stringify(pay)); } catch (err) { ghost = null; }
    }
    var before = e.s.nextUid;
    if (!e.choose(i)) {
      if (o.cost) toast({ title: 'You cannot pay for that', text: tr('It takes {card}, and there is none on the table.', { card: CF.CARDS[o.cost].label }), kind: 'minor' });
      return false;
    }
    if (pel && ghost) { flyTo(pel, b, ghost); markFlown(pay.uid); }
    el.classList.add('answered');
    b.classList.add('taken');
    CF.Audio.play('seal');
    UI.haptic('confirm');
    // What the answer gives comes out of it.
    if (typeof before === 'number') e.tableCards().forEach(function (x) { if (x.uid >= before) markSpawn(x.uid, b); });
    e.dirty = true;
    return true;
  }
  UI.answerChoice = answerChoice;

  // ---- Case strings: a rope from a case card to every card that belongs
  // to it, pinned at both ends, in the case's own colour. Cards inside a verb
  // are tied to the verb's token; a card being dragged pulls its string along.
  var LINK_COLORS = ['#d0342c', '#3aa76d', '#3b7fd1', '#e0b64a', '#b45cd6', '#e0783a'];
  var linkEl = null, pinEl = null;
  // What the last full build drew, in document order: ropes[i] is the i-th
  // path, pinList[i] the i-th pair of circles; linkKeys maps a card's uid (or
  // 'v:' + a verb) to the ropes that touch it, pinsOf a uid to its pin.
  var ropes = [], pinList = [], linkKeys = {}, pinsOf = {}, heldPins = [];
  function linkPoint(c, drag) {
    var e = UI.e;
    if (drag && drag.uids && drag.uids.indexOf(c.uid) >= 0 && drag.lastEv) {
      var p = toBoard(drag.lastEv.clientX, drag.lastEv.clientY, drag.rect);
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
    if (CF.Settings.get('strings') === false) { linkEl.innerHTML = ''; pinEl.innerHTML = ''; fitLayers(null); return; }
    var drag = UI.drag && UI.drag.kind === 'card' && UI.drag.started ? UI.drag : null;
    var cases = {}, order = [], box = null;
    function reach(x, y) {
      if (!box) box = { x0: x, y0: y, x1: x, y1: y };
      else { box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y); box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y); }
    }
    Object.keys(e.s.cards).forEach(function (uid) {
      var c = e.s.cards[uid], k = CF.CARDS[c.def].kind;
      if (!c.caseId || c.hidden) return;
      if (k === 'case' || k === 'coldcase') { cases[c.caseId] = cases[c.caseId] || { card: c, kids: [] }; cases[c.caseId].card = c; }
      else if (k === 'clue' || k === 'evidence' || k === 'witness' || k === 'suspect' || k === 'condemned' || c.def === 'atlarge' || c.def === 'trial' || c.def === 'thread') {
        (cases[c.caseId] = cases[c.caseId] || { card: null, kids: [] }).kids.push(c);
      }
    });
    Object.keys(e.s.cases).forEach(function (id) { order.push(id); });
    var html = '', shade = '', pins = '';
    ropes = []; pinList = []; linkKeys = {}; pinsOf = {};
    function keysOf(c) { return c.loc && c.loc.verb ? [String(c.uid), 'v:' + c.loc.verb] : [String(c.uid)]; }
    function pin(c, pt, col, r) {
      // A card in hand carries its pin with it (it is drawn in the drag layer's place).
      if (pt.held) return '';
      pinsOf[c.uid] = pinList.length;
      pinList.push({ card: c, r: r });
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
        var ri = ropes.length;
        ropes.push({ a: g.card, b: c });
        keysOf(g.card).concat(keysOf(c)).forEach(function (k) { (linkKeys[k] = linkKeys[k] || []).push(ri); });
        var d = ropePath(a, b);
        reach(a.x, a.y); reach(b.x, b.y); reach((a.x + b.x) / 2, ropeSag(a, b));
        shade += '<path class="shade" d="' + d + '"/>';
        html += '<path d="' + d + '" stroke="' + col + '"/>';
        pins += pin(c, b, col, 6);
      });
      if (any) pins += pin(g.card, a, col, 7);
    });
    // The shadows first, then the ropes over them: rope i is children[n + i], its shadow children[i].
    html = shade + html;
    if (linkEl.__html !== html) { linkEl.innerHTML = html; linkEl.__html = html; }
    if (pinEl.__html !== pins) { pinEl.innerHTML = pins; pinEl.__html = pins; }
    fitLayers(box);
  }
  // The ropes' and pins' layers are only as big as the ropes (with a pin's width and the shadow about them), not the
  // whole table, so the pins above the cards are not one table-sized layer over every glow. Nothing tied: no size.
  // Held, a rope may stray outside: the layers overflow visibly, and fit again when it is put down.
  function fitLayers(box) {
    var pad = 12, r = box ? { x: Math.floor(box.x0 - pad), y: Math.floor(box.y0 - pad), w: Math.ceil(box.x1 - box.x0 + 2 * pad), h: Math.ceil(box.y1 - box.y0 + 2 * pad) } : { x: 0, y: 0, w: 0, h: 0 };
    var key = r.x + ' ' + r.y + ' ' + r.w + ' ' + r.h;
    [linkEl, pinEl].forEach(function (el) {
      if (!el || el.__box === key) return;
      el.__box = key;
      el.setAttribute('viewBox', key);
      el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
    });
  }
  UI.fitLayers = fitLayers;
  // A rope sags between its pins.
  function ropeSag(a, b) { return Math.max(a.y, b.y) + Math.min(40, Math.abs(b.x - a.x) * 0.1 + 14); }
  function ropePath(a, b) {
    var mx = (a.x + b.x) / 2, my = ropeSag(a, b);
    return 'M' + a.x.toFixed(0) + ' ' + a.y.toFixed(0) + ' Q' + mx.toFixed(0) + ' ' + my.toFixed(0) + ' ' + b.x.toFixed(0) + ' ' + b.y.toFixed(0);
  }
  function movePin(c, pt) {
    var pi = pinsOf[c.uid];
    if (pi === undefined) return;
    var dot = pinEl.children[2 * pi], hi = pinEl.children[2 * pi + 1], r = pinList[pi].r;
    if (!dot || !hi) return;
    if (pt.held) {
      // In hand: the pin goes with the card, and comes back when it is put down.
      if (dot._held) return;
      dot._held = hi._held = true;
      dot.setAttribute('visibility', 'hidden'); hi.setAttribute('visibility', 'hidden');
      heldPins.push(dot, hi);
      return;
    }
    dot.setAttribute('cx', pt.x.toFixed(0)); dot.setAttribute('cy', pt.y.toFixed(0));
    hi.setAttribute('cx', (pt.x - r / 3).toFixed(0)); hi.setAttribute('cy', (pt.y - r / 3).toFixed(0));
  }
  // While something is held, only the ropes and pins tied to it move: the
  // keys are the held cards' uids, or 'v:' + a token's verb.
  function syncLinksHeld(keys) {
    if (!linkEl || !pinEl || CF.Settings.get('strings') === false) return;
    var drag = UI.drag && UI.drag.kind === 'card' && UI.drag.started ? UI.drag : null;
    var seen = {};
    keys.forEach(function (k) {
      (linkKeys[k] || []).forEach(function (ri) {
        if (seen[ri]) return;
        seen[ri] = true;
        var rope = ropes[ri], el = linkEl.children[ropes.length + ri], sh = linkEl.children[ri];
        if (!el) return;
        var a = linkPoint(rope.a, drag), b = linkPoint(rope.b, drag);
        if (!a || !b) return;
        var d = ropePath(a, b);
        el.setAttribute('d', d);
        if (sh) sh.setAttribute('d', d);
        movePin(rope.a, a); movePin(rope.b, b);
      });
    });
  }
  function releasePins() {
    heldPins.forEach(function (el) { el._held = false; el.setAttribute('visibility', 'visible'); });
    heldPins = [];
  }
  UI.syncLinks = syncLinks;
  UI.syncLinksHeld = syncLinksHeld;

  function syncBoard() {
    var e = UI.e, board = $('#board');
    syncPile();
    syncChoice();
    var lifted = UI.lifted || {};
    var groups = {};
    e.tableCards().forEach(function (c) {
      if (lifted[c.uid]) return;
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
          settleAfter(el, 'flying', 360);
          delete UI.spawn[top.uid];
        } else {
          place(el, top.loc.x, top.loc.y);
          if (top.fresh) { el.classList.add('arrive'); settleAfter(el, 'arrive', 500); }
        }
        board.appendChild(el);
        if (sp) { void el.offsetWidth; }
        // A Condemned or an Abroad card a verdict has just made waits under the stamp.
        if (UI.verdictWait && top.uid >= UI.verdictWait.from && (top.def === 'condemned' || top.def === 'atlarge')) el.classList.add('awaiting');
      } else if (el.dataset.sig !== sig) {
        fillCard(el, top, list.length);
      }
      if (el.parentNode === board) place(el, top.loc.x, top.loc.y);
      el.cfAt = { x: top.loc.x, y: top.loc.y };
      el.classList.toggle('selected', UI.selected === top.uid);
      // Only the top of a stack is asked whether it can be used: the cards under it are not seen.
      el.classList.toggle('unavailable', !!e.unavailableReason(top));
      if (top.maxLife) liveCards.push([el, top.uid]);
      list.forEach(function (c) { c.fresh = false; });
    });
    Object.keys(cardEls).forEach(function (uid) {
      if (keep[uid] || lifted[uid]) return;
      var el = cardEls[uid], gone = goneWhy[uid];
      delete cardEls[uid];
      delete goneWhy[uid];
      if (el.parentNode !== board) return;
      leaveTable(el, gone);
    });
    syncVerbs();
  }

  // How a card leaves the table, where the rules say why (the engine's 'gone' event, { uid, why }): an ability lost
  // for good burns, a token or a trail fades like ink, a witness walks off, a Coin spent flies to the Bell. Anything
  // else, and any card the rules say nothing of, fades as before. Less motion: a plain fade, as long.
  var goneWhy = {};
  var GONE = { lost: ['gone-burn', 900], faded: ['gone-ink', 700], left: ['gone-walk', 600] };
  function leaveTable(el, gone) {
    var why = gone && gone.why, g = GONE[why];
    if (why === 'spent' && gone.card && !gone.flown && verbEls.time && !calm()) {
      flyTo(el, verbEls.time, gone.card);
      setTimeout(function () { CF.Audio.play('coin'); }, 350);
      el.remove();
      return;
    }
    if (g) { el.classList.add(g[0]); setTimeout(function () { el.remove(); }, g[1]); return; }
    el.classList.add('leaving');
    setTimeout(function () { el.remove(); }, 220);
  }
  function cardGone(p) {
    if (!p || p.uid === undefined || p.uid === null) return;
    var c = UI.e.card(p.uid), prev = goneWhy[p.uid];
    goneWhy[p.uid] = { why: p.why, card: c ? cloneCard(c) : null, flown: !!(prev && prev.flown) };
    // An ability lost for good is heard and felt: a low falling note, the paper catching, a double pulse.
    if (p.why === 'lost' && !UI.replaying) { CF.Audio.play('loss'); UI.haptic([40, 60, 40]); }
  }
  // A card that has already flown somewhere (a choice's price, the Bell's dues) does not fly again as it goes.
  function markFlown(uid) { goneWhy[uid] = goneWhy[uid] || { why: null }; goneWhy[uid].flown = true; }
  function cloneCard(c) { try { return JSON.parse(JSON.stringify(c)); } catch (err) { return null; } }
  UI.goneWhy = goneWhy;

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
        tok.insertAdjacentHTML('beforeend', '<svg class="v-ring" viewBox="0 0 248 248"><rect class="track" x="4" y="4" width="240" height="240" rx="20" /><rect class="glow" x="4" y="4" width="240" height="240" rx="20" /><rect class="line" x="4" y="4" width="240" height="240" rx="20" /></svg>');
        if (vid === 'time') tok.appendChild(h('div', 'v-week', tr('Wk {n}', { n: e.s.week })));
        tok.appendChild(h('div', 'v-plate' + (def.label.length > 9 ? ' long' : ''), def.label));
        el.appendChild(tok);
        el.appendChild(h('div', 'v-status'));
        el.appendChild(h('div', 'v-badge', '!'));
        el.appendChild(h('div', 'v-count'));
        el.appendChild(h('div', 'v-back'));
        var mag = h('div', 'v-magnet');
        mag.title = tr(vid === 'time' ? 'Dues: what the Bell draws from the table each week' : 'Magnet: pull in the cards this verb\'s open slots take');
        el.appendChild(mag);
        // The live children, found once: the frame loop writes them without a query.
        el._ring = tok.querySelector('.v-ring rect.line');
        if (el._ring) el._ring._glow = tok.querySelector('.v-ring rect.glow');
        el._status = el.querySelector('.v-status');
        el._week = tok.querySelector('.v-week');
        el._magnet = mag;
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
      seal(el._count || (el._count = el.querySelector('.v-count')), n, '');
      // The token's small box: hidden until the verb, part-way through its
      // work, asks for one more card. It shows what kind, and a tap pulls a
      // fitting card in from the table. The Bell's shows the dues when due.
      var mag = el._magnet || el.querySelector('.v-magnet');
      if (vid === 'time') {
        var dues = e.dues();
        // The dues on a numbered ring (cnum-01 is 0), in figures past nine.
        var ring = dues >= 0 && dues <= 9 ? 'cnum-' + pad2(dues + 1) : '';
        mag.style.backgroundImage = ring ? art(ring) : '';
        mag.textContent = ring ? '' : String(dues);
        mag.classList.toggle('due', dues > CF.ECONOMY.rent || CF.WEEK - e.s.weekT <= 10);
      }
      else {
        var ask = v.status === 'running' && v.ask && !v.ask.filled ? v.ask : null;
        mag.classList.toggle('asks', !!ask);
        mag.style.backgroundImage = ask ? art(ASK_ART[ask.accepts[0]] || 'iinv-05') : '';
        mag.textContent = '';
        mag.title = tr(ask ? ask.label + ': ' + ask.text : '');
        el.classList.toggle('asking', !!ask);
      }
      seal(el._badge || (el._badge = el.querySelector('.v-badge')), v.status === 'done' ? v.out.length : 0, '!');
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // A small count on a numbered wax seal (cwaxn-01..05); figures past five;
  // the fallback mark, with its own word, when there is nothing to count.
  function seal(el, n, fallback) {
    var key = n > 0 && n <= 5 ? 'cwaxn-' + pad2(n) : n > 5 || !fallback ? '' : 'cmark-04';
    var text = n > 5 ? String(n) : n > 0 ? '' : fallback;
    if (el._seal === key + '|' + text) return;
    el._seal = key + '|' + text;
    el.style.backgroundImage = key ? art(key) : '';
    el.textContent = text;
    el.classList.toggle('figures', n > 5);
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

  // The tokens' rings, clocks and the Bell's dues, every frame: each write is
  // guarded by the last value, so a still table costs nothing.
  function updateVerbRings() {
    var e = UI.e, dues = null;
    Object.keys(verbEls).forEach(function (vid) {
      var el = verbEls[vid], v = e.verb(vid);
      var pct = vid === 'time' ? e.s.weekT / CF.WEEK : v.status === 'running' ? v.elapsed / v.duration : v.status === 'done' ? 1 : 0;
      if (el._ring) setDash(el._ring, Math.min(1, pct) * RING_LEN, RING_LEN);
      if (el._status) setText(el._status, tr(verbStatus(vid)));
      if (el._week) {
        if (dues === null) dues = e.dues();
        setText(el._week, tr('Wk {n}', { n: e.s.week }));
        var due = dues > CF.ECONOMY.rent || CF.WEEK - e.s.weekT <= 10;
        if (el._due !== due) { el._due = due; el._magnet.classList.toggle('due', due); }
      }
    });
  }

  // The season of the year, where the rules keep one: e.season() ({ id, label, line }), else CF.SEASONS
  // ([{ id, label, line, from, to }], weeks of the year 1-52). Nothing until the rules have seasons.
  function seasonNow(e) {
    var se = null;
    try { se = typeof e.season === 'function' ? e.season() : null; } catch (err) { se = null; }
    if (!se && CF.SEASONS && CF.SEASONS.length) {
      var wk = ((Math.max(1, e.s.week || 1) - 1) % 52) + 1;
      se = CF.SEASONS.filter(function (x) { return wk >= x.from && wk <= x.to; })[0] || null;
    }
    if (!se) return null;
    // The engine's season (engine.js CF.SEASONS) is named by `name`; its line already opens with that name, and
    // `effect` says what it changes, where it changes anything.
    var label = se.label || se.name;
    return label ? { id: se.id, label: label, line: se.line || null, effect: se.effect || null, named: !!se.name && !se.label } : null;
  }
  UI.seasonNow = seasonNow;
  // The week bar's tooltip names the week, and the season with it.
  var weekTitleSig = '';
  function weekTitle() {
    var wb = document.querySelector('#weekbar'), e = UI.e;
    if (!wb || !e) return;
    var se = seasonNow(e), sig = e.s.week + '|' + (se ? se.label : '') + '|' + CF.lang();
    if (sig === weekTitleSig) return;
    weekTitleSig = sig;
    var en = se ? 'Week ' + e.s.week + '. ' + se.label : 'Week ' + e.s.week;
    // The page's own walk translates a title from its English (js/i18n.js); this one is kept there too.
    wb.__en_title = en;
    wb.title = se ? tr('Week {n}. {season}', { n: e.s.week, season: se.label }) : tr('Week {n}', { n: e.s.week });
  }
  // The sun-to-moon bar: the shade draws back from the sun as the week passes.
  // It is anchored at the moon end and scaled, written only when it has moved.
  var weekShade = null, weekScale = -1;
  function updateWeekBar() {
    if (!UI.e) return;
    if (!weekShade) {
      weekShade = document.querySelector('#weekbar .wb-shade');
      if (!weekShade) return;
      weekShade.style.left = '19%';
      weekShade.style.transformOrigin = 'right center';
      weekShade.style.transition = 'transform 0.5s linear';
    }
    weekTitle();
    var p = Math.min(1, UI.e.s.weekT / CF.WEEK);
    var sc = Math.round((81 - 62 * p) / 81 * 200) / 200;
    if (Math.abs(sc - weekScale) < 0.005) return;
    // A new week is not a rewind: the shade is full at once (the bar flashes, see weekTurns); the slide comes back after.
    var turned = weekScale >= 0 && sc > weekScale + 0.05;
    weekShade.style.transition = turned ? 'none' : 'transform 0.5s linear';
    weekScale = sc;
    weekShade.style.transform = 'scaleX(' + sc + ')';
  }

  function updateLive() {
    var e = UI.e;
    updateWeekBar();
    if (!e.s.over) moodTick();
    if (!UI.drag) renderHint();
    advanceTyping();
    if (UI.notices.length) updateNotices();
    // The dossier's clock, and the card pictured in it.
    var peekUid = UI.hover || UI.selected, peekCard = peekUid && e.card(peekUid);
    if (peekCard && peekCard.maxLife) {
      var pt = $('#peek .i-time'); if (pt) pt.textContent = clockLine(peekCard);
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
    // Each card element stands for every card at its place on the table: read once, not a stack per element.
    var byPos = {};
    e.tableCards().forEach(function (c) { var k = c.loc.x + ',' + c.loc.y; (byPos[k] = byPos[k] || []).push(c.uid); });
    Object.keys(cardEls).forEach(function (uid) {
      var el = cardEls[uid], c = e.card(+uid);
      var stackUids = c && c.loc && c.loc.t === 'table' ? byPos[c.loc.x + ',' + c.loc.y] || [+uid] : [+uid];
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
    // On a phone the docked window and a pinned dossier share too little screen: the window puts the dossier away,
    // as Back or a touch on the felt would (a tap on a card in the window reads it again).
    if (narrow() && UI.selected) {
      UI.hover = null; select(null);
      var pk = $('#peek');
      if (pk) { pk.classList.remove('open', 'pinned'); pk.dataset.uid = ''; }
    }
    document.body.classList.add('has-window'); // the page makes room (toasts move clear of the window)
    UI.e.dirty = true;
  }
  function closeWindow(vid) {
    var e = UI.e;
    // Whatever the verb found stays in it, face down, until it is looked at;
    // cards in its slots stay put, and the token counts them.
    UI.openVerbs = UI.openVerbs.filter(function (x) { return x !== vid; });
    UI.hoverSlot = null;
    if (UI.pick && UI.pick.verb === vid) UI.pick = null;
    if (!UI.openVerbs.length) document.body.classList.remove('has-window');
    e.dirty = true;
  }
  function closeAllWindows() { UI.openVerbs.slice().forEach(closeWindow); }
  UI.openWindow = openWindow;

  // The Council's fortnightly count where the rules keep one, else null: the engine's councilExpects() gives
  // { n answered, m expected, weeksLeft } from Bailiff (councilQuota()'s { closed, expect } is read the same way).
  function councilQuota(e) {
    var q = null;
    try {
      if (typeof e.councilExpects === 'function') { var x = e.councilExpects(); q = x ? { closed: x.n, expect: x.m } : null; }
      else if (typeof e.councilQuota === 'function') q = e.councilQuota();
    } catch (err) { q = null; }
    if (!q || typeof q.expect !== 'number' || q.expect <= 0) return null;
    return { closed: Math.max(0, q.closed | 0), expect: Math.min(8, q.expect | 0) };
  }
  UI.councilQuota = councilQuota;
  function windowSig(vid) {
    var e = UI.e, v = e.verb(vid), pv = v.status === 'idle' ? e.preview(vid) : null;
    // The finds' face-down state is part of it, so a turned card redraws (with its flip) at once.
    return [v.status, JSON.stringify(v.slots), v.out.map(function (u) { var c = e.card(u); return u + (c && c.hidden ? 'h' : ''); }).join(','), v.held.join(','), v.story ? v.story.title : '', v.ask ? (v.ask.filled || 'open') : '',
      pv ? pv.label + '|' + pv.blocked + '|' + pv.text : '', e.lockReason(vid) || '', v.recipe || '',
      vid === 'time' ? e.s.week + '/' + JSON.stringify(councilQuota(e)) : '', UI.pick && UI.pick.verb === vid ? UI.pick.slot + ':' + e.tableCards().length : '', UI.about === vid ? 'about' + e.s.rank : ''].join('#');
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
    document.body.classList.toggle('has-window', UI.openVerbs.length > 0);
    UI.openVerbs.forEach(function (vid, i) {
      var w = winEls[vid];
      if (!w) {
        w = h('div', 'vwin');
        w.dataset.win = vid;
        // The Bell's window is its own description: it has no info to open.
        w.innerHTML = '<div class="vw-head"><div class="vw-icon"></div><h3></h3>' + (CF.VERBS[vid].auto ? '' : '<button class="vw-info" title="' + esc('What this verb does') + '">i</button>') + '<button class="vw-close" title="' + esc('Close (Esc)') + '">×</button></div><div class="divider"></div><div class="vw-body"></div>';
        if (!CF.VERBS[vid].auto) w.querySelector('.vw-info').addEventListener('click', function (ev) { ev.stopPropagation(); UI.about = UI.about === vid ? null : vid; UI.e.dirty = true; });
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
        keepClearOfBar(body);
        // A slot just tapped: the cards that fit come into view (on a short screen they open below the slots).
        if (UI.pickReveal && UI.pickReveal === vid) {
          UI.pickReveal = null;
          var pk = body.querySelector('.picker');
          if (pk && pk.scrollIntoView) pk.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    });
  }

  // The window stands at the side of the table, fitted to it.
  function positionWindow(vid, w) { void vid; w.classList.add('docked'); }
  // The body scrolls under its sticky bar (Start, Clear; Take all): whatever is scrolled into view stops below it.
  function keepClearOfBar(body) {
    var bar = null;
    for (var i = 0; i < body.children.length; i++) if (body.children[i].classList.contains('actions')) { bar = body.children[i]; break; }
    var hgt = bar && bar.offsetHeight ? bar.offsetHeight + 6 : 0;
    body.style.scrollPaddingTop = hgt ? hgt + 'px' : '';
  }
  UI.keepClearOfBar = keepClearOfBar;

  function miniCard(card) {
    var mc = miniCard0(card);
    // The flip plays on the wrapper: the card inside keeps its mini scale. A redraw mid-flip picks it up where it was.
    var held = UI.flipHold[card.uid], into = UI.flipIn[card.uid], t = flipNow();
    if (held !== undefined && card.hidden) { mc.classList.add('flip-out'); mc.style.animationDelay = Math.round(held - t) + 'ms'; }
    else if (into !== undefined) {
      if (t - into < FLIP_IN) { mc.classList.add('flip-in'); if (t > into) mc.style.animationDelay = -Math.round(t - into) + 'ms'; }
      else delete UI.flipIn[card.uid];
    }
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
      // The season first, where the rules keep one: the week, the season's name and its line.
      var season = seasonNow(e);
      if (season) {
        // The rules' line names its season already ('Lent: fish on every table...'): it stands as the season.
        var sline = season.named && season.line ? tr('Week {n}. {season}', { n: e.s.week, season: tr(season.line) })
          : season.line ? tr('Week {n}. {season}: {line}', { n: e.s.week, season: season.label, line: season.line }) : tr('Week {n}. {season}', { n: e.s.week, season: season.label });
        pane.appendChild(h('p', 'vw-desc vw-season', sline));
        if (season.effect) pane.appendChild(h('p', 'vw-desc vw-season', tr(season.effect)));
      }
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
      pane.appendChild(h('p', 'vw-desc', 'Coin in a verb\'s slot counts at the Bell.'));
      // The Council's count, from Bailiff where the rules keep one: cases answered this fortnight against what it
      // expects, as wax pips. Short of it at the Bell, the Crowd stirs; met, it settles.
      var quota = councilQuota(e);
      if (quota) {
        var qrow = h('div', 'quota' + (quota.closed >= quota.expect ? ' met' : ''));
        var pips = '';
        for (var qi = 0; qi < quota.expect; qi++) pips += '<i class="' + (qi < quota.closed ? 'on' : '') + '"></i>';
        qrow.innerHTML = '<span class="q-seal" style="background-image:' + art(PATRON_ART.council) + '"></span><span class="q-text">' +
          escText(tr('The Council counts: {n} of {m} this fortnight', { n: Math.min(quota.closed, quota.expect), m: quota.expect })) + '</span><span class="q-pips">' + pips + '</span>';
        pane.appendChild(qrow);
      }
      var orders = e.tableCards().filter(function (c) { return c.def === 'order' && CF.costOf; }).sort(function (a, b) { return CF.costOf(a) - CF.costOf(b); });
      if (orders[0] && CF.costOf(orders[0]) > money) pane.appendChild(h('p', 'vw-desc', tr('Cheapest petition: {label}, {n} Coin more', { label: e.labelOf(orders[0]), n: CF.costOf(orders[0]) - money })));
      var rv = e.cardsOf('rival', true)[0];
      if (rv) pane.appendChild(h('p', 'vw-desc', 'The Harbourmaster\'s Examiner is in the city' + (rv.data.stalled >= e.s.week ? ', and lying low for now.' : '. Every week they act against you unless you act first.')));
      pane.appendChild(h('p', 'vw-desc', open.length ? 'Open cases, most urgent first.' : 'No open cases.'));
      open.forEach(function (rec) {
        var cc = e.caseCard(rec.id);
        if (!cc) return;
        var life = cc.life / cc.maxLife;
        var row = h('div', 'clock' + (cc.life < 60 ? ' urgent' : ''));
        row.innerHTML = '<span class="ck-title">' + esc(rec.title) + (rec.searches === 0 ? ' · ' + esc('never opened') : '') + '</span><span class="ck-bar"><i style="width:' + Math.round(life * 100) + '%"></i></span>' +
          '<span class="ck-days">' + esc(CF.daysLeft(cc.life) === 1 ? tr('1 day') : tr('{n} days', { n: CF.daysLeft(cc.life) })) + '</span>';
        row.title = tr('Show this case on the table');
        row.addEventListener('click', function () { UI.panTo(cc.uid); });
        pane.appendChild(row);
      });
      return;
    }

    if (v.status !== 'idle' && UI.about === vid) aboutBlock(pane, vid);
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
          var pen = askPenalty(vid);
          ab.appendChild(h('div', 'vw-desc', pen === 'fatigue' ? 'Or drop a card on the token. Ignore it and the work still finishes, but wearier.' : pen === 'thin' ? 'Or drop a card on the token. Ignore it and the work still finishes, but it finds less.' : 'Or drop a card on the token. Ignore it and the work finishes as it would have.'));
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
    if (UI.about === vid) aboutBlock(pane, vid);
    var lock = e.lockReason(vid);
    var pv = e.preview(vid);
    // The Court reads the charge first: what the case needs against what the
    // tokens give, above the slots, and the tokens that hurt it are marked.
    var charge = vid === 'arrest' && pv && pv.detail && pv.detail.charge ? pv.detail.charge : null;
    var bad = {};
    // The first case of the office (the opening's): a charge on Indicia is said, in red, to walk.
    var pcard = primaryCard ? e.card(primaryCard) : null, prec = pcard && pcard.caseId ? e.caseRec(pcard.caseId) : null;
    var firstCase = !!(prec && prec.opening);
    // The charge as the Court reads it (for the seals and for each token's standing), where the accused is in.
    var assess = null;
    if (vid === 'arrest' && pcard && pcard.def === 'suspect' && e.assessCharge) {
      try { assess = e.assessCharge(pcard, ['c1', 'c2', 'c3', 'c4'].map(function (k) { return v.slots[k] && e.card(v.slots[k]); }).filter(Boolean)); } catch (err) { assess = null; }
    }
    if (charge) {
      var cbox = h('div', 'charge-box');
      cbox.innerHTML = chargeHtml(charge, firstCase, assess);
      pane.insertBefore(cbox, pane.firstChild);
      (charge.bad || []).forEach(function (u) { bad[u] = true; });
    }
    var slots = h('div', 'slots');
    e.visibleSlots(vid).forEach(function (sl) {
      var s = h('div', 'slot' + (sl.primary ? ' primary' : ''));
      s.dataset.verb = vid;
      s.dataset.slot = sl.key;
      var box = h('div', 's-box');
      var uid = v.slots[sl.key];
      if (uid && e.card(uid)) {
        var mc = miniCard(e.card(uid));
        if (bad[uid]) { var mcard = mc.querySelector('.card'); (mcard || mc).classList.add('bad'); }
        box.appendChild(mc);
      } else {
        // An empty slot, tapped, says what it takes and offers the cards that fit.
        box.classList.add('empty');
        box.title = tr('Pick a card for this slot');
        box.addEventListener('click', function () {
          var same = UI.pick && UI.pick.verb === vid && UI.pick.slot === sl.key;
          UI.pick = same ? null : { verb: vid, slot: sl.key };
          UI.pickReveal = same ? null : vid;
          e.dirty = true;
        });
        if (UI.pick && UI.pick.verb === vid && UI.pick.slot === sl.key) s.classList.add('picking');
      }
      s.appendChild(box);
      // The primary slot wears its first name; the whole list is in the title.
      var parts = sl.label.split(' / ');
      // Under a token before the Court: its standing toward this accused, not the slot's name.
      var stand = assess && !sl.primary && uid ? tokenStanding(assess, pcard, e.card(uid)) : null;
      var lab = h('div', 's-label' + (stand ? ' st-' + stand : ''), stand ? STANDING[stand] : sl.primary ? parts[0] : sl.label);
      lab.title = sl.primary && parts.length > 1 ? slashText(sl.label) : kindsText(sl.accepts, ' / ');
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

    var rbox = h('div', 'recipe');
    if (pv) {
      rbox.innerHTML = '<h5>' + esc(pv.label) + '</h5><p>' + esc(pv.text || '') + '</p>' +
        (pv.detail && pv.detail.charge && !charge ? chargeHtml(pv.detail.charge, firstCase, assess) : '') +
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

    var act2 = h('div', 'actions go-row');
    var go = h('button', 'plate-btn redfill go', pv ? tr('{label} · {n}s', { label: pv.label, n: Math.round(pv.duration) }) : (primaryCard ? 'Nothing comes of it' : 'Put a card in'));
    // The Charge plate wears the charge it would bring: dark on Indicia, red on Half Proof, gold on Full, and says
    // which after the verb, with the weight against the need (on a phone, where the name is hidden: Charge, Indicia 1/5).
    var goTier = charge && pv && charge.tier && TIER_PLATE[charge.tier] ? tr('{tier} · {n}/{need}', { tier: tr(charge.tierLabel || CF.Charge.TIERS[charge.tier].label), n: charge.score, need: charge.need }) : null;
    if (goTier) go = h('button', 'plate-btn go tier-' + charge.tier + ' ' + TIER_PLATE[charge.tier], pv.label);
    // The Court's Charge plate names the accused in a span a narrow phone hides (the charge panel names them too).
    if (pv && vid === 'arrest' && pcard && pcard.def === 'suspect') {
      var gname = tr(CF.cardFace(pcard, e.labelOf(pcard)).text.replace(/^★ /, '')), glab = go.textContent, gat = gname ? glab.indexOf(gname) : -1;
      var raw = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      if (gat >= 0) go.innerHTML = raw(glab.slice(0, gat)) + '<span class="go-name">' + raw(gname) + '</span>' + raw(glab.slice(gat + gname.length));
    }
    if (goTier) go.appendChild(h('span', 'go-tier', goTier));
    go.disabled = !pv || !!pv.blocked;
    go.addEventListener('click', function () { if (e.start(vid)) { verbStarted(vid); e.dirty = true; } });
    // Shut by the Fever: the plate is the way out, to Rest with the Fever laid in it.
    var fever = feverLock(vid);
    if (fever && go.disabled) {
      go = h('button', 'plate-btn gold go to-rest', 'To Rest');
      go.addEventListener('click', function () { toRest(fever); });
    }
    act2.appendChild(go);
    if (Object.keys(v.slots).length) {
      var clr = h('button', 'plate-btn dark', 'Clear');
      clr.addEventListener('click', function () { returnSlots(vid); });
      act2.appendChild(clr);
    }
    pane.appendChild(act2);
  }

  // The info pane: what a junior can do here now, the offices' powers, the ways found; open in any state of the verb.
  function aboutBlock(pane, vid) {
    var e = UI.e;
    // What a junior can do here now; each office's power below it, dim, and the ones still to come as one line each.
    var info = e.verbInfo(vid);
    pane.appendChild(h('p', 'vw-desc vw-about', info.basics));
    info.powers.forEach(function (pw) {
      pane.appendChild(h('p', 'vw-desc vw-power' + (pw.open ? '' : ' locked'), pw.open ? tr('{label}: {text}', { label: tr(pw.label), text: tr(pw.text) }) : tr('At {rank}: {label}', { rank: tr(pw.rankLabel), label: tr(pw.label) })));
    });
    var sr = e.s.stats.recipes || {};
    var ways = e.s.stats.ways || {};
    var known = (CF.RECIPES_BY_VERB[vid] || []).filter(function (r) { return sr[r.id] && (ways[r.id] || typeof r.label === 'string'); }).map(function (r) { return tr(ways[r.id] || r.label) + (sr[r.id] > 1 ? ' ×' + sr[r.id] : ''); });
    pane.appendChild(h('p', 'vw-desc vw-about', known.length ? tr('Ways you have found here: {list}.', { list: joinList(known) }) : tr('You have not found a way here yet: put a card in and see what it offers.')));
    // The verb's own part of the Help, one tap away: the book, no words.
    if (HELP_AT[vid] && CF.openHelp) {
      var hb = h('button', 'vw-help');
      hb.title = tr('How to Play');
      hb.style.backgroundImage = art('bround-22');
      hb.addEventListener('click', function (ev) { ev.stopPropagation(); CF.Audio.play('click'); CF.openHelp(HELP_AT[vid]); });
      pane.appendChild(hb);
    }
  }
  // The Charge plate's colour by the charge it would bring.
  var TIER_PLATE = { weak: 'dark', reasonable: 'redfill', strong: 'gold' };
  // A verb's first words, for the window's info: what anyone can do with it from the first day (e.verbInfo).
  UI.verbBasics = function (vid) { return UI.e ? UI.e.verbInfo(vid).basics : CF.VERBS[vid].basics || CF.VERBS[vid].desc; };

  // Whether Post the Watch takes this kind of card as its first (the engine may widen it from the bands to the Coquille).
  function postWatchTakes(def) {
    var r = CF.RECIPES_BY_ID && CF.RECIPES_BY_ID.duty_post_watch, prim = r && r.requires && r.requires.primary;
    return prim === def || (!!prim && typeof prim.indexOf === 'function' && typeof prim !== 'string' && prim.indexOf(def) >= 0);
  }
  // The Fever on the table, when it is what shuts this verb and Rest can take it; else null.
  function feverLock(vid) {
    var e = UI.e;
    if (vid === 'reflect' || CF.VERBS[vid].lockedBy !== 'burnout' || !e.lockReason(vid)) return null;
    var f = e.cardsOf('burnout').filter(function (c) { return c.loc.t === 'table'; })[0];
    return f && e.verb('reflect').unlocked ? f : null;
  }
  function toRest(fever) {
    var e = UI.e, rest = e.verb('reflect');
    openWindow('reflect');
    if (rest.status === 'idle' && fever.loc && fever.loc.t === 'table') { var el = cardEls[fever.uid]; if (e.autoSlot('reflect', fever.uid)) { markSpawn(fever.uid, el); CF.Audio.play('drop'); } }
    e.dirty = true;
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
    box.innerHTML = '<div class="pk-head"><span>' + escText(tr('{slot} takes: {kinds}', { slot: sl.label, kinds: kindsText(sl.accepts, ', ') })) + '</span><button class="pk-close" title="' + esc('Close') + '">×</button></div>';
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
  // UI.flipIn[uid] and UI.flipHold[uid] keep when each half began, so a window redrawn
  // in the middle of a flip carries it on from where it was instead of starting over.
  UI.flipIn = {};
  UI.flipHold = {};
  var FLIP_OUT = 180, FLIP_IN = 220, FLIP_STEP = 70;
  function flipNow() { return performance.now(); }
  // A find that names someone, or carries a confession, lands with a low note and a glow; the rest land quietly.
  function discovery(card) {
    var d = card.data || {};
    return card.def === 'suspect' || !!d.points || !!d.confession;
  }
  function turnOver(e, uid) {
    delete UI.flipHold[uid];
    UI.flipIn[uid] = flipNow();
    e.reveal(uid);
    e.dirty = true;   // the window redraws the card face up, where it lies; a tap on it then reads it
    var c = e.card(uid);
    if (!c || !discovery(c)) return;
    setTimeout(function () {
      CF.Audio.play('discovery');
      UI.haptic(20);
      var el = document.querySelector('.vwin .card[data-uid="' + uid + '"]') || cardEls[uid];
      if (el) { el.classList.remove('noticed'); void el.offsetWidth; el.classList.add('noticed'); setTimeout(function () { el.classList.remove('noticed'); }, 4000); }
    }, 120);
  }
  function flipOut(wrap, uid, delay) {
    UI.flipHold[uid] = flipNow() + delay;
    if (!wrap) return;
    wrap.style.animationDelay = delay ? delay + 'ms' : '';
    wrap.classList.add('flip-out');
  }
  function flipReveal(card, el) {
    var e = UI.e;
    var wrap = el && (el.closest('.mini-wrap') || el);
    flipOut(wrap, card.uid, 0);
    CF.Audio.play('flip');
    UI.haptic(12);
    UI.hoverBlock = card.uid;   // the mouse resting on it does not open the inspect: a tap does
    if (UI.hover === card.uid) UI.hover = null;
    setTimeout(function () { turnOver(e, card.uid); }, FLIP_OUT);
  }
  // Every find turns in its turn, a moment apart, each with its own flick.
  function revealAll(vid) {
    var e = UI.e, w = winEls[vid];
    var hidden = e.verb(vid).out.filter(function (u) { var c = e.card(u); return c && c.hidden; });
    if (!hidden.length) return;
    UI.haptic(12);
    hidden.forEach(function (u, i) {
      var el = w && w.querySelector('.card[data-uid="' + u + '"]'), wrap = el && (el.closest('.mini-wrap') || el);
      flipOut(wrap, u, i * FLIP_STEP);
      setTimeout(function () { CF.Audio.play('flip'); }, i * FLIP_STEP);
      setTimeout(function () { if (e.card(u) && e.card(u).hidden) turnOver(e, u); else delete UI.flipHold[u]; }, FLIP_OUT + i * FLIP_STEP);
    });
  }
  UI.revealAll = revealAll;
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
  // A story's words in the reader's language: a story told in sentences (entry.parts) is read one sentence at a
  // time, so each finds its own key; else the whole text.
  function storyText(story) {
    if (!story) return '';
    if (story.parts && story.parts.length) return story.parts.map(function (x) { return tr(x); }).join(' ');
    return tr(story.text || '');
  }
  UI.storyText = storyText;
  function storyBox(story) {
    var d = h('div', 'story');
    d.innerHTML = '<h5>' + esc(story.title) + '</h5>';
    var p = h('p');
    d.appendChild(p);
    if (typed.has(story) || CF.Settings.typeRate() === Infinity || !story.text) {
      p.textContent = storyText(story);
      typed.add(story);
    } else {
      if (!UI.typing || UI.typing.story !== story) UI.typing = { story: story, t0: performance.now() };
      // The words still to come stand unseen after the typed ones, so the story has its full height from the
      // first frame: the finds under it do not slide down between a player's two taps.
      var shown = h('span'), ghost = h('span', 'ghost');
      p.appendChild(shown); p.appendChild(ghost);
      UI.typing.el = shown; UI.typing.ghost = ghost;
      d.title = tr('Click to show all');
      d.addEventListener('click', function () { typed.add(story); p.textContent = storyText(story); UI.typing = null; });
      advanceTyping();
    }
    return d;
  }
  function advanceTyping() {
    var t = UI.typing;
    if (!t || !t.el) return;
    var n = Math.floor(((performance.now() - t.t0) / 1000) * CF.Settings.typeRate());
    var full = storyText(t.story);
    if (n >= full.length) { t.el.textContent = full; if (t.ghost) t.ghost.textContent = ''; typed.add(t.story); UI.typing = null; return; }
    t.el.textContent = full.slice(0, n);
    if (t.ghost) t.ghost.textContent = full.slice(n);
  }

  // A picture of what a slot takes, from its first accepted kind.
  var SLOT_ART = { health: 'imed-01', focus: 'cres-05', instinct: 'iinv-06', funds: 'itrade-20', teammate: 'rrole-03', case: 'imark-01', witness: 'rrole-01', suspect: 'rrole-02', rival: 'csus-02',
    clue: 'iinv-02', evidence: 'iinv-16', district: 'iinv-17', order: 'ilaw-05', personnel: 'ilaw-11', informant: 'cwit-01', condemned: 'ilaw-06', rung: 'ilaw-01', trial: 'ilaw-02', coldcase: 'imark-06',
    fatigue: 'imed-13', hunger: 'imed-20', sickness: 'imed-07', stress: 'imed-21', spent: 'imed-08', lesson: 'iinv-20', kit_bio: 'iinv-16', tool: 'iinv-16', paperwork: 'ilaw-21', watchq: 'iinv-05', intel: 'cwit-01', thread: 'iinv-24', looseend: 'iinv-24', bribe: 'itrade-20', gang: 'icrime-22', syndicate: 'imyst-09' };
  function slotArt(sl) {
    for (var i = 0; i < sl.accepts.length; i++) if (SLOT_ART[sl.accepts[i]]) return SLOT_ART[sl.accepts[i]];
    return null;
  }
  // A slot's kinds in the reader's language: each name read alone (a joined list is no key), joined by the language's own
  // comma, or by a slash.
  function kindsText(ids, sep) {
    return ids.map(function (a) { return tr(prettyAspect(a)); }).join(sep === ', ' ? tr(', ') : sep);
  }
  UI.kindsText = kindsText;
  // A slot's ' / '-joined name, each part read alone.
  function slashText(label) { return String(label).split(' / ').map(function (x) { return tr(x); }).join(' / '); }
  UI.slashText = slashText;
  function prettyAspect(a) {
    var map = { tool: 'Instrument', teammate: 'Watchman', atlarge: 'Abroad', coldcase: 'Unanswered', looseend: 'Loose End', promotion: 'The Council\'s Letter', chair: 'The Seat', funds: 'Coin', focus: 'Wit',
      nextdoor: 'The Next Door', spent: 'Spent Health, Wit or Instinct', lesson: 'Insight', kit_bio: 'Physician\'s Case' };
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
  // The Roads: the endings this run is nearest, each with its seal and what it still wants, and the defeats that
  // have warned you, from the rules' own reckoning (e.roads(): [{ id, text, vars, warn }], three or so). A line's
  // text is a template; its picture is the ending's own.
  function journalRoads(e) {
    if (typeof e.roads !== 'function') return [];
    var list;
    try { list = e.roads() || []; } catch (err) { list = []; }
    if (!(list instanceof Array)) return [];
    return list.map(function (r) {
      if (!r || !r.id) return null;
      // The rules' road is how near it is in a word and what it still wants in a sentence (callings.js roads()).
      var text = typeof r.text === 'string' ? tr(r.text, r.vars || undefined)
        : typeof r.want === 'string' ? (r.near ? glue('{near} · {want}', { near: tr(r.near), want: tr(r.want) }) : tr(r.want)) : null;
      if (!text) return null;
      var end = (CF.ENDINGS || {})[r.id] || {};
      return { id: r.id, title: tr(r.title || end.title || r.id), text: text, warn: !!r.warn, art: (UI.ENDING_ART || {})[r.id] || 'ccirc-01' };
    }).filter(Boolean).slice(0, 4);
  }
  UI.journalRoads = journalRoads;
  function renderJournal() {
    var e = UI.e, j = e.s.journal;
    var roads = journalRoads(e);
    var fsig = firstsSig(e) + '|' + roads.map(function (r) { return r.id + ':' + r.text; }).join(';');
    if (shownJournal === j[0] && UI.journalLen === j.length && UI.firstsSig === fsig) return;
    shownJournal = j[0];
    UI.journalLen = j.length;
    UI.firstsSig = fsig;
    if (!$('#journal-drawer').classList.contains('open') && j.length > (UI.journalSeen || 0)) $('#btn-journal').classList.add('unread');
    var pane = $('#journal');
    pane.innerHTML = '';
    var fb = h('div', 'firsts');
    var done = FIRSTS.filter(function (f) { return f.done(e); }).length;
    fb.innerHTML = '<h6>' + escText(tr('Firsts: {n} of {total}', { n: done, total: FIRSTS.length })) + '</h6>';
    // Each first wears a progress mark: the empty ring, then the check.
    FIRSTS.forEach(function (f) {
      var ok = f.done(e), sp = h('span', 'first' + (ok ? ' done' : ''));
      sp.innerHTML = '<i style="background-image:' + art(ok ? 'cprog-02' : 'cprog-01') + '"></i>' + esc(f.label);
      fb.appendChild(sp);
    });
    pane.appendChild(fb);
    if (roads.length) {
      var rb = h('div', 'roads');
      rb.innerHTML = '<h6>' + esc('Roads') + '</h6>' + roads.map(function (r) {
        return '<div class="road' + (r.warn ? ' warn' : '') + '" data-end="' + esc(r.id) + '"><i style="background-image:' + art(r.art) + '"></i><b>' + esc(r.title) + '</b><span>' + esc(r.text) + '</span></div>';
      }).join('');
      pane.appendChild(rb);
    }
    j.slice(0, 120).forEach(function (x) {
      var d = h('div', 'journal-entry k-' + x.kind);
      d.innerHTML = '<i class="j-icon" style="background-image:' + art(TOAST_ICONS[x.kind] || 'ccirc-01') + '"></i><div class="j-meta">' + escText(tr('Week {n}', { n: x.week })) + '</div><h6>' + esc(x.title) + '</h6><p>' + escText(storyText(x)) + '</p>';
      pane.appendChild(d);
    });
  }

  function caseLife(rec) { var cc = UI.e.caseCard(rec.id); return cc ? cc.life : Infinity; }

  // The charge breakdown in the Arrest window: what the case needs proven
  // against what the clues give, then the bonuses and penalties.
  // The four things full proof asks, as four wax seals lit or dark: enough proof, of two kinds the case turns
  // on, with word behind it (a witness, a confession, a token that names or corroborates), and nothing that
  // describes somebody else. The rules may give them (describe().gates); else they are read off the charge.
  var GATES = { enough: { art: 'cwax-03', label: 'Enough' }, kinds: { art: 'cwax-01', label: 'Two kinds' }, word: { art: 'cwax-02', label: 'Word behind it' }, clean: { art: 'cwax-04', label: 'Nothing against them' } };
  var GATE_ORDER = ['enough', 'kinds', 'word', 'clean'];
  var WORD_NOTE = 'Word behind it: a witness\'s Deposition, two tokens bound in Rest, a hand matched to them, or a free confession.';
  function chargeGates(d, a) {
    if (d && d.gates && d.gates.length) return d.gates.filter(function (g) { return GATES[g.id]; });
    if (!a) return null;
    return [{ id: 'enough', ok: a.score >= a.need }, { id: 'kinds', ok: a.covered >= 2 },
      { id: 'word', ok: a.witnesses >= 1 || !!a.confession || a.corroboration >= 1 }, { id: 'clean', ok: !a.contradictions }];
  }
  function chargeHtml(d, firstCase, a) {
    var gates = chargeGates(d, a);
    var html = '<div class="charge tier-' + d.tier + '"><div class="ch-head"><span>' + escText(tr('{tier} charge', { tier: d.tierLabel })) + '</span></div>';
    if (gates) {
      html += '<div class="ch-gates">' + GATE_ORDER.map(function (id) {
        var g = gates.filter(function (x) { return x.id === id; })[0];
        if (!g) return '';
        return '<span class="ch-gate ' + (g.ok ? 'on' : 'off') + '" data-gate="' + id + '" title="' + esc(GATES[id].label) + '"><i style="background-image:' + art(GATES[id].art) + '"></i><em>' + esc(GATES[id].label) + '</em></span>';
      }).join('') + '</div>';
    }
    // The Court's words, glossed where they stand: what the tier means (Charge.TIERS[*].gloss).
    if (d.tierGloss) html += '<div class="ch-gloss">' + esc(d.tierGloss) + '</div>';
    if (firstCase && d.tier === 'weak') html += '<div class="ch-note bad ch-first">' + esc('The first case of your office. On Indicia the Court will let them go.') + '</div>';
    d.rows.forEach(function (r) {
      var pct = Math.min(100, (r.have / r.need) * 100);
      html += '<div class="ch-row' + (r.have >= r.need ? ' met' : r.have ? ' part' : '') + '"><span class="chip-icon" style="background-image:' + art(ASPECT_ART[r.aspect] || 'iinv-05') + '"></span>' +
        '<span class="ch-name">' + esc(CF.ASPECTS[r.aspect].label) + '</span><span class="ch-bar"><i style="width:' + pct + '%"></i></span><span class="ch-num">' + CF.bidi(r.have + ' / ' + r.need) + '</span></div>';
    });
    // Every other seal lit and only the word dark: say what word would do it.
    var onlyWord = gates && d.tier !== 'strong' && gates.every(function (g) { return g.ok === (g.id !== 'word'); });
    // The rules' own word note (describe() gives it with id 'word') is the one shown; the window's stands in only
    // where the rules gave none, so the line is never said twice.
    var ruleWord = d.notes.some(function (n) { return n.id === 'word'; });
    d.notes.forEach(function (n) {
      if (onlyWord && /^To full proof/.test(n.text)) return;
      html += '<div class="ch-note ' + n.kind + (n.id === 'word' ? ' ch-word' : '') + '">' + esc(n.text) + '</div>';
    });
    if (onlyWord && !ruleWord) html += '<div class="ch-note dim ch-word">' + esc(WORD_NOTE) + '</div>';
    return html + '</div>';
  }
  // A token before the Court, read against this accused: it names them (their name, their mark, or about them),
  // it describes somebody else, it is off what the case turns on, or it is plain proof.
  function tokenStanding(a, accused, tok) {
    if (!a || !accused || !tok || tok.def !== 'clue') return null;
    // The rules' own word on each laid token (charge.js assessCharge standing), where they give it.
    var rs = a.standing && a.standing[tok.uid];
    if (rs && rs.id) return rs.id === 'else' ? 'other' : STANDING[rs.id] ? rs.id : null;
    if ((a.contradicting || []).some(function (c) { return c.uid === tok.uid; })) return 'other';
    if (!a.rec || tok.caseId !== a.rec.id) return 'off';
    var sus = UI.e.suspectOf(accused), d = tok.data || {};
    if (sus && ((d.points && d.points === sus.key) || (d.about && d.about === sus.key) || (d.trait && d.trait === sus.trait))) return 'names';
    var asp = CF.clueAspects(tok);
    if (!Object.keys(asp).some(function (k) { return a.profile && a.profile[k]; })) return 'off';
    return 'proof';
  }
  var STANDING = { names: 'Names them', other: 'Someone else', off: 'Off the case', proof: 'Proof' };
  UI.tokenStanding = tokenStanding;


  // Short handwritten notes for the inspector's dossier.
  // Health, Wit and Instinct: the tricks you keep, and how the ability grows.
  function abilityNotes(card) {
    var e = UI.e, lines = e.perkList().map(function (k) { return tr('Trick: {perk}', { perk: e.perkLabel(k) }); });
    var ab = /^spent_/.test(card.def) ? CF.CARDS[card.def].restores : card.def;
    if (!CF.growthWays || !CF.CARDS[ab] || CF.CARDS[ab].kind !== 'ability') return lines;
    var ways = CF.growthWays(e, ab, true);
    if (!ways.length) return lines;
    lines.push(tr('How {ability} grows (an Insight, taken to Rest):', { ability: tr(CF.CARDS[ab].label) }));
    ways.forEach(function (w) {
      // An office's own Insight, not yet open: named, dim, with the office that opens it.
      var at = wayRank(w);
      if (at !== null && (w.state === 'locked' || (w.state === 'open' && (e.s.rank || 0) < at))) { lines.push(tr('At {rank}: {label}', { rank: tr(CF.RANKS[at]), label: tr(w.label) })); return; }
      if (w.state === 'locked') return;
      if (w.state === 'learned') lines.push(tr('{label}: learned.', { label: tr(w.label) }));
      else if (w.state === 'waiting') lines.push(tr('{label}: the Insight is on the table. Put it into Rest.', { label: tr(w.label) }));
      else lines.push(tr('{label}: {how} ({n} of {need})', { label: tr(w.label), how: tr(w.how), n: w.n, need: w.need }));
    });
    return lines;
  }
  // The office an Insight opens at, where the rules give one (the way's own rank, else its spec's), else null.
  function wayRank(w) {
    var spec = CF.INSIGHTS && CF.INSIGHTS[w.id], r = typeof w.rank === 'number' ? w.rank : spec && typeof spec.rank === 'number' ? spec.rank : null;
    return r !== null && CF.RANKS && CF.RANKS[r] ? r : null;
  }
  UI.wayRank = wayRank;
  function dossierNotes(card) {
    var e = UI.e, def = CF.CARDS[card.def], k = def.kind, lines = [];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var a = CF.clueAspects(card);
    var asp = Object.keys(a).map(function (x) { return CF.ASPECTS[x].label + ' ' + a[x]; }).join(', ');
    if (k === 'case' && rec) {
      var met = rec.suspects.filter(function (x) { return x.revealed; });
      lines.push(tr('{scene}, {district}', { scene: tr(rec.scene), district: tr(CF.DISTRICTS[rec.district].label) }));
      lines.push(met.length ? tr('Accused met: {list}', { list: joinList(met.map(function (x) { return tr(CF.nameParts(x.name)[1] || x.name) + (x.cleared ? ' ✗' : rec.identified === x.key ? ' ★' : ''); })) }) : tr('Accused met: none'));
      lines.push([tr(rec.found >= rec.items.length ? 'Scene: searched out' : rec.searches ? 'Scene: partly searched' : 'Scene: not searched')]
        .concat(rec.delegate ? [tr('{name} on it', { name: rec.delegate.card.label })] : []).concat(rec.major ? [tr('cried')] : []).join(' · '));
      // The clock itself is the live line under the notes (Time left).
      lines.push(tr('{n} days left', { n: CF.daysLeft(card.life) }) + (rec.highProfile ? ' · ' + tr('the city watches') : ''));
      // What it takes to convict, and what is still wanted, are the proof row's (proofRow), in icons.
      if (rec.commission) {
        var com = rec.commission, council = com.from === 'council' && com.deadline;
        lines.push(tr('Commission: {patron} wants {what}', { patron: CF.PATRONS[com.from].label, what: { quiet: 'it quiet', mercy: 'mercy', square: 'the square' }[com.wants] }) +
          (council && e.s.t <= com.deadline ? ' · ' + tr('{n} days for the Council', { n: CF.daysLeft(com.deadline - e.s.t) }) : ''));
        if (council && e.s.t > com.deadline) lines.push('The Council wanted it quicker');
      }
      if (rec.rival) lines.push('The Rival works this too: the clock is half');
      if (harbourTemplate(rec.template)) lines.push('Convict the Harbourmaster himself, and no examiner comes again');
      var ctpl = CF.CASE_TEMPLATES && CF.CASE_TEMPLATES[rec.template];
      // The seizure only comes with the Inquisitor here or the Bishop not warm.
      // The rules say it where they can (patrons.js heresyWatch: the same gate and week the seizure keeps).
      var hw = typeof e.heresyWatch === 'function' ? e.heresyWatch(rec) : undefined;
      if (hw) lines.push(hw.vars ? tr(hw.line, hw.vars) : hw.line);
      else if (hw === undefined && ctpl && ctpl.heresy) {
        if (e.s.flags.inquisitor || !((e.s.favour || {}).bishop > 0)) lines.push(tr('Smells of heresy: from week {n} the Inquisitor may take it', { n: (rec.week || 0) + 2 }));
        else lines.push('The Bishop has kept the Dominicans off this one.');
      }
      if (e.s.flags.inquisitor) lines.push('The Inquisitor is in the city');
    } else if (card.def === 'suspect') {
      // Each fact once: the description owns their role and their mark (and the mark chip opens it), the kind line
      // above names the case, and the proof row says what it takes and what is still wanted.
      var sus = e.suspectOf(card);
      if (rec && rec.identified === card.data.key) lines.push('The one it points to');
      var sw = rec && rec.status === 'open' ? stillWanted(e, card) : null;
      if (sus && sus.questioned && !sus.cleared && rec && rec.status === 'open') lines.push('Confront them in Question with a token of the case');
      else if (sus && sus.questioned) lines.push('Questioned already'); else lines.push('Question them with Wit');
      // The Court shows seals; the numbers behind them are kept here.
      if (sw && sw.a.n) lines.push(tr('Weight of proof: {score} of {need}', { score: Math.round(sw.a.score * 10) / 10, need: sw.a.need }));
    } else if (k === 'clue' || k === 'evidence' || card.def === 'witness') {
      var aboutWho = aboutOf(card);
      if (aboutWho) lines.push(tr('About {name}', { name: aboutWho.sus.name }));
      if (k === 'evidence') lines.push(card.data.item && card.data.item.needs ? 'Raw proof: read it in Study with the right instrument' : 'Raw proof: read it in Study before it counts');
      else if (k === 'clue') lines.push(asp ? tr('Proves {asp}: into the Court with the Accused', { asp: asp }) : 'Into the Court with the Accused');
      else if (card.def === 'witness') lines.push(card.data.asked ? 'Questioned already' : 'Question them with Wit for their word');
      if (card.data.points) { var pto = rec && rec.suspects.filter(function (x) { return x.key === card.data.points; })[0]; if (pto) lines.push(tr('Names {name}', { name: pto.name })); }
      if (card.data.trait && !card.data.points) { var ptr = CF.TRAITS.filter(function (t) { return t.id === card.data.trait; })[0]; if (ptr) lines.push(tr('Describes someone who: {desc}', { desc: tr(ptr.desc).replace(/\.$/, '').toLowerCase() })); }
      if (card.data.stake && CF.STAKES[card.data.stake]) lines.push(CF.STAKES[card.data.stake].label + (card.data.againstInterest ? ' · against interest' : '') + (card.data.coerced ? ' · not credible' : ''));
      if (card.data.confession) lines.push(card.data.confession === 'free' ? 'Confessed freely' : 'Under the question');
      else if (card.data.falseConfession) lines.push('A false confession');
      // A chit that names the same door as another case's token on the table: a quiet cue, not which door or why.
      // The rules' own cue (network.js linkTwin, Net.TWIN_LINE).
      if (card.data.link && e.linkTwin && e.linkTwin(card)) lines.push(CF.Network.TWIN_LINE);
      if (card.data.tampered) lines.push('Spoiled by the Rival');
      if (card.data.bribed) lines.push('Paid to forget');
      if (card.data.frame) lines.push('The thief-takers\' men');
      // How long it keeps is the dossier's live clock line (clockLine), not a second line here.
      if (k === 'evidence' && card.data.item && card.data.item.needs) lines.push('Needs an instrument');
    } else if (k === 'teammate' || k === 'personnel') {
      if (card.data.name) lines.push(card.data.name);
      if (asp) lines.push(asp);
      if (card.data.traits && card.data.traits.length) lines.push(joinList(card.data.traits.map(function (t) { return tr(CF.OFFICER_TRAITS[t].label); })));
      if (card.data.level) lines.push(tr('Level {n}', { n: card.data.level }));
    } else if (k === 'equipment') {
      var m = def.mods || {};
      // What an instrument sharpens, in words (story.js Story.boostLine: the kinds of find, never the tag ids).
      if (m.boost) lines.push(tr(CF.Story.boostLine(m.boost)));
      if (m.gate) lines.push('Reads raw proof that needs it');
      if (m.extraEvidence) lines.push('Finds more at a scene');
      if (m.unlocks) lines.push(tr('Opens: {what}', { what: (CF.RECIPES_BY_ID[m.unlocks] || {}).label || m.unlocks }));
      if (m.unlocksVerb) lines.push(tr('Opens {what} at any office', { what: ((CF.POWERS && CF.POWERS[m.unlocksVerb]) || CF.VERBS[m.unlocksVerb] || { label: m.unlocksVerb }).label }));
    } else if (k === 'informant') {
      lines.push(tr('Works {district}', { district: CF.DISTRICTS[card.data.district].label }));
      lines.push(tr('Trust {t}/3 · heat {h}/{max}', { t: card.data.trust || 0, h: card.data.heat || 0, max: CF.INFORMANT.compromisedAt }));
      lines.push(e.informantStatus(card) === 'compromised' ? 'Marked: gone quiet' : tr('Next word in {t}', { t: U.fmtTime(Math.max(0, card.data.tipT || 0)) }));
    } else if (k === 'calling') {
      e.initPaths();
      lines.push(CF.Callings.summary(e));
      var cnt = e.s.counts || {};
      // Near either ending, the counts say how near: Mercy m of 12, Cruelty c of 14.
      var Soc = CF.Societies || {}, mercyAt = (Soc.MERCIFUL || {}).mercy || 12, cruelAt = (Soc.HANGMANS || {}).cruelty || 14;
      var nearEnd = mercyAt - (cnt.mercy || 0) <= 3 || cruelAt - (cnt.cruelty || 0) <= 3;
      lines.push([nearEnd ? tr('Cruelty {c} (Hangman at {at})', { c: cnt.cruelty || 0, at: cruelAt }) : tr('Cruelty {n}', { n: cnt.cruelty || 0 }),
        nearEnd ? tr('Mercy {m} of {at}', { m: cnt.mercy || 0, at: mercyAt }) : tr('Mercy {n}', { n: cnt.mercy || 0 }),
        tr('Purse {n}', { n: cnt.purse || 0 })].concat(cnt.debt ? [tr('Debt {n}', { n: cnt.debt })] : []).join(' · '));
      if (e.s.court && e.s.court.stance) lines.push(e.s.court.stance === 'treaty' ? 'A Treaty with the Court' : tr('Inside the Court, week {n}', { n: e.s.court.insideWeeks }));
      // Favour as each patron's word; the Standing meter's popover says what the steps bring.
      var fv = e.favour();
      lines.push(tr('Favour: {list}', { list: ['council', 'bishop', 'guild'].map(function (p) { return glue('{patron}: {word}', { patron: CF.PATRONS[p].label, word: favourWord(fv[p] || 0) }); }).join(' · ') }));
      lines.push(tr(e.dominantPath() !== e.s.calling ? 'Leaning: {path} (drifting)' : 'Leaning: {path}', { path: CF.CALLINGS[e.dominantPath()].label }));
      var notes = (e.s.pathNotes || []).slice(-1);
      if (notes.length) lines.push(tr('Lately: {list}', { list: joinList(notes.map(function (n) { return glue('{path} +{n} ({why})', { path: (CF.PATHS[n.path] || {}).label || n.path, n: n.n || 1, why: n.why }); })) }));
      var paths = e.s.paths || {}, lead = null;
      Object.keys(paths).forEach(function (k) { if (k !== e.s.calling && PATH_HINTS[k] && (!lead || paths[k] > paths[lead])) lead = k; });
      if (lead && paths[lead] > 0) lines.push(glue('{path}: {how}', { path: (CF.PATHS[lead] || {}).label || lead, how: PATH_HINTS[lead] }));
      // Where you came from, in one line: the life before, and the calling you set out in.
      var once = e.s.who && CF.ORIGINS[e.s.who] ? CF.ORIGINS[e.s.who].label.toLowerCase() : null;
      var setOut = e.s.origin !== e.s.calling && CF.CALLINGS[e.s.origin] ? CF.CALLINGS[e.s.origin].label : null;
      if (once && setOut) lines.push(tr('Once {origin}; set out as {calling}', { origin: once, calling: setOut }));
      else if (once) lines.push(tr('Once {origin}', { origin: once }));
      else if (setOut) lines.push(tr('Set out as {calling}', { calling: setOut }));
    } else if (card.def === 'condemned') {
      lines.push(card.data.role ? card.data.role.charAt(0).toUpperCase() + card.data.role.slice(1) : 'Convicted');
      lines.push(tr('Custom: {rung}', { rung: CF.Sentence.rungLabel(card.data.template, card.data.custom) }));
      if (card.data.penitent) lines.push('Penitent');
      // The commission, at the sentence: what the patron asked for, read off the rungs that wear their seal.
      // The rules write the patron's ask into the Condemned's own description (sentence.js condemn: data.patronWants);
      // the line is said here only for a card that does not carry it.
      var asks = card.data && card.data.patronWants ? null : patronAsks(card);
      if (asks) lines.push(tr('{patron} asks for: {list}', { patron: tr(CF.PATRONS[asks.who].label), list: orList(asks.names.map(function (x) { return tr(x); })) }));
    } else if (card.def === 'rung') {
      lines.push((CF.RUNGS[card.data.rung] || {}).cost || '');
      var rp = rungPatron(card);
      if (rp) lines.push(tr('{patron} asks for this', { patron: tr(CF.PATRONS[rp].label) }));
    } else if (card.def === 'plea') {
      lines.push({ church: 'From the Bishop', guild: 'From the Guild', family: 'From the family' }[card.data.from] || 'A plea');
      lines.push('A reason for mercy');
    } else if (card.def === 'syndicate') {
      var court = e.s.court || {};
      if (court.king) lines.push(tr('King of Thunes: {name}', { name: court.king.name }));
      lines.push(court.stance === 'treaty' ? 'A Treaty stands' : court.stance === 'rule' ? tr('You are inside, week {n}', { n: court.insideWeeks }) : 'No stance yet');
      // Disguise is a Bailiff's: below the staff, the Watch on the stair is the answer, where the rules let it take the Coquille.
      if (e.s.rank < 2 && postWatchTakes('syndicate')) lines.push('Below Bailiff: post the Watch (Attend + watchman)');
      else lines.push('Disguise: ledger, Wit, or Instinct and Coin');
    } else if (card.def === 'gang') {
      lines.push(tr('{n} sworn', { n: (card.data.members || []).length }));
      lines.push('Disguise to go among them');
    } else if (card.def === 'front') {
      var fr = e.fronts()[card.data.front];
      if (fr) {
        lines.push(tr(CF.DISTRICTS[fr.district].label) + ' · ' + tr(fr.gang.replace(/^the /, 'The ')));
        lines.push(tr('Open cases through here: {n}', { n: e.casesAtFront(fr.id).length }));
        lines.push(fr.watched ? 'Watched: a safer way in' : 'Not yet watched');
      }
    } else if (card.def === 'rival') {
      var rd = card.data || {};
      if (rd.heat) lines.push(tr('Weakness found: {n} of 2', { n: rd.heat }));
      else if (rd.stalled && rd.stalled >= e.s.week) lines.push(tr('Lying low until week {n}', { n: rd.stalled + 1 }));
      if (rivalCareful(card)) lines.push('Careful this week: the next thread after the Bell');
      if (rivalCatch(card)) {
        // Caught at it: the second thread is what they did, put before them in Question; a thread goes cold.
        if (rd.heat) {
          lines.push('The next thread: catch them at it. Question them with a token they spoiled, a witness they paid, or the case they took');
          var rdirt = rivalDirt(e)[0];
          if (rdirt) lines.push(tr('On your table: {label}', { label: e.labelOf(rdirt) }));
          if (typeof rd.heatWeek === 'number') lines.push(tr('The thread goes cold after week {n}', { n: rd.heatWeek + (CF.RIVAL_THREAD_WEEKS || 3) }));
        } else lines.push('Question with Wit, or shadow in Explore with Instinct, for a first thread');
      }
      else if (!rd.heat) lines.push('Question with Wit, or shadow in Explore with Instinct, to expose');
      if (harbourArc()) lines.push('Sent home, they leave a leaf from the Customs House');
    } else if (card.def === 'atlarge') {
      var crim = card.data.criminalId && e.criminal(card.data.criminalId);
      if (crim) {
        lines.push(tr(CF.Criminals.rankOf(crim).label) + ' · ' + tr(crim.crimes === 1 ? '1 crime' : '{n} crimes', { n: crim.crimes }));
        if (crim.traits.length) lines.push(joinList(crim.traits.map(function (t) { return tr(CF.CRIMINAL_TRAITS[t].label); })));
        if (crim.king) lines.push('The King of Thunes');
        else if (crim.organization !== 'none') {
          var band = e.cardsOf('gang', true).filter(function (g) { return (g.data.members || []).indexOf(crim.name) >= 0; })[0];
          lines.push(band ? tr('Sworn of {band}', { band: tr(band.data.name.replace(/^the /, 'The ')) }) : crim.organization === 'syndicate' ? 'Of the Coquille' : 'Sworn of a band');
        }
        if (crim.heat) lines.push(tr('Heat {n}', { n: crim.heat }));
        // Struck again: the old record answers the new case, where the rules have the recipe for it.
        if (CF.RECIPES_BY_ID && CF.RECIPES_BY_ID.ref_known && e.openCases().some(function (r) { return r.criminalId === card.data.criminalId; })) lines.push('Their new crime: lay this beside it in Rest');
        lines.push('Hunt: Work the Quarter in Explore; Old Ghosts (their Unanswered case) or a Sighting in Rest; Disguise (Bailiff)');
      }
    } else if (card.def === 'dagger') {
      // Which verbs answer it and what the Coin buys; Attend only where the rules let a watchman double the guard.
      var grace = ((CF.Societies || {}).MOUNTAIN || {}).grace || 6;
      lines.push(tr('Rest with two Coin: {n} weeks of peace', { n: grace }));
      lines.push('Rest alone: endure it, and they may come anyway');
      if (daggerGuard()) lines.push('Attend with a watchman: Double the Guard');
      lines.push(e.s.flags.mountainIgnored ? 'Ignored once already: next time there is no warning' : 'Let it lie and they come back');
    } else if (card.def === 'looseend') {
      // A Loose End remembers the case that left it, where the rules keep it (data.fromTitle), and the stack says
      // how near the Architect is.
      var marks = (e.stackOf && e.stackOf(card)) || [];
      if (!marks.length) marks = [card];
      marks.forEach(function (m) { if (m.data && m.data.fromTitle) lines.push(tr('From {title}: three strokes cut where the crime began.', { title: tr(m.data.fromTitle) })); });
      var arch = recipeOf('looseend');
      if (arch && e.s.calling === 'master' && !e.s.flags.architect) lines.push(tr('{need} in {verb} find the Architect: {n} of {need}', { need: LOOSE_NEED, verb: tr(CF.VERBS[arch.verb].label), n: Math.min(LOOSE_NEED, freeOf('looseend').length) }));
      else if (e.s.flags.architect) lines.push('You are already hunting the Architect.');
    } else if (card.def === customsLeafDef()) {
      // What two leaves open, and how many you hold.
      var hb = recipeOf(card.def);
      if (harbourArc()) lines.push(tr('{need} in {verb} open the Harbourmaster\'s Books: {n} of {need}', { need: LEAVES_NEED, verb: tr(CF.VERBS[hb ? hb.verb : 'reflect'].label), n: Math.min(LEAVES_NEED, freeOf(card.def).length) }));
    } else if (card.def === 'wound') {
      lines.push('Another blow before this knits will kill you.');
    }
    // A card's clock is not among the notes: the dossier's live line under them (clockLine) keeps it, ticking.
    return lines.slice(0, k === 'case' ? 8 : k === 'calling' ? 9 : 6);
  }
  // The dossier's one clock line, written again every frame: a wound knits, anything else runs out.
  function clockLine(card) {
    return card.def === 'wound' ? tr('Knits in {t}', { t: U.fmtTime(card.life) }) : tr('Time left: {t}', { t: U.fmtTime(card.life) });
  }
  UI.clockLine = clockLine;
  // A list in the reader's own commas (Arabic joins with its own).
  function joinList(xs) { return xs.join(tr(', ')); }
  // Pieces put together with nothing but punctuation between them: each piece is read in the reader's language
  // and the pattern itself, which has no words of its own, is filled as it stands.
  function glue(pattern, vars) {
    var out = {};
    for (var k in vars) out[k] = typeof vars[k] === 'string' ? tr(vars[k]) : vars[k];
    return CF.bidi(U.fill(pattern, out));
  }
  // The rows a charge still lacks: each kind of proof with how much is wanting.
  function wantedList(rows) { return rows.length ? joinList(rows.map(function (r) { return tr(CF.ASPECTS[r.aspect].label) + ' ' + (r.need - r.have); })) : tr(WORD_WANTED); }
  // The proof a case turns on, as the charge panel shows it: each kind with filled and empty pips (what the best
  // charge on the table has of what it needs), a dark seal while full proof still wants word behind it. The
  // sentences of old (to convict, still wanted) are its title. Null for a card with no case to prove.
  function proofRow(card) {
    var e = UI.e, rec = card.caseId ? e.caseRec(card.caseId) : null;
    if (!rec || !CF.Charge || !CF.Charge.profileOf || (card.def !== 'suspect' && CF.CARDS[card.def].kind !== 'case')) return null;
    var prof = CF.Charge.profileOf(rec), keys = Object.keys(prof);
    if (!keys.length) return null;
    var have = {}, wanted = null, word = false;
    if (rec.status === 'open' && e.assessCharge) {
      var tokens = e.tableCards().filter(function (t) { return t.def === 'clue' && t.caseId === rec.id; });
      var accused = card.def === 'suspect' ? [card] : e.tableCards().filter(function (c) { return c.def === 'suspect' && c.caseId === rec.id; });
      var best = null;
      accused.forEach(function (c) { var a = e.assessCharge(c, tokens); if (a && (!best || a.score > best.score)) best = a; });
      if (best) CF.Charge.describe(best).rows.forEach(function (r) { have[r.aspect] = r.have; });
      if (card.def === 'suspect') { var sw = stillWanted(e, card); if (sw) { wanted = wantedList(sw.rows); word = !!sw.word; } }
      else { wanted = caseWanted(rec); word = !!best && best.tier !== 'strong' && wanted === tr(WORD_WANTED); }
    }
    var convict = tr('To convict: {list}', { list: joinList(keys.map(function (k) { return tr(CF.ASPECTS[k].label) + ' ' + prof[k]; })) });
    return { rows: keys.map(function (k) { return { aspect: k, need: prof[k], have: Math.min(prof[k], have[k] || 0) }; }), word: word,
      title: convict + (wanted ? ' · ' + tr('Still wanted: {list}', { list: wanted }) : '') };
  }
  UI.proofRow = proofRow;
  function proofHtml(p) {
    if (!p) return '';
    var html = '<div class="i-proof" title="' + esc(p.title) + '">' + p.rows.map(function (r) {
      var pips = '';
      for (var i = 0; i < r.need; i++) pips += i < r.have ? '●' : '○';
      return '<span class="pf-chip' + (r.have >= r.need ? ' met' : '') + '" title="' + esc(CF.ASPECTS[r.aspect].label) + '"><span class="chip-icon" style="background-image:' + art(ASPECT_ART[r.aspect] || 'iinv-05') + '"></span><b>' + pips + '</b></span>';
    }).join('');
    if (p.word) html += '<span class="pf-chip pf-word" title="' + esc(WORD_WANTED) + '"><span class="chip-icon" style="background-image:' + art(GATES.word.art) + '"></span><b>○</b></span>';
    return html + '</div>';
  }
  UI.proofHtml = proofHtml;
  // What the best charge on the table against a case's accused still lacks; nothing when there is no accused, or a charge is strong.
  function caseWanted(rec) {
    var e = UI.e, best = null, strong = false;
    if (!rec || rec.status !== 'open' || !e.assessCharge) return null;
    var tokens = e.tableCards().filter(function (t) { return t.def === 'clue' && t.caseId === rec.id; });
    e.tableCards().forEach(function (c) {
      if (c.def !== 'suspect' || c.caseId !== rec.id) return;
      var a = e.assessCharge(c, tokens);
      if (!a) return;
      if (a.tier === 'strong') { strong = true; return; }
      var rows = CF.Charge.describe(a).rows.filter(function (r) { return r.have < r.need; });
      if ((rows.length || a.wordWanted) && (!best || a.score > best.score)) best = { score: a.score, rows: rows };
    });
    return best && !strong ? wantedList(best.rows) : null;
  }

  // The dossier's painted band: the kind's seal and the name (index.html #peek-head, beside the panel, since the
  // panel scrolls and clips at its paper). Nothing passed: the band is bare.
  function peekHead(icon, name) {
    var hd = $('#peek-head');
    if (!hd) return;
    hd.innerHTML = name ? (icon ? '<span class="k-icon" style="background-image:' + art(icon) + '"></span>' : '') + '<h4>' + esc(name) + '</h4>' : '';
    hd.classList.toggle('on', !!name);
  }
  UI.peekHead = peekHead;
  // An accused's description, without the case it ends on: the kind line above names the case.
  function dossierDesc(card, rec) {
    var desc = UI.e.descOf(card);
    if (card.def !== 'suspect' || !rec) return desc;
    var sus = UI.e.suspectOf(card), t = sus && traitOf(sus.trait);
    if (sus && t && desc === CF.util.fill('{name}, {role}. {trait}', { name: sus.name, role: sus.role, trait: t.desc }) + ' (Accused in: ' + rec.title + ')') {
      return tr('{name}, {role}. {trait}', { name: sus.name, role: sus.role, trait: t.desc });
    }
    return desc;
  }
  // Which cards get the paper dossier's notes.
  function dossierKind(card, def) {
    return ['case', 'suspect', 'witness', 'clue', 'evidence', 'teammate', 'personnel', 'equipment', 'intel', 'place', 'hospital', 'informant', 'district', 'criminal', 'coldcase', 'court', 'calling'].indexOf(def.kind) >= 0 || card.def === 'front' || card.def === 'atlarge' || card.def === 'wound' || card.def === 'dagger' ||
      card.def === 'condemned' || card.def === 'rung' || card.def === 'plea' || card.def === 'looseend' || (!!customsLeafDef() && card.def === customsLeafDef()) ? 'paper' : null;
  }
  // Every line of words the dossier shows for a card, as the player reads them, without a page: the description,
  // the notes and the proof row's title. The tests read it in each language over played games.
  UI.dossierLines = function (card) {
    var def = CF.CARDS[card.def], rec = card.caseId ? UI.e.caseRec(card.caseId) : null;
    var notes = dossierKind(card, def) ? dossierNotes(card) : def.kind === 'ability' ? abilityNotes(card) : [];
    var p = proofRow(card);
    return [UI.e.labelOf(card), dossierDesc(card, rec)].concat(notes).concat(p ? [p.title] : []);
  };
  // The dossier stands at the top left of the table; over the card it shows (Health at the left of a desk), it
  // stands at the right instead, so the card stays in sight and in reach. Not with a window open: the window
  // is docked at the right, and on a phone it is the sheet from the bottom.
  function placePeek(box, card) {
    var far = false, el = card.loc && card.loc.t === 'table' ? cardEls[card.uid] : null;
    if (el && !UI.openVerbs.length && el.getBoundingClientRect) {
      var r = el.getBoundingClientRect(), t = tableRect(), s = UI.scale(), reach = (12 + 330 + 12) * s;
      far = t.width >= 2 * reach && r.right > t.left && r.left < t.left + reach;
    }
    if (box.classList.contains('far') !== far) box.classList.toggle('far', far);
  }
  UI.placePeek = placePeek;
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
    placePeek(box, card);
    if (box.dataset.uid === String(uid) && box.dataset.sig === cardSig(card, 1)) return;
    box.dataset.uid = uid; box.dataset.sig = cardSig(card, 1);
    var def = CF.CARDS[card.def];
    var rec = card.caseId ? e.caseRec(card.caseId) : null;
    var dz = dossierKind(card, def);
    var html = '<div class="i-card"></div>';
    var notes = dz ? dossierNotes(card) : def.kind === 'ability' ? abilityNotes(card) : [];
    var kindArt = KIND_ART[card.def] || KIND_ART[def.kind];
    // The painted band at the top carries the kind's seal and the name, as a verb window's does; under the card,
    // the kind and (for anything but the case itself) the case it belongs to.
    peekHead(kindArt, e.labelOf(card));
    html += '<div class="i-kind">' + esc(def.kindLabel || (CF.KINDS[def.kind] || {}).label || def.kind) + (rec && def.kind !== 'case' ? ' · ' + esc(rec.title) : '') + '</div>';
    var a = CF.aspectsOf(card);
    var badges = CF.CLUE_ASPECTS.filter(function (k) { return a[k]; }).map(function (k) {
      return '<span class="chip big" data-aspect="' + k + '" title="' + esc('Tap for what this means') + '"><span class="chip-icon" style="background-image:' + art(ASPECT_ART[k] || 'iinv-05') + '"></span>' + esc(CF.ASPECTS[k].label) + ' ' + a[k] + '</span>';
    }).join('');
    var tid = traitOfCard(card);
    if (tid) badges += '<span class="chip big trait" data-trait="' + esc(tid) + '" title="' + esc('Tap for the mark') + '"><span class="chip-icon" style="background-image:' + art(traitArt(traitOf(tid))) + '"></span>' + esc('The mark') + '</span>';
    if (badges) html += '<div class="i-aspects">' + badges + '</div>';
    html += '<p>' + esc(dossierDesc(card, rec)) + '</p>';
    html += proofHtml(proofRow(card));
    if (notes.length) html += '<div class="i-lines">' + notes.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
    if (card.maxLife) html += '<div class="i-note i-time">' + escText(clockLine(card)) + '</div>';
    var why = card.loc && card.loc.t === 'table' && e.unavailableReason(card);
    if (why) html += '<div class="i-note i-unavailable">' + esc(why) + '</div>';
    var canMark = card.loc && (card.loc.t === 'table' || card.loc.t === 'slot');
    // A Petition (or the rules' ledger of them) opens the Watch-house board, where every one stands with its price.
    var toBoard = def.kind === 'order' && typeof UI.openPrecinct === 'function';
    box.innerHTML = '<button class="peek-close" title="' + esc('Close') + '">×</button>' + html +
      (canMark ? '<button class="peek-mark plate-btn' + (card.data && card.data.mark ? ' dark' : '') + '">' + esc(card.data && card.data.mark ? 'Unmark' : 'Mark') + '</button>' : '') +
      (toBoard ? '<button class="peek-board plate-btn teal">' + esc('The Watch-house') + '</button>' : '');
    var pb = box.querySelector('.peek-board');
    if (pb) pb.addEventListener('click', function (ev) { ev.stopPropagation(); CF.Audio.play('click'); UI.openPrecinct(); });
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
        pop.innerHTML = '<b>' + esc(A.label) + '</b><p>' + esc(A.meaning) + '</p><p class="ap-from">' + escText(tr('Where it comes from: {from}', { from: tr(aspectFrom(k, UI.e, null)) })) + '</p><p class="ap-note">' + esc('Proof of this kind counts toward a charge that asks for it. The number is how much of it the token carries.') + '</p>';
        var find = h('button', 'ap-find', 'Show on the table');
        find.addEventListener('click', function (ev2) { ev2.stopPropagation(); UI.showAspect(k); });
        pop.appendChild(find);
        chip.parentNode.insertAdjacentElement('afterend', pop);
      });
    });
    box.querySelectorAll('.chip[data-trait]').forEach(function (chip) {
      chip.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = chip.dataset.trait, t = traitOf(id);
        var old = box.querySelector('.aspect-pop');
        if (old) { var was = old.dataset.trait; old.remove(); if (was === id) return; }
        var pop = h('div', 'aspect-pop');
        pop.dataset.trait = id;
        pop.innerHTML = '<b>' + esc('The mark') + '</b><p>' + esc(t ? t.desc : '') + '</p>';
        var find = h('button', 'ap-find', 'Show on the table');
        find.addEventListener('click', function (ev2) { ev2.stopPropagation(); UI.showTrait(id); });
        pop.appendChild(find);
        chip.parentNode.insertAdjacentElement('afterend', pop);
      });
    });
  }

  // The Help's list of the six kinds of proof: what each means and where it is found (Lot V's #help-aspects).
  function renderHelpAspects() {
    var box = $('#help-aspects');
    if (!box) return;
    box.innerHTML = '';
    CF.CLUE_ASPECTS.forEach(function (k) {
      var A = CF.ASPECTS[k], row = h('div', 'ha-row');
      row.innerHTML = '<span class="chip-icon" style="background-image:' + art(ASPECT_ART[k] || 'iinv-05') + '"></span><b>' + esc(A.label) + '</b> ' + esc(A.meaning) + ' <i>' + escText(tr('Where it comes from: {from}', { from: tr(aspectFrom(k, null)) })) + '</i>';
      box.appendChild(row);
    });
  }

  // The accused's mark, by its id; the icon arrives with the data (CF.TRAITS[].icon).
  function traitOf(id) { return id ? (CF.TRAITS || []).filter(function (t) { return t.id === id; })[0] || null : null; }
  function traitArt(t) { return t && t.icon ? t.icon : TRAIT_ART; }
  // The mark a card carries: an accused's own, or the one a token describes.
  function traitOfCard(card) {
    if (!card || !card.data) return null;
    if (card.def === 'suspect') { var sus = UI.e.suspectOf(card); return sus && sus.trait ? sus.trait : card.data.trait || null; }
    return card.data.trait || null;
  }
  function traitChip(id, big) {
    var t = traitOf(id), b = h('span', 'chip trait' + (big ? ' big' : ''));
    b.dataset.trait = id;
    b.title = tr(t ? t.desc : 'The mark');
    var i = h('span', 'chip-icon');
    i.style.backgroundImage = art(traitArt(t));
    b.appendChild(i);
    if (big) b.appendChild(h('span', null, 'The mark'));
    return b;
  }
  // Every card on the table that shares a mark lights up for a moment.
  UI.showTrait = function (id) {
    var e = UI.e, n = 0;
    Object.keys(cardEls).forEach(function (uid) {
      var c = e.card(+uid);
      if (!c || c.hidden || traitOfCard(c) !== id) return;
      var el = cardEls[uid]; el.classList.remove('noticed'); void el.offsetWidth; el.classList.add('noticed'); n++;
      setTimeout(function () { el.classList.remove('noticed'); }, 4000);
    });
    if (!n) toast({ title: 'The mark', text: 'Nothing on the table carries it.', kind: 'minor' });
  };

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
  // The card under the pointer. A find turning over in a window stands edge-on for a moment: the press then lands
  // on its wrapper (.mini-wrap), which still holds that card.
  function cardAt(target) {
    if (!target.closest) return null;
    var n = target.closest('.card[data-uid]');
    if (n) return n;
    var w = target.closest('.mini-wrap');
    return w && w.querySelector ? w.querySelector('.card[data-uid]') : null;
  }

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
    tiltChanged();
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
    // A window stands docked at the side (positionWindow): a press on it brings it to the front, it never moves.
    var win = t.closest && t.closest('.vwin');
    if (win) {
      var wid = win.dataset.win;
      if (UI.openVerbs[UI.openVerbs.length - 1] !== wid) { openWindow(wid); }
    }
    var n = cardAt(t);
    if (n && n.closest('.pk-card')) return; // picker cards are buttons, not cards
    if (n && ev.button === 0) {
      var uid = +n.dataset.uid;
      var card = UI.e.card(uid);
      if (!card || !card.loc || card.loc.t === 'held') { select(uid); return; }
      // The number badge is the handle for the whole stack; the card is one card.
      var whole = ev.shiftKey || !!(t.closest && t.closest('.c-count'));
      var dd = { kind: 'card', uid: uid, src: n, x0: ev.clientX, y0: ev.clientY, started: false, whole: whole, inWin: !!win };
      UI.drag = dd;
      // A hold on a stacked card, without moving, lifts the whole stack.
      if (!whole && card.loc.t === 'table' && UI.e.stackOf(card).length > 1) {
        dd.holdT = setTimeout(function () {
          if (UI.drag !== dd || dd.started) return;
          dd.holdT = 0; dd.whole = true;
          var pt = { clientX: dd.x0, clientY: dd.y0 };
          liftCard(dd, pt); moveLifted(dd, pt); UI.haptic('tick');
        }, 400);
      }
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
    if (t.closest && t.closest('#table') && !win && !t.closest('#zoom') && !t.closest('#peek') && !t.closest('#turn')) {
      // Touching the felt puts away the windows and the pinned dossier.
      if (UI.openVerbs.length) closeAllWindows();
      UI.drag = { kind: 'pan', x0: ev.clientX, y0: ev.clientY, vx: UI.view.x, vy: UI.view.y, started: false };
      ev.preventDefault();
    }
  }

  // A verb tile and the pile move under a finger as under the mouse: the player arranges the table.
  // A tap still opens the verb; the felt around them pans.

  // A gesture's drawing, once a frame: the board under a pan, the tile or the pile under a drag, the zoom
  // under a pinch. The numbers are kept at every move; the page is written here. flushDraw runs a pending
  // frame at once (the gesture ended before it came).
  function drawGesture(d) {
    if (d.kind === 'pan') applyView();
    else if (d.kind === 'pinch') applyPinch(d);
    else if ((d.kind === 'verb' || d.kind === 'pile') && d.at) {
      if (d.kind === 'pile') placePile(d.el, d.at.x, d.at.y); else place(d.el, d.at.x, d.at.y);
      if (d.kind === 'verb') syncLinksHeld(['v:' + d.verb]);
    }
  }
  function frameDraw(d) {
    if (!d.raf) d.raf = requestAnimationFrame(function () { d.raf = 0; if (UI.drag === d) drawGesture(d); });
  }
  function flushDraw(d) {
    if (!d || !d.raf) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(d.raf);
    d.raf = 0;
    if (d.kind !== 'card') drawGesture(d); // a card's drop reads the pointer itself
  }
  function applyPinch(d) {
    var pinch = pinchState();
    if (!pinch) return;
    var want = U.clamp(d.z0 * (pinch.d / d.d0), UI.Z_MIN, 1.6);
    zoomAt(pinch.cx, pinch.cy, want / UI.view.z, d.rect);
  }

  function onPointerMove(ev) {
    if (pointers[ev.pointerId]) pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    if (UI.drag && UI.drag.kind === 'pinch') {
      var pd = UI.drag;
      if (!pinchState()) return;
      if (!pd.rect) pd.rect = $('#table').getBoundingClientRect();
      if (!pd.raf) pd.raf = requestAnimationFrame(function () { pd.raf = 0; applyPinch(pd); });
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
    if (d.kind === 'pan') {
      if (!d.started) { d.started = true; d.rect = $('#table').getBoundingClientRect(); $('#table').classList.add('panning'); }
      if (d.holdT) { clearTimeout(d.holdT); d.holdT = 0; }
      // The camera follows at once (the numbers are cheap, read off the rect taken when the pan began); the board
      // is moved once a frame, however many moves the finger sends.
      var tr0 = d.rect;
      var p0 = toPlane(d.x0 - tr0.left, d.y0 - tr0.top), p1 = toPlane(ev.clientX - tr0.left, ev.clientY - tr0.top);
      UI.view.x = d.vx + (p1.x - p0.x);
      UI.view.y = d.vy + (p1.y - p0.y);
      clampView(tr0);
      frameDraw(d);
      return;
    }
    if (d.kind !== 'pan' && !d.started && Math.abs(ev.clientX - d.x0) + Math.abs(ev.clientY - d.y0) < 7) return; // a tap, not a drag
    if (d.holdT) { clearTimeout(d.holdT); d.holdT = 0; } // it moved: no hold
    if (d.kind === 'verb' || d.kind === 'pile') {
      if (!d.started) {
        d.started = true; d.el.classList.add('dragging'); hideHint(); UI.haptic('tick');
        d.rect = $('#table').getBoundingClientRect();
        if (d.kind === 'verb') { var vv = UI.e.verb(d.verb); d.b0 = { x: vv.x, y: vv.y }; }
        if (UI.openVerbs.length) closeAllWindows();
      }
      var q0 = toBoard(d.x0, d.y0, d.rect), q1 = toBoard(ev.clientX, ev.clientY, d.rect);
      d.at = { x: d.b0.x + (q1.x - q0.x), y: d.b0.y + (q1.y - q0.y) };
      if (d.kind === 'verb') { var mv = UI.e.s.verbs[d.verb]; if (mv) { mv.x = d.at.x; mv.y = d.at.y; } }
      frameDraw(d);
      return;
    }
    if (!d.started) { liftCard(d, ev); moveLifted(d, ev); return; }
    // Later moves are kept and drawn once a frame.
    d.pt = { clientX: ev.clientX, clientY: ev.clientY };
    if (!d.raf) d.raf = requestAnimationFrame(function () { d.raf = 0; if (UI.drag === d && d.started) moveLifted(d, d.pt); });
  }

  // Pick a card up: move its element into the drag layer, lifted and tilting.
  function liftCard(d, ev) {
    var e = UI.e;
    hideHint();
    var card = e.card(d.uid);
    d.started = true;
    UI.haptic('tick');
    d.from = card.loc.t;
    d.fromVerb = card.loc.verb;
    var r = d.src.getBoundingClientRect();
    d.rect = $('#table').getBoundingClientRect();
    tiltMatrix();
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
    // Where the browser has the translate property, the card sits at the layer's corner and moves by it alone:
    // no layout on a move, and the tilt's eased transform stays its own.
    d.tr = liftTranslate();
    if (d.tr) { d.el.style.left = '0px'; d.el.style.top = '0px'; }
    $('#drag-layer').appendChild(d.el);
    d.rot = 0;
    d.lastX = ev.clientX;
    if (CF.Settings.get('pauseOnDrag') && !UI.paused && !e.s.over) { UI.autoPaused = true; UI.setPaused(true); }
    CF.Audio.play('pick');
    markDropTargets(card);
  }

  var canTranslate;
  function liftTranslate() {
    if (canTranslate === undefined) { try { canTranslate = !!(document.body && document.body.style && 'translate' in document.body.style); } catch (err) { canTranslate = false; } }
    return canTranslate;
  }
  // The lifted card's place: by translate where it can, else by left and top.
  function liftAt(d, x, y) {
    if (d.tr) d.el.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
    else { d.el.style.left = x + 'px'; d.el.style.top = y + 'px'; }
  }
  // Before the card glides by left and top (back to its slot, into a verb), it is put there exactly where it is.
  function liftToLeftTop(d) {
    if (!d.tr || !d.lastEv) return;
    d.tr = false;
    d.el.style.translate = '';
    d.el.style.left = (d.lastEv.clientX - d.gx) + 'px'; d.el.style.top = (d.lastEv.clientY - d.gy) + 'px';
    void d.el.offsetWidth;
  }
  function moveLifted(d, ev) {
    d.lastEv = { clientX: ev.clientX, clientY: ev.clientY };
    var vx = ev.clientX - d.lastX;
    d.lastX = ev.clientX;
    d.rot = U.clamp(d.rot * 0.7 + vx * 0.9, -14, 14);
    liftAt(d, ev.clientX - d.gx, ev.clientY - d.gy);
    d.el.style.transform = 'scale(' + (d.z * 1.07) + ') rotate(' + d.rot.toFixed(1) + 'deg)';
    syncLinksHeld(d.uids.map(String));
    edgeScroll(d);
    var t = dropTarget(ev), over = t && t.node ? t.node : null;
    if (d.hoverNode !== over) {
      if (d.hoverNode) d.hoverNode.classList.remove('drop-hover');
      if (over) over.classList.add('drop-hover');
      d.hoverNode = over;
    }
    // The tilt straightens 90ms after the last move: one timer at a time, which looks at when the card last moved.
    d.movedAt = performance.now();
    if (!d.settleT) d.settleT = setTimeout(function settle() {
      d.settleT = 0;
      if (UI.drag !== d) return;
      var wait = 90 - (performance.now() - d.movedAt);
      if (wait > 1) { d.settleT = setTimeout(settle, wait); return; }
      d.rot = 0; d.el.style.transform = 'scale(' + (d.z * 1.07) + ') rotate(0deg)';
    }, 90);
  }

  // A card held near the felt's edge carries the camera that way: the Court and Rest are reached by one drag on a
  // phone whose fit shows four tiles. The band is 36px; the nearer the edge, the faster, every frame until the
  // card leaves the band, the board's end is reached, or the card is put down.
  var EDGE_BAND = 36;
  function edgePush(d) {
    var r = d.rect, p = d.lastEv;
    if (!r || !p) return null;
    var dx = 0, dy = 0;
    var l = p.clientX - r.left, rt = r.left + r.width - p.clientX, t = p.clientY - r.top, b = r.top + r.height - p.clientY;
    if (l < EDGE_BAND) dx = (EDGE_BAND - Math.max(0, l)) * 0.6;
    else if (rt < EDGE_BAND) dx = -(EDGE_BAND - Math.max(0, rt)) * 0.6;
    if (t < EDGE_BAND) dy = (EDGE_BAND - Math.max(0, t)) * 0.6;
    else if (b < EDGE_BAND) dy = -(EDGE_BAND - Math.max(0, b)) * 0.6;
    return dx || dy ? { x: dx, y: dy } : null;
  }
  function edgeScroll(d) {
    if (d.kind !== 'card' || d.edgeRaf || d.inEdge || !edgePush(d)) return;
    d.edgeRaf = requestAnimationFrame(function step() {
      d.edgeRaf = 0;
      if (UI.drag !== d || !d.started) return;
      var push = edgePush(d);
      if (!push) return;
      var vx = UI.view.x, vy = UI.view.y;
      UI.view.x += push.x; UI.view.y += push.y;
      clampView(d.rect);
      if (UI.view.x === vx && UI.view.y === vy) return; // the board's end: nothing more that way
      applyView();
      // The drop-hover follows what now lies under the card.
      d.inEdge = true; moveLifted(d, d.lastEv); d.inEdge = false;
      d.edgeRaf = requestAnimationFrame(step);
    });
  }
  function stopEdge(d) {
    if (!d || !d.edgeRaf) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(d.edgeRaf);
    d.edgeRaf = 0;
  }

  function dropTarget(ev) {
    var under = document.elementFromPoint ? document.elementFromPoint(ev.clientX, ev.clientY) : null;
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
    releasePins();
  }

  // Put a lifted table element back on the board and glide it to (x, y).
  function settleOnBoard(d, x, y, ev) {
    var el = d.el, board = $('#board');
    var p = toBoard(ev ? ev.clientX : d.origin.left, ev ? ev.clientY : d.origin.top, d.rect);
    el.classList.remove('lifted');
    el.style.left = el.style.top = '';
    el.style.translate = '';
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
      liftToLeftTop(d);
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
  // Back (and Escape) puts away the nearest thing first: a card in hand, the slot picker, the pinned dossier
  // or meter page, the journal, then the top window. True when something was put away.
  function closeNearest() {
    if (UI.drag) { cancelDrag(); return true; }
    if (UI.pick) { UI.pick = null; if (UI.e) UI.e.dirty = true; return true; }
    var peek = $('#peek');
    if (peek && peek.classList.contains('pinned')) {
      UI.hover = null; select(null);
      peek.classList.remove('open', 'pinned'); peek.dataset.uid = '';
      return true;
    }
    var jd = $('#journal-drawer');
    if (jd && jd.classList.contains('open')) { UI.toggleJournal(false); return true; }
    if (UI.openVerbs.length) { closeWindow(UI.openVerbs[UI.openVerbs.length - 1]); return true; }
    return false;
  }
  UI.back = function () {
    // A menu, a screen or a dialog stands over the table: Back is for it (js/main.js UI.onBack), never for a window
    // or the dossier hidden behind it.
    if (!UI.modal && closeNearest()) return true;
    if (UI.onBack) return UI.onBack();
    return false;
  };

  function resumeAfterDrag() {
    if (UI.autoPaused) { UI.autoPaused = false; UI.setPaused(false); }
  }
  function cancelDrag() {
    var d = UI.drag;
    flushDraw(d);
    stopEdge(d);
    UI.drag = null;
    clearMarks();
    resumeAfterDrag();
    if (!d) return;
    if (d.holdT) clearTimeout(d.holdT);
    if (d.kind === 'pinch') return;
    if (d.kind === 'card' && d.started) { flyBack(d); UI.e.dirty = true; }
    if ((d.kind === 'verb' || d.kind === 'pile') && d.started) {
      d.el.classList.remove('dragging');
      // The token goes back where it was lifted from, and its strings with it.
      if (d.kind === 'verb' && d.b0) { var vv = UI.e.s.verbs[d.verb]; if (vv) { vv.x = d.b0.x; vv.y = d.b0.y; place(d.el, vv.x, vv.y); syncLinks(); } }
      UI.e.dirty = true;
    }
  }

  function onPointerUp(ev) {
    delete pointers[ev.pointerId];
    var d = UI.drag;
    if (!d) return;
    flushDraw(d);
    stopEdge(d);
    if (d.kind === 'pinch') { if (!pinchState()) UI.drag = null; return; }
    var e = UI.e;
    UI.drag = null;
    clearMarks();
    resumeAfterDrag();
    if (d.holdT) clearTimeout(d.holdT);
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
      // A finished verb's card: face down, a tap turns it over; face up, a tap reads it; two taps take it to the
      // table, face down or up. The second tap is told here, by the pointer, for a finger as for the mouse: the
      // turn redraws the card under it, and the browser's own dblclick may never come (or come to the wrapper).
      if (card && card.loc && card.loc.t === 'out' && (d.inWin || ev.target.closest('.vwin'))) {
        var now = performance.now(), last = UI.lastTap;
        UI.lastTap = { uid: d.uid, t: now };
        if (last && last.uid === d.uid && now - last.t < DOUBLE_TAP) {
          UI.lastTap = null; UI.tookByTaps = now;
          markSpawn(card.uid, d.src);
          e.takeOutput(card.loc.verb, card.uid);
          CF.Audio.play('drop'); UI.haptic(10);
          e.dirty = true;
          return;
        }
        if (card.hidden) flipReveal(card, d.src); else select(d.uid);
        return;
      }
      // Two taps on a table card send it where it goes (as a double-click does): told here by the pointer, since a
      // finger's two taps bring no dblclick. The first tap reads it, as ever.
      if (card && card.loc && card.loc.t === 'table') {
        var now2 = performance.now(), last2 = UI.lastTap;
        UI.lastTap = { uid: d.uid, t: now2 };
        if (last2 && last2.uid === d.uid && now2 - last2.t < DOUBLE_TAP) {
          UI.lastTap = null; UI.tookByTaps = now2;
          if (sendOnDouble(card)) return;
        }
      }
      // With a verb open, a tap on a card that fits puts it in; the window stays.
      if (card && card.loc && card.loc.t === 'table' && UI.openVerbs.length) {
        var openVid = UI.openVerbs[UI.openVerbs.length - 1];
        if (e.verb(openVid).status === 'idle' && e.autoSlot(openVid, card.uid)) { markSpawn(card.uid, d.src); CF.Audio.play('drop'); UI.haptic('confirm'); e.dirty = true; return; }
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
        CF.Audio.play('drop'); UI.haptic('confirm');
        absorb(d, t);
      } else {
        refused(t, card);
        if (card.loc.t === 'table' && d.from === 'out') {
          // It left the verb's output but found no slot: drop it by the pointer.
          UI.spawn[card.uid] = { cx: ev.clientX, cy: ev.clientY, gx: d.gx, gy: d.gy };
          d.el.remove();
        } else flyBack(d);
      }
    } else if (t.table) {
      var p = toBoard(ev.clientX, ev.clientY, d.rect);
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

  // A drop the verb will not take: a dull knock, a short buzz, the tile or slot shakes its head (a red edge under
  // less motion), and the reason, where the rules give one, stands in the hint bar for two seconds.
  // A refusal always has its reason: the verb's lock, the work it is at, the rules' own word, else what the verb
  // (or the slot) takes, so a card of the wrong kind is never sent back without a word.
  function refused(t, card) {
    var e = UI.e, vid = t.verb;
    CF.Audio.play('refuse'); UI.haptic('reject');
    var node = t.node;
    if (node) { node.classList.remove('refuse'); void node.offsetWidth; node.classList.add('refuse'); setTimeout(function () { node.classList.remove('refuse'); }, 320); }
    var why = vid ? refusalReason(vid, t.slot, card) : null;
    UI.hintFlash = why ? { text: why, until: performance.now() + 2500 } : null;
  }
  UI.refused = refused;
  // What each verb takes, in a line: the hint bar's answer to a card of the wrong kind on its tile.
  var VERB_TAKES = {
    duty: 'Attend takes Health or Wit for a day\'s work, a Case, a watchman, a Petition, a Letter of Service, or the Council\'s letters.',
    investigate: 'Explore takes a Case, an Accused, Instinct or Health, an informer, or someone abroad.',
    analyze: 'Study takes raw proof: a token, an Accused, or an unanswered case.',
    interrogate: 'Question takes a Witness, an Accused, or the Rival.',
    reflect: 'Rest takes a Case or its tokens, Weariness, Fever, Hunger, Sickness, Stress, a Wound, or an Insight.',
    arrest: 'The Court takes an Accused, or the Condemned.',
    time: 'The Bell takes no cards. It rings by itself at the week\'s end.',
  };
  UI.VERB_TAKES = VERB_TAKES;
  function refusalReason(vid, slotKey, card) {
    var e = UI.e, v = e.verb(vid), def = CF.VERBS[vid];
    if (!v || !def) return null;
    var lock = e.lockReason(vid);
    if (lock) return tr(lock);
    if (v.status === 'running') {
      if (v.ask && !v.ask.filled) return tr('{verb} asks for {what}, not this.', { verb: def.label, what: v.ask.label });
      return tr('{verb} is at work. Wait for its clock to run out.', { verb: def.label });
    }
    if (card && card.loc && card.loc.t === 'table') { var un = e.unavailableReason(card); if (un) return tr(un); }
    var pv = v.status === 'idle' && e.preview ? e.preview(vid) : null;
    if (pv && pv.blocked) return tr(pv.blocked);
    var sl = null;
    def.slots.forEach(function (x) { if (x.key === slotKey) sl = x; });
    if (sl && !sl.primary) {
      var kinds = [];
      sl.accepts.forEach(function (a) { var w = prettyAspect(a); if (kinds.indexOf(w) < 0) kinds.push(w); });
      return tr('This place takes {what}.', { what: kinds.slice(0, 4).join(', ') });
    }
    return VERB_TAKES[vid] ? tr(VERB_TAKES[vid]) : null;
  }
  // A card dropped into a slot shrinks into it.
  function absorb(d, t) {
    var el = d.el;
    UI.lifted = null;
    if (d.from === 'table') delete cardEls[d.uid];
    var r = t.node.getBoundingClientRect();
    liftToLeftTop(d);
    el.classList.add('absorbing');
    el.style.left = (r.left + r.width / 2 - T.CW / 2) + 'px';
    el.style.top = (r.top + r.height / 2 - T.CH / 2) + 'px';
    el.style.transformOrigin = '50% 50%';
    el.style.transform = 'scale(0.4)';
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 240);
  }

  // Two taps on a find within this long take it (onPointerUp); the dblclick that follows them is already answered.
  var DOUBLE_TAP = 450;
  function onDoubleClick(ev) {
    if (UI.modal) return;
    if (UI.tookByTaps && performance.now() - UI.tookByTaps < 700) return;
    var n = cardAt(ev.target);
    var e = UI.e;
    if (!n) return;
    var card = e.card(+n.dataset.uid);
    if (!card || !card.loc) return;
    if (card.loc.t === 'out') { markSpawn(card.uid, n); e.takeOutput(card.loc.verb, card.uid); e.dirty = true; return; }
    if (card.loc.t !== 'table') return;
    sendOnDouble(card);
  }
  // A table card asked for twice (a double-click, or two taps): a verb asking for it mid-work first, else the
  // open window or a fresh verb that takes it. True when it went somewhere.
  function sendOnDouble(card) {
    var e = UI.e;
    for (var a = 0; a < CF.VERB_ORDER.length; a++) if (e.askAccepts(CF.VERB_ORDER[a], card)) { UI.answerAsk(CF.VERB_ORDER[a], card.uid); return true; }
    var tries = UI.openVerbs.slice().reverse().concat(CF.VERB_ORDER);
    for (var i = 0; i < tries.length; i++) {
      var id = tries[i], v = e.verb(id);
      var fresh = UI.openVerbs.indexOf(id) >= 0 || (v.status === 'idle' && !Object.keys(v.slots).length);
      if (fresh && canTake(id, card) && e.autoSlot(id, card.uid)) { openWindow(id); CF.Audio.play('drop'); UI.haptic(10); e.dirty = true; return true; }
    }
    return false;
  }
})();
