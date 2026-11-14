// Teoría musical básica: notas, acordes, cifrado y digitación en el bajo.

export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Nombres habituales para tonalidades y acordes
export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const LATIN = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Cuerdas del bajo de arriba abajo en la tablatura: Sol, Re, La, Mi
export const OPEN = [43, 38, 33, 28];
export const STRING_NAMES = ['G', 'D', 'A', 'E'];
export const LOW = 28, HIGH = 55;

export const pcOf = name =>
  (LETTER_PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;

export const pretty = s => s.replace(/#/g, '♯').replace(/b/g, '♭');

/** Nombre de una nota para mostrar (Do Re Mi o C D E). */
export function noteName(pc, flats, latin) {
  const n = (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12];
  return (latin ? LATIN[n[0]] : n[0]) + (n[1] === '#' ? '♯' : n[1] === 'b' ? '♭' : '');
}

/** Letra + alteración + posición en el pentagrama (clave de fa, escrito una octava arriba). */
export function staffSpell(midi, flats) {
  const w = midi + 12;
  const n = (flats ? FLAT : SHARP)[w % 12];
  const oct = Math.floor(w / 12) - 1;
  return { step: oct * 7 + 'CDEFGAB'.indexOf(n[0]), acc: n[1] || '', key: n[0] + oct };
}

export function parseChord(str) {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(str.trim());
  if (!m) return null;
  const rootName = m[1] + m[2], q = m[3];
  const maj7 = /maj7|maj9|M7|Δ/.test(q);
  const rest = q.replace(/maj|M7|Δ/g, '');
  const dim = /dim|°|º/.test(q);
  const minor = !dim && /^(m|min|-)/.test(rest);
  const halfDim = /m7b5|ø/.test(q);
  const sus4 = /sus4|sus$/.test(q), sus2 = /sus2/.test(q), power = q === '5';
  const has7 = !maj7 && /7|9|11|13/.test(rest);
  const six = /6/.test(rest);
  const third = dim || minor ? 3 : sus4 ? 5 : sus2 ? 2 : power ? 7 : 4;
  const fifth = dim || halfDim || /b5/.test(q) ? 6 : /aug|\+/.test(q) ? 8 : 7;
  const seventh = maj7 ? 11 : dim && !halfDim ? 9 : 10;
  const tones = [0, third, fifth];
  if (maj7) tones.push(11); else if (has7) tones.push(dim ? 9 : 10); else if (six) tones.push(9);
  const letter = rootName[0];
  const flats = rootName[1] === 'b' ? true : rootName[1] === '#' ? false
    : 'CF'.includes(letter) || ((minor || dim) && 'DG'.includes(letter));
  const rootPc = pcOf(rootName);
  return {
    name: str.trim(), rootPc, bassPc: m[4] ? pcOf(m[4]) : rootPc,
    third, fifth, seventh, sixth: minor ? 10 : 9, top: minor ? 12 : seventh,
    minor: minor || dim, flats, tones: [...new Set(tones)],
  };
}

function nameFor(pc, minor) {
  pc = ((pc % 12) + 12) % 12;
  return minor && pc === 8 ? 'G#' : KEYS[pc];
}

export function transposeChord(str, delta) {
  const c = parseChord(str);
  if (!c || !delta) return str;
  return str.trim().replace(/^[A-G][#b]?/, nameFor(c.rootPc + delta, c.minor))
    .replace(/\/[A-G][#b]?$/, s => '/' + nameFor(pcOf(s.slice(1)) + delta, false));
}

export function transposeText(text, delta) {
  return text.replace(/[A-G][#b]?[^\s|]*/g, s => transposeChord(s, delta));
}

const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };

/** "I7 | IV7 | bVII | vi" en una tonalidad -> texto de acordes reales. */
export function realize(roman, key) {
  const k = pcOf(key);
  return roman.replace(/(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)([^\s|]*)/g,
    (_, acc, deg, suf) => {
      const minor = deg === deg.toLowerCase();
      const pc = k + ROMAN[deg.toUpperCase()] + (acc === 'b' ? -1 : acc === '#' ? 1 : 0);
      return nameFor(pc, minor) + (minor ? 'm' : '') + suf;
    });
}

/**
 * Elige cuerda y traste para cada nota. La mano cubre cuatro trastes (un dedo por
 * traste): se prefieren las notas dentro de esa zona y se penalizan los saltos.
 */
export function fingering(midis, maxFret = 14) {
  let base = 1;
  return midis.map(m => {
    let best = null;
    OPEN.forEach((open, s) => {
      const f = m - open;
      if (f < 0 || f > maxFret) return;
      let cost;
      if (f === 0) cost = .3;
      else if (f >= base && f <= base + 3) cost = f * .05;
      else cost = 1 + 1.5 * (f < base ? base - f : f - base - 3) + f * .05;
      if (!best || cost < best.cost) best = { string: s, fret: f, cost };
    });
    if (best.fret > 0 && (best.fret < base || best.fret > base + 3)) {
      base = best.fret < base ? best.fret : best.fret - 3;
    }
    return { string: best.string, fret: best.fret };
  });
}
