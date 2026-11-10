// Generador de líneas de bajo y de acompañamiento (batería + acordes) por estilos.
import { parseChord, fingering, LOW, HIGH } from './theory.js';

const E8 = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], Q = [0, 1, 2, 3], OFF = [.5, 1.5, 2.5, 3.5];

/*
 * Patrones: "ficha:duración" separados por espacios; "|" separa compases de un
 * patrón de dos compases. Fichas: R fundamental, 3 tercera, 5 quinta, 6 sexta,
 * 7 séptima, 8 octava, b3/b5/b7/2/4 grados fijos, "5-" quinta grave, "_" silencio,
 * "A/x" nota de aproximación al acorde siguiente (o x si el acorde no cambia).
 */
export const STYLES = {
  blues: {
    name: 'Blues shuffle', desc: 'El shuffle atresillado de Chicago: relajado y con balanceo.',
    swing: true, tempo: 92, sub: 4,
    pats: {
      1: ['R:1 R:1 R:1 R:1', 'R:1 R:1 5:1 5:1', 'R:1 5:1 R:1 5:1'],
      2: ['R:1 3:1 5:1 6:1 | 7:1 6:1 5:1 3:1', 'R:1 3:1 5:1 6:1', 'R:1 3:1 5:1 A/3:1', 'R:1 R:.5 R:.5 5:1 6:1'],
      3: ['R:.5 R:.5 3:.5 3:.5 5:.5 5:.5 6:.5 6:.5 | 7:.5 7:.5 6:.5 6:.5 5:.5 5:.5 3:.5 3:.5',
        'R:.5 R:.5 3:.5 3:.5 5:.5 5:.5 6:.5 5:.5', 'R:1 b3:.5 3:.5 5:1 6:.5 A/5:.5'],
    },
    drums: { kick: [0, 2], snare: [1, 3], hat: E8 }, comp: [[0, 1.4], [1.5, .5], [2, 1.4], [3.5, .5]],
  },
  walking: {
    name: 'Walking', desc: 'Una nota por tiempo, caminando de un acorde al siguiente. Blues lento y jazz.',
    swing: true, tempo: 104, sub: 4, walking: true,
    drums: { kick: [0], hat: [1, 3], ride: [0, 1, 1.5, 2, 3, 3.5] }, comp: [[0, 1.4], [1.5, 2.4]],
  },
  rock: {
    name: 'Rock', desc: 'Corcheas rectas y firmes sobre la fundamental. Empuje constante.',
    swing: false, tempo: 116, sub: 8,
    pats: {
      1: ['R:1 R:1 R:1 R:1', 'R:2 R:1 R:1', 'R:1.5 R:.5 R:2'],
      2: ['R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 R:.5', 'R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 A/R:.5',
        'R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 5:.5 5:.5'],
      3: ['R:.5 R:.5 8:.5 R:.5 R:.5 8:.5 b7:.5 5:.5', 'R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 b3:.5 3:.5',
        'R:1 R:.5 R:.5 _:.5 R:.5 5:.5 A/b7:.5'],
    },
    drums: { kick: [0, 2, 2.5], snare: [1, 3], hat: E8 }, comp: [[0, 2], [2, 2]],
  },
  rocknroll: {
    name: "Rock'n'roll", desc: 'Boogie de los años 50: arpegios que suben y bajan sin parar.',
    swing: false, tempo: 138, sub: 4,
    pats: {
      1: ['R:1 3:1 5:1 3:1', 'R:1 R:1 5:1 5:1'],
      2: ['R:1 3:1 5:1 6:1 | 7:1 6:1 5:1 3:1', 'R:1 3:1 5:1 6:1 | 8:1 6:1 5:1 3:1'],
      3: ['R:.5 R:.5 3:.5 3:.5 5:.5 5:.5 6:.5 6:.5 | 7:.5 7:.5 6:.5 6:.5 5:.5 5:.5 3:.5 3:.5',
        'R:.5 3:.5 5:.5 6:.5 7:.5 6:.5 5:.5 3:.5', 'R:.5 3:.5 5:.5 6:.5 8:.5 6:.5 5:.5 3:.5'],
    },
    drums: { kick: [0, 1.5, 2], snare: [1, 3], hat: E8 }, comp: [[0, .4], [1, .4], [2, .4], [3, .4]],
  },
  pop: {
    name: 'Pop', desc: 'Negra con puntillo y corchea: el ritmo de mil canciones.',
    swing: false, tempo: 100, sub: 8,
    pats: {
      1: ['R:4', 'R:2 R:2', 'R:3 R:1'],
      2: ['R:1.5 R:.5 R:2', 'R:1.5 R:.5 R:1 5:1', 'R:1.5 R:.5 R:1.5 A/5:.5'],
      3: ['R:1.5 R:.5 _:.5 R:.5 5:.5 8:.5', 'R:1.5 5:.5 8:1 5:.5 A/R:.5', 'R:.5 R:.5 R:.5 R:.5 R:.5 R:.5 5:.5 A/3:.5'],
    },
    drums: { kick: [0, 1.5, 2], snare: [1, 3], hat: E8 }, comp: [[0, 1.5], [1.5, 2.5]],
  },
  country: {
    name: 'Country', desc: 'Fundamental y quinta alternadas, a dos tiempos. Sencillo y bailable.',
    swing: false, tempo: 108, sub: 4,
    pats: {
      1: ['R:2 5-:2', 'R:1 _:1 5-:1 _:1'],
      2: ['R:1 5-:1 R:1 5-:1', 'R:1 5-:1 R:1 A/5-:1'],
      3: ['R:1 5-:.5 5-:.5 R:1 5-:.5 A/6:.5', 'R:1 5-:1 R:.5 2:.5 3:.5 A/5:.5'],
    },
    drums: { kick: [0, 2], snare: [1, 3], hat: E8 }, comp: [[1, .4], [3, .4]],
  },
  reggae: {
    name: 'Reggae', desc: 'Graves gordos, silencios y el acorde a contratiempo.',
    swing: false, tempo: 76, sub: 8,
    pats: {
      1: ['R:1.5 R:.5 5:1 _:1', 'R:1 _:1 R:.5 R:.5 5:1'],
      2: ['R:.5 R:.5 _:.5 R:.5 3:.5 5:.5 _:1', 'R:1 _:.5 5:.5 3:.5 R:.5 _:1'],
      3: ['R:.5 R:.5 _:.5 5:.5 3:.5 5:.5 R:.5 A/6:.5', 'R:.5 3:.5 5:.5 _:.5 8:.5 5:.5 3:.5 A/R:.5'],
    },
    drums: { kick: [2], rim: [2], hat: E8 }, comp: [[1, .3], [3, .3]],
  },
  funk: {
    name: 'Funk / Disco', desc: 'Octavas saltarinas con el bombo a negras.',
    swing: false, tempo: 110, sub: 8,
    pats: {
      1: ['R:1 8:1 R:1 8:1', 'R:1 R:1 8:1 R:1'],
      2: ['R:.5 8:.5 R:.5 8:.5 R:.5 8:.5 R:.5 8:.5', 'R:.5 8:.5 R:.5 8:.5 R:.5 8:.5 b7:.5 8:.5'],
      3: ['R:.5 R:.5 8:.5 R:.5 _:.5 b7:.5 8:.5 A/5:.5', 'R:.5 8:.5 5:.5 8:.5 R:.5 8:.5 b7:.5 5:.5'],
    },
    drums: { kick: Q, snare: [1, 3], ohat: OFF }, comp: [[.5, .3], [1.5, .3], [2.5, .3], [3.5, .3]],
  },
  bossa: {
    name: 'Bossa / Latino', desc: 'Fundamental y quinta con aire brasileño.',
    swing: false, tempo: 120, sub: 8,
    pats: {
      1: ['R:2 5:2'],
      2: ['R:1.5 5:.5 5:2', 'R:1.5 5:.5 5:1.5 R:.5'],
      3: ['R:1.5 5:.5 5:1 8:.5 A/5:.5', 'R:1.5 5:.5 8:1.5 5:.5'],
    },
    drums: { kick: [0, 1.5, 2, 3.5], rim: [0, 1.5, 3], hat: E8 }, comp: [[0, 1], [1.5, 1], [3, .8]],
  },
  balada: {
    name: 'Balada', desc: 'Notas largas y pocas. Para tocar despacio y con buen sonido.',
    swing: false, tempo: 70, sub: 4,
    pats: {
      1: ['R:4', 'R:3 R:1'],
      2: ['R:3 5:1', 'R:2 5:1 A/3:1'],
      3: ['R:1.5 5:.5 8:1 5:.5 A/3:.5', 'R:2 3:1 5:.5 A/6:.5'],
    },
    drums: { kick: [0, 2.5], snare: [1, 3], hat: E8 }, comp: [[0, 4]],
  },
};

