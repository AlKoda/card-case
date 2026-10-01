// Boot and navigation: title screen, new game, settings, archive, pause menu,
// endings, and saving.
(function () {
  var CF = window.CF;
  var UI = CF.UI;
  var SAVE_KEY = 'casefile.save.v1';
  var LEGACY_KEY = 'casefile.legacy.v1';

  function $(id) { return document.getElementById(id); }
  var tr = CF.T;
  function store(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (err) { /* storage unavailable */ } }
  function load(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
  function show(id, on) { $(id).classList.toggle('hidden', !on); UI.modal = !!document.querySelector('.modal:not(.hidden)'); if (UI.wake) UI.wake(); }
  function only(id) {
    document.querySelectorAll('.modal').forEach(function (m) { m.classList.toggle('hidden', m.id !== id); });
    UI.modal = !!id;
    if (UI.wake) UI.wake();
  }
  function click(id, fn) { $(id).addEventListener('click', function (ev) { CF.Audio.play('click'); fn(ev); }); }

  // A styled yes/no dialog in place of the browser's confirm().
  var confirmYes = null, confirmFrom = null;
  function ask(text, onYes) {
    confirmYes = onYes;
    confirmFrom = document.querySelector('.modal:not(.hidden)');
    $('confirm-text').textContent = tr(text);
    show('confirm', true);
  }
  function closeConfirm() { show('confirm', false); confirmYes = null; }
  click('confirm-no', closeConfirm);
  click('confirm-yes', function () { var fn = confirmYes; closeConfirm(); if (fn) fn(); });

  // Promotion: rank badge, and the verbs the new rank unlocks.
  UI.onPromotion = function (rank) {
    $('promo-badge').style.backgroundImage = 'var(--art-' + (['cwax-01', 'cwax-03', 'cwax-02'][((CF.RANK_DEFS[rank] || {}).badge || 1) - 1] || 'cwax-01') + ')';
    $('promo-title').textContent = tr('Promoted: ' + CF.RANKS[rank]);
    var unlocked = Object.keys(CF.POWERS).filter(function (k) { return CF.POWERS[k].rank === rank; });
    var note = $('promo-note');
    note.textContent = unlocked.length ? tr(CF.POWERS[unlocked[0]].text) : '';
    [1, 2, 3].forEach(function (i) {
      var k = unlocked[i - 1];
      var el = $('promo-s' + i), cap = el.querySelector('.lu-cap');
      el.style.backgroundImage = k ? 'var(--art-' + CF.POWERS[k].art + ')' : '';
      el.classList.toggle('empty', !k);
      el.dataset.power = k || '';
      if (cap) cap.textContent = k ? tr(CF.POWERS[k].label) : '';
      el.classList.toggle('on', i === 1 && !!k);
    });
    CF.Audio.play('victory');
    show('promo', true);
  };
  // A tap on a power reads it out under the slots.
  $('promo-box').addEventListener('click', function (ev) {
    var slot = ev.target.closest('.lu-slot');
    var k = slot && slot.dataset.power;
    if (!k || !CF.POWERS[k]) return;
    $('promo-note').textContent = tr(CF.POWERS[k].text);
    document.querySelectorAll('#promo-box .lu-slot').forEach(function (el) { el.classList.toggle('on', el === slot); });
  });
  click('promo-close', function () { show('promo', false); });
  click('promo-precinct', function () { show('promo', false); if (UI.e) { CF.Precinct.open(UI.e); only('precinct'); } });

  var inGame = false;     // a real game (not the demo table behind the title)
  var returnTo = 'title'; // where Back goes from Settings / Archive

  var CALLING_ART = { commissioner: 'ctrade-04', master: 'ctrade-06', crusader: 'ctrade-05' };
  var ENDING_ART = { dismissed: 'cback-04', burnout: 'cback-04', collapse: 'cback-04', consumed: 'cback-02', corruption: 'cback-06',
    death: 'cback-04', riot: 'cback-01', thieftaker: 'cback-06', oldbailey: 'cback-03', kingofthunes: 'cback-06', treatycity: 'cback-05', merciful: 'cback-03', hangmans: 'cback-04', stake: 'cback-01', dagger: 'cback-04', commissioner: 'ctrade-04', master: 'ctrade-06', crusader: 'ctrade-05' };

  function save() {
    if (inGame && UI.e && !UI.e.s.over) store(SAVE_KEY, UI.e.save());
  }
  UI.onSave = save;
  UI.onResolved = function (rec) { if (inGame) CF.Archive.add(rec); };

  UI.onGameOver = function (over) {
    var e = UI.e;
    store(SAVE_KEY, null);
    store(LEGACY_KEY, JSON.stringify(e.s.legacy));
    var st = e.s.stats || {};
    // The screen wears the banner (red on a loss, gold on a win) and the paper; the end card is a wide
    // frame of the same tone with the ending's picture in its arch and the rank's wax in its circle.
    $('end').querySelector('.screen-box').className = 'screen-box end-box ' + (over.win ? 'end-win' : 'end-lose');
    $('end-banner').className = 'banner ' + (over.win ? 'win' : 'lose');
    $('end-card-pic').style.backgroundImage = 'var(--art-' + (ENDING_ART[over.id] || 'cback-04') + ')';
    $('end-card-seal').style.backgroundImage = 'var(--art-' + (['cwax-01', 'cwax-03', 'cwax-02'][((CF.RANK_DEFS[e.s.rank] || {}).badge || 1) - 1] || 'cwax-01') + ')';
    $('end-card-bottom').textContent = tr(e.s.detective);
    $('end-title').textContent = tr(over.title);
    $('end-sub').textContent = tr('{rank} {name}', { rank: CF.RANKS[e.s.rank], name: e.s.detective }) + (e.s.who && CF.ORIGINS[e.s.who] ? tr(', once {origin}', { origin: CF.ORIGINS[e.s.who].label.toLowerCase() }) : '') + tr(', week {n}', { n: over.week }) +
      (over.origin && over.calling && over.origin !== over.calling ? tr(' · set out as {a}, ended as {b}', { a: CF.CALLINGS[over.origin].label, b: CF.CALLINGS[over.calling].label }) : '');
    $('end-text').textContent = tr(over.text);
    // The tally as painted counters: the crown, the eye, the moon, the fire.
    $('end-stats').innerHTML = [
      ['Convictions', st.convictions, 'cres-09'], ['Acquittals', st.acquittals, 'cres-03'], ['Unanswered', st.cold, 'cres-12'], ['Wrongful', st.wrongful, 'cres-04'],
    ].map(function (x) { return '<div style="--c:var(--art-' + x[2] + ')"><b>' + (x[1] || 0) + '</b><span>' + tr(x[0]) + '</span></div>'; }).join('');
    CF.Audio.play(over.win ? 'victory' : 'defeat');
    only('end');
  };

  // ---------------------------------------------------------------- Title
  function openTitle() {
    $('t-continue').classList.toggle('hidden', !load(SAVE_KEY));
    only('title');
  }

  // A new game starts at once: a name and a past drawn for you, the calling
  // chosen in play. A predecessor's desk is taken up when the ending offers it.
  function openStart(withLegacy) { newGame(withLegacy); }

  function newGame(useLegacy) {
    var legacy = null;
    if (useLegacy) { try { legacy = JSON.parse(load(LEGACY_KEY)); } catch (err) { legacy = null; } }
    var who = CF.ORIGIN_ORDER[Math.floor(Math.random() * CF.ORIGIN_ORDER.length)];
    var name = CF.NAMES.last[Math.floor(Math.random() * CF.NAMES.last.length)];
    var e = CF.Engine.newGame({ who: who, name: name, legacy: legacy, guided: !!CF.Settings.get('guided'), opening: true });
    if (legacy) store(LEGACY_KEY, null);
    UI.attach(e);
    inGame = true;
    UI.paused = false;
    UI.speed = 1;
    save();
    only(null);
    UI.fitView();
  }

  function continueGame() {
    try {
      UI.attach(CF.Engine.load(load(SAVE_KEY)));
      UI.paused = false;
      UI.speed = 1;
      UI.setSpeed && UI.setSpeed(1);
      inGame = true;
      only(null);
      UI.fitView();
    } catch (err) {
      store(SAVE_KEY, null);
      openTitle();
    }
  }

  function openSettings(from) { returnTo = from; CF.SettingsUI.open(); only('settings'); }
  function openArchive(from) { returnTo = from; CF.Archive.open(); only('archive'); }
  function goBack() { if (returnTo === 'menu') only('menu'); else if (returnTo === 'end') only('end'); else openTitle(); }

  click('t-new', function () {
    if (load(SAVE_KEY)) ask('Take up a new letter of office? Your saved game will be lost.', function () { openStart(false); });
    else openStart(false);
  });
  click('t-continue', continueGame);
  click('t-archive', function () { openArchive('title'); });
  click('t-settings', function () { openSettings('title'); });
  click('t-help', function () { returnTo = 'title'; only('help'); });
  // The language button on the title screen cycles through the languages.
  function langButton() { var b = $('t-lang'); if (b) b.textContent = CF.LANGS[CF.lang()].name; }
  click('t-lang', function () {
    var codes = Object.keys(CF.LANGS), next = codes[(codes.indexOf(CF.lang()) + 1) % codes.length];
    CF.Settings.save({ lang: next });
    langButton();
  });
  langButton();
  click('set-back', function () { CF.SettingsUI.cancel(); goBack(); });
  click('set-apply', function () { CF.SettingsUI.apply(); goBack(); });
  click('arc-back', goBack);

  // Back (Android, or the host's own back control): close the top modal, or
  // open the pause menu; on the title screen there is nothing to go back to.
  UI.onBack = function () {
    var open = document.querySelector('.modal:not(.hidden)');
    if (open && open.id === 'confirm') { closeConfirm(); return true; }
    if (open && open.id === 'title') return false;
    if (open && (open.id === 'settings' || open.id === 'archive')) { goBack(); return true; }
    if (open && open.id === 'end') return true;
    if (open) { only(inGame ? null : 'title'); return true; }
    if (inGame) { only('menu'); return true; }
    return false;
  };
  click('btn-help', function () { returnTo = 'game'; only('help'); });
  click('btn-precinct', function () { CF.Precinct.open(UI.e); only('precinct'); });
  click('m-precinct', function () { CF.Precinct.open(UI.e); only('precinct'); });
  // On a phone the top bar keeps only the clock and the menu: the journal and the Help live here.
  click('m-journal', function () { only(null); UI.toggleJournal(true); });
  click('m-help', function () { returnTo = 'game'; only('help'); });
  click('precinct-close', function () { only(null); });
  click('help-close', function () { if (returnTo === 'title') openTitle(); else only(null); });
  click('btn-menu', function () { only('menu'); });
  click('m-resume', function () { only(null); });
  click('m-tidy', function () { if (UI.e) UI.tidy(); only(null); });
  click('m-save', function () { save(); only(null); });
  click('m-settings', function () { openSettings('menu'); });
  click('m-archive', function () { openArchive('menu'); });
  click('m-title', function () { save(); openTitle(); });
  click('m-new', function () {
    ask('Resign your office? Your progress will be lost.', function () {
      store(SAVE_KEY, null);
      inGame = false;
      openStart(false);
    });
  });
  click('end-successor', function () { inGame = false; openStart(true); });
  click('end-new', function () { inGame = false; openStart(false); });
  click('end-archive', function () { openArchive('end'); });
  click('end-look', function () { only(null); });
  window.addEventListener('beforeunload', save);

  UI.applyLang();
  langButton();
  UI.init();
  // A table is always showing behind the title screen.
  UI.attach(CF.Engine.newGame({ calling: 'master', seed: 1 }));
  openTitle();
})();
