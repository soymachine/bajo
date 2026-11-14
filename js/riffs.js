// «Mis riffs»: líneas de bajo escritas a mano en una cuadrícula tipo tablatura.
// Se guardan solo en el navegador (localStorage), nunca en el repositorio.
import { parseProgression, STYLES, ROLES } from './generator.js';
import { OPEN, pretty } from './theory.js';

const MAX_FRET = 12;
const STRINGS = ['Sol', 'Re', 'La', 'Mi'];
const WRITTEN = [4, 3, 2, 1.5, 1, .75, .5, .25]; // duraciones que la partitura sabe escribir
const METRO = { name: 'Solo metrónomo', swing: false, tempo: 90, sub: 4, drums: { rim: [0, 1, 2, 3] }, comp: [] };

const emptyBar = res => Array(res).fill(0);
const isNote = st => Array.isArray(st);

export function newRiff() {
  return { id: 'r' + Date.now(), name: 'Riff nuevo', tempo: 100, style: 'rock', res: 8, chords: '', bars: [emptyBar(8)] };
}

/** Riff de ejemplo (original) para enseñar cómo funciona el editor. */
export function exampleRiff() {
  const up = [[2, 0], 0, [2, 4], 0, [1, 2], 0, [1, 4], 0];
  const down = [[1, 5], 0, [1, 4], 0, [1, 2], 0, [2, 4], 0];
  return { id: 'r-ejemplo', name: 'Ejemplo: boogie en La', tempo: 110, style: 'blues', res: 8, chords: 'A7 | A7', bars: [up, down] };
}

/** Convierte un riff en una «canción» con el mismo formato que generate(). */
export function riffSong(riff) {
  const stepLen = 4 / riff.res;
  const prog = parseProgression(riff.chords || '');
  const blank = { name: '', rootPc: 0, bassPc: 0, flats: false, tones: [], minor: false };
  const segs = [], bars = [], notes = [];
  riff.bars.forEach((steps, b) => {
    const chords = prog.bars.length ? prog.bars[b % prog.bars.length] : [blank];
    const n = chords.length;
    const lens = n === 1 ? [4] : n === 2 ? [2, 2] : n === 3 ? [2, 1, 1] : [1, 1, 1, 1];
    let beat = 0;
    const mine = chords.map((chord, i) => { const s = { bar: b, beat, len: lens[i], chord, run: 0 }; beat += lens[i]; return s; });
    segs.push(...mine);
    bars.push({ segs: mine });
    steps.forEach((st, i) => {
      if (!isNote(st)) return;
      let j = i + 1;
      while (j < steps.length && steps[j] === 0) j++;
      const dur = (j - i) * stepLen, at = i * stepLen;
      const chord = mine.filter(s => s.beat <= at + .001).pop().chord;
      const midi = OPEN[st[0]] + st[1];
      const iv = ((midi - chord.bassPc) % 12 + 12) % 12;
      notes.push({
        bar: b, beat: at, at: b * 4 + at, dur, vdur: WRITTEN.find(d => d <= dur + .001),
        midi, string: st[0], fret: st[1], chord, flats: chord.flats,
        role: chord.name ? (ROLES[iv] || 'nota de paso') : '',
      });
    });
  });
  const base = STYLES[riff.style] || METRO;
  const style = { ...base, name: riff.name, desc: '', comp: prog.bars.length ? base.comp : [] };
  return { bars, segs, notes, total: bars.length * 4, style, styleId: 'riff' };
}

function resize(riff, res) {
  if (res === riff.res) return;
  riff.bars = riff.bars.map(bar => {
    const out = emptyBar(res);
    if (res > riff.res) bar.forEach((st, i) => { out[i * 2] = st; });
    else bar.forEach((st, i) => { if (i % 2 === 0) out[i / 2] = st; });
    return out;
  });
  riff.res = res;
}

