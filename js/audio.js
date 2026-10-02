// Sound, synthesized with WebAudio so the game ships no audio files.
// Effects are short envelopes on oscillators and noise; the music is a slow
// minor-key pad over rain-like noise.
(function () {
  var CF = window.CF;
  var A = (CF.Audio = { ctx: null, ready: false });
  var volScale = 1;
  var master, limiter, musicBus, sfxBus, noiseBuf, musicTimer = null, chordIdx = 0;

  // Browsers only allow audio after a user gesture.
  A.unlock = function () {
    if (A.ready) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain();
    musicBus = A.ctx.createGain();
    sfxBus = A.ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    // A soft limiter on the master, so cues that land together do not clip.
    if (A.ctx.createDynamicsCompressor) {
      limiter = A.ctx.createDynamicsCompressor();
      limiter.threshold.value = -16; limiter.knee.value = 8; limiter.ratio.value = 4;
      limiter.attack.value = 0.005; limiter.release.value = 0.2;
      master.connect(limiter); limiter.connect(A.ctx.destination);
    } else master.connect(A.ctx.destination);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    A.apply(CF.Settings.values);
    startMusic();
  };

  // Away from the game (another app, a locked screen): silence, and back again.
  // The pad stops being scheduled while silent, or every chord queued in the
  // dark would sound at once on return; the rain loop is kept, not doubled.
  A.suspend = function () {
    if (!A.ready) return;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (A.ctx.state === 'running') A.ctx.suspend();
  };
  A.resume = function () {
    if (!A.ready) return;
    if (A.ctx.state === 'suspended') {
      var p = A.ctx.resume();
      if (p && p.then) p.then(startMusic, function () { /* still locked */ }); else startMusic();
    } else startMusic();
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) A.suspend(); else A.resume(); });
  window.addEventListener('pagehide', A.suspend);
  window.addEventListener('pageshow', A.resume);

  A.apply = function (v) {
    if (!A.ready) return;
    var t = A.ctx.currentTime;
    master.gain.setTargetAtTime(v.master / 100, t, 0.1);
    musicBus.gain.setTargetAtTime((v.music / 100) * 0.35, t, 0.3);
    sfxBus.gain.setTargetAtTime(v.sfx / 100, t, 0.05);
  };
  CF.Settings.onChange(A.apply);

  function tone(freq, dur, opts) {
    opts = opts || {};
    var c = A.ctx, t = c.currentTime + (opts.delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((opts.vol || 0.3) * volScale, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var node = o;
    if (opts.lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g);
    g.connect(opts.bus || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, opts) {
    opts = opts || {};
    var c = A.ctx, t = c.currentTime + (opts.delay || 0);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.freq || 2000;
    f.Q.value = opts.q || 1;
    // opts.attack swells the noise in (a crowd's murmur) instead of striking it.
    if (opts.attack) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime((opts.vol || 0.2) * volScale, t + opts.attack); }
    else g.gain.setValueAtTime((opts.vol || 0.2) * volScale, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // A struck bell: a few inharmonic partials, each fading on its own.
  function bell(freq, dur, opts) {
    opts = opts || {};
    var vol = opts.vol || 0.1, delay = opts.delay || 0;
    [[1, 1, 1], [2, 0.45, 0.7], [2.76, 0.3, 0.5], [5.4, 0.12, 0.3]].forEach(function (p) {
      tone(freq * p[0], dur * p[2], { vol: vol * p[1], delay: delay, attack: 0.004, lp: opts.lp || 2400 });
    });
  }

  function gavel() {
    [0, 0.22].forEach(function (d) {
      noise(0.05, { filter: 'lowpass', freq: 420, q: 0.7, vol: 0.35, delay: d });
      tone(150, 0.09, { to: 70, vol: 0.3, delay: d });
    });
  }

  var SOUNDS = {
    pick: function () { noise(0.05, { freq: 3500, vol: 0.12 }); tone(900, 0.05, { type: 'triangle', vol: 0.05 }); },
    drop: function () { tone(170, 0.12, { to: 90, vol: 0.25 }); noise(0.08, { freq: 900, vol: 0.08 }); },
    click: function () { tone(1400, 0.04, { type: 'square', vol: 0.03, lp: 3000 }); },
    start: function () { tone(196, 0.25, { type: 'triangle', vol: 0.18 }); tone(294, 0.35, { type: 'triangle', vol: 0.14, delay: 0.09 }); },
    complete: function () { tone(880, 0.9, { vol: 0.12 }); tone(1320, 1.1, { vol: 0.07, delay: 0.05 }); },
    case: function () { noise(0.03, { freq: 4000, vol: 0.2 }); noise(0.03, { freq: 4000, vol: 0.2, delay: 0.09 }); tone(1760, 0.7, { vol: 0.1, delay: 0.18 }); },
    danger: function () { tone(110, 0.8, { type: 'sawtooth', vol: 0.16, lp: 600 }); tone(116.5, 0.8, { type: 'sawtooth', vol: 0.14, lp: 600 }); },
    week: function () { noise(0.04, { freq: 2500, q: 8, vol: 0.25 }); noise(0.04, { freq: 1800, q: 8, vol: 0.2, delay: 0.35 }); },
    victory: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.9, { type: 'triangle', vol: 0.12, delay: i * 0.12 }); }); },
    // A leaf turned: a quiet story, without a bell.
    page: function () { noise(0.12, { filter: 'highpass', freq: 2500, vol: 0.06 }); },
    // A need arriving: two low beats.
    heartbeat: function () { tone(55, 0.12, { vol: 0.25 }); tone(52, 0.14, { vol: 0.2, delay: 0.22 }); },
    // Bad news that is not harm: a low rumble.
    omen: function () { noise(0.35, { filter: 'lowpass', freq: 180, vol: 0.18 }); tone(73, 0.5, { vol: 0.08 }); },
    // A find turned over: the flick of the paper, then the face landing.
    flip: function () { noise(0.035, { filter: 'highpass', freq: 3000, vol: 0.10 }); noise(0.05, { filter: 'bandpass', freq: 1800, q: 0.8, vol: 0.08, delay: 0.18 }); tone(260, 0.06, { vol: 0.04, delay: 0.18 }); },
    // A find that names someone, or carries a confession: a low note under the face.
    discovery: function () { tone(110, 0.9, { vol: 0.07 }); tone(165, 0.9, { vol: 0.04, delay: 0.04 }); },
    // A verb asks for a card: two knocks at the door.
    knock: function () { [0, 0.16].forEach(function (d) { noise(0.04, { freq: 700, q: 3, vol: 0.22, delay: d }); tone(180, 0.05, { to: 120, vol: 0.12, delay: d }); }); },
    // Wax pressed down: a choice answered, a rank sealed.
    seal: function () { noise(0.06, { filter: 'lowpass', freq: 600, vol: 0.2 }); tone(196, 0.18, { vol: 0.08 }); },
    // A new office: the tower bell, then two soft notes.
    office: function () { bell(147, 3, { vol: 0.09 }); tone(220, 0.9, { type: 'triangle', vol: 0.06, delay: 0.4, lp: 1400 }); tone(294, 1.1, { type: 'triangle', vol: 0.06, delay: 0.7, lp: 1400 }); },
    // The verdict: the gavel twice as the stamp comes down (its 60% point), then the bell for the condemned, the
    // crowd's murmur for a man let go.
    gavel: function () { gavel(); },
    convict: function () { gavel(); bell(110, 2.8, { vol: 0.10, delay: 0.5 }); },
    acquit: function () { gavel(); noise(1.4, { filter: 'bandpass', freq: 600, q: 0.5, vol: 0.06, attack: 0.4, delay: 0.5 }); },
    defeat: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 1.1, { type: 'triangle', vol: 0.12, delay: i * 0.18, lp: 1200 }); }); },
  };

  // One cue at a time: the same cue does not repeat inside its gap, and a
  // lesser cue gives way to a greater one started a moment before.
  var MIN_GAP = { gavel: 1.0, convict: 1.0, acquit: 1.0, complete: 0.7, drop: 0.06, click: 0.05, start: 0.25, case: 1.0, danger: 1.5, omen: 1.5, heartbeat: 4.0, knock: 1.0, page: 0.4, flip: 0.05, discovery: 0.5, seal: 0.2, coin: 0.07, pick: 0.05 };
  var PRIORITY = { gavel: 5, convict: 5, acquit: 5, victory: 5, defeat: 5, office: 5, week: 4, danger: 4, omen: 3, heartbeat: 3, case: 3, complete: 2, knock: 2, seal: 2, discovery: 2, page: 1, start: 1, drop: 1, flip: 1, pick: 0, click: 0 };
  // A quiet cue is heard only alone.
  var QUIET = { page: 1 };
  var lastAt = {}, top = { p: -1, at: -1 };
  A.allow = function (name, now) {
    var gap = MIN_GAP[name] || 0, p = PRIORITY[name] || 0;
    if (lastAt[name] !== undefined && now - lastAt[name] < gap) return false;
    if (QUIET[name] && top.at >= 0 && now - top.at < 0.3) return false;
    if (top.at >= 0 && now - top.at < 0.3 && p < top.p) return false;
    lastAt[name] = now;
    if (!(top.at >= 0 && now - top.at < 0.3) || p >= top.p) { top.p = p; top.at = now; }
    return true;
  };
  A.reset = function () { lastAt = {}; top = { p: -1, at: -1 }; };
  // opts.vol scales the cue (the busy 'complete' at a fast clock).
  A.play = function (name, opts) {
    if (!A.ready || !SOUNDS[name]) return false;
    if (!A.allow(name, A.ctx.currentTime)) return false;
    volScale = opts && opts.vol > 0 ? opts.vol : 1;
    try { SOUNDS[name](); } catch (err) { /* ignore audio errors */ }
    volScale = 1;
    return true;
  };

  // --- Music: a slow Am9 - Fmaj7 - Dm9 - E7 pad, with soft rain under it.
  var CHORDS = [[110, 164.8, 196, 261.6, 246.9], [87.3, 130.8, 164.8, 220, 261.6], [73.4, 146.8, 174.6, 220, 329.6], [82.4, 123.5, 146.8, 207.7, 293.7]];
  function padChord() {
    if (!A.ready || A.ctx.state !== 'running') return;
    var c = A.ctx, t = c.currentTime;
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(900, t + 4);
    f.frequency.linearRampToValueAtTime(450, t + 9);
    f.connect(musicBus);
    CHORDS[chordIdx % CHORDS.length].forEach(function (freq, i) {
      [0, 4].forEach(function (detune) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = freq;
        o.detune.value = detune * (i % 2 ? 1 : -1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.18 : 0.06, t + 2.5);
        g.gain.linearRampToValueAtTime(0.0001, t + 10);
        o.connect(g); g.connect(f);
        o.start(t); o.stop(t + 10.2);
      });
    });
    chordIdx++;
  }
  function rain() {
    var c = A.ctx;
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start();
  }
  var raining = false;
  function startMusic() {
    if (!A.ready || A.ctx.state !== 'running') return;
    if (!raining) { rain(); raining = true; }
    if (musicTimer) return;
    padChord();
    musicTimer = setInterval(padChord, 8000);
  }

  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, A.unlock, { capture: true }); });
})();
