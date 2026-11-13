// Motor de audio: sintetiza bajo, batería y acordes con Web Audio y los
// programa con antelación para que el ritmo sea estable.

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// Muestras de instrumentos reales (ver audio/CREDITS.md). Si no se pueden cargar,
// cada voz usa el sintetizador de respaldo.
const SAMPLES = {
  bass: { E1: 28, G1: 31, Bb1: 34, Db2: 37, E2: 40, G2: 43, Bb2: 46, Db3: 49, E3: 52, G3: 55 },
  keys: { E3: 52, G3: 55, Bb3: 58, Db4: 61, E4: 64 },
  drums: ['kick1', 'kick2', 'snare1', 'snare2', 'rim1', 'hat1', 'hat2', 'hat3',
    'hatsoft1', 'hatsoft2', 'ohat1', 'ohat2', 'ride1', 'ride2'],
};
// Nivel de pico al que se normaliza cada tipo de muestra
const LEVEL = { bass: .48, keys: .12, kick: .72, snare: .5, rim: .34, hat: .16, hatsoft: .09, ohat: .16, ride: .15 };
const FILES = [
  ...Object.keys(SAMPLES.bass).map(n => ({ kind: 'bass', name: n, midi: SAMPLES.bass[n], url: `audio/bass/${n}.mp3` })),
  ...Object.keys(SAMPLES.keys).map(n => ({ kind: 'keys', name: n, midi: SAMPLES.keys[n], url: `audio/keys/${n}.mp3` })),
  ...SAMPLES.drums.map(n => ({ kind: n.replace(/\d+$/, ''), name: n, url: `audio/drums/${n}.mp3` })),
];

