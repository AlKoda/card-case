// The Settings screen and the Case Archive (a record of every case you have
// closed or lost, across all your detectives).
(function () {
  var CF = window.CF;
  function $(id) { return document.getElementById(id); }
  var tr = CF.T;
  function esc(s) { return String(tr(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ------------------------------------------------------------ Settings
  var SettingsUI = (CF.SettingsUI = {});
  var RANGES = ['master', 'music', 'sfx', 'textSpeed', 'gap', 'uiScale'];
  var TOGGLES = ['shake', 'pauseOnCase', 'pauseOnVerb', 'pauseOnBlur', 'guided', 'pauseOnDrag', 'grid', 'snap', 'strings', 'haptics'];

  function showValue(input) { input.nextElementSibling.textContent = input.value + (input.id === 's-gap' ? 'px' : '%'); }

  SettingsUI.open = function () {
    var v = CF.Settings.values;
    RANGES.forEach(function (k) { var el = $('s-' + k); el.value = v[k]; showValue(el); });
    TOGGLES.forEach(function (k) { $('s-' + k).checked = !!v[k]; });
    $('s-lang').value = v.lang || 'en';
    $('s-fullscreen').checked = !!document.fullscreenElement;
    // In the app the window is already full screen, and the version is worth knowing.
    var app = null;
    try { app = window.CaseFileAndroid && window.CaseFileAndroid.isApp && window.CaseFileAndroid.isApp() ? window.CaseFileAndroid : null; } catch (err) { app = null; }
    $('s-fullscreen').closest('.set-row').classList.toggle('hidden', !!app);
    var ver = '';
    try { ver = app && app.version ? String(app.version()) : ''; } catch (err) { ver = ''; }
    $('s-version').textContent = ver ? tr('App version {v}', { v: ver }) : '';
    $('s-version').classList.toggle('hidden', !ver);
  };

  SettingsUI.apply = function () {
    var vals = {};
    TOGGLES.forEach(function (k) { vals[k] = $('s-' + k).checked; });
    RANGES.forEach(function (k) { vals[k] = +$('s-' + k).value; });
    vals.lang = $('s-lang').value;
    CF.Settings.save(vals);
    var lb = $('t-lang'); if (lb) lb.textContent = CF.LANGS[CF.lang()].name;
    if (CF.UI && CF.UI.applyScale) CF.UI.applyScale();
    if (CF.UI && CF.UI.e && CF.TABLE.GAP !== vals.gap) { CF.TABLE.GAP = vals.gap; CF.UI.tidy ? CF.UI.tidy() : CF.UI.e.tidy(); }
    var fs = $('s-fullscreen').checked;
    try {
      if (fs && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      if (!fs && document.fullscreenElement) document.exitFullscreen();
    } catch (err) { /* fullscreen not allowed */ }
  };

  // Leaving without applying: undo any live volume preview.
  SettingsUI.cancel = function () { CF.Audio.apply(CF.Settings.values); };

  RANGES.forEach(function (k) {
    $('s-' + k).addEventListener('input', function (ev) {
      showValue(ev.target);
      // Preview volume changes live.
      if (k !== 'textSpeed' && k !== 'gap' && k !== 'uiScale' && CF.Audio.ready) {
        var preview = {}; for (var x in CF.Settings.values) preview[x] = CF.Settings.values[x];
        preview[k] = +ev.target.value;
        CF.Audio.apply(preview);
      }
    });
  });
  document.querySelectorAll('.settings-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.settings-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('sec-' + b.dataset.sec).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ------------------------------------------------------------ Precinct
  // The precinct as a second board: every room, what it does, what it costs,
  // and a way to put its requisition on the table.
  var Precinct = (CF.Precinct = {});
  // Pure: the tiles the board shows for an engine.
  Precinct.tiles = function (e) {
    return CF.ROOM_ORDER.map(function (key) {
      var room = CF.ROOMS[key], order = CF.ORDERS[room.order];
      var owned = !!e.s.rooms[key];
      var onTable = e.cardsOf('order', true).some(function (c) { return c.data.order === room.order; });
      var locked = e.s.rank < order.rank;
      return { key: key, label: room.label, desc: room.desc, cost: order.cost, rank: order.rank,
        state: owned ? 'owned' : locked ? 'locked' : onTable ? 'ordered' : 'open' };
    });
  };
  // Put the requisition form on the table, unless it is already there.
  Precinct.order = function (e, key) {
    var room = CF.ROOMS[key], order = CF.ORDERS[room.order];
    if (e.s.rooms[key] || e.s.rank < order.rank) return false;
    if (e.cardsOf('order', true).some(function (c) { return c.data.order === room.order; })) return false;
    e.create('order', { label: 'Petition: ' + order.label, desc: room.desc + ' Costs ' + order.cost + ' Coin.', data: { order: room.order } });
    e.dirty = true;
    return true;
  };
  var ROOM_ICONS = { locker: 'iinv-11', suite: 'ilaw-06', archive: 'iinv-20', intel: 'cwit-03', training: 'ilaw-22', thieftakers: 'itrade-20', lab: 'imed-24', survroom: 'iinv-19' };
  Precinct.open = function (e) {
    Precinct.e = e;
    Precinct.render();
  };
  Precinct.render = function () {
    var e = Precinct.e;
    if (!e) return;
    var grid = $('precinct-grid');
    grid.innerHTML = '';
    var owned = 0;
    Precinct.tiles(e).forEach(function (t) {
      if (t.state === 'owned') owned++;
      var d = document.createElement('div');
      d.className = 'room ' + t.state;
      d.innerHTML = '<div class="rm-icon" style="background-image:var(--art-' + (ROOM_ICONS[t.key] || 'iplace-10') + ')"></div><div class="rm-name">' + esc(t.label) + '</div><div class="rm-desc">' + esc(t.desc) + '</div>' +
        '<div class="rm-foot">' + esc(t.state === 'owned' ? 'Built' : t.state === 'locked' ? tr('Needs {rank}', { rank: CF.RANKS[t.rank] }) : t.state === 'ordered' ? 'Petition on the table' : tr('{n} Coin', { n: t.cost })) + '</div>';
      if (t.state === 'open') {
        var b = document.createElement('button');
        b.className = 'plate-btn teal small';
        b.textContent = tr('Petition');
        b.addEventListener('click', function () { Precinct.order(e, t.key); CF.Audio.play('start'); Precinct.render(); });
        d.appendChild(b);
      }
      grid.appendChild(d);
    });
    $('precinct-sub').textContent = tr('{rank} {name} · {owned} of {rooms} rooms built · up to {cases} open cases · stipend {pay} a week', { rank: CF.RANKS[e.s.rank], name: e.s.detective, owned: owned, rooms: CF.ROOM_ORDER.length, cases: e.maxOpenCases(), pay: e.rankDef().salary });
  };

  // ------------------------------------------------------------ Archive
  var KEY = 'casefile.archive.v1';
  var OPENED = 'casefile.archive.opened.v1';
  var PER_PAGE = 8;
  var CARD_ART = { convicted: 'cback-03', wrongful: 'cback-01', acquitted: 'cback-05', cold: 'cback-04' };
  var OUTCOMES = { convicted: 'Answered', wrongful: 'Closed', acquitted: 'Acquitted', cold: 'Unanswered', settled: 'Settled', court: 'Closed by the Court', inquisitor: 'Taken by the Inquisitor' };

  function readList(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (err) { return []; } }
  function writeList(key, list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch (err) { /* storage unavailable */ } }

  var Archive = (CF.Archive = { page: 0, selected: 0 });

  Archive.add = function (rec) {
    var list = readList(KEY).filter(function (r) { return r.id !== rec.id; });
    list.unshift(rec);
    writeList(KEY, list.slice(0, 120));
  };

  Archive.open = function () {
    Archive.page = 0;
    Archive.selected = 0;
    Archive.render();
  };

  function isOpened(rec) { return readList(OPENED).indexOf(rec.id) >= 0; }

  Archive.render = function () {
    var list = readList(KEY);
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    Archive.page = Math.min(Archive.page, pages - 1);
    var grid = $('archive-grid');
    grid.innerHTML = '';
    if (!list.length) grid.innerHTML = '<p class="archive-empty">' + esc('Nothing in the Rolls yet. Every case you answer, or lose, is entered here.') + '</p>';
    list.slice(Archive.page * PER_PAGE, (Archive.page + 1) * PER_PAGE).forEach(function (rec, i) {
      var idx = Archive.page * PER_PAGE + i;
      var b = document.createElement('button');
      b.className = 'pcard' + (idx === Archive.selected ? ' on' : '') + ' o-' + rec.outcome;
      b.style.backgroundImage = 'var(--art-' + (CARD_ART[rec.outcome] || 'cback-04') + ')';
      b.innerHTML = '<span class="pc-top">' + esc(rec.title) + '</span><span class="pc-bottom">' + esc(OUTCOMES[rec.outcome] || rec.outcome) + '</span>';
      b.addEventListener('click', function () { Archive.selected = idx; Archive.render(); });
      grid.appendChild(b);
    });
    $('arc-page').textContent = tr((Archive.page + 1) + ' / ' + pages);
    $('arc-prev').disabled = Archive.page === 0;
    $('arc-next').disabled = Archive.page >= pages - 1;
    renderDetail(list[Archive.selected]);
  };

  function row(icon, html) { return '<div class="a-row"><i class="ico ico-' + icon + '"></i><div>' + html + '</div></div>'; }

  function renderDetail(rec) {
    var box = $('archive-detail');
    if (!rec) { box.innerHTML = '<div class="a-title"><span>' + esc('The Rolls') + '</span></div><p class="a-empty">' + esc('Choose a case.') + '</p>'; $('arc-open').disabled = true; return; }
    var opened = isOpened(rec);
    var cul = rec.culprit || {};
    var truth;
    if (!opened) truth = '<i>' + esc('Sealed. Break the seal to learn the truth.') + '</i>';
    else if (rec.outcome === 'wrongful') truth = tr('<b>{name}</b>, {role}, did it, and someone else went to the rope for it.', { name: esc(cul.name), role: esc(cul.role) }) + ' ' + esc(cul.motive || '');
    else truth = '<b>' + esc(cul.name) + '</b>, ' + esc(cul.role) + '. ' + esc(cul.motive || '') + ' <span class="a-dim">' + esc(cul.trait || '') + '</span>';
    var portrait = CF.UI.personArt(cul.name || rec.title, cul.role || '');
    box.innerHTML = '<div class="a-title"><span>' + esc(rec.title) + '</span></div>' +
      '<div class="a-portrait' + (opened ? '' : ' sealed') + '" style="background-image:var(--art-' + portrait + ')"></div>' + (opened ? '' : '<div class="a-seal"></div>') +
      row('file', '<b>' + esc(OUTCOMES[rec.outcome] || rec.outcome) + '</b>' + esc(tr(', week {n}', { n: rec.week })) + (rec.highProfile ? esc(' · the city watched') : '') + '<br><span class="a-dim">' + esc(tr('Examiner {name}', { name: rec.detective })) + '</span>') +
      row('pin', esc(rec.scene) + '<br><span class="a-dim">' + esc((CF.DISTRICTS[rec.district] || {}).label || '') + '</span>') +
      row('person', esc(tr('Victim: {name}', { name: rec.victim })) + (rec.charged ? '<br>' + esc(tr('Charged: {name}', { name: rec.charged })) : '<br><span class="a-dim">' + esc('Nobody was charged.') + '</span>')) +
      row('eye', truth);
    $('arc-open').disabled = opened;
  }

  function hash(str) { var x = 0; str = String(str); for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }

  $('arc-prev').addEventListener('click', function () { Archive.page--; Archive.selected = Archive.page * PER_PAGE; Archive.render(); });
  $('arc-next').addEventListener('click', function () { Archive.page++; Archive.selected = Archive.page * PER_PAGE; Archive.render(); });
  $('arc-open').addEventListener('click', function () {
    var rec = readList(KEY)[Archive.selected];
    if (!rec) return;
    var opened = readList(OPENED);
    opened.push(rec.id);
    writeList(OPENED, opened.slice(-300));
    CF.Audio.play('case');
    Archive.render();
  });
})();
