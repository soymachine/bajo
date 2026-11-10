import { KEYS, noteName, pretty, realize, transposeText, pcOf } from './theory.js';
import { STYLES, PRESETS, parseProgression, generate, buildEvents } from './generator.js';
import { Engine } from './audio.js';
import { renderScore } from './score.js';
import { createFretboard } from './fretboard.js';
import { initGame } from './fretgame.js';
import { initTuner } from './tuner.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- estado guardado en localStorage ----------
const KEY = 'cuatro-cuerdas.v1';
const defaults = {
  preset: 'blues12', key: 'A', text: '', style: 'blues', level: 2, seed: 0, tempo: 92,
  loop: true, countIn: true, mute: false, vol: { bass: .9, drums: .7, chords: .5 },
  staff: true, tab: true, names: false, latin: true,
  custom: [], log: {}, gameBest: 0,
};
const store = {
  data: { ...defaults },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sin datos */ }
    this.data.vol = { ...defaults.vol, ...this.data.vol };
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* almacenamiento lleno o bloqueado */ } },
};
store.load();
const S = store.data;

const engine = new Engine();
let song = null, score = null, board = null, lastNote = -2, lastBar = -1;

const allPresets = () => PRESETS.flatMap(g => g.items);
const findPreset = id => allPresets().find(p => p.id === id) || S.custom.find(p => p.id === id);
const formatText = t => {
  const bars = t.split(/[|\n]/).map(b => b.trim()).filter(Boolean);
  const lines = [];
  for (let i = 0; i < bars.length; i += 4) lines.push(bars.slice(i, i + 4).join(' | '));
  return lines.join('\n');
};

// ---------- controles ----------
function fillPresets() {
  const sel = $('#preset');
  sel.innerHTML = '';
  const groups = [...PRESETS];
  if (S.custom.length) groups.push({ group: 'Mis progresiones', items: S.custom });
  for (const g of groups) {
    const og = document.createElement('optgroup');
    og.label = g.group;
    for (const p of g.items) og.appendChild(new Option(p.name, p.id));
    sel.appendChild(og);
  }
  sel.appendChild(new Option('— acordes propios —', 'custom'));
  sel.value = findPreset(S.preset) ? S.preset : 'custom';
  $('#del').hidden = !S.custom.some(p => p.id === S.preset);
}
function fillKeys() {
  const sel = $('#key');
  sel.innerHTML = '';
  for (const k of KEYS) sel.appendChild(new Option(`Tono: ${pretty(k)} · ${noteName(pcOf(k), k.includes('b'), true)}`, k));
  sel.value = S.key;
}
function fillStyles() {
  const box = $('#styles');
  box.innerHTML = '';
  for (const [id, st] of Object.entries(STYLES)) {
    const b = document.createElement('button');
    b.textContent = st.name;
    b.dataset.style = id;
    b.onclick = () => setStyle(id, true);
    box.appendChild(b);
  }
}
function setStyle(id, withTempo) {
  S.style = id;
  if (withTempo) setTempo(STYLES[id].tempo);
  rebuild();
}
function setTempo(bpm) {
  S.tempo = Math.max(40, Math.min(200, Math.round(bpm)));
  $('#tempo').value = S.tempo;
  $('#tempoVal').textContent = S.tempo;
  engine.setTempo(S.tempo);
  store.save();
}
function applyPreset(id) {
  const p = findPreset(id);
  if (!p) return;
  S.preset = id;
  S.key = p.key;
  S.text = p.roman ? realize(p.roman, p.key) : p.text;
  S.seed = 0;
  $('#key').value = S.key;
  if (p.style) { S.style = p.style; setTempo(STYLES[p.style].tempo); }
  $('#del').hidden = !S.custom.some(c => c.id === id);
  rebuild();
}

