import { KEYS, noteName, pretty, realize, transposeText, pcOf } from './theory.js';
import { STYLES, PRESETS, parseProgression, generate, buildEvents } from './generator.js';
import { Engine } from './audio.js';
import { renderScore } from './score.js';
import { createFretboard } from './fretboard.js';
import { initGame } from './fretgame.js';
import { initTuner } from './tuner.js';
import { LIBRARY, makeExercise, exerciseTitle, routineFor, dayNumber } from './exercises.js';
import { SONGS, GENRES, songPreset } from './songs.js';
import { initRiffs, riffSong, riffFromHash } from './riffs.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- estado guardado en localStorage ----------
const KEY = 'cuatro-cuerdas.v1';
const defaults = {
  preset: 'blues12', key: 'A', text: '', style: 'blues', level: 2, seed: 0, tempo: 92,
  loop: true, countIn: true, mute: false, vol: { bass: .9, drums: .7, chords: .5 },
  staff: true, tab: true, names: false, latin: true,
  custom: [], log: {}, gameBest: 0,
  mode: 'song', ex: null, step: null, exKey: 'A',
  daily: { date: '', secs: [0, 0, 0] }, ramp: { on: false, step: 4, to: 120 },
};
const store = {
  data: { ...defaults },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sin datos */ }
    for (const k of ['vol', 'ramp', 'daily']) this.data[k] = { ...defaults[k], ...this.data[k] };
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* almacenamiento lleno o bloqueado */ } },
};
store.load();
const S = store.data;

const engine = new Engine();
let song = null, score = null, board = null, lastNote = -2, lastBar = -1;
let range = null, picking = null, pickStart = 0, rampStart = null, stage = false;

const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dateKey(new Date());
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
if (S.daily.date !== today()) { S.daily = { date: today(), secs: [0, 0, 0] }; S.step = null; }

const allPresets = () => PRESETS.flatMap(g => g.items);
const findPreset = id => (String(id).startsWith('song:') ? songPreset(id)
  : allPresets().find(p => p.id === id) || S.custom.find(p => p.id === id));
const formatText = t => {
  const bars = t.split(/[|\n]/).map(b => b.trim()).filter(Boolean);
  const lines = [];
  for (let i = 0; i < bars.length; i += 4) lines.push(bars.slice(i, i + 4).join(' | '));
  return lines.join('\n');
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
}

