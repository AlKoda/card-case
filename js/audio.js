// Sound, synthesized with WebAudio so the game ships no audio files.
// Effects are short envelopes on oscillators and noise; the music is a slow
// minor-key pad over rain-like noise.
(function () {
  var CF = window.CF;
  var A = (CF.Audio = { ctx: null, ready: false });
  var master, musicBus, sfxBus, noiseBuf, musicTimer = null, chordIdx = 0;

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
    master.connect(A.ctx.destination);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    A.apply(CF.Settings.values);
    startMusic();
  };

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
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.3, t + (opts.attack || 0.005));
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
    g.gain.setValueAtTime(opts.vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(t);
    s.stop(t + dur + 0.05);
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
    defeat: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 1.1, { type: 'triangle', vol: 0.12, delay: i * 0.18, lp: 1200 }); }); },
  };

  A.play = function (name) {
    if (!A.ready || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (err) { /* ignore audio errors */ }
  };

  // --- Music: a slow Am9 - Fmaj7 - Dm9 - E7 pad, with soft rain under it.
  var CHORDS = [[110, 164.8, 196, 261.6, 246.9], [87.3, 130.8, 164.8, 220, 261.6], [73.4, 146.8, 174.6, 220, 329.6], [82.4, 123.5, 146.8, 207.7, 293.7]];
  function padChord() {
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
  function startMusic() {
    if (musicTimer) return;
    rain();
    padChord();
    musicTimer = setInterval(padChord, 8000);
  }

  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, A.unlock, { capture: true }); });
})();