// ---------- generar y dibujar ----------
function rebuild() {
  const prog = parseProgression(S.text);
  const hint = $('#chordHint');
  if (prog.errors.length || !prog.bars.length) {
    hint.classList.add('error');
    hint.textContent = prog.bars.length
      ? `No entiendo: ${prog.errors.join(', ')}. Ejemplos válidos: A7, Dm, F#m7, Bb, Cmaj7.`
      : 'Escribe al menos un acorde, por ejemplo: A7 | D7 | E7 | A7';
    if (!prog.bars.length) return;
  } else {
    hint.classList.remove('error');
    hint.innerHTML = 'Escribe tus acordes separando los compases con <kbd>|</kbd>. Dos acordes en un compás: <kbd>C Am | F G</kbd>';
  }
  $('#chords').value = formatText(S.text);
  song = generate(prog, S.style, S.level, S.seed);
  engine.setSong(buildEvents(song), song.total, song.style.swing);
  if (!engine.playing) setPlayingUI(false);

  $$('#styles button').forEach(b => b.classList.toggle('active', b.dataset.style === S.style));
  $$('#levels button').forEach(b => b.classList.toggle('active', +b.dataset.level === S.level));
  $('#styleDesc').textContent = song.style.desc;
  const p = findPreset(S.preset);
  $('#sheetTitle').innerHTML = `${p ? p.name : 'Acordes propios'} <span>${song.style.name}${song.style.swing ? ' · corcheas con swing' : ''} · ${song.bars.length} compases</span>`;
  draw();
  store.save();
}
function draw() {
  const el = $('#score');
  const wide = el.clientWidth >= 880;
  const dense = song.notes.some(n => n.dur === .5);
  score = renderScore(el, song, {
    staff: S.staff, tab: S.tab || !S.staff, names: S.names, latin: S.latin,
    perLine: wide || !(dense || song.bars.some(b => b.segs.length > 1)) ? 4 : 2,
  });
  lastNote = -2; lastBar = -1;
  if (!engine.playing) idleNow();
}

// ---------- panel "ahora" ----------
function chordAt(bar, beat) {
  return song.bars[bar].segs.filter(s => s.beat <= beat + .001).pop();
}
function idleNow() {
  const first = song.segs[0], next = song.segs.find(s => s.chord.name !== first.chord.name);
  $('#nowChord').textContent = pretty(first.chord.name);
  $('#nowNext').textContent = next ? pretty(next.chord.name) : '—';
  $('#nowNote').textContent = '—';
  $('#nowRole').textContent = 'pulsa Tocar';
  showBoard(0, -1);
}
function showBoard(bar, idx) {
  const seen = new Set(), dots = [];
  song.notes.forEach((n, i) => {
    if (n.bar !== bar || i === idx) return;
    const k = n.string + ':' + n.fret;
    if (seen.has(k)) return;
    seen.add(k);
    dots.push({ string: n.string, fret: n.fret, cls: 'ghost', label: noteName(n.midi, n.flats, S.latin) });
  });
  if (idx >= 0) {
    const n = song.notes[idx];
    dots.push({ string: n.string, fret: n.fret, cls: 'cur', label: noteName(n.midi, n.flats, S.latin) });
  }
  board.set(dots);
}
function frame() {
  requestAnimationFrame(frame);
  if (!engine.playing || !song) return;
  const beat = engine.position();
  if (beat === null) return;
  if (beat < 0) {
    $('#nowNote').textContent = 5 + Math.floor(beat);
    $('#nowRole').textContent = 'preparados…';
    return;
  }
  const idx = score.setBeat(beat);
  const bar = Math.floor(beat / 4);
  if (idx === lastNote && bar === lastBar) return;
  const seg = chordAt(bar, beat - bar * 4);
  const si = song.segs.indexOf(seg);
  let next = null;
  for (let k = 1; k <= song.segs.length && !next; k++) {
    const s = song.segs[(si + k) % song.segs.length];
    if (s.chord.name !== seg.chord.name) next = s;
  }
  $('#nowChord').textContent = pretty(seg.chord.name);
  $('#nowNext').textContent = next ? pretty(next.chord.name) : '—';
  if (idx >= 0) {
    const n = song.notes[idx];
    $('#nowNote').textContent = noteName(n.midi, n.flats, S.latin);
    $('#nowRole').textContent = `${n.role} · ${['Sol', 'Re', 'La', 'Mi'][n.string]}, ${n.fret ? 'traste ' + n.fret : 'al aire'}`;
    const strong = $('#nowNote');
    strong.classList.remove('hit'); void strong.offsetWidth; strong.classList.add('hit');
  } else {
    $('#nowNote').textContent = '·';
    $('#nowRole').textContent = 'silencio';
  }
  showBoard(bar, idx);
  lastNote = idx; lastBar = bar;
}

// ---------- reproducción y registro de práctica ----------
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function setPlayingUI(on) {
  document.body.classList.toggle('playing', on);
  $('#play span').textContent = on ? 'Parar' : 'Tocar';
  if (!on && score) { score.clear(); if (song) idleNow(); }
}
function toggle() {
  if (engine.playing) engine.stop();
  else if (song) { engine.start(); setPlayingUI(true); lastNote = -2; }
}
engine.onEnd = () => setPlayingUI(false);
setInterval(() => {
  if (!engine.playing) return;
  S.log[today()] = (S.log[today()] || 0) + 1;
  if (S.log[today()] % 10 === 0) { store.save(); renderStreak(); }
}, 1000);

