// The Settings screen and the Case Archive (a record of every case you have
// closed or lost, across all your detectives).
(function () {
  var CF = window.CF;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ------------------------------------------------------------ Settings
  var SettingsUI = (CF.SettingsUI = {});
  var RANGES = ['master', 'music', 'sfx', 'textSpeed'];

  function showValue(input) { input.nextElementSibling.textContent = input.value + '%'; }

  SettingsUI.open = function () {
    var v = CF.Settings.values;
    RANGES.forEach(function (k) { var el = $('s-' + k); el.value = v[k]; showValue(el); });
    $('s-shake').checked = !!v.shake;
    $('s-fullscreen').checked = !!document.fullscreenElement;
  };

  SettingsUI.apply = function () {
    var vals = { shake: $('s-shake').checked };
    RANGES.forEach(function (k) { vals[k] = +$('s-' + k).value; });
    CF.Settings.save(vals);
    var fs = $('s-fullscreen').checked;
    try {
      if (fs && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      if (!fs && document.fullscreenElement) document.exitFullscreen();
    } catch (err) { /* fullscreen not allowed */ }
  };

  RANGES.forEach(function (k) {
    $('s-' + k).addEventListener('input', function (ev) {
      showValue(ev.target);
      // Preview volume changes live.
      if (k !== 'textSpeed' && CF.Audio.ready) {
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

  // ------------------------------------------------------------ Archive
  var KEY = 'casefile.archive.v1';
  var OPENED = 'casefile.archive.opened.v1';
  var PER_PAGE = 8;
  var CARD_ART = { burglary: 'house', missing: 'woman', harbor: 'crow', arson: 'city', fraud: 'letter', extortion: 'smoker',
    manhunt: 'map', gang: 'board', syndicate: 'eye', architect: 'tentacles' };
  var OUTCOMES = { convicted: 'Solved', wrongful: 'Closed', acquitted: 'Acquitted', cold: 'Gone Cold' };

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
    if (!list.length) grid.innerHTML = '<p class="archive-empty">No cases yet. Every case you close, or lose, is filed here.</p>';
    list.slice(Archive.page * PER_PAGE, (Archive.page + 1) * PER_PAGE).forEach(function (rec, i) {
      var idx = Archive.page * PER_PAGE + i;
      var b = document.createElement('button');
      b.className = 'pcard' + (idx === Archive.selected ? ' on' : '') + ' o-' + rec.outcome;
      b.style.backgroundImage = 'var(--art-pcard-' + (CARD_ART[rec.template] || 'hourglass') + ')';
      b.innerHTML = '<span class="pc-top">' + esc(rec.title) + '</span><span class="pc-bottom">' + esc(OUTCOMES[rec.outcome] || rec.outcome) + '</span>';
      b.addEventListener('click', function () { Archive.selected = idx; Archive.render(); });
      grid.appendChild(b);
    });
    $('arc-page').textContent = (Archive.page + 1) + ' / ' + pages;
    $('arc-prev').disabled = Archive.page === 0;
    $('arc-next').disabled = Archive.page >= pages - 1;
    renderDetail(list[Archive.selected]);
  };

  function row(icon, html) { return '<div class="a-row"><i class="ico ico-' + icon + '"></i><div>' + html + '</div></div>'; }

  function renderDetail(rec) {
    var box = $('archive-detail');
    if (!rec) { box.innerHTML = '<div class="a-title"><span>The Archive</span></div><p class="a-empty">Select a case file.</p>'; $('arc-open').disabled = true; return; }
    var opened = isOpened(rec);
    var cul = rec.culprit || {};
    var truth;
    if (!opened) truth = '<i>Sealed. Open the file to learn the truth.</i>';
    else if (rec.outcome === 'wrongful') truth = '<b>' + esc(cul.name) + '</b>, ' + esc(cul.role) + ', did it, and someone else went to prison for it. ' + esc(cul.motive || '');
    else truth = '<b>' + esc(cul.name) + '</b>, ' + esc(cul.role) + '. ' + esc(cul.motive || '') + ' <span class="a-dim">' + esc(cul.trait || '') + '</span>';
    var portrait = cul.name ? 'portrait-' + [0, 1, 3, 4, 5, 6, 7, 8][hash(cul.name) % 8] : 'portrait-0';
    box.innerHTML = '<div class="a-title"><span>' + esc(rec.title) + '</span></div>' +
      '<div class="a-portrait' + (opened ? '' : ' sealed') + '" style="background-image:var(--art-' + portrait + ')"></div>' +
      row('file', '<b>' + esc(OUTCOMES[rec.outcome] || rec.outcome) + '</b>, week ' + rec.week + (rec.highProfile ? ' · high-profile' : '') + '<br><span class="a-dim">Detective ' + esc(rec.detective) + '</span>') +
      row('pin', esc(rec.scene) + '<br><span class="a-dim">' + esc((CF.DISTRICTS[rec.district] || {}).label || '') + '</span>') +
      row('person', 'Victim: ' + esc(rec.victim) + (rec.charged ? '<br>Charged: ' + esc(rec.charged) : '<br><span class="a-dim">Nobody was charged.</span>')) +
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
