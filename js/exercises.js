// Ejercicios técnicos (escalas, arpegios, araña…) y la rutina diaria de práctica.
import { parseChord, fingering, pcOf, noteName, realize, OPEN, LOW } from './theory.js';
import { STYLES, PRESETS, parseProgression, generate } from './generator.js';

export const SCALES = {
  mayor: { name: 'Escala mayor', steps: [0, 2, 4, 5, 7, 9, 11, 12], chord: '', minor: false,
    desc: 'La escala del Do-Re-Mi. Súbela y bájala escuchando el acorde de fondo.' },
  pentam: { name: 'Pentatónica menor', steps: [0, 3, 5, 7, 10, 12], chord: 'm7', minor: true,
    desc: 'Cinco notas que son la base del blues y del rock. Imprescindible.' },
  pentaM: { name: 'Pentatónica mayor', steps: [0, 2, 4, 7, 9, 12], chord: '', minor: false,
    desc: 'La pentatónica alegre: country, rock\'n\'roll y soul.' },
  blues: { name: 'Escala de blues', steps: [0, 3, 5, 6, 7, 10, 12], chord: '7', minor: true,
    desc: 'La pentatónica menor más la «blue note». Suena a blues desde la primera nota.' },
  menor: { name: 'Escala menor', steps: [0, 2, 3, 5, 7, 8, 10, 12], chord: 'm', minor: true,
    desc: 'La escala menor natural: más triste y seria que la mayor.' },
};

export const LIBRARY = [
  { id: 'arana', name: 'Araña cromática', keyed: false },
  ...Object.entries(SCALES).map(([scale, s]) => ({ id: 'scale', scale, name: s.name, keyed: true })),
  { id: 'arpegios', name: 'Arpegios del blues', keyed: true },
  { id: 'octavas', name: 'Octavas', keyed: true },
  { id: 'ciclo', name: 'Ciclo de cuartas', keyed: false },
];

const DEGREE = { 0: 'tónica', 2: 'segunda', 3: 'tercera menor', 4: 'tercera', 5: 'cuarta',
  6: 'quinta disminuida (blue note)', 7: 'quinta', 8: 'sexta menor', 9: 'sexta',
  10: 'séptima menor', 11: 'séptima', 12: 'octava' };
const BLUES12 = 'I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7';

const keyLabel = (key, latin) => noteName(pcOf(key), key.includes('b'), latin);

export function exerciseInfo(spec) {
  switch (spec.id) {
    case 'arana': return { name: 'Araña cromática',
      desc: 'Un dedo por traste, cuerda a cuerda, subiendo y bajando. Despierta los dedos: despacio y limpio.' };
    case 'scale': return { name: SCALES[spec.scale].name, desc: SCALES[spec.scale].desc };
    case 'arpegios': return { name: 'Arpegios del blues',
      desc: 'Fundamental, tercera, quinta y séptima de cada acorde del blues de 12 compases.' };
    case 'octavas': return { name: 'Octavas',
      desc: 'La fundamental y su octava, saltando con la mano. La base del funk y la disco.' };
    case 'ciclo': return { name: 'Ciclo de cuartas',
      desc: 'Fundamental y quinta por los doce tonos. Para conocer todo el mástil.' };
  }
  return { name: 'Ejercicio', desc: '' };
}

export function exerciseTitle(spec, latin) {
  const { name } = exerciseInfo(spec);
  if (spec.id === 'arana') return `${name} desde el traste ${spec.fret || 1}`;
  return spec.key ? `${name} en ${keyLabel(spec.key, latin)}` : name;
}

const exStyle = (info, tempo, comp, pats) => ({
  name: info.name, desc: info.desc, tempo, swing: false, sub: 4, pats,
  drums: { kick: [0, 2], hat: [0, 1, 2, 3] }, comp,
});

/** Convierte una lista de notas seguidas en una «canción» con el mismo formato que generate(). */
function fromNotes(seq, chord, style) {
  let at = 0;
  const notes = seq.map(s => {
    const n = { ...s, at, bar: Math.floor(at / 4), beat: at % 4, chord, flats: s.flats ?? chord.flats };
    at += s.dur;
    return n;
  });
  const total = Math.ceil(at / 4) * 4;
  notes[notes.length - 1].dur += total - at;
  const need = notes.filter(n => n.string === undefined);
  fingering(need.map(n => n.midi)).forEach((f, i) => Object.assign(need[i], f));
  const segs = [], bars = [];
  for (let b = 0; b < total / 4; b++) {
    const seg = { bar: b, beat: 0, len: 4, chord, run: b };
    segs.push(seg);
    bars.push({ segs: [seg] });
  }
  return { bars, segs, notes, total, style, styleId: 'ex' };
}