const compiled = new Map();
function compile(str) {
  if (!compiled.has(str)) {
    compiled.set(str, str.split('|').map(bar => bar.trim().split(/\s+/).map(t => {
      const i = t.lastIndexOf(':');
      return { tok: t.slice(0, i), dur: parseFloat(t.slice(i + 1)) };
    })));
  }
  return compiled.get(str);
}

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texto "A7 | D7 | A7 E7" -> compases con acordes. */
export function parseProgression(text) {
  const bars = [], errors = [];
  let prev = null;
  for (const raw of text.split(/[|\n]/)) {
    const names = raw.trim().split(/\s+/).filter(Boolean);
    if (!names.length) continue;
    const chords = [];
    for (const n of names.slice(0, 4)) {
      const c = n === '%' ? prev : parseChord(n);
      if (!c) errors.push(n); else { chords.push(c); prev = c; }
    }
    if (chords.length) bars.push(chords);
  }
  return { bars, errors };
}

const rootMidi = c => LOW + ((c.bassPc - 4 + 12) % 12);
const fit = m => (m > HIGH ? m - 12 : m < LOW ? m + 12 : m);

function tokMidi(tok, chord) {
  const root = rootMidi(chord);
  const down = tok.endsWith('-');
  const base = down ? tok.slice(0, -1) : tok;
  const iv = { R: 0, b2: 1, 2: 2, b3: 3, 3: chord.third, 4: 5, b5: 6, 5: chord.fifth,
    6: chord.sixth, b7: 10, 7: chord.top, 8: 12 }[base];
  if (down) return root + iv - 12 < LOW ? root + iv : root + iv - 12;
  return fit(root + iv);
}

