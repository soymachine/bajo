// Motor de audio: sintetiza bajo, batería y acordes con Web Audio y los
// programa con antelación para que el ritmo sea estable.

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

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
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx;
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
      case 'kick': return this.kick(t);
      case 'snare': return this.snare(t);
      case 'rim': return this.rim(t);
      case 'hat': return this.hat(t, .045, .22 * ev.vel, 7500);
      case 'ohat': return this.hat(t, .16, .2, 7000);
      case 'ride': return this.hat(t, .28, .11 * ev.vel, 5200);
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

  bass(t, dur, midi, dest) {
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