export class Engine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.tempo = 100;
    this.swing = false;
    this.loop = true;
    this.countIn = true;
    this.vol = { bass: .9, drums: .7, chords: .5 };
    this.muteBass = false;
    this.events = [];
    this.total = 16;
    this.onEnd = null;
    this.onLoop = null;
    this.kit = {};       // muestras decodificadas, por tipo
    this.rr = {};        // contadores para alternar golpes (round robin)
    this.loading = null; this.decoding = null;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = .9;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.decoding = this.decode();
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx;
  }

  /** Descarga las muestras (se puede llamar antes de que el usuario pulse nada). */
  preload() {
    if (!this.loading) {
      this.loading = Promise.all(FILES.map(async f => {
        try {
          const r = await fetch(f.url);
          if (!r.ok) return null;
          return { ...f, data: await r.arrayBuffer() };
        } catch (e) { return null; }
      })).then(list => list.filter(Boolean));
    }
    return this.loading;
  }
  async decode() {
    const files = await this.preload();
    await Promise.all(files.map(f => new Promise(done => {
      const ok = buffer => {
        if (buffer) {
          // nivel de pico y primer instante con sonido (los mp3 traen un pequeño silencio inicial)
          let peak = 0;
          const ch = buffer.getChannelData(0);
          for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
          let i = 0;
          while (i < ch.length && Math.abs(ch[i]) < peak * .02) i++;
          const s = { buffer, midi: f.midi, start: Math.max(0, i - 48) / buffer.sampleRate, gain: LEVEL[f.kind] / (peak || 1) };
          (this.kit[f.kind] = this.kit[f.kind] || []).push(s);
        }
        done();
      };
      try {
        const p = this.ctx.decodeAudioData(f.data.slice(0), ok, () => done());
        if (p && p.catch) p.catch(() => done());
      } catch (e) { done(); }
    })));
    for (const k of ['bass', 'keys']) if (this.kit[k]) this.kit[k].sort((a, b) => a.midi - b.midi);
  }
  /** Se resuelve cuando las muestras están listas (o tras un tiempo de espera). */
  ready(timeout = 2500) {
    this.init();
    return Promise.race([this.decoding, new Promise(r => setTimeout(r, timeout))]);
  }
  next(kind) {
    const list = this.kit[kind];
    if (!list || !list.length) return null;
    this.rr[kind] = ((this.rr[kind] || 0) + 1) % list.length;
    return list[this.rr[kind]];
  }
  nearest(kind, midi) {
    const list = this.kit[kind];
    if (!list || !list.length) return null;
    return list.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
  }
  /** Reproduce una muestra con afinación, volumen y duración dados. */
  sample(s, t, dest, { rate = 1, gain = 1, dur = null, release = .05 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(s.gain * gain, t);
    let end = t + (s.buffer.duration - s.start) / rate;
    if (dur !== null && t + dur + release * 5 < end) {
      g.gain.setTargetAtTime(0, t + dur, release);
      end = t + dur + release * 6;
    }
    src.connect(g).connect(dest);
    src.start(t, s.start);
    src.stop(end + .02);
    return g;
  }

  // --- tiempo musical <-> segundos (con swing atresillado opcional) ---
  T(b) {
    const f = Math.floor(b), r = b - f;
    const s = this.swing ? (r < .5 ? r * 4 / 3 : 2 / 3 + (r - .5) * 2 / 3) : r;
    return (f + s) * 60 / this.tempo;
  }
  Tinv(t) {
    const x = t * this.tempo / 60, f = Math.floor(x), s = x - f;
    return f + (this.swing ? (s < 2 / 3 ? s * .75 : .5 + (s - 2 / 3) * 1.5) : s);
  }
  absBeat() { return this.Tinv(this.ctx.currentTime - this.t0); }

  start() {
    this.init();
    this.stop(true);
    const now = this.ctx.currentTime;
    this.sess = this.ctx.createGain();
    this.sess.connect(this.master);
    this.bus = {};
    for (const k of ['bass', 'drums', 'chords']) {
      this.bus[k] = this.ctx.createGain();
      this.bus[k].connect(this.sess);
    }
    this.applyVol();
    const startAbs = this.countIn ? -4 : 0;
    this.t0 = now + .12 - this.T(startAbs);
    for (let b = startAbs; b < 0; b++) this.click(this.t0 + this.T(b), b === startAbs);
    this.idx = 0; this.loopN = 0;
    this.playing = true;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop(silent) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const s = this.sess, now = this.ctx.currentTime;
    s.gain.setTargetAtTime(0, now, .015);
    setTimeout(() => s.disconnect(), 200);
    if (!silent && this.onEnd) this.onEnd();
  }

  tick() {
    if (!this.events.length) return;
    const now = this.ctx.currentTime, horizon = now + .15;
    let endAbs = null;
    for (;;) {
      if (this.idx >= this.events.length) {
        if (!this.loop) { endAbs = (this.loopN + 1) * this.total; break; }
        this.idx = 0; this.loopN++;
        if (this.onLoop) this.onLoop(this.loopN);
      }
      const ev = this.events[this.idx];
      const abs = this.loopN * this.total + ev.beat;
      const t = this.t0 + this.T(abs);
      if (t > horizon) break;
      this.fire(ev, Math.max(t, now), this.T(abs + ev.dur) - this.T(abs));
      this.idx++;
    }
    if (endAbs !== null && now > this.t0 + this.T(endAbs)) this.stop();
  }

  /** Posición actual: tiempo dentro de la vuelta (negativo durante la cuenta atrás). */
  position() {
    if (!this.playing) return null;
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    const abs = this.Tinv(this.ctx.currentTime - lat - this.t0);
    return abs < 0 ? abs : abs % this.total;
  }

  retime(fn) {
    if (!this.playing) return fn();
    const cur = this.absBeat();
    fn();
    this.t0 = this.ctx.currentTime - this.T(cur);
  }
  /** Cambia el tempo justo en el tiempo absoluto indicado (p. ej. al empezar una vuelta). */
  changeTempoAt(bpm, abs) {
    const at = this.t0 + this.T(abs);
    this.tempo = bpm;
    this.t0 = at - this.T(abs);
  }
  setTempo(bpm) { this.retime(() => { this.tempo = bpm; }); }

  setSong(events, total, swing) {
    if (this.playing && total !== this.total) this.stop();
    this.retime(() => { this.swing = swing; });
    this.events = events; this.total = total;
    if (this.playing) {
      const cur = this.absBeat();
      if (cur < 0) { this.idx = 0; this.loopN = 0; return; }
      this.loopN = Math.floor(cur / total);
      const at = cur % total + .2 * this.tempo / 60;
      this.idx = events.findIndex(e => e.beat >= at);
      if (this.idx < 0) this.idx = events.length;
    }
  }

  applyVol() {
    if (!this.bus) return;
    this.bus.bass.gain.value = this.muteBass ? 0 : this.vol.bass;
    this.bus.drums.gain.value = this.vol.drums;
    this.bus.chords.gain.value = this.vol.chords;
  }

  fire(ev, t, dur) {
    switch (ev.type) {
      case 'bass': return this.bass(t, dur, ev.midi, this.bus.bass);
      case 'chord': return this.chord(t, dur, ev.midis);
      default: return this.drum(ev.type, t, ev.vel);
    }
  }

  env(t, peak, attack, hold, release, dest) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * .7, t + attack, .12);
    g.gain.setTargetAtTime(0, t + Math.max(attack, hold), release);
    g.connect(dest);
    return g;
  }
  osc(type, f, t, end, dest, gain = 1) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    const g = this.ctx.createGain(); g.gain.value = gain;
    o.connect(g).connect(dest);
    o.start(t); o.stop(end);
    return o;
  }

  drum(type, t, vel = 1) {
    const kind = type === 'hat' && vel < 1 ? 'hatsoft' : type;
    const s = this.next(kind) || (kind === 'hatsoft' ? this.next('hat') : null);
    if (!s) {
      switch (type) {
        case 'kick': return this.kick(t);
        case 'snare': return this.snare(t);
        case 'rim': return this.rim(t);
        case 'hat': return this.hat(t, .045, .22 * vel, 7500);
        case 'ohat': return this.hat(t, .16, .2, 7000);
        case 'ride': return this.hat(t, .28, .11 * vel, 5200);
      }
      return;
    }
    // un charles nuevo corta el charles abierto anterior, como en una batería real
    if ((type === 'hat' || type === 'ohat') && this.openHat) {
      this.openHat.gain.cancelScheduledValues(t);
      this.openHat.gain.setTargetAtTime(0, t, .012);
      this.openHat = null;
    }
    const human = .9 + Math.random() * .2;
    const g = this.sample(s, t, this.bus.drums, { gain: human * (type === 'ride' ? .75 + .25 * vel : 1) });
    if (type === 'ohat') this.openHat = g;
  }

  bass(t, dur, midi, dest) {
    const s = this.nearest('bass', midi);
    if (!s) return this.bassSynth(t, dur, midi, dest);
    this.sample(s, t, dest, { rate: Math.pow(2, (midi - s.midi) / 12), dur: Math.max(.08, dur * .96), release: .035 });
  }
  bassSynth(t, dur, midi, dest) {
    const f = hz(midi), end = t + dur + .3;
    const out = this.env(t, .8, .008, dur * .9, .03, dest);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.setTargetAtTime(380, t, .09);
    lp.connect(out);
    this.osc('sawtooth', f, t, end, lp, .4);
    this.osc('sine', f, t, end, out, .6);
    this.osc('triangle', f * 2, t, end, lp, .3); // armónico para altavoces pequeños
  }
  /** Nota suelta (afinador, juego del diapasón). */
  pluck(midi, dur = 1) { this.init(); this.bass(this.ctx.currentTime + .02, dur, midi, this.master); }

  chord(t, dur, midis) {
    if (this.kit.keys && this.kit.keys.length) {
      midis.forEach((m, i) => {
        const s = this.nearest('keys', m);
        // las notas entran escalonadas unos milisegundos, como al tocar un acorde con la mano
        this.sample(s, t + i * .006, this.bus.chords, { rate: Math.pow(2, (m - s.midi) / 12), dur: Math.max(.12, dur * .9), release: .07 });
      });
      return;
    }
    this.chordSynth(t, dur, midis);
  }
  chordSynth(t, dur, midis) {
    const out = this.env(t, .11, .012, dur * .85, .05, this.bus.chords);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2000;
    lp.connect(out);
    for (const m of midis) {
      this.osc('triangle', hz(m), t, t + dur + .4, lp);
      this.osc('sawtooth', hz(m) * 1.003, t, t + dur + .4, lp, .18);
    }
  }

  noiseHit(t, decay, gain, type, freq, q = .7) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.001, t + decay);
    src.connect(f).connect(g).connect(this.bus.drums);
    src.start(t, Math.random() * .5); src.stop(t + decay + .02);
  }
  tone(t, type, f0, f1, decay, gain, dest) {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay * .6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(.001, t + decay);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + decay + .02);
  }
  kick(t) { this.tone(t, 'sine', 150, 45, .26, 1, this.bus.drums); }
  snare(t) {
    this.noiseHit(t, .17, .5, 'highpass', 1500);
    this.tone(t, 'triangle', 220, 170, .09, .45, this.bus.drums);
  }
  rim(t) {
    this.noiseHit(t, .035, .5, 'bandpass', 1800, 4);
    this.tone(t, 'square', 820, 800, .03, .18, this.bus.drums);
  }
  hat(t, decay, gain, freq) { this.noiseHit(t, decay, gain, 'highpass', freq); }
  click(t, accent) { this.tone(t, 'square', accent ? 1600 : 1100, accent ? 1600 : 1100, .05, .25, this.sess); }
}