function approach(next, prev, rand) {
  const t = rootMidi(next);
  const r = rand();
  const cands = r < .45 ? [t - 1, t + 1] : r < .75 ? [t + 1, t - 1] : [t + 7, t - 5, t - 1];
  for (const c of cands) if (c >= LOW && c <= HIGH && c !== prev) return c;
  return fit(t - 1);
}

function halfPattern(style, level) {
  if (level === 1) return [{ tok: 'R', dur: 2 }];
  if (level === 3 && style.sub === 8) {
    return [{ tok: 'R', dur: .5 }, { tok: 'R', dur: .5 }, { tok: '5', dur: .5 }, { tok: 'A/5', dur: .5 }];
  }
  return [{ tok: 'R', dur: 1 }, { tok: level === 3 ? 'A/5' : '5', dur: 1 }];
}

function walkBar(chord, level, changes, rand) {
  if (level === 1) return compile('R:1 3:1 5:1 3:1')[0];
  const shapes = [['3', '5'], ['2', '3'], ['5', '3'], ['3', '4']];
  if (level === 3) {
    shapes.push(['8', 'b7'], ['5', '6'], ['b7', '5']);
    if (!chord.minor) shapes.push(['b3', '3']);
  }
  const [a, b] = shapes[Math.floor(rand() * shapes.length)];
  const last = changes ? 'A/5' : ['5', '3', '6'].filter(t => t !== b)[Math.floor(rand() * 2)];
  const out = [{ tok: level === 3 && rand() < .2 ? '8' : 'R', dur: 1 }];
  if (level === 3 && rand() < .25) out.push({ tok: a, dur: .5 }, { tok: a, dur: .5 });
  else out.push({ tok: a, dur: 1 });
  out.push({ tok: b, dur: 1 }, { tok: last, dur: 1 });
  return out;
}