// ---------- controles ----------
function fillPresets() {
  const sel = $('#preset');
  sel.innerHTML = '';
  const groups = [...PRESETS];
  groups.push({ group: 'Canciones míticas', items: SONGS.map(x => ({ id: 'song:' + x.id, name: `${x.title} · ${x.artist}` })) });
  if (S.custom.length) groups.push({ group: 'Mis progresiones', items: S.custom });
  for (const g of groups) {
    const og = document.createElement('optgroup');
    og.label = g.group;
    for (const p of g.items) og.appendChild(new Option(p.name, p.id));
    sel.appendChild(og);
  }
  sel.appendChild(new Option('— acordes propios —', 'custom'));
  sel.value = findPreset(S.preset) ? S.preset : 'custom';
  if (sel.value !== S.preset) sel.value = String(S.preset).startsWith('song:') ? S.preset.split(':').slice(0, 2).join(':') : 'custom';
  $('#del').hidden = !S.custom.some(p => p.id === S.preset);
}
const keyOption = k => new Option(`${pretty(k)} · ${noteName(pcOf(k), k.includes('b'), true)}`, k);
function fillKeys() {
  const sel = $('#key');
  sel.innerHTML = '';
  for (const k of KEYS) { const o = keyOption(k); o.text = 'Tono: ' + o.text; sel.appendChild(o); }
  sel.value = S.key;
  const ek = $('#exKey');
  ek.innerHTML = '';
  for (const k of KEYS) ek.appendChild(keyOption(k));
  ek.value = S.exKey;
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
function showTempo(bpm) {
  $('#tempo').value = bpm;
  $('#tempoVal').textContent = bpm;
}
function setTempo(bpm) {
  S.tempo = Math.max(40, Math.min(200, Math.round(bpm)));
  showTempo(S.tempo);
  engine.setTempo(S.tempo);
  store.save();
}
function applyPreset(id) {
  const p = findPreset(id);
  if (!p) return;
  S.mode = 'song'; S.step = null; range = null;
  S.preset = id;
  S.key = p.key;
  S.text = p.roman ? realize(p.roman, p.key) : p.text;
  S.seed = 0;
  $('#preset').value = id;
  if ($('#preset').value !== id) {
    // una parte de una canción: en el selector se muestra la canción
    $('#preset').value = id.startsWith('song:') ? id.split(':').slice(0, 2).join(':') : 'custom';
  }
  $('#key').value = S.key;
  if (p.style) { S.style = p.style; setTempo(p.tempo || STYLES[p.style].tempo); }
  $('#del').hidden = !S.custom.some(c => c.id === id);
  rebuild();
}
function loadExercise(spec, step = null) {
  if (engine.playing) engine.stop();
  S.mode = 'ex'; S.ex = spec; S.step = step; range = null;
  setTempo(makeExercise(spec).style.tempo);
  rebuild();
}

// ---------- generar y dibujar ----------
function rebuild() {
  const riff = S.mode === 'riff' ? (S.riffs || []).find(r => r.id === S.riffId) : null;
  if (S.mode === 'riff' && !riff) S.mode = 'song';
  document.body.classList.toggle('exmode', S.mode !== 'song');
  if (S.mode === 'ex') {
    song = makeExercise(S.ex);
  } else if (riff) {
    song = riffSong(riff);
  } else {
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
  }
  if (range && range[1] >= song.bars.length) range = null;
  pushEvents();
  if (!engine.playing) setPlayingUI(false);

  $$('#styles button').forEach(b => b.classList.toggle('active', b.dataset.style === S.style));
  $$('#levels button').forEach(b => b.classList.toggle('active', +b.dataset.level === S.level));
  $('#styleDesc').textContent = song.style.desc;
  if (S.mode === 'ex') {
    $('#sheetTitle').innerHTML = `${exerciseTitle(S.ex, S.latin)} <span>Ejercicio · ${song.bars.length} compases</span>`;
  } else if (riff) {
    $('#sheetTitle').textContent = riff.name;
    $('#sheetTitle').insertAdjacentHTML('beforeend', ` <span>Mi riff · ${song.bars.length} ${song.bars.length === 1 ? 'compás' : 'compases'}</span>`);
  } else {
    const p = findPreset(S.preset);
    $('#sheetTitle').innerHTML = `${p ? p.name : 'Acordes propios'} <span>${song.style.name}${song.style.swing ? ' · corcheas con swing' : ''} · ${song.bars.length} compases</span>`;
  }
  renderExBar();
  renderRange();
  draw();
  store.save();
}
/** Envía al motor de audio la canción entera o solo el tramo elegido. */
function pushEvents() {
  const lo = range ? range[0] * 4 : 0, hi = range ? (range[1] + 1) * 4 : song.total;
  const ev = buildEvents(song)
    .filter(e => e.beat >= lo - 1e-6 && e.beat < hi - 1e-6)
    .map(e => ({ ...e, beat: e.beat - lo }));
  engine.setSong(ev, hi - lo, song.style.swing);
}
const rangeStart = () => (range ? range[0] * 4 : 0);

function draw() {
  const el = $('#score');
  const zoom = stage ? 1.45 : 1;
  const wide = el.clientWidth / zoom >= 880;
  const dense = song.notes.some(n => n.dur === .5);
  const sixteenths = song.notes.some(n => (n.vdur ?? n.dur) < .5);
  score = renderScore(el, song, {
    staff: S.staff, tab: S.tab || !S.staff, names: S.names, latin: S.latin, zoom,
    perLine: !sixteenths && (wide || !(dense || song.bars.some(b => b.segs.length > 1))) ? 4 : 2,
    onBar: pickBar,
    marks: S.mode === 'song' ? (findPreset(S.preset) || {}).marks : null,
  });
  el.classList.toggle('picking', !!picking);
  if (range) score.setRange(range[0], range[1]);
  else if (picking === 'end') score.setRange(pickStart, pickStart);
  lastNote = -2; lastBar = -1;
  if (!engine.playing) idleNow();
}

// ---------- tramo y aceleración ----------
function renderRange() {
  const txt = $('#rangeTxt');
  $('#clearRange').hidden = !range;
  $('#pickRange').hidden = !!picking;
  txt.classList.toggle('active', !!picking);
  if (picking === 'start') txt.textContent = 'Toca en la partitura el primer compás…';
  else if (picking === 'end') txt.textContent = `Desde el compás ${pickStart + 1}. Ahora toca el último…`;
  else txt.textContent = range ? `Compases ${range[0] + 1} a ${range[1] + 1}` : 'Toda la canción';
}
function pickBar(bar) {
  if (!picking) return;
  if (picking === 'start') {
    pickStart = bar; picking = 'end';
    score.setRange(bar, bar);
  } else {
    if (engine.playing) engine.stop();
    range = [Math.min(pickStart, bar), Math.max(pickStart, bar)];
    picking = null;
    $('#score').classList.remove('picking');
    pushEvents();
    score.setRange(range[0], range[1]);
    idleNow();
  }
  renderRange();
}
$('#pickRange').onclick = () => {
  picking = 'start';
  $('#score').classList.add('picking');
  renderRange();
  $('#score').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
$('#clearRange').onclick = () => {
  if (engine.playing) engine.stop();
  range = null; picking = null;
  pushEvents();
  score.setRange(null);
  renderRange(); idleNow();
};

function renderRamp() {
  $('#rampOn').checked = S.ramp.on;
  $('#rampStep').value = S.ramp.step;
  $('#rampTo').textContent = S.ramp.to;
  document.querySelector('.practice').classList.toggle('ramping', S.ramp.on);
}
for (const n of [2, 3, 4, 5, 6, 8, 10]) $('#rampStep').appendChild(new Option(`+${n} ppm`, n));
$('#rampOn').onchange = e => {
  S.ramp.on = e.target.checked;
  if (S.ramp.on && S.ramp.to <= S.tempo) S.ramp.to = Math.min(200, S.tempo + 20);
  if (S.ramp.on && !S.loop) { S.loop = engine.loop = true; $('#loop').checked = true; }
  renderRamp(); store.save();
};
$('#rampStep').onchange = e => { S.ramp.step = +e.target.value; store.save(); };
$('#rampDown').onclick = () => { S.ramp.to = Math.max(40, S.ramp.to - 5); renderRamp(); store.save(); };
$('#rampUp').onclick = () => { S.ramp.to = Math.min(200, S.ramp.to + 5); renderRamp(); store.save(); };
engine.onLoop = n => {
  if (!S.ramp.on) return;
  const next = Math.min(S.ramp.to, S.tempo + S.ramp.step);
  if (next <= S.tempo) return;
  S.tempo = next;
  engine.changeTempoAt(next, n * engine.total);
  showTempo(next);
  if (next === S.ramp.to) toast(`¡Objetivo alcanzado: ${next} ppm!`);
};

// ---------- barra de ejercicio / paso de la rutina ----------
function renderExBar() {
  const bar = $('#exbar');
  const step = S.step;
  $('#exEdit').hidden = S.mode !== 'riff';
  if (S.mode === 'song' && step === null) { bar.hidden = true; return; }
  bar.hidden = false;
  if (S.mode === 'riff') {
    const r = S.riffs.find(x => x.id === S.riffId);
    $('#exLabel').innerHTML = '<small>Mi riff</small><b></b>';
    $('#exLabel b').textContent = r.name;
  } else if (step !== null) {
    const st = routineFor(dayNumber(), S.latin)[step];
    $('#exLabel').innerHTML = `<small>Paso ${step + 1} de 3 · ${st.kicker}</small><b>${st.title}</b>`;
  } else {
    $('#exLabel').innerHTML = `<small>Ejercicio</small><b>${exerciseTitle(S.ex, S.latin)}</b>`;
  }
  $('#exNext').hidden = step === null || step === 2;
  $('#exNext').textContent = step === 1 ? 'Paso 3: groove →' : 'Paso 2: técnica →';
  $('#exTimeBox').hidden = step === null;
  updateStepTimer();
}
function updateStepTimer() {
  if (S.step === null) return;
  const st = routineFor(dayNumber(), S.latin)[S.step];
  const secs = S.daily.secs[S.step], goal = st.min * 60;
  $('#exTime').textContent = secs >= goal ? `¡Hecho! ${fmtTime(secs)}` : `${fmtTime(secs)} de ${st.min}:00`;
  $('#exProg').style.width = Math.min(100, secs / goal * 100) + '%';
  $('#exTimeBox').classList.toggle('done', secs >= goal);
}
function startStep(i) {
  const st = routineFor(dayNumber(), S.latin)[i];
  if (engine.playing) engine.stop();
  if (st.ex) loadExercise(st.ex, i);
  else { applyPreset(st.preset); S.step = i; renderExBar(); store.save(); }
  showView('tocar');
}
$('#exNext').onclick = () => startStep(S.step + 1);
$('#exQuit').onclick = () => {
  if (engine.playing) engine.stop();
  S.step = null;
  const back = S.mode === 'riff' ? 'riffs' : 'hoy';
  if (S.mode !== 'song') { S.mode = 'song'; range = null; setTempo(STYLES[S.style].tempo); }
  showView(back);
  rebuild();
};
$('#exEdit').onclick = () => { showView('riffs'); riffs.edit(S.riffId); };
function playRiff(r) {
  if (engine.playing) engine.stop();
  S.mode = 'riff'; S.riffId = r.id; S.step = null; range = null;
  setTempo(r.tempo);
  rebuild();
  showView('tocar');
}

// ---------- vista HOY ----------
function renderToday() {
  if (S.daily.date !== today()) { S.daily = { date: today(), secs: [0, 0, 0] }; S.step = null; }
  const d = new Date();
  $('#todayDate').textContent = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const r = routineFor(dayNumber(), S.latin);
  const list = $('#routine');
  list.innerHTML = '';
  let done = 0;
  r.forEach((st, i) => {
    const secs = S.daily.secs[i], ok = secs >= st.min * 60;
    if (ok) done++;
    const li = document.createElement('li');
    li.className = 'rstep' + (ok ? ' done' : '');
    li.style.animationDelay = i * 80 + 'ms';
    li.innerHTML = `
      <div class="num">${ok ? '✓' : i + 1}</div>
      <div class="body">
        <small>${st.kicker} · ${st.min} min</small>
        <h3>${st.title}</h3>
        <p>${st.desc}</p>
        <div class="bar"><i style="width:${Math.min(100, secs / (st.min * 60) * 100)}%"></i></div>
      </div>`;
    const b = document.createElement('button');
    b.className = 'btn big';
    b.textContent = ok ? 'Otra vez' : secs ? 'Seguir' : 'Empezar';
    b.onclick = () => startStep(i);
    li.appendChild(b);
    list.appendChild(li);
  });
  $('#todayMsg').textContent = done === 3
    ? '¡Práctica de hoy completada! Mañana habrá ejercicios nuevos.'
    : done ? `Llevas ${done} de 3. ¡Sigue así!`
      : 'Tres pasos, unos quince minutos. Empieza por el primero y deja que la música haga el resto.';
  renderDiary();
}
function renderDiary() {
  const cells = [], end = new Date();
  // 4 semanas completas, de lunes a domingo, terminando en la semana actual
  const start = new Date(end);
  start.setDate(end.getDate() - ((end.getDay() + 6) % 7) - 21);
  let week = 0, month = 0, days = 0;
  for (const h of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) cells.push(`<b>${h}</b>`);
  for (let i = 0; i < 28; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const secs = S.log[dateKey(d)] || 0, mins = Math.floor(secs / 60);
    const future = d > end;
    const lvl = future ? 'future' : mins >= 15 ? 'l3' : mins >= 5 ? 'l2' : secs >= 60 ? 'l1' : '';
    const isToday = dateKey(d) === today();
    if (!future) { month += secs; if (secs >= 60) days++; if (i >= 21) week += secs; }
    cells.push(`<i class="${lvl}${isToday ? ' is-today' : ''}" title="${d.toLocaleDateString('es')}: ${mins} min">${d.getDate()}</i>`);
  }
  $('#diary').innerHTML = cells.join('');
  $('#diaryTotals').innerHTML = `Esta semana: <b>${Math.round(week / 60)} min</b> · Últimas 4 semanas: <b>${Math.round(month / 60)} min</b> en ${days} ${days === 1 ? 'día' : 'días'}`;
}
function fillLibrary() {
  const box = $('#library');
  box.innerHTML = '';
  for (const item of LIBRARY) {
    const b = document.createElement('button');
    b.textContent = item.name;
    b.onclick = () => {
      const spec = { id: item.id };
      if (item.scale) spec.scale = item.scale;
      if (item.keyed) spec.key = S.exKey;
      if (item.id === 'arana') spec.fret = 1;
      loadExercise(spec);
      showView('tocar');
    };
    box.appendChild(b);
  }
}
$('#exKey').onchange = e => { S.exKey = e.target.value; store.save(); };

// ---------- vista CANCIONES ----------
let genre = 'Todas';
const hueOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const GENRE_CLASS = { Blues: 'g-blues', "Rock'n'roll": 'g-rnr', Rock: 'g-rock', Pop: 'g-pop', Soul: 'g-soul' };
function sleeve(song, big) {
  const v = hueOf(song.id) % 3;
  return `<div class="sleeve ${GENRE_CLASS[song.genre]} v${v}${big ? ' big' : ''}" style="--h:${hueOf(song.id)}">
      <span class="yr">${song.year}</span>
      <b>${song.title}</b>
      <span class="ar">${song.artist}</span>
    </div>`;
}
function renderSongs() {
  const f = $('#genres');
  f.innerHTML = '';
  for (const g of ['Todas', ...GENRES]) {
    const b = document.createElement('button');
    b.textContent = g;
    b.classList.toggle('active', g === genre);
    b.onclick = () => { genre = g; renderSongs(); };
    f.appendChild(b);
  }
  const grid = $('#songGrid');
  grid.innerHTML = '';
  SONGS.filter(x => genre === 'Todas' || x.genre === genre).forEach((x, i) => {
    const card = document.createElement('button');
    card.className = 'song';
    card.style.animationDelay = i * 35 + 'ms';
    card.innerHTML = `${sleeve(x)}<div class="disc"></div>
      <div class="meta"><span>${x.genre}</span><span>${pretty(x.key)} · ${x.tempo} ppm</span></div>`;
    card.onclick = () => openSong(x);
    grid.appendChild(card);
  });
}
function openSong(x) {
  const d = $('#songDlg');
  const keyName = noteName(pcOf(x.key), x.key.includes('b'), S.latin);
  const minor = x.sections[0].chords.trim().split(/\s+/)[0].includes('m');
  const total = x.sections.reduce((n, s) => n + s.chords.split('|').length * s.times, 0);
  $('#songHead').innerHTML = `${sleeve(x, true)}
    <div>
      <p class="kick">${x.genre} · ${x.year}</p>
      <h2>${x.title}</h2>
      <p class="by">${x.artist}</p>
      <p class="facts"><span>Tono <b>${keyName}${minor ? ' menor' : ''}</b></span><span><b>${x.tempo}</b> ppm</span><span>Estilo <b>${STYLES[x.style].name}</b></span><span><b>${total}</b> compases</span></p>
      <p class="feel">${x.feel}</p>
    </div>`;
  const list = $('#songSections');
  list.innerHTML = '';
  x.sections.forEach((sec, i) => {
    const li = document.createElement('li');
    const chips = sec.chords.split('|').map(b => `<span>${pretty(b.trim())}</span>`).join('');
    li.innerHTML = `<div><b>${sec.name}</b>${sec.times > 1 ? ` <small>×${sec.times}</small>` : ''}</div><div class="bars">${chips}</div>`;
    const b = document.createElement('button');
    b.className = 'btn ghost sm';
    b.textContent = 'Practicar';
    b.onclick = () => playSong(x, i);
    li.appendChild(b);
    list.appendChild(li);
  });
  $('#songPlay').onclick = () => playSong(x, null);
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function playSong(x, idx) {
  const d = $('#songDlg');
  if (d.close) d.close(); else d.removeAttribute('open');
  applyPreset(idx === null ? `song:${x.id}` : `song:${x.id}:${idx}`);
  showView('tocar');
}
$('#songClose').onclick = () => { const d = $('#songDlg'); if (d.close) d.close(); else d.removeAttribute('open'); };
$('#songDlg').addEventListener('click', e => { if (e.target.id === 'songDlg') e.target.close(); });

// ---------- panel "ahora" ----------
function chordAt(bar, beat) {
  return song.bars[bar].segs.filter(s => s.beat <= beat + .001).pop();
}
const chordLabel = c => (c && c.name ? pretty(c.name) : '—');
function idleNow() {
  const b0 = range ? range[0] : 0;
  const first = song.bars[b0].segs[0];
  const next = song.segs.find(s => s.bar >= b0 && s.chord.name !== first.chord.name);
  $('#nowChord').textContent = chordLabel(first.chord);
  $('#nowNext').textContent = next ? chordLabel(next.chord) : '—';
  $('#nowNote').textContent = '—';
  $('#nowRole').textContent = 'pulsa Tocar';
  showBoard(b0, -1);
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
  const pos = engine.position();
  if (pos === null) return;
  if (pos < 0) {
    $('#nowNote').textContent = 5 + Math.floor(pos);
    $('#nowRole').textContent = 'preparados…';
    return;
  }
  const beat = pos + rangeStart();
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
  $('#nowChord').textContent = chordLabel(seg.chord);
  $('#nowNext').textContent = next ? chordLabel(next.chord) : '—';
  if (idx >= 0) {
    const n = song.notes[idx];
    $('#nowNote').textContent = noteName(n.midi, n.flats, S.latin);
    $('#nowRole').textContent = `${n.role ? n.role + ' · ' : ''}${['Sol', 'Re', 'La', 'Mi'][n.string]}, ${n.fret ? 'traste ' + n.fret : 'al aire'}`;
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
function setPlayingUI(on) {
  document.body.classList.toggle('playing', on);
  $('#play span').textContent = on ? 'Parar' : 'Tocar';
  if (!on && score) { score.clear(); if (song) idleNow(); }
}
let starting = false;
async function start() {
  if (!song || starting) return;
  starting = true;
  // init() se llama dentro del gesto del usuario (lo exige iOS); luego se espera a las muestras
  await engine.ready();
  starting = false;
  if (rampStart === null) rampStart = S.tempo;
  if (S.ramp.on && S.ramp.to <= S.tempo) toast(`Para acelerar, pon el objetivo por encima de ${S.tempo} ppm.`);
  engine.start(); setPlayingUI(true); lastNote = -2;
}
function toggle() {
  if (engine.playing) engine.stop();
  else start();
}
engine.onEnd = () => {
  setPlayingUI(false);
  if (rampStart !== null && S.tempo !== rampStart) {
    toast(`¡Has llegado a ${S.tempo} ppm! El tempo vuelve a ${rampStart} para la próxima.`);
    setTempo(rampStart);
  }
  rampStart = null;
  store.save();
};
setInterval(() => {
  if (!engine.playing) return;
  const d = today();
  S.log[d] = (S.log[d] || 0) + 1;
  if (S.daily.date !== d) { S.daily = { date: d, secs: [0, 0, 0] }; S.step = null; renderExBar(); }
  if (S.step !== null) {
    const goal = routineFor(dayNumber(), S.latin)[S.step].min * 60;
    if (++S.daily.secs[S.step] === goal) toast(S.step < 2 ? '¡Paso completado! Cuando quieras, pasa al siguiente.' : '¡Práctica de hoy completada! Muy bien.');
    updateStepTimer();
  }
  if (S.log[d] % 10 === 0) { store.save(); renderStreak(); }
}, 1000);

function renderStreak() {
  const day = new Date(), cells = [];
  const done = d => (S.log[dateKey(d)] || 0) >= 60;
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

// ---------- pantalla grande ----------
function setStage(on) {
  stage = on;
  document.body.classList.toggle('stage', on);
  $('#stageBtn span').textContent = on ? 'Pantalla normal' : 'Pantalla grande';
  const doc = document.documentElement;
  try {
    if (on && !document.fullscreenElement && !document.webkitFullscreenElement) {
      const req = doc.requestFullscreen || doc.webkitRequestFullscreen;
      if (req) { const p = req.call(doc); if (p && p.catch) p.catch(() => {}); }
    } else if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); }
    }
  } catch (e) { /* sin pantalla completa: basta con el modo grande */ }
  if (song) draw();
  window.scrollTo({ top: 0 });
}
$('#stageBtn').onclick = () => setStage(!stage);
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(ev, () => {
    if (stage && !document.fullscreenElement && !document.webkitFullscreenElement) setStage(false);
  });
}

// ---------- teclado y pedal ----------
// Al tocar un botón con el dedo o el ratón, se le quita el foco para que el pedal
// (que envía Espacio, flechas o AvPág) siga controlando la reproducción.
document.addEventListener('pointerup', () => setTimeout(() => {
  const a = document.activeElement;
  if (a && a.matches('button, input[type=checkbox], input[type=range]')) a.blur();
}, 0));
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const t = e.target;
  if (t.matches('textarea, select, input:not([type=checkbox]):not([type=range])')) return;
  if (!$('#view-tocar').classList.contains('active')) return;
  const k = e.key;
  const onControl = t.matches('button, input');
  if ((k === ' ' || k === 'Enter') && onControl) return; // activa el control enfocado
  if (/^Arrow/.test(k) && t.matches('input[type=range]')) return;
  if ([' ', 'Enter', 'ArrowRight', 'ArrowDown', 'PageDown'].includes(k)) toggle();
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) start();
  else if (k === '+' || k === '=') setTempo(S.tempo + 4);
  else if (k === '-') setTempo(S.tempo - 4);
  else if (k === 'f' || k === 'F') setStage(!stage);
  else if (k === 'Escape' && stage) setStage(false);
  else return;
  e.preventDefault();
});

