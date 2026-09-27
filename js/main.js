// Boot and navigation: title screen, new game, settings, archive, pause menu,
// endings, and saving.
(function () {
  var CF = window.CF;
  var UI = CF.UI;
  var SAVE_KEY = 'casefile.save.v1';
  var LEGACY_KEY = 'casefile.legacy.v1';

  function $(id) { return document.getElementById(id); }
  function store(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (err) { /* storage unavailable */ } }
  function load(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
  function show(id, on) { $(id).classList.toggle('hidden', !on); UI.modal = !!document.querySelector('.modal:not(.hidden)'); }
  function only(id) {
    document.querySelectorAll('.modal').forEach(function (m) { m.classList.toggle('hidden', m.id !== id); });
    UI.modal = !!id;
  }
  function click(id, fn) { $(id).addEventListener('click', function (ev) { CF.Audio.play('click'); fn(ev); }); }

  // A styled yes/no dialog in place of the browser's confirm().
  var confirmYes = null, confirmFrom = null;
  function ask(text, onYes) {
    confirmYes = onYes;
    confirmFrom = document.querySelector('.modal:not(.hidden)');
    $('confirm-text').textContent = text;
    show('confirm', true);
  }
  function closeConfirm() { show('confirm', false); confirmYes = null; }
  click('confirm-no', closeConfirm);
  click('confirm-yes', function () { var fn = confirmYes; closeConfirm(); if (fn) fn(); });

  // Promotion: rank badge, and the verbs the new rank unlocks.
  UI.onPromotion = function (rank) {
    $('promo-badge').style.backgroundImage = 'var(--art-' + (['medal-moon', 'medal-sun', 'medal-lion'][((CF.RANK_DEFS[rank] || {}).badge || 1) - 1] || 'medal-sun') + ')';
    $('promo-title').textContent = 'Promoted: ' + CF.RANKS[rank];
    var unlocked = Object.keys(CF.POWERS).filter(function (k) { return CF.POWERS[k].rank === rank; });
    [1, 2, 3].forEach(function (i) {
      var k = unlocked[i - 1];
      var el = $('promo-s' + i);
      el.style.backgroundImage = k ? 'var(--art-' + CF.POWERS[k].art + ')' : '';
      el.title = k ? CF.POWERS[k].label + ': ' + CF.POWERS[k].text : '';
    });
    CF.Audio.play('victory');
    show('promo', true);
  };
  click('promo-box', function () { show('promo', false); });

  var chosen = 'master';
  var chosenWho = 'clerk';
  var inGame = false;     // a real game (not the demo table behind the title)
  var returnTo = 'title'; // where Back goes from Settings / Archive

  var CALLING_ART = { commissioner: 'ntarot-09', master: 'ntarot-07', crusader: 'ntarot-08' };
  var ENDING_ART = { dismissed: 'ntarot-08', burnout: 'ntarot-08', collapse: 'ntarot-08', consumed: 'ntarot-07', corruption: 'ntarot-07',
    death: 'ntarot-08', riot: 'ntarot-08', thieftaker: 'ntarot-07', oldbailey: 'ntarot-09', kingofthunes: 'ntarot-08', treatycity: 'ntarot-08', merciful: 'ntarot-09', hangmans: 'ntarot-07', stake: 'ntarot-09', dagger: 'ntarot-08', commissioner: 'ntarot-09', master: 'ntarot-07', crusader: 'ntarot-09' };

  function save() {
    if (inGame && UI.e && !UI.e.s.over) store(SAVE_KEY, UI.e.save());
  }
  UI.onSave = save;
  UI.onResolved = function (rec) { if (inGame) CF.Archive.add(rec); };

  UI.onGameOver = function (over) {
    var e = UI.e;
    store(SAVE_KEY, null);
    store(LEGACY_KEY, JSON.stringify(e.s.legacy));
    var st = e.s.stats;
    $('end').querySelector('.modal-box').className = 'modal-box end-box ' + (over.win ? 'end-win' : 'end-lose');
    $('end-card').style.backgroundImage = 'var(--art-' + (ENDING_ART[over.id] || 'ntarot-08') + ')';
    $('end-card-top').textContent = over.title;
    $('end-card-bottom').textContent = e.s.detective;
    $('end-title').textContent = over.title;
    $('end-sub').textContent = CF.RANKS[e.s.rank] + ' ' + e.s.detective + (e.s.who && CF.ORIGINS[e.s.who] ? ', once ' + CF.ORIGINS[e.s.who].label.toLowerCase() : '') + ', week ' + over.week +
      (over.origin && over.calling && over.origin !== over.calling ? ' · set out as ' + CF.CALLINGS[over.origin].label + ', ended as ' + CF.CALLINGS[over.calling].label : '');
    $('end-text').textContent = over.text;
    $('end-stats').innerHTML = [
      ['Convictions', st.convictions], ['Acquittals', st.acquittals], ['Unanswered', st.cold], ['Wrongful', st.wrongful],
    ].map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
    CF.Audio.play(over.win ? 'victory' : 'defeat');
    only('end');
  };

  // ---------------------------------------------------------------- Title
  function openTitle() {
    $('t-continue').classList.toggle('hidden', !load(SAVE_KEY));
    only('title');
  }

  function buildOrigins() {
    var box = $('origins');
    if (!box) return;
    box.innerHTML = '';
    CF.ORIGIN_ORDER.forEach(function (k) {
      var o = CF.ORIGINS[k];
      var b = document.createElement('button');
      b.className = 'origin' + (k === chosenWho ? ' on' : '');
      b.innerHTML = '<div class="o-face" style="background-image:var(--art-' + o.art + ')"></div><h3>' + o.label + '</h3><p>' + o.blurb + '</p><div class="bonus">' + o.bends + '</div><div class="shut">' + o.shut + '</div>';
      b.addEventListener('click', function () { chosenWho = k; CF.Audio.play('pick'); buildOrigins(); });
      box.appendChild(b);
    });
  }
  function buildCallings() {
    buildOrigins();
    var box = $('callings');
    box.innerHTML = '';
    Object.keys(CF.CALLINGS).forEach(function (k) {
      var c = CF.CALLINGS[k];
      var b = document.createElement('button');
      b.className = 'calling' + (k === chosen ? ' on' : '');
      b.innerHTML = '<div class="pcard" style="background-image:var(--art-' + CALLING_ART[k] + ')"><span class="pc-top">' + c.label.replace('The ', '') +
        '</span><span class="pc-bottom">' + c.theme + '</span></div><div class="calling-text"><h3>' + c.label + '</h3><p>' + c.blurb + '</p><div class="bonus">' + c.bonus + '</div></div>';
      b.addEventListener('click', function () { chosen = k; CF.Audio.play('pick'); buildCallings(); });
      box.appendChild(b);
    });
  }

  function openStart(withLegacy) {
    buildCallings();
    var legacy = load(LEGACY_KEY);
    $('legacy-row').classList.toggle('hidden', !legacy);
    $('legacy').checked = !!(legacy && withLegacy);
    if (legacy) {
      try {
        var L = JSON.parse(legacy);
        $('legacy-label').textContent = 'Succeed ' + L.predecessor + ' (' + L.ending + '): inherit ' + (L.cold || []).length + ' unanswered case(s) and ' +
          ((L.atlarge || []).length + (L.gangs || []).length) + ' enemies';
      } catch (err) { $('legacy-row').classList.add('hidden'); }
    }
    only('start');
  }

  function newGame(useLegacy) {
    var legacy = null;
    if (useLegacy) { try { legacy = JSON.parse(load(LEGACY_KEY)); } catch (err) { legacy = null; } }
    var name = $('name').value.trim().slice(0, 24) || 'Kessler';
    var e = CF.Engine.newGame({ calling: chosen, who: chosenWho, name: name, legacy: legacy, guided: !!CF.Settings.get('guided') });
    if (legacy) store(LEGACY_KEY, null);
    UI.attach(e);
    inGame = true;
    UI.paused = false;
    UI.speed = 1;
    save();
    only(null);
  }

  function continueGame() {
    try {
      UI.attach(CF.Engine.load(load(SAVE_KEY)));
      UI.paused = false;
      UI.speed = 1;
      UI.setSpeed && UI.setSpeed(1);
      inGame = true;
      only(null);
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
  click('start-back', openTitle);
  click('btn-new', function () { newGame($('legacy').checked); });
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
    if (open && open.id === 'start') { openTitle(); return true; }
    if (open && open.id === 'end') return true;
    if (open) { only(inGame ? null : 'title'); return true; }
    if (inGame) { only('menu'); return true; }
    return false;
  };
  click('btn-help', function () { returnTo = 'game'; only('help'); });
  click('btn-precinct', function () { CF.Precinct.open(UI.e); only('precinct'); });
  click('m-precinct', function () { CF.Precinct.open(UI.e); only('precinct'); });
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

  UI.init();
  // A table is always showing behind the title screen.
  UI.attach(CF.Engine.newGame({ calling: chosen, seed: 1 }));
  openTitle();
})();
