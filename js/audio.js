// Sound, synthesized with WebAudio so the game ships no audio files.
// Effects are short envelopes on oscillators and noise; the music is a slow
// minor-key pad over rain-like noise, muffled under menus and darker under danger.
(function () {
  var CF = window.CF;
  var A = (CF.Audio = { ctx: null, ready: false });
  var volScale = 1;
  var master, limiter, musicBus, sfxBus, noiseBuf, rainBuf, musicTimer = null, chordIdx = 0;
  // The pad's road to the master: a lowpass that closes while the game is paused or under a menu (hush), then
  // a gain that the hush lowers and a stinger ducks.
  var hushF, duckG, hushed = false, duckUntil = 0, halted = false;

  // Browsers only allow audio after a user gesture.
  A.unlock = function () {
    if (A.ready) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain();
    musicBus = A.ctx.createGain();
    sfxBus = A.ctx.createGain();
    hushF = A.ctx.createBiquadFilter();
    hushF.type = 'lowpass'; hushF.frequency.value = 20000;
    duckG = A.ctx.createGain();
    musicBus.connect(hushF); hushF.connect(duckG); duckG.connect(master);
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
    // The rain's own seven seconds, so its loop is not heard as a loop.
    rainBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 7, A.ctx.sampleRate);
    var rd = rainBuf.getChannelData(0);
    for (var j = 0; j < rd.length; j++) rd[j] = Math.random() * 2 - 1;
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

  // A church bell for the week: the hum an octave down, the prime, the minor tierce, the quint, the nominal and
  // the superquint, each a sine dying on its own, under a lowpass. opts.cents detunes the upper partials apart
  // (a cracked bell); opts.decay shortens it.
  var CHURCH = [[0.5, 0.5, 1], [1, 0.35, 0.8], [1.19, 0.25, 0.65], [1.5, 0.15, 0.5], [2, 0.3, 0.4], [3, 0.1, 0.2]];
  function churchBell(freq, dur, opts) {
    opts = opts || {};
    var vol = opts.vol || 0.1, delay = opts.delay || 0, cents = opts.cents || 0, decay = opts.decay || 1;
    CHURCH.forEach(function (p, i) {
      var f = freq * p[0] * (cents && i > 1 ? Math.pow(2, (i % 2 ? cents : -cents) / 1200) : 1);
      tone(f, dur * p[2] * decay, { vol: vol * p[1], delay: delay, attack: 0.004, lp: 2500 });
    });
  }

  function gavel() {
    [0, 0.22].forEach(function (d) {
      noise(0.05, { filter: 'lowpass', freq: 420, q: 0.7, vol: 0.35, delay: d });
      tone(150, 0.09, { to: 70, vol: 0.3, delay: d });
    });
  }

  var COMPLETE_VOICE = { arrest: { type: 'triangle', dur: 0.9 }, interrogate: { type: 'triangle', dur: 0.9 }, reflect: { type: 'sine', dur: 1.6 } };
  var SOUNDS = {
    pick: function () { noise(0.05, { freq: 3500, vol: 0.12 }); tone(900, 0.05, { type: 'triangle', vol: 0.05 }); },
    drop: function () { tone(170, 0.12, { to: 90, vol: 0.25 }); noise(0.08, { freq: 900, vol: 0.08 }); },
    click: function () { tone(1400, 0.04, { type: 'square', vol: 0.03, lp: 3000 }); },
    start: function () { tone(196, 0.25, { type: 'triangle', vol: 0.18 }); tone(294, 0.35, { type: 'triangle', vol: 0.14, delay: 0.09 }); },
    // A verb's work done: the upper voice of the chord the pad is sounding, an octave up, so the most frequent cue in
    // the game always lands in the music; Court and Question in a reed's triangle, Rest a long sine, the rest a short
    // one. The Bell has its toll instead.
    complete: function (o) {
      var verb = o && o.verb;
      if (verb === 'time') return;
      var f = A.completeNote(), v = COMPLETE_VOICE[verb] || { type: 'sine', dur: 0.9 };
      tone(f, v.dur, { type: v.type, vol: 0.09, lp: v.type === 'triangle' ? 2400 : 0 });
      tone(f * 2, v.dur * 0.8, { vol: 0.025, delay: 0.04 });
    },
    case: function () { noise(0.03, { freq: 4000, vol: 0.2 }); noise(0.03, { freq: 4000, vol: 0.2, delay: 0.09 }); tone(1760, 0.7, { vol: 0.1, delay: 0.18 }); },
    danger: function () { tone(110, 0.8, { type: 'sawtooth', vol: 0.16, lp: 600 }); tone(116.5, 0.8, { type: 'sawtooth', vol: 0.14, lp: 600 }); },
    // The Bell tolls the week: short and quiet, since it comes every minute of play.
    week: function () { churchBell(196, 2.5, { vol: 0.08 }); },
    // A week you could not pay: the same bell, cracked: its partials pulled apart, half the ring, a dull knock.
    weekUnpaid: function () { churchBell(196, 2.5, { vol: 0.08, cents: 15, decay: 0.5 }); noise(0.08, { filter: 'lowpass', freq: 500, vol: 0.1 }); },
    // A Coin taken or paid: a small bright ring.
    coin: function () { tone(2350, 0.08, { type: 'triangle', vol: 0.05 }); tone(3720, 0.06, { vol: 0.03, delay: 0.01 }); },
    // A meter crossing into a new word: two soft notes, falling where it hurts, rising where it helps.
    meterWorse: function () { tone(330, 0.22, { type: 'triangle', vol: 0.05 }); tone(311, 0.3, { type: 'triangle', vol: 0.05, delay: 0.12 }); },
    meterBetter: function () { tone(294, 0.2, { vol: 0.05 }); tone(392, 0.3, { vol: 0.05, delay: 0.1 }); },
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
    // A drop the verb will not take: a dull falling knock, a muffled scuff.
    refuse: function () { tone(140, 0.12, { type: 'triangle', to: 110, vol: 0.10, lp: 800 }); noise(0.05, { filter: 'lowpass', freq: 400, vol: 0.08 }); },
    // Wax pressed down: a choice answered, a rank sealed.
    seal: function () { noise(0.06, { filter: 'lowpass', freq: 600, vol: 0.2 }); tone(196, 0.18, { vol: 0.08 }); },
    // A new office: the tower bell, then two soft notes.
    office: function () { bell(147, 3, { vol: 0.09 }); tone(220, 0.9, { type: 'triangle', vol: 0.06, delay: 0.4, lp: 1400 }); tone(294, 1.1, { type: 'triangle', vol: 0.06, delay: 0.7, lp: 1400 }); },
    // The verdict: the gavel twice as the stamp comes down (its 60% point), then the bell for the condemned, the
    // crowd's murmur for a man let go.
    gavel: function () { gavel(); },
    convict: function () { gavel(); bell(110, 2.8, { vol: 0.10, delay: 0.5 }); },
    acquit: function () { gavel(); noise(1.4, { filter: 'bandpass', freq: 600, q: 0.5, vol: 0.06, attack: 0.4, delay: 0.5 }); },
    // An ability lost for good: a low note falling an octave, the paper catching under it.
    loss: function () { tone(220, 1.2, { to: 110, type: 'triangle', vol: 0.12, lp: 900 }); noise(0.6, { filter: 'lowpass', freq: 500, vol: 0.05 }); },
    defeat: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 1.1, { type: 'triangle', vol: 0.12, delay: i * 0.18, lp: 1200 }); }); },
  };

  // One cue at a time: the same cue does not repeat inside its gap, and a
  // lesser cue gives way to a greater one started a moment before.
  var MIN_GAP = { loss: 1.0, week: 1.0, weekUnpaid: 1.0, meterWorse: 0.8, meterBetter: 0.8, gavel: 1.0, convict: 1.0, acquit: 1.0, complete: 0.7, drop: 0.06, click: 0.05, start: 0.25, case: 1.0, danger: 1.5, omen: 1.5, heartbeat: 4.0, knock: 1.0, refuse: 0.15, page: 0.4, flip: 0.05, discovery: 0.5, seal: 0.2, coin: 0.07, pick: 0.05 };
  var PRIORITY = { loss: 4, gavel: 5, convict: 5, acquit: 5, victory: 5, defeat: 5, office: 5, week: 4, weekUnpaid: 4, meterWorse: 1, meterBetter: 1, coin: 0, danger: 4, omen: 3, heartbeat: 3, case: 3, complete: 2, knock: 2, refuse: 1, seal: 2, discovery: 2, page: 1, start: 1, drop: 1, flip: 1, pick: 0, click: 0 };
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
  // A stinger (the ending's, the office's) is heard over the pad, not against it: the pad drops away for three seconds.
  var STINGERS = { victory: 1, defeat: 1, office: 1 };
  A.play = function (name, opts) {
    if (!A.ready || !SOUNDS[name]) return false;
    if (!A.allow(name, A.ctx.currentTime)) return false;
    volScale = opts && opts.vol > 0 ? opts.vol : 1;
    try { SOUNDS[name](opts); if (STINGERS[name]) A.duck(3); } catch (err) { /* ignore audio errors */ }
    volScale = 1;
    return true;
  };

  // The pad's level after the hush and the duck: x0.6 hushed, x0.3 under a stinger.
  function padLevel() {
    if (!duckG) return;
    var t = A.ctx.currentTime, g = (hushed ? 0.6 : 1) * (t < duckUntil ? 0.3 : 1);
    duckG.gain.setTargetAtTime(g, t, t < duckUntil ? 0.08 : 0.4);
    if (t < duckUntil) duckG.gain.setTargetAtTime(hushed ? 0.6 : 1, duckUntil, 0.6);
  }
  A.duck = function (sec) {
    if (!A.ready) return;
    duckUntil = A.ctx.currentTime + (sec || 3);
    padLevel();
  };
  // Paused, or a menu over the table: the pad goes muffled and a little quieter, and comes back as it was.
  A.hush = function (on) {
    on = !!on;
    if (!A.ready || on === hushed) return;
    hushed = on;
    hushF.frequency.setTargetAtTime(on ? 420 : 20000, A.ctx.currentTime, 0.4);
    padLevel();
  };
  // The ending: the pad stops and the stinger rings alone; a new game starts it again.
  A.music = function (on) {
    halted = !on;
    if (!A.ready) return;
    if (halted) { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } stopDrone(); }
    else startMusic();
  };

  // --- Music: a slow minor-key pad, with soft rain under it. Three calm progressions, one picked at the end of
  // each phrase of four chords; under danger (mood 1) a darker one, the filter kept lower; under the worst (mood 2)
  // a low drone that breathes. Each chord: the bass, then four upper voices; the fourth voice is the finish's note.
  var AM9 = [110, 164.8, 196, 261.6, 246.9], FMAJ7 = [87.3, 130.8, 164.8, 220, 261.6], DM9 = [73.4, 146.8, 174.6, 220, 329.6],
    E7 = [82.4, 123.5, 146.8, 207.7, 293.7], CMAJ7 = [65.4, 196, 246.9, 261.6, 329.6];
  var PROGRESSIONS = [[AM9, FMAJ7, DM9, E7], [AM9, DM9, FMAJ7, E7], [AM9, CMAJ7, FMAJ7, E7]];
  // Am, B-flat maj7, Am, E7 with the flat ninth.
  var DARK = [[110, 164.8, 220, 261.6, 329.6], [116.5, 174.6, 220, 293.7, 349.2], [110, 164.8, 220, 261.6, 329.6], [82.4, 207.7, 293.7, 246.9, 349.2]];
  var prog = PROGRESSIONS[0], lastChord = null, mood = 0, calmSince = 0, drone = null;
  // The chord now sounding is the one padChord last started: its upper voice, doubled. Before any, the phrase's last.
  A.completeNote = function () { return (lastChord || prog[prog.length - 1])[3] * 2; };
  A.mood = function (n, now) {
    n = Math.max(0, Math.min(2, n | 0));
    now = now === undefined ? (A.ctx ? A.ctx.currentTime : 0) : now;
    // Danger is heard at once; calm comes back only after twenty seconds of it.
    if (n >= mood) { mood = n; calmSince = now; }
    else if (now - calmSince >= 20) { mood = n; calmSince = now; }
    if (A.ready && !halted) { if (mood >= 2) startDrone(); else stopDrone(); }
    return mood;
  };
  function startDrone() {
    if (drone || A.ctx.state !== 'running') return;
    var c = A.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    o.type = 'sine'; o.frequency.value = 55;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.04, t + 3);
    lfo.frequency.value = 0.2; depth.gain.value = 0.015;
    lfo.connect(depth); depth.connect(g.gain);
    o.connect(g); g.connect(musicBus);
    o.start(t); lfo.start(t);
    drone = { o: o, g: g, lfo: lfo };
  }
  function stopDrone() {
    if (!drone || !A.ctx) return;
    var t = A.ctx.currentTime, d = drone;
    drone = null;
    d.g.gain.setTargetAtTime(0.0001, t, 1);
    d.o.stop(t + 5); d.lfo.stop(t + 5);
  }
  function padChord() {
    if (!A.ready || A.ctx.state !== 'running') return;
    var c = A.ctx, t = c.currentTime;
    // A phrase ends: the next one picks its progression.
    if (chordIdx % 4 === 0) prog = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
    var set = mood >= 1 ? DARK : prog, peak = mood >= 1 ? 650 : 900;
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(peak, t + 4);
    f.frequency.linearRampToValueAtTime(450, t + 9);
    f.connect(musicBus);
    lastChord = set[chordIdx % set.length];
    lastChord.forEach(function (freq, i) {
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
  // The rain: seven seconds of noise in two layers that loop at different lengths (seven seconds and five and a
  // third), through two bands, under a slow swell of a third either way, so no turn of the loop is heard.
  function rain() {
    var c = A.ctx, g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    g.gain.value = 1;
    [[1200, 0], [1700, 5.3]].forEach(function (b) {
      var s = c.createBufferSource(), f = c.createBiquadFilter(), lg = c.createGain();
      s.buffer = rainBuf; s.loop = true;
      if (b[1]) { s.loopStart = 0; s.loopEnd = b[1]; }
      f.type = 'bandpass'; f.frequency.value = b[0]; f.Q.value = 0.4;
      lg.gain.value = 0.03;
      s.connect(f); f.connect(lg); lg.connect(g);
      s.start();
    });
    lfo.frequency.value = 0.05; depth.gain.value = 0.3;
    lfo.connect(depth); depth.connect(g.gain);
    lfo.start();
    g.connect(musicBus);
  }
  // The week turns: the pad goes back to its first chord, so the tonic lands under the toll.
  A.downbeat = function () {
    chordIdx = 0;
    if (!musicTimer || !A.ready || A.ctx.state !== 'running') return;
    clearInterval(musicTimer);
    padChord();
    musicTimer = setInterval(padChord, 8000);
  };
  var raining = false;
  function startMusic() {
    if (!A.ready || A.ctx.state !== 'running') return;
    if (!raining) { rain(); raining = true; }
    if (musicTimer || halted) return;
    padChord();
    musicTimer = setInterval(padChord, 8000);
  }

  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, A.unlock, { capture: true }); });
})();