// ---------- eventos ----------
$('#play').onclick = toggle;
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
  rebuild(); game.refresh(); tuner.refresh(); renderToday(); renderSongs();
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
  S.text = t; S.preset = 'custom'; S.seed = 0; S.step = null; range = null;
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

function showView(name) {
  if (engine.playing) engine.stop();
  if (stage && name !== 'tocar') setStage(false);
  $$('.tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'tocar' && song) draw();
  if (name === 'hoy') renderToday();
  if (name === 'canciones') renderSongs();
  if (name === 'riffs') riffs.render();
  window.scrollTo({ top: 0 });
}
$$('.tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => song && $('#view-tocar').classList.contains('active') && draw(), 150);
});

// ---------- app instalable ----------
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ios = /iPad|iPhone/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
$('#installTip').hidden = standalone || !ios;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
}

// ---------- arranque ----------
engine.preload();
engine.tempo = S.tempo; engine.loop = S.loop; engine.countIn = S.countIn;
engine.muteBass = S.mute; engine.vol = S.vol;
fillPresets(); fillKeys(); fillStyles(); fillLibrary(); renderRamp();
board = createFretboard($('#nowBoard'), { frets: 12, latin: S.latin });
const riffs = initRiffs($('#view-riffs'), { store, engine, getLatin: () => S.latin, onPlay: playRiff, notify: toast });
const game = initGame($('#view-diapason'), engine, store, () => S.latin);
const tuner = initTuner($('#view-afinador'), engine, () => S.latin);
if (!S.text) { const p = findPreset('blues12'); S.text = realize(p.roman, p.key); }
if (S.mode === 'ex' && !S.ex) S.mode = 'song';
setTempo(S.tempo);
rebuild();
renderStreak();
renderToday();
renderSongs();
requestAnimationFrame(frame);

// ---------- riff recibido por enlace ----------
async function openSharedRiff() {
  if (!/[#&]riff=/.test(location.hash)) return;
  const riff = await riffFromHash(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!riff) { toast('El enlace del riff no es válido o está incompleto.'); return; }
  showView('riffs');
  toast(riffs.add(riff) ? `«${riff.name}» añadido a Mis riffs.` : `«${riff.name}» ya estaba en Mis riffs.`);
}
openSharedRiff();
window.addEventListener('hashchange', openSharedRiff);