function aranaSong(fret, info) {
  const up = [];
  for (const s of [3, 2, 1, 0]) for (let k = 0; k < 4; k++) up.push({ string: s, fret: fret + k, k });
  const down = [];
  for (const s of [0, 1, 2, 3]) for (let k = 3; k >= 0; k--) down.push({ string: s, fret: fret + k, k });
  const seq = [...up, ...down].map(n => ({
    midi: OPEN[n.string] + n.fret, string: n.string, fret: n.fret, dur: 1, role: `dedo ${n.k + 1}`, flats: false,
  }));
  const chord = { name: '', rootPc: 4, bassPc: 4, flats: false, tones: [], minor: false };
  return fromNotes(seq, chord, exStyle(info, 60, []));
}

function scaleSong(scale, key, info) {
  const sc = SCALES[scale], pc = pcOf(key);
  const chord = parseChord(key + sc.chord);
  // tonalidades con bemoles: para las menores, mira su relativa mayor
  const flats = sc.minor ? ![7, 2, 9, 4, 11].includes((pc + 3) % 12) : [5, 10, 3, 8, 1].includes(pc);
  const root = LOW + ((pc - 4 + 12) % 12);
  const seq = [...sc.steps, ...sc.steps.slice(0, -1).reverse()]
    .map(iv => ({ midi: root + iv, dur: 1, role: DEGREE[iv], flats }));
  return fromNotes(seq, chord, exStyle(info, 70, [[0, 4]]));
}

const viaGenerator = (text, style) => generate(parseProgression(text), style, 2, 0);

export function makeExercise(spec) {
  const info = exerciseInfo(spec);
  switch (spec.id) {
    case 'arana': return aranaSong(spec.fret || 1, info);
    case 'scale': return scaleSong(spec.scale, spec.key, info);
    case 'arpegios': return viaGenerator(realize(BLUES12, spec.key),
      exStyle(info, 76, [[0, 4]], { 2: ['R:1 3:1 5:1 7:1 | 8:1 7:1 5:1 3:1'] }));
    case 'octavas': return viaGenerator(realize('I | IV | V | I', spec.key),
      exStyle(info, 84, [[0, 2], [2, 2]], { 2: ['R:.5 8:.5 R:.5 8:.5 R:.5 8:.5 R:.5 8:.5'] }));
    case 'ciclo': return viaGenerator('C | F | Bb | Eb | Ab | Db | Gb | B | E | A | D | G',
      exStyle(info, 72, [[0, 4]], { 2: ['R:1 5:1 8:1 5:1'] }));
  }
  throw new Error('Ejercicio desconocido: ' + spec.id);
}

// ---------- rutina diaria ----------
const EASY_KEYS = ['A', 'E', 'G', 'D', 'C', 'F', 'Bb'];

export const dayNumber = (d = new Date()) =>
  Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);

function pick(day, salt, n) {
  let h = Math.imul(day + salt * 7919, 0x9e3779b1) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
  return h % n;
}

/** Tres pasos (calentamiento, técnica y groove) que cambian cada día. */
export function routineFor(day, latin) {
  const warmups = [
    { id: 'arana', fret: 1 + pick(day, 1, 5) },
    { id: 'ciclo' },
    { id: 'octavas', key: EASY_KEYS[pick(day, 2, EASY_KEYS.length)] },
  ];
  const warm = warmups[pick(day, 3, warmups.length)];
  const techs = [...Object.keys(SCALES).map(scale => ({ id: 'scale', scale })), { id: 'arpegios' }];
  const tech = { ...techs[pick(day, 4, techs.length)], key: EASY_KEYS[pick(day, 5, EASY_KEYS.length)] };
  const presets = PRESETS.flatMap(g => g.items);
  const p = presets[pick(day, 6, presets.length)];
  const st = STYLES[p.style];
  return [
    { kicker: 'Calentamiento', min: 3, ex: warm, title: exerciseTitle(warm, latin), desc: exerciseInfo(warm).desc },
    { kicker: 'Técnica', min: 5, ex: tech, title: exerciseTitle(tech, latin), desc: exerciseInfo(tech).desc },
    { kicker: 'Groove', min: 7, preset: p.id, title: `${p.name} · ${st.name}`, desc: st.desc },
  ];
}
