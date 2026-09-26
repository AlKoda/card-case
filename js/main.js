// Boot: start screen, saving/loading, menus and endings.
(function () {
  var CF = window.CF;
  var UI = CF.UI;
  var SAVE_KEY = 'casefile.save.v1';
  var LEGACY_KEY = 'casefile.legacy.v1';

  function $(id) { return document.getElementById(id); }
  function store(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (err) { /* storage unavailable */ } }
  function load(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
  function show(id, on) { $(id).classList.toggle('hidden', !on); UI.modal = !!document.querySelector('.modal:not(.hidden)'); }

  var chosen = 'master';

  function save() {
    if (UI.e && !UI.e.s.over) store(SAVE_KEY, UI.e.save());
  }
  UI.onSave = save;

  UI.onGameOver = function (over) {
    var e = UI.e;
    store(SAVE_KEY, null);
    store(LEGACY_KEY, JSON.stringify(e.s.legacy));
    var st = e.s.stats;
    $('end').querySelector('.modal-box').className = 'modal-box ' + (over.win ? 'end-win' : 'end-lose');
    $('end-title').textContent = over.title;
    $('end-sub').textContent = CF.RANKS[e.s.rank] + ' ' + e.s.detective + ', week ' + over.week;
    $('end-text').textContent = over.text;
    $('end-stats').innerHTML = [
      ['Convictions', st.convictions], ['Acquittals', st.acquittals], ['Gone cold', st.cold], ['Wrongful', st.wrongful],
    ].map(function (x) { return '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
    show('end', true);
  };

  function buildCallings() {
    var box = $('callings');
    box.innerHTML = '';
    Object.keys(CF.CALLINGS).forEach(function (k) {
      var c = CF.CALLINGS[k];
      var b = document.createElement('button');
      b.className = 'calling' + (k === chosen ? ' on' : '');
      b.innerHTML = '<div class="theme">' + c.theme + '</div><h3>' + c.label + '</h3><p>' + c.blurb + '</p><div class="bonus">' + c.bonus + '</div>';
      b.addEventListener('click', function () { chosen = k; buildCallings(); });
      box.appendChild(b);
    });
  }

  function openStart() {
    buildCallings();
    var legacy = load(LEGACY_KEY);
    $('legacy-row').classList.toggle('hidden', !legacy);
    if (legacy) {
      try {
        var L = JSON.parse(legacy);
        $('legacy-label').textContent = 'Succeed ' + L.predecessor + ' (' + L.ending + '): inherit ' + (L.cold || []).length + ' cold case(s) and ' +
          ((L.atlarge || []).length + (L.gangs || []).length) + ' enemies';
      } catch (err) { $('legacy-row').classList.add('hidden'); }
    }
    $('btn-continue').classList.toggle('hidden', !load(SAVE_KEY));
    show('start', true);
  }

  function newGame(useLegacy) {
    var legacy = null;
    if (useLegacy) { try { legacy = JSON.parse(load(LEGACY_KEY)); } catch (err) { legacy = null; } }
    var name = ($('name').value || 'Marlowe').trim().slice(0, 24);
    var e = CF.Engine.newGame({ calling: chosen, name: name, legacy: legacy });
    if (legacy) store(LEGACY_KEY, null);
    UI.attach(e);
    UI.paused = false;
    UI.speed = 1;
    save();
    show('start', false);
    show('end', false);
  }

  $('btn-new').addEventListener('click', function () { newGame($('legacy').checked); });
  $('btn-continue').addEventListener('click', function () {
    try {
      UI.attach(CF.Engine.load(load(SAVE_KEY)));
      show('start', false);
    } catch (err) {
      store(SAVE_KEY, null);
      $('btn-continue').classList.add('hidden');
    }
  });
  $('btn-help').addEventListener('click', function () { show('help', true); });
  $('btn-help2').addEventListener('click', function () { show('help', true); });
  $('help-close').addEventListener('click', function () { show('help', false); });
  $('btn-menu').addEventListener('click', function () { show('menu', true); });
  $('m-resume').addEventListener('click', function () { show('menu', false); });
  $('m-save').addEventListener('click', function () { save(); show('menu', false); });
  $('m-new').addEventListener('click', function () {
    if (!confirm('Abandon this case file? Your progress will be lost.')) return;
    store(SAVE_KEY, null);
    show('menu', false);
    openStart();
  });
  $('end-successor').addEventListener('click', function () { show('end', false); openStart(); $('legacy').checked = true; });
  $('end-new').addEventListener('click', function () { show('end', false); openStart(); $('legacy').checked = false; });
  $('end-look').addEventListener('click', function () { show('end', false); });
  window.addEventListener('beforeunload', save);

  UI.init();
  // A table is always showing behind the start screen.
  UI.attach(CF.Engine.newGame({ calling: chosen, seed: 1 }));
  openStart();
})();
