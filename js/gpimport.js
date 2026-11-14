// Importa archivos de Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) y MusicXML a «Mis riffs».
// La lectura del archivo la hace alphaTab (vendor/alphaTab.min.js, MPL-2.0), que solo se
// descarga cuando se importa algo. El archivo no sale del navegador.
import { fingering, parseChord } from './theory.js';

const TICKS_BAR = 3840; // un compás de 4/4 en ticks MIDI (960 por negra)
const STANDARD = [43, 38, 33, 28];

let lib = null;
function loadLib() {
  if (!lib) {
    lib = new Promise((resolve, reject) => {
      if (window.alphaTab) return resolve(window.alphaTab);
      const s = document.createElement('script');
      s.src = 'vendor/alphaTab.min.js';
      s.onload = () => resolve(window.alphaTab);
      s.onerror = () => { lib = null; reject(new Error('No se pudo cargar el lector de Guitar Pro. Revisa la conexión.')); };
      document.head.appendChild(s);
    });
  }
  return lib;
}

export async function readScore(arrayBuffer) {
  const at = await loadLib();
  return at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(arrayBuffer));
}

const tuningOf = track => [...(track.staves[0].tuning || [])];

/** Pistas que se pueden importar (sin percusión), con la de bajo más probable primero marcada. */
export function listTracks(score) {
  const tracks = score.tracks
    .filter(t => !t.staves[0].isPercussion)
    .map(t => {
      const tuning = tuningOf(t);
      let notes = 0;
      for (const bar of t.staves[0].bars) for (const b of bar.voices[0].beats) if (b.notes.length) notes++;
      const low = tuning.length ? Math.min(...tuning) : 99;
      return {
        index: t.index, name: (t.name || `Pista ${t.index + 1}`).trim(), strings: tuning.length, notes,
        standard: tuning.length === 4 && tuning.every((m, i) => m === STANDARD[i]),
        bass: /bass|bajo|basse/i.test(t.name || '') || (tuning.length >= 4 && tuning.length <= 6 && low <= 31),
      };
    });
  const best = tracks.find(t => t.bass && t.notes) || tracks.find(t => t.notes) || tracks[0];
  return { tracks, best: best ? best.index : -1 };
}

/**
 * Convierte una pista en un riff de la cuadrícula. Devuelve también avisos sobre lo que
 * hubo que adaptar (afinación, compases que no son de 4/4, tresillos…).
 */
export function trackToRiff(score, trackIndex, from, to, fileName = '') {
  const track = score.tracks[trackIndex];
  const staff = track.staves[0];
  const tuning = tuningOf(track);
  const standard = tuning.length === 4 && tuning.every((m, i) => m === STANDARD[i]);
  const warnings = [];
  const first = Math.max(0, from - 1), last = Math.min(staff.bars.length, to);

  // 1) recoger los eventos de cada compás en ticks
  const bars = [];
  let fine = false, odd = 0, offGrid = 0, chordsFound = 0;
  for (let b = first; b < last; b++) {
    const mb = score.masterBars[b];
    if (mb.timeSignatureNumerator * (TICKS_BAR / mb.timeSignatureDenominator) !== TICKS_BAR) odd++;
    const events = [];
    let chord = '';
    for (const beat of staff.bars[b].voices[0].beats) {
      if (!chord && beat.chord && beat.chord.name && parseChord(beat.chord.name)) chord = beat.chord.name.trim();
      const start = beat.playbackStart;
      if (start >= TICKS_BAR) continue;
      if (start % 480) fine = true; // algo cae fuera de las corcheas: hace falta cuadrícula de semicorcheas
      if (start % 240) offGrid++;
      const played = beat.notes.filter(n => !n.isDead && (!n.isTieDestination || start === 0));
      if (beat.isRest || !beat.notes.length || beat.notes.every(n => n.isDead)) events.push({ start, rest: true });
      else if (played.length) {
        const n = played.reduce((a, c) => (c.realValue < a.realValue ? c : a));
        events.push({ start, midi: n.realValue, string: tuning.length - n.string, fret: n.fret });
      } // nota ligada a mitad de compás: sigue sonando la anterior
    }
    if (chord) chordsFound++;
    bars.push({ events, chord });
  }

  // 2) afinación: si no es un bajo de 4 cuerdas estándar, se recoloca en el mástil
  const notes = bars.flatMap(b => b.events.filter(e => !e.rest));
  if (!standard && notes.length) {
    let shift = 0;
    const lo = Math.min(...notes.map(n => n.midi)), hi = Math.max(...notes.map(n => n.midi));
    while (lo + shift < 28) shift += 12;
    while (hi + shift > 28 + 12 + 24 && lo + shift - 12 >= 28) shift -= 12;
    notes.forEach(n => { n.midi = Math.min(n.midi + shift, 43 + 24); });
    fingering(notes.map(n => n.midi), 24).forEach((f, i) => Object.assign(notes[i], f));
    warnings.push(tuning.length === 4
      ? 'La pista usa otra afinación: las notas se han recolocado para un bajo en afinación estándar (Mi La Re Sol).'
      : `La pista es de ${tuning.length} cuerdas: las notas se han recolocado en un bajo de 4 cuerdas${shift ? ' (cambiando de octava)' : ''}.`);
  }

  // 3) pasar a la cuadrícula
  const res = fine ? 16 : 8, step = TICKS_BAR / res;
  let dropped = 0;
  const grid = bars.map(({ events }) => {
    const steps = Array(res).fill(0);
    let sounding = false;
    for (const e of events) {
      const i = Math.round(e.start / step);
      if (i >= res) { if (!e.rest) dropped++; continue; }
      if (e.rest) { if (sounding && steps[i] === 0) steps[i] = 'r'; sounding = false; }
      else if (Array.isArray(steps[i])) dropped++;
      else { steps[i] = [e.string, e.fret]; sounding = true; }
    }
    return steps;
  });

  if (odd) warnings.push(`${odd} ${odd === 1 ? 'compás no es' : 'compases no son'} de 4/4: se han ajustado a cuatro tiempos y pueden sonar distinto.`);
  if (offGrid) warnings.push('Hay tresillos o figuras muy rápidas: se han aproximado a la semicorchea más cercana.');
  if (dropped) warnings.push(`${dropped} ${dropped === 1 ? 'nota no cabía' : 'notas no cabían'} en la cuadrícula y se ${dropped === 1 ? 'ha' : 'han'} omitido.`);

  // acordes: solo si el archivo los trae; se rellenan hacia delante
  let chords = '';
  if (chordsFound) {
    let cur = bars.find(b => b.chord).chord;
    chords = bars.map(b => { if (b.chord) cur = b.chord; return cur; }).join(' | ');
  }

  const title = (score.title || fileName.replace(/\.[^.]+$/, '') || 'Importado').trim();
  const name = `${title} · ${(track.name || 'pista').trim()}`.slice(0, 50);
  const tempo = Math.max(40, Math.min(200, Math.round(score.tempo || 100)));
  return {
    riff: { id: 'r' + Date.now(), name, tempo, style: 'rock', res, chords, bars: grid },
    warnings, noteCount: grid.reduce((n, b) => n + b.filter(Array.isArray).length, 0),
  };
}
