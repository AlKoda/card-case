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
  var TOGGLES = ['shake', 'pauseOnCase', 'pauseOnVerb', 'pauseOnBlur', 'guided', 'pauseOnDrag', 'grid', 'snap', 'strings', 'haptics', 'tilt', 'calm'];

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
    var lb = $('t-lang'), lw = lb && (lb.querySelector('span') || lb); if (lw) lw.textContent = CF.LANGS[CF.lang()].name;
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
  // The effects and the whole: let go of the slider and a card lands, at the level just set (music is heard already).
  var tasteAt = 0;
  ['sfx', 'master'].forEach(function (k) {
    var el = $('s-' + k);
    if (!el) return;
    el.addEventListener('change', function () {
      var now = Date.now();
      if (!CF.Audio.ready || now - tasteAt < 150) return;
      tasteAt = now;
      CF.Audio.play('drop');
    });
  });
  // The pile's cell outlines follow the card pitch: the stylesheet reads --cell-px.
  function cellPitch() {
    var gap = +CF.Settings.get('gap') || CF.TABLE.GAP;
    try { document.documentElement.style.setProperty('--cell-px', (CF.TABLE.CW + gap) + 'px'); } catch (err) { /* no style */ }
  }
  CF.Settings.onChange(cellPitch);
  cellPitch();
  // The dossier's close hot spot stands beside the panel, over its baked X (a scroller clips its own children).
  var peekX = $('peek-x');
  if (peekX) peekX.addEventListener('click', function () { var b = document.querySelector('#peek .peek-close'); if (b) b.click(); });

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
      return { key: key, label: room.label, desc: room.desc, cost: Math.max(1, order.cost - orderDiscount(e)), rank: order.rank,
        state: owned ? 'owned' : locked ? 'locked' : onTable ? 'ordered' : 'open', use: owned ? roomUse(e, key) : 0 };
    });
  };
  // What a built room has done for you, where the rules count it (s.roomUse, { room: n }, kept by the engine at
  // each point a room's effect lands): one short phrase on the tile's foot, so the Coin it cost shows its return.
  var ROOM_USE = {
    locker: 'Tokens kept past their fading: {n}', suite: 'Questionings with more Word: {n}', archive: 'Cases opened again: {n}',
    intel: 'Fronts named, informers seated: {n}', training: 'Coin saved at the drill: {n}', thieftakers: 'Cases settled by the thief-takers: {n}',
    lab: 'Readings at the bench: {n}', survroom: 'Fronts seen from the Belfry: {n}',
  };
  function roomUse(e, key) { var u = e.s.roomUse; return u && typeof u[key] === 'number' && u[key] > 0 ? u[key] : 0; }
  Precinct.useLine = function (t) { return t.use && ROOM_USE[t.key] ? CF.T(ROOM_USE[t.key], { n: t.use }) : ''; };
  // The foot of a tile: built (with its return), the office it needs, the petition on the table, or its price.
  Precinct.foot = function (t) {
    if (t.state === 'owned') { var used = Precinct.useLine(t); return used ? CF.T('Built · {use}', { use: used }) : CF.T('Built'); }
    return t.state === 'locked' ? CF.T('Needs {rank}', { rank: CF.RANKS[t.rank] }) : t.state === 'ordered' ? CF.T('Petition on the table') : CF.T('{n} Coin', { n: t.cost });
  };
  // The Clerk's origin takes a Coin off every petition, the board's too.
  function orderDiscount(e) { return e.s.who === 'clerk' ? 1 : 0; }
  // The petition card for an order: the engine's own builder when it has
  // one (so the board and the Council's forms cannot differ), else the same
  // shape built here.
  function orderSpec(e, key) {
    var spec = typeof e.orderSpec === 'function' ? e.orderSpec(key) : null;
    if (spec && spec.data && spec.data.order === key) return spec;
    var o = CF.ORDERS[key], disc = orderDiscount(e);
    var what = o.room ? CF.ROOMS[o.room].desc : CF.CARDS[o.give].desc;
    return { label: 'Petition: ' + o.label, desc: what + ' Costs ' + Math.max(1, o.cost - disc) + ' Coin.', data: { order: key, discount: disc } };
  }
  // Put the requisition form on the table, unless it is already there.
  Precinct.order = function (e, key) {
    var room = CF.ROOMS[key], order = CF.ORDERS[room.order];
    if (e.s.rooms[key] || e.s.rank < order.rank) return false;
    if (e.cardsOf('order', true).some(function (c) { return c.data.order === room.order; })) return false;
    e.create('order', orderSpec(e, room.order));
    e.dirty = true;
    return true;
  };
  // The Petitions that are not rooms (the instruments, a key, and whatever else the Council will hear), as the
  // board's second row: bought, the office it needs, its form on the table, or its price. Pure, like tiles().
  var GOOD_ICONS = { camera: 'cstory-04', prints: 'cstory-02', kit: 'iinv-16', labpass: 'ilaw-19', surveillance: 'cverb-08' };
  Precinct.goods = function (e) {
    var bought = (e.s.flags && e.s.flags.bought) || {};
    return Object.keys(CF.ORDERS).filter(function (k) { return !CF.ORDERS[k].room; }).map(function (k) {
      var o = CF.ORDERS[k], give = o.give && CF.CARDS[o.give];
      var onTable = e.cardsOf('order', true).some(function (c) { return c.data.order === k; });
      var state = bought[k] ? 'owned' : e.s.rank < o.rank ? 'locked' : onTable ? 'ordered' : 'open';
      return { key: k, good: true, label: o.label, desc: give ? give.desc : (o.desc || ''), cost: Math.max(1, o.cost - orderDiscount(e)), rank: o.rank, state: state, icon: GOOD_ICONS[k] || 'ccrime-07' };
    });
  };
  // The next Petition to aim for: the cheapest one the office allows and not yet bought.
  Precinct.next = function (list) {
    var best = null;
    list.forEach(function (t) { if ((t.state === 'open' || t.state === 'ordered') && (!best || t.cost < best.cost)) best = t; });
    return best ? best.key : null;
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
    var owned = 0, rooms = Precinct.tiles(e), all = rooms.concat(Precinct.goods(e)), next = Precinct.next(all);
    all.forEach(function (t) {
      if (t.state === 'owned' && !t.good) owned++;
      var d = document.createElement('div');
      d.className = 'room ' + t.state + (t.good ? ' good' : '') + (t.key === next ? ' next' : '');
      d.innerHTML = '<div class="rm-icon" style="background-image:var(--art-' + (t.good ? t.icon : ROOM_ICONS[t.key] || 'iplace-10') + ')"></div><div class="rm-name">' + esc(t.label) + '</div><div class="rm-desc">' + esc(t.desc) + '</div>' +
        '<div class="rm-foot">' + esc(t.good && t.state === 'owned' ? CF.T('Bought') : Precinct.foot(t)) + '</div>' + (t.key === next ? '<div class="rm-next">' + esc('Next') + '</div>' : '');
      if (t.state === 'open' && !t.good) {
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
  // Each case wears its own crime card; the outcome is a wax in the corner.
  var OUTCOME_WAX = { convicted: 'cwax-03', wrongful: 'cwax-01', acquitted: 'cok-02', cold: 'cwax-05', settled: 'cok-01', court: 'cwax-02', inquisitor: 'cwax-01' };
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
  // The strip names the kind of case ('Burglary'), which reads in both languages;
  // an old record without a template keeps its whole title.
  function shortTitle(rec) {
    var tpl = CF.CASE_TEMPLATES && CF.CASE_TEMPLATES[rec.template];
    return rec.short || (tpl && tpl.label) || rec.title || '';
  }

  Archive.render = function () {
    var list = readList(KEY);
    var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    Archive.page = Math.min(Archive.page, pages - 1);
    var grid = $('archive-grid');
    grid.innerHTML = '';
    var openedIds = readList(OPENED);
    if (!list.length) grid.innerHTML = '<p class="archive-empty">' + esc('Nothing in the Rolls yet. Every case you answer, or lose, is entered here.') + '</p>';
    list.slice(Archive.page * PER_PAGE, (Archive.page + 1) * PER_PAGE).forEach(function (rec, i) {
      var idx = Archive.page * PER_PAGE + i;
      var b = document.createElement('button');
      b.className = 'pcard' + (idx === Archive.selected ? ' on' : '') + ' o-' + rec.outcome;
      b.style.backgroundImage = 'var(--art-' + CF.UI.caseArt(rec.template) + ')';
      b.title = tr(rec.title) + ' · ' + tr(OUTCOMES[rec.outcome] || rec.outcome);
      b.innerHTML = '<span class="pc-top">' + esc(rec.title) + '</span><span class="pc-bottom">' + esc(shortTitle(rec)) + '</span>' +
        '<i class="pc-seal" style="--s:var(--art-' + (OUTCOME_WAX[rec.outcome] || 'cwax-05') + ')"></i>' + (openedIds.indexOf(rec.id) >= 0 ? '' : '<i class="pc-sealed" style="--s:var(--art-cstamp-04)"></i>');
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
    // The portrait floats on the corner and the title and rows run beside it, in either direction, at any width.
    box.innerHTML = '<div class="a-portrait' + (opened ? '' : ' sealed') + '" style="background-image:var(--art-' + portrait + ')"></div>' + (opened ? '' : '<div class="a-seal"></div>') +
      '<div class="a-title"><span>' + esc(rec.title) + '</span></div>' +
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