function renderStreak() {
  const day = new Date(), cells = [];
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const done = d => (S.log[key(d)] || 0) >= 60;
  let streak = 0;
  const c = new Date();
  if (!done(c)) c.setDate(c.getDate() - 1);
  while (done(c)) { streak++; c.setDate(c.getDate() - 1); }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(day); d.setDate(day.getDate() - i);
    cells.push(`<i class="${done(d) ? 'on' : ''}" title="${d.toLocaleDateString('es')}">${'DLMXJVS'[d.getDay()]}</i>`);
  }
  const mins = Math.floor((S.log[today()] || 0) / 60);
  $('#streak').innerHTML = `<div class="week">${cells.join('')}</div>
    <div><b>${streak}</b> ${streak === 1 ? 'día seguido' : 'días seguidos'}<small>hoy: ${mins} min</small></div>`;
}

// ---------- eventos ----------
$('#play').onclick = toggle;
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) && $('#view-tocar').classList.contains('active')) {
    e.preventDefault(); toggle();
  }
});
$('#tempo').oninput = e => setTempo(+e.target.value);
$('#tempoDown').onclick = () => setTempo(S.tempo - 4);
$('#tempoUp').onclick = () => setTempo(S.tempo + 4);

function bindCheck(id, get, set) {
  const el = $(id);
  el.checked = get();
  el.onchange = () => { set(el.checked); store.save(); };
}
bindCheck('#loop', () => S.loop, v => { S.loop = engine.loop = v; });
bindCheck('#countin', () => S.countIn, v => { S.countIn = engine.countIn = v; });
bindCheck('#mute', () => S.mute, v => { S.mute = engine.muteBass = v; engine.applyVol(); });
for (const [id, k] of [['#volBass', 'bass'], ['#volDrums', 'drums'], ['#volChords', 'chords']]) {
  $(id).value = S.vol[k];
  $(id).oninput = e => { S.vol[k] = +e.target.value; engine.applyVol(); store.save(); };
}
bindCheck('#optStaff', () => S.staff, v => { S.staff = v; if (!v) { S.tab = true; $('#optTab').checked = true; } draw(); });
bindCheck('#optTab', () => S.tab, v => { S.tab = v; if (!v) { S.staff = true; $('#optStaff').checked = true; } draw(); });
bindCheck('#optNames', () => S.names, v => { S.names = v; draw(); });
bindCheck('#optLatin', () => S.latin, v => {
  S.latin = v;
  board = createFretboard($('#nowBoard'), { frets: 12, latin: S.latin });
  draw(); game.refresh(); tuner.refresh();
});

$('#preset').onchange = e => { if (e.target.value !== 'custom') applyPreset(e.target.value); };
$('#key').onchange = e => {
  const delta = pcOf(e.target.value) - pcOf(S.key);
  S.text = transposeText(S.text, delta);
  S.key = e.target.value;
  rebuild();
};
function applyText() {
  const t = $('#chords').value;
  if (formatText(t) === formatText(S.text)) return;
  S.text = t; S.preset = 'custom'; S.seed = 0;
  $('#preset').value = 'custom'; $('#del').hidden = true;
  rebuild();
}
$('#apply').onclick = applyText;
$('#chords').onchange = applyText;
$('#save').onclick = () => {
  applyText();
  const name = prompt('Nombre para esta progresión:', 'Mi progresión');
  if (!name) return;
  const p = { id: 'c' + Date.now(), name: name.trim().slice(0, 40), key: S.key, text: S.text, style: S.style };
  S.custom.push(p); S.preset = p.id;
  fillPresets(); rebuild();
};
$('#del').onclick = () => {
  const p = S.custom.find(c => c.id === S.preset);
  if (!p || !confirm(`¿Borrar «${p.name}»?`)) return;
  S.custom = S.custom.filter(c => c !== p);
  S.preset = 'custom';
  fillPresets(); rebuild();
};
$$('#levels button').forEach(b => b.onclick = () => { S.level = +b.dataset.level; rebuild(); });
$('#reroll').onclick = () => { S.seed++; rebuild(); };

$$('.tabs button').forEach(b => b.onclick = () => {
  if (engine.playing) engine.stop();
  $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + b.dataset.view));
  if (b.dataset.view === 'tocar' && song) draw();
});
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => song && draw(), 150); });

// ---------- arranque ----------
engine.tempo = S.tempo; engine.loop = S.loop; engine.countIn = S.countIn;
engine.muteBass = S.mute; engine.vol = S.vol;
fillPresets(); fillKeys(); fillStyles();
board = createFretboard($('#nowBoard'), { frets: 12, latin: S.latin });
const game = initGame($('#view-diapason'), engine, store, () => S.latin);
const tuner = initTuner($('#view-afinador'), engine, () => S.latin);
if (!S.text) { const p = findPreset('blues12'); S.text = realize(p.roman, p.key); }
setTempo(S.tempo);
rebuild();
renderStreak();
requestAnimationFrame(frame);
