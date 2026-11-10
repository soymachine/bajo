// Afinador: tonos de referencia y detección de tono por micrófono (algoritmo YIN).
import { OPEN, noteName } from './theory.js';

/** Devuelve la frecuencia fundamental en Hz, o null si no hay señal clara. */
export function detectPitch(buf, sr) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < .008) return null;
  const maxLag = Math.floor(sr / 28), minLag = Math.floor(sr / 420);
  const W = n - maxLag;
  if (W < maxLag) return null;
  const d = new Float32Array(maxLag + 1);
  let sum = 0, tau = -1;
  for (let t = 1; t <= maxLag; t++) {
    let s = 0;
    for (let i = 0; i < W; i += 2) { const x = buf[i] - buf[i + t]; s += x * x; }
    sum += s;
    d[t] = sum ? s * t / sum : 1;
  }
  for (let t = minLag; t < maxLag; t++) {
    if (d[t] < .12) {
      while (t + 1 < maxLag && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const shift = a + c - 2 * b ? (a - c) / (2 * (a + c - 2 * b)) : 0;
  return sr / (tau + shift);
}

export function initTuner(root, engine, getLatin) {
  const $ = s => root.querySelector(s);
  const strings = [...OPEN].reverse(); // Mi La Re Sol
  const btns = $('#tunerStrings');
  const mk = () => {
    btns.innerHTML = '';
    strings.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'string-btn';
      b.innerHTML = `<small>${4 - i}ª cuerda</small><b>${noteName(m, false, getLatin())}</b>`;
      b.onclick = () => { engine.pluck(m, 2.5); engine.pluck(m + 12, 2.5); }; // con octava: se oye en altavoces pequeños
      btns.appendChild(b);
    });
  };
  mk();

  let stream = null, raf = 0, analyser, data, hist = [];
  const needle = $('#needle'), out = $('#tunerNote'), msg = $('#tunerMsg'), cents = $('#tunerCents'), mic = $('#micBtn');

  function loop() {
    raf = requestAnimationFrame(loop);
    analyser.getFloatTimeDomainData(data);
    const f = detectPitch(data, engine.ctx.sampleRate);
    if (!f) { if (hist.length) hist.shift(); if (!hist.length) root.classList.remove('hearing'); return; }
    hist.push(f); if (hist.length > 5) hist.shift();
    const med = [...hist].sort((a, b) => a - b)[hist.length >> 1];
    const midi = 69 + 12 * Math.log2(med / 440);
    // cuerda al aire más cercana (ignorando la octava)
    let best = strings[0], off = 99;
    for (const s of strings) {
      let d = (midi - s) % 12; if (d > 6) d -= 12; if (d < -6) d += 12;
      if (Math.abs(d) < Math.abs(off)) { off = d; best = s; }
    }
    const c = Math.round(off * 100), cl = Math.max(-50, Math.min(50, c));
    root.classList.add('hearing');
    needle.style.transform = `rotate(${cl * .9}deg)`;
    out.textContent = noteName(best, false, getLatin());
    cents.textContent = (c > 0 ? '+' : '') + c + ' cents';
    const ok = Math.abs(c) <= 5;
    root.classList.toggle('intune', ok);
    msg.textContent = ok ? '¡Afinada!' : c < 0 ? 'Baja: aprieta la clavija ↑' : 'Alta: afloja la clavija ↓';
  }

  mic.onclick = async () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop()); stream = null;
      cancelAnimationFrame(raf);
      mic.textContent = 'Activar micrófono';
      root.classList.remove('hearing', 'intune');
      msg.textContent = 'Micrófono apagado';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = engine.init();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      data = new Float32Array(analyser.fftSize);
      ctx.createMediaStreamSource(stream).connect(analyser);
      mic.textContent = 'Apagar micrófono';
      msg.textContent = 'Toca una cuerda al aire…';
      loop();
    } catch (e) {
      msg.textContent = 'No se pudo acceder al micrófono. Revisa los permisos del navegador.';
    }
  };
  return { refresh: mk };
}