const ROLES = { 0: 'fundamental', 2: 'segunda', 3: 'tercera menor', 4: 'tercera', 5: 'cuarta',
  7: 'quinta', 9: 'sexta', 10: 'séptima', 11: 'séptima mayor' };

export function generate(prog, styleId, level, seed) {
  const style = STYLES[styleId];
  const rand = rng(seed + 1);
  const segs = [];
  prog.bars.forEach((chords, bar) => {
    const n = chords.length;
    const lens = n === 1 ? [4] : n === 2 ? [2, 2] : n === 3 ? [2, 1, 1] : [1, 1, 1, 1];
    let beat = 0;
    chords.forEach((chord, i) => { segs.push({ bar, beat, len: lens[i], chord }); beat += lens[i]; });
  });
  // posición de cada compás dentro de una racha del mismo acorde (para patrones de dos compases)
  segs.forEach((s, i) => {
    const p = segs[i - 1];
    s.run = s.len === 4 && p && p.len === 4 && p.chord.name === s.chord.name ? p.run + 1 : 0;
  });
  const variant = style.pats ? compile(style.pats[level][seed % style.pats[level].length]) : null;

  const notes = [];
  let prev = -1;
  segs.forEach((seg, i) => {
    const next = segs[(i + 1) % segs.length].chord;
    const changes = next.bassPc !== seg.chord.bassPc;
    const items = seg.len === 1 ? [{ tok: 'R', dur: 1 }]
      : seg.len === 2 ? halfPattern(style, level)
        : style.walking ? walkBar(seg.chord, level, changes, rand)
          : variant[seg.run % variant.length];
    let beat = seg.beat;
    for (const { tok, dur } of items) {
      if (tok !== '_') {
        let midi, role, flats = seg.chord.flats;
        if (tok.startsWith('A/')) {
          if (changes) {
            midi = approach(next, prev, rand); role = 'nota de paso';
            // cromatismo: bemol si baja hacia el acorde siguiente, sostenido si sube
            const d = ((midi - rootMidi(next)) % 12 + 12) % 12;
            flats = d === 1 ? true : d === 11 ? false : next.flats;
          }
          else midi = tokMidi(tok.slice(2), seg.chord);
        } else midi = tokMidi(tok, seg.chord);
        if (!role) {
          const iv = ((midi - rootMidi(seg.chord)) % 12 + 12) % 12;
          role = iv === 0 && midi !== rootMidi(seg.chord) ? 'octava' : ROLES[iv] || 'nota de paso';
        }
        notes.push({ bar: seg.bar, beat, dur, midi, role, flats, chord: seg.chord, at: seg.bar * 4 + beat });
        prev = midi;
      }
      beat += dur;
    }
  });
  fingering(notes.map(n => n.midi)).forEach((f, i) => Object.assign(notes[i], f));

  const bars = prog.bars.map((_, b) => ({ segs: segs.filter(s => s.bar === b) }));
  return { bars, segs, notes, total: bars.length * 4, style, styleId };
}

function voicing(chord) {
  return chord.tones.map(iv => {
    let m = 48 + ((chord.rootPc + iv) % 12);
    if (m < 52) m += 12;
    return m;
  });
}

