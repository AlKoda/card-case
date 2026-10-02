// Boot and navigation: title screen, new game, settings, archive, pause menu,
// endings, and saving.
(function () {
  var CF = window.CF;
  var UI = CF.UI;
  var SAVE_KEY = 'casefile.save.v1';
  var PREV_KEY = 'casefile.save.v1.prev';     // the save before the last one, for a recovery by hand
  var BROKEN_KEY = 'casefile.save.v1.broken'; // a save no edition could read, kept for the same reason
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
    // With nothing to decide it is a word from the desk: the same dialog, one button.
    $('confirm').querySelector('.dlg-head').textContent = tr(onYes ? 'A Question' : 'A Word');
    $('confirm-yes').textContent = tr(onYes ? 'Yes' : 'Close');
    $('confirm-no').classList.toggle('hidden', !onYes);
    show('confirm', true);
  }
  function closeConfirm() { show('confirm', false); confirmYes = null; }
  function notice(text) { ask(text, null); }
  click('confirm-no', closeConfirm);
  click('confirm-yes', function () { var fn = confirmYes; closeConfirm(); if (fn) fn(); });

  // Promotion: rank badge, and the verbs the new rank unlocks.
  UI.onPromotion = function (rank) {
    $('promo-badge').style.backgroundImage = 'var(--art-' + (['cwax-01', 'cwax-03', 'cwax-02'][((CF.RANK_DEFS[rank] || {}).badge || 1) - 1] || 'cwax-01') + ')';
    // A small 'Promoted' over the rank alone, so the rank clears the plate's stars.
    var title = $('promo-title'), kick = document.createElement('small'), rk = document.createElement('span');
    kick.className = 'lu-kick'; kick.textContent = tr('Promoted');
    rk.className = 'lu-rank'; rk.textContent = tr(CF.RANKS[rank]);
    title.textContent = ''; title.appendChild(kick); title.appendChild(rk);
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
    // The office's own bell, not the ending's fanfare.
    CF.Audio.play('office');
    show('promo', true);
    // The ceremony: the panel opens, the wax comes down on it, the powers are dealt one by one.
    var box = $('promo-box'), dealt = 0;
    box.classList.remove('cer'); void box.offsetWidth; box.classList.add('cer');
    [1, 2, 3].forEach(function (i) { var el = $('promo-s' + i); el.style.animationDelay = el.classList.contains('empty') ? '' : (0.75 + 0.12 * dealt++) + 's'; });
    clearTimeout(promoStamp);
    promoStamp = setTimeout(function () { if (!$('promo').classList.contains('hidden')) { CF.Audio.play('seal'); if (UI.haptic) UI.haptic(40); } }, 650);
  };
  var promoStamp = null;
  // The new rank's wax glows in the top bar for a moment once the dialog is put away.
  function closePromo() {
    show('promo', false);
    var rb = document.getElementById('rank-badge');
    if (!rb) return;
    rb.classList.remove('rank-new'); void rb.offsetWidth; rb.classList.add('rank-new');
    // The new wax is pressed into the bar.
    setTimeout(function () { CF.Audio.play('seal'); }, 300);
    setTimeout(function () { rb.classList.remove('rank-new'); }, 2000);
  }
  // A tap on a power reads it out under the slots.
  $('promo-box').addEventListener('click', function (ev) {
    var slot = ev.target.closest('.lu-slot');
    var k = slot && slot.dataset.power;
    if (!k || !CF.POWERS[k]) return;
    $('promo-note').textContent = tr(CF.POWERS[k].text);
    document.querySelectorAll('#promo-box .lu-slot').forEach(function (el) { el.classList.toggle('on', el === slot); });
  });
  click('promo-close', closePromo);
  click('promo-precinct', function () { closePromo(); if (UI.e) { CF.Precinct.open(UI.e); only('precinct'); } });

  var inGame = false;     // a real game (not the demo table behind the title)
  var returnTo = 'title'; // where Back goes from Settings / Archive

  var CALLING_ART = { commissioner: 'ctrade-04', master: 'ctrade-06', crusader: 'ctrade-05' };
  var ENDING_ART = { dismissed: 'cback-04', burnout: 'cback-04', collapse: 'cback-04', consumed: 'cback-02', corruption: 'cback-06',
    death: 'cback-04', riot: 'cback-01', thieftaker: 'cback-06', oldbailey: 'cback-03', kingofthunes: 'cback-06', treatycity: 'cback-05', merciful: 'cback-03', hangmans: 'cback-04', stake: 'cback-01', dagger: 'cback-04', commissioner: 'ctrade-04', master: 'ctrade-06', crusader: 'ctrade-05' };

  // Every save keeps the one before it, so a save that goes wrong is one step back, never gone.
  function save() {
    if (!(inGame && UI.e && !UI.e.s.over)) return;
    var next = UI.e.save(), cur = load(SAVE_KEY);
    if (cur && cur !== next) store(PREV_KEY, cur);
    store(SAVE_KEY, next);
  }
  // Continue shows while the save is at least JSON: an edition that cannot
  // load it may be followed by one that can, and a new game asks before it writes over it.
  function saveParses() {
    var raw = load(SAVE_KEY);
    if (!raw) return false;
    try { return !!JSON.parse(raw); } catch (err) { return false; }
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
    $('t-continue').classList.toggle('hidden', !saveParses());
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
    lockLandscape();
    UI.fitView();
  }

  // Installed or full screen, the page asks to be held on its side like the app; a browser that will not is
  // answered by the turn card (js/ui.js) instead.
  function lockLandscape() {
    try {
      var standalone = typeof matchMedia === 'function' && (matchMedia('(display-mode:standalone)').matches || matchMedia('(display-mode:fullscreen)').matches);
      if (!(document.fullscreenElement || standalone) || !screen.orientation || !screen.orientation.lock) return;
      var p = screen.orientation.lock('landscape');
      if (p && p.catch) p.catch(function () { /* not allowed here */ });
    } catch (err) { /* no orientation lock */ }
  }

  // Continue: the saved letter. One that cannot be read is never thrown away:
  // a copy goes under BROKEN_KEY, the save stays where it was for an edition
  // that can read it, and the title says so. True when the table is up.
  function continueGame() {
    var raw = load(SAVE_KEY);
    try {
      UI.attach(CF.Engine.load(raw));
      UI.paused = false;
      UI.speed = 1;
      UI.setSpeed && UI.setSpeed(1);
      inGame = true;
      only(null);
      lockLandscape();
      UI.fitView();
      return true;
    } catch (err) {
      if (window.console && console.error) console.error(err);
      store(BROKEN_KEY, raw);
      openTitle();
      notice('The saved letter could not be read. The desk is kept as it was; a new letter starts afresh.');
      return false;
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
  // A phone browser may throw a hidden tab away without beforeunload: write the save as the page goes out of sight.
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // Install in one tap: the browser's offer is kept and a plate button on the
  // title shows it. An offer prompts once, so the button goes with it.
  var installOffer = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    installOffer = ev;
    $('t-install').classList.remove('hidden');
  });
  click('t-install', function () {
    var offer = installOffer;
    installOffer = null;
    $('t-install').classList.add('hidden');
    if (offer && offer.prompt) offer.prompt();
  });
  window.addEventListener('appinstalled', function () { installOffer = null; $('t-install').classList.add('hidden'); });

  // A new edition: index.html registers the service worker and calls this when a
  // fresh one has installed behind a running page. The toast sits above every
  // screen (the title too); tapped, it saves, lets the new worker take over
  // (the page reloads on controllerchange) and comes back onto the same table.
  CF.updateAsked = false;
  CF.onUpdate = function (reg) {
    if ($('update-toast')) return;
    var t = document.createElement('div');
    t.id = 'update-toast';
    t.className = 'toast k-event';
    t.style.cssText = 'position:fixed;right:calc(12px + var(--sa-r));top:calc(var(--sa-t) + 64px);z-index:1400;width:380px;max-width:calc(100vw - 24px);--bar:var(--art-clabel-06);--icon:var(--art-bround-16)';
    t.innerHTML = '<b></b><span></span>';
    t.firstChild.textContent = tr('A new edition is ready');
    t.lastChild.textContent = tr('Tap to reload.');
    t.addEventListener('click', function () {
      t.remove();
      save();
      if (inGame) { try { history.replaceState(history.state, '', location.pathname + location.search + '#resume'); } catch (err) { /* no history to write */ } }
      CF.updateAsked = true;
      if (reg && reg.waiting) reg.waiting.postMessage('skip'); else location.reload();
    });
    document.body.appendChild(t);
    // Until the stylesheet paints the bar from --bar, it is the background.
    try { if (/^(none)?$/.test(getComputedStyle(t).borderImageSource || '')) t.style.backgroundImage = 'var(--bar)'; } catch (err) { /* no layout here */ }
  };

  // ---------------------------------------------------------------- Boot
  UI.applyLang();
  langButton();
  // '#resume' (the Android wrapper after a renderer kill or process death, the
  // page after an update): straight back to the table, paused, when there is a save.
  var resume = /resume/.test(location.hash);
  if (location.hash) { try { history.replaceState(history.state, '', location.pathname + location.search); } catch (err) { /* a file: page has no history to write */ } }
  UI.init();
  // Back in a browser or the installed page: a sentinel entry under the page, so
  // the browser's Back closes windows the way Android's does and leaves only
  // from the title. The APK has its own Back.
  if (!window.CaseFileAndroid && /^https?:/.test(location.protocol) && window.history && history.pushState) {
    history.replaceState({ cf: 0 }, '');
    history.pushState({ cf: 1 }, '');
    window.addEventListener('popstate', function (ev) {
      if (!ev.state || ev.state.cf !== 0) return;
      if (UI.back()) history.pushState({ cf: 1 }, '');
      else history.back();
    });
  }
  if (resume && saveParses() && continueGame()) UI.setPaused(true);
  else {
    // A table is always showing behind the title screen (and behind the word
    // about a save that could not be read, which continueGame has put up).
    UI.attach(CF.Engine.newGame({ calling: 'master', seed: 1 }));
    if (!document.querySelector('.modal:not(.hidden)')) openTitle();
  }
})();