// ---------- compartir por enlace ----------
// El riff viaja comprimido dentro del propio enlace (tras la #), sin servidor.
const b64 = {
  enc: bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
};
async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export async function riffToLink(riff) {
  const { name, tempo, style, res, chords, bars } = riff;
  const json = new TextEncoder().encode(JSON.stringify({ name, tempo, style, res, chords, bars }));
  const base = location.href.split('#')[0];
  if (typeof CompressionStream === 'function') return `${base}#riff=z${b64.enc(await pipe(json, new CompressionStream('deflate-raw')))}`;
  return `${base}#riff=j${b64.enc(json)}`;
}
/** Lee un riff de un enlace y lo valida entero: viene de fuera, no se confía en nada. */
export async function riffFromHash(hash) {
  const m = /[#&]riff=([zj])([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m || m[2].length > 200000) return null;
  try {
    let bytes = b64.dec(m[2]);
    if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const d = JSON.parse(new TextDecoder().decode(bytes));
    const res = d.res === 16 ? 16 : 8;
    if (!Array.isArray(d.bars) || !d.bars.length || d.bars.length > 600) return null;
    const bars = d.bars.map(bar => {
      if (!Array.isArray(bar) || bar.length !== res) throw new Error('compás');
      return bar.map(st => {
        if (st === 'r') return 'r';
        if (Array.isArray(st) && Number.isInteger(st[0]) && st[0] >= 0 && st[0] <= 3 &&
          Number.isInteger(st[1]) && st[1] >= 0 && st[1] <= 24) return [st[0], st[1]];
        return 0;
      });
    });
    return {
      id: 'r' + Date.now(),
      name: String(d.name || 'Riff compartido').slice(0, 50),
      tempo: Math.max(40, Math.min(200, Math.round(+d.tempo) || 100)),
      style: STYLES[d.style] ? d.style : 'metro',
      res, chords: String(d.chords || '').slice(0, 6000), bars,
    };
  } catch (e) { return null; }
}

export function initRiffs(root, { store, engine, getLatin, onPlay, notify = () => {} }) {
  const $ = s => root.querySelector(s);
  const S = store.data;
  if (!S.riffs) S.riffs = [exampleRiff()];
  const PAGE = 8; // compases que se muestran a la vez en el editor
  let cur = null, brush = 0, page = 0;

  const save = () => store.save();
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- lista ----------
  function renderList() {
    const list = $('#riffList');
    list.innerHTML = '';
    $('#riffEmpty').hidden = S.riffs.length > 0;
    for (const r of S.riffs) {
      const count = r.bars.reduce((n, b) => n + b.filter(isNote).length, 0);
      const card = el('div', 'riff-card' + (cur && cur.id === r.id ? ' active' : ''));
      card.innerHTML = `
        <div>
          <b>${esc(r.name)}</b>
          <small>${r.bars.length} ${r.bars.length === 1 ? 'compás' : 'compases'} · ${count} notas · ${r.tempo} ppm${r.chords ? ' · ' + esc(pretty(r.chords)) : ''}</small>
        </div>`;
      const play = el('button', 'btn', 'Tocar');
      play.onclick = () => onPlay(r);
      const edit = el('button', 'btn ghost', 'Editar');
      edit.onclick = () => open(r);
      card.append(play, edit);
      list.appendChild(card);
    }
  }

  // ---------- editor ----------
  function open(r) {
    cur = r; page = 0;
    $('#riffEditor').hidden = false;
    $('#riffName').value = r.name;
    $('#riffChords').value = r.chords;
    $('#riffStyle').value = STYLES[r.style] ? r.style : 'metro';
    renderMeta(); renderBrush(); renderBars(); renderList();
    $('#riffEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderMeta() {
    $('#riffTempo').textContent = cur.tempo;
    root.querySelectorAll('[data-res]').forEach(b => b.classList.toggle('active', +b.dataset.res === cur.res));
    const prog = parseProgression(cur.chords || '');
    const hint = $('#riffChordHint');
    hint.classList.toggle('error', prog.errors.length > 0);
    hint.textContent = prog.errors.length
      ? `No entiendo: ${prog.errors.join(', ')}. Ejemplos: A7, Dm, F#m7, Bb.`
      : 'Opcional. Un acorde por compás, separados con | (si hay menos acordes que compases, se repiten). Sin acordes suena solo la batería.';
  }
  function renderBrush() {
    const box = $('#riffBrush');
    box.innerHTML = '';
    for (let f = 0; f <= MAX_FRET; f++) {
      const b = el('button', brush === f ? 'active' : '', String(f));
      b.onclick = () => { brush = f; renderBrush(); };
      box.appendChild(b);
    }
    const e = el('button', 'erase' + (brush === 'erase' ? ' active' : ''), 'Borrar');
    e.onclick = () => { brush = 'erase'; renderBrush(); };
    box.appendChild(e);
  }
  function renderBars() {
    const box = $('#riffBars');
    box.innerHTML = '';
    const labels = cur.res === 8 ? ['1', 'y', '2', 'y', '3', 'y', '4', 'y']
      : ['1', '', 'y', '', '2', '', 'y', '', '3', '', 'y', '', '4', '', 'y', ''];
    const pages = Math.ceil(cur.bars.length / PAGE);
    page = Math.max(0, Math.min(page, pages - 1));
    const pager = $('#riffPager');
    pager.hidden = pages < 2;
    $('#riffPageTxt').textContent = `Compases ${page * PAGE + 1} a ${Math.min(cur.bars.length, (page + 1) * PAGE)} de ${cur.bars.length}`;
    $('#riffPrev').disabled = page === 0;
    $('#riffNext').disabled = page >= pages - 1;
    cur.bars.forEach((steps, b) => {
      if (b < page * PAGE || b >= (page + 1) * PAGE) return;
      const wrap = el('div', 'rbar');
      const head = el('div', 'rbar-head', `<b>Compás ${b + 1}</b>`);
      const dup = el('button', 'btn ghost sm', 'Duplicar');
      dup.onclick = () => { cur.bars.splice(b + 1, 0, steps.map(st => (isNote(st) ? [...st] : st))); changed(); };
      const clr = el('button', 'btn ghost sm', 'Vaciar');
      clr.onclick = () => { cur.bars[b] = emptyBar(cur.res); changed(); };
      const del = el('button', 'btn ghost sm', 'Quitar');
      del.disabled = cur.bars.length === 1;
      del.onclick = () => { cur.bars.splice(b, 1); changed(); };
      head.append(dup, clr, del);
      const grid = el('div', 'rgrid r' + cur.res);
      grid.style.gridTemplateColumns = `44px repeat(${cur.res}, 1fr)`;
      grid.appendChild(el('span', 'rlab'));
      labels.forEach((l, i) => grid.appendChild(el('span', 'rbeat' + (i % (cur.res / 4) === 0 ? ' strong' : ''), l)));
      // hasta dónde suena cada nota, para sombrear las casillas siguientes
      const hold = steps.map(() => -1);
      let last = null;
      steps.forEach((st, i) => {
        if (isNote(st)) last = st[0]; else if (st === 'r') last = null; else if (last !== null) hold[i] = last;
      });
      STRINGS.forEach((name, s) => {
        grid.appendChild(el('span', 'rlab', getLatin() ? name : 'GDAE'[s]));
        steps.forEach((st, i) => {
          const on = isNote(st) && st[0] === s;
          const c = el('button', 'rcell' + (on ? ' on' : hold[i] === s ? ' hold' : '') + (i % (cur.res / 4) === 0 ? ' beat' : ''), on ? String(st[1]) : '');
          c.setAttribute('aria-label', `${name}, paso ${i + 1}`);
          c.onclick = () => setCell(b, s, i);
          grid.appendChild(c);
        });
      });
      grid.appendChild(el('span', 'rlab rest', 'Silencio'));
      steps.forEach((st, i) => {
        const c = el('button', 'rcell rest' + (st === 'r' ? ' on' : '') + (i % (cur.res / 4) === 0 ? ' beat' : ''), st === 'r' ? '✕' : '');
        c.setAttribute('aria-label', `Silencio, paso ${i + 1}`);
        c.onclick = () => { cur.bars[b][i] = st === 'r' ? 0 : 'r'; changed(); };
        grid.appendChild(c);
      });
      wrap.append(head, grid);
      box.appendChild(wrap);
    });
  }
  function setCell(b, s, i) {
    const st = cur.bars[b][i];
    if (brush === 'erase' || (isNote(st) && st[0] === s && st[1] === brush)) cur.bars[b][i] = 0;
    else {
      cur.bars[b][i] = [s, brush];
      engine.pluck(OPEN[s] + brush, .5);
    }
    changed();
  }
  function changed() { save(); renderBars(); renderList(); }

  $('#riffNew').onclick = () => { const r = newRiff(); S.riffs.unshift(r); save(); open(r); $('#riffName').select(); };
  $('#riffName').oninput = e => { cur.name = e.target.value.slice(0, 50) || 'Riff sin nombre'; save(); renderList(); };
  $('#riffChords').oninput = e => { cur.chords = e.target.value; save(); renderMeta(); renderList(); };
  $('#riffStyle').onchange = e => { cur.style = e.target.value; save(); };
  $('#riffTempoDown').onclick = () => { cur.tempo = Math.max(40, cur.tempo - 4); save(); renderMeta(); renderList(); };
  $('#riffTempoUp').onclick = () => { cur.tempo = Math.min(200, cur.tempo + 4); save(); renderMeta(); renderList(); };
  root.querySelectorAll('[data-res]').forEach(b => b.onclick = () => {
    const res = +b.dataset.res;
    const loses = res < cur.res && cur.bars.some(bar => bar.some((st, i) => st !== 0 && i % 2));
    if (loses && !confirm('Al pasar a corcheas se perderán las notas que están en semicorcheas intermedias. ¿Continuar?')) return;
    resize(cur, res); save(); renderMeta(); renderBars();
  });
  $('#riffAddBar').onclick = () => { cur.bars.push(emptyBar(cur.res)); page = Math.floor((cur.bars.length - 1) / PAGE); changed(); };
  $('#riffPrev').onclick = () => { page--; renderBars(); };
  $('#riffNext').onclick = () => { page++; renderBars(); };

  // ---------- importar Guitar Pro / MusicXML ----------
  let gp = null; // { mod, score, fileName }
  const dlg = $('#gpDlg');
  const closeDlg = () => (dlg.close ? dlg.close() : dlg.removeAttribute('open'));
  function gpPreview() {
    const total = gp.score.masterBars.length;
    let from = Math.max(1, Math.min(total, parseInt($('#gpFrom').value, 10) || 1));
    let to = Math.max(from, Math.min(total, parseInt($('#gpTo').value, 10) || total));
    gp.result = gp.mod.trackToRiff(gp.score, +$('#gpTrack').value, from, to, gp.fileName);
    const { riff, warnings, noteCount } = gp.result;
    $('#gpInfo').textContent = `${riff.bars.length} ${riff.bars.length === 1 ? 'compás' : 'compases'} · ${noteCount} notas · ${riff.tempo} ppm · cuadrícula de ${riff.res === 16 ? 'semicorcheas' : 'corcheas'}`;
    const ul = $('#gpWarn');
    ul.innerHTML = '';
    for (const w of warnings) ul.appendChild(el('li', '', esc(w)));
    $('#gpOk').disabled = noteCount === 0;
    if (!noteCount) ul.appendChild(el('li', '', 'Esta pista no tiene notas en esos compases.'));
  }
  $('#gpBtn').onclick = () => $('#gpFile').click();
  $('#gpFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const status = $('#gpStatus');
    status.hidden = false; status.classList.remove('error');
    status.textContent = `Leyendo ${file.name}…`;
    try {
      const mod = await import('./gpimport.js');
      const score = await mod.readScore(await file.arrayBuffer());
      const { tracks, best } = mod.listTracks(score);
      if (!tracks.length) throw new Error('El archivo no tiene pistas de instrumento.');
      gp = { mod, score, fileName: file.name };
      status.hidden = true;
      $('#gpTitle').textContent = score.title || file.name;
      $('#gpBy').textContent = [score.artist, score.album].filter(Boolean).join(' · ');
      const sel = $('#gpTrack');
      sel.innerHTML = '';
      for (const t of tracks) sel.appendChild(new Option(`${t.name} — ${t.strings} cuerdas, ${t.notes} notas${t.bass ? ' (bajo)' : ''}`, t.index));
      sel.value = best;
      $('#gpFrom').value = 1; $('#gpTo').value = score.masterBars.length;
      $('#gpFrom').max = $('#gpTo').max = score.masterBars.length;
      gpPreview();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    } catch (err) {
      status.classList.add('error');
      status.textContent = `No se pudo leer «${file.name}». ¿Es un archivo de Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) o MusicXML? ${err && err.message ? '(' + err.message + ')' : ''}`;
    }
  };
  for (const id of ['#gpTrack', '#gpFrom', '#gpTo']) $(id).onchange = gpPreview;
  $('#gpCancel').onclick = closeDlg;
  $('#gpOk').onclick = () => {
    gpPreview();
    const { riff } = gp.result;
    S.riffs.unshift(riff);
    save(); closeDlg();
    open(riff);
  };
  $('#riffPlay').onclick = () => onPlay(cur);
  $('#riffClose').onclick = () => { cur = null; $('#riffEditor').hidden = true; renderList(); };
  // En el iPad, la app instalada no comparte datos con Safari: aquí se pega el enlace recibido.
  $('#riffPaste').onclick = async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { /* sin permiso para leer el portapapeles */ }
    if (!/riff=/.test(text)) text = prompt('Pega aquí el enlace del riff que te han enviado:') || '';
    if (!text.trim()) return;
    const riff = await riffFromHash(text.replace(/^[^#]*/, '') || '#' + text);
    if (!riff) { notify('Ese enlace no contiene un riff válido.'); return; }
    notify(api.add(riff) ? `«${riff.name}» añadido a Mis riffs.` : `«${riff.name}» ya estaba en Mis riffs.`);
  };
  $('#riffShare').onclick = async () => {
    const url = await riffToLink(cur);
    const text = `Riff de bajo «${cur.name}» para Cuatro Cuerdas`;
    try {
      if (navigator.share) { await navigator.share({ title: cur.name, text, url }); return; }
      await navigator.clipboard.writeText(url);
      notify('Enlace copiado. Pégalo en un mensaje para enviarlo.');
    } catch (e) {
      if (e && e.name === 'AbortError') return; // se cerró el menú de compartir
      prompt('Copia este enlace y envíalo:', url);
    }
  };
  $('#riffDelete').onclick = () => {
    if (!confirm(`¿Borrar «${cur.name}»? No se puede deshacer.`)) return;
    S.riffs = S.riffs.filter(r => r !== cur);
    cur = null; save();
    $('#riffEditor').hidden = true;
    renderList();
  };

  const sel = $('#riffStyle');
  sel.appendChild(new Option('Solo metrónomo', 'metro'));
  for (const [id, st] of Object.entries(STYLES)) sel.appendChild(new Option(`Batería de ${st.name}`, id));

  renderList();
  const api = {
    render() { renderList(); if (cur) renderBars(); },
    /** Añade un riff recibido por enlace (si no está ya) y lo abre. */
    add(riff) {
      const same = S.riffs.find(r => r.name === riff.name && JSON.stringify(r.bars) === JSON.stringify(riff.bars));
      if (!same) { S.riffs.unshift(riff); save(); }
      open(same || riff);
      return !same;
    },
    edit(id) { const r = S.riffs.find(x => x.id === id); if (r) open(r); },
  };
  return api;
}