/** Eventos de audio (bajo + batería + acordes) ordenados por tiempo. */
export function buildEvents(song) {
  const ev = song.notes.map(n => ({ beat: n.at, dur: n.dur, type: 'bass', midi: n.midi }));
  const { drums, comp } = song.style;
  song.bars.forEach((bar, b) => {
    for (const [type, hits] of Object.entries(drums)) {
      for (const h of hits) ev.push({ beat: b * 4 + h, dur: .5, type, vel: h % 1 ? .6 : 1 });
    }
    for (const [h, dur] of comp) {
      const seg = bar.segs.filter(s => s.beat <= h).pop();
      ev.push({ beat: b * 4 + h, dur, type: 'chord', midis: voicing(seg.chord) });
    }
  });
  return ev.sort((a, b) => a.beat - b.beat);
}

// Progresiones en grados; se realizan en la tonalidad elegida.
export const PRESETS = [
  { group: 'Blues', items: [
    { id: 'blues12', name: 'Blues de 12 compases', key: 'A', style: 'blues',
      roman: 'I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7' },
    { id: 'bluesquick', name: 'Blues con cambio rápido', key: 'E', style: 'blues',
      roman: 'I7 | IV7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7' },
    { id: 'bluesminor', name: 'Blues menor', key: 'A', style: 'walking',
      roman: 'i7 | i7 | i7 | i7 | iv7 | iv7 | i7 | i7 | bVI7 | V7 | i7 | V7' },
    { id: 'blues8', name: 'Blues de 8 compases', key: 'E', style: 'blues',
      roman: 'I7 | V7 | IV7 | IV7 | I7 | V7 | I7 IV7 | I7 V7' },
  ] },
  { group: 'Rock', items: [
    { id: 'rnr12', name: "Rock'n'roll clásico", key: 'A', style: 'rocknroll',
      roman: 'I | I | I | I | IV | IV | I | I | V | IV | I | I' },
    { id: 'rock3', name: 'Rock de tres acordes', key: 'A', style: 'rock', roman: 'I | IV | V | IV' },
    { id: 'rockmixo', name: 'Rock sureño', key: 'D', style: 'rock', roman: 'I | bVII | IV | IV' },
    { id: 'andaluza', name: 'Cadencia andaluza', key: 'A', style: 'rock', roman: 'i | bVII | bVI | V7' },
    { id: 'rockminor', name: 'Rock menor', key: 'E', style: 'rock', roman: 'i | bVI | bIII | bVII' },
  ] },
  { group: 'Pop y baladas', items: [
    { id: 'pop4', name: 'Los cuatro acordes del pop', key: 'G', style: 'pop', roman: 'I | V | vi | IV' },
    { id: 'fifties', name: 'Años 50', key: 'C', style: 'balada', roman: 'I | vi | IV | V' },
    { id: 'popminor', name: 'Pop en menor', key: 'C', style: 'pop', roman: 'vi | IV | I | V' },
    { id: 'canon', name: 'Canon', key: 'D', style: 'balada', roman: 'I | V | vi | iii | IV | I | IV | V' },
  ] },
  { group: 'Otros', items: [
    { id: 'jazz251', name: 'Jazz: ii – V – I', key: 'C', style: 'walking', roman: 'ii7 | V7 | Imaj7 | Imaj7' },
    { id: 'turnaround', name: 'Rueda de jazz', key: 'C', style: 'walking',
      roman: 'Imaj7 vi7 | ii7 V7 | Imaj7 vi7 | ii7 V7' },
    { id: 'reggae', name: 'Reggae', key: 'A', style: 'reggae', roman: 'I | I | IV | V' },
    { id: 'bossa', name: 'Bossa', key: 'F', style: 'bossa', roman: 'Imaj7 | Imaj7 | ii7 | V7' },
    { id: 'funk', name: 'Funk de un acorde', key: 'E', style: 'funk', roman: 'i7 | i7 | i7 | IV7' },
  ] },
];
