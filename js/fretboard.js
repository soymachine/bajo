// Diapasón del bajo en SVG (cuerda Mi abajo, como en la tablatura).
import { svg } from './score.js';
import { STRING_NAMES } from './theory.js';

export function createFretboard(parent, { frets = 12, onPick, latin = true } = {}) {
  const FW = 62, NUT = 64, W = NUT + frets * FW + 14, H = 172;
  const sy = s => 26 + s * 34;
  const fx = f => (f === 0 ? NUT - 26 : NUT + (f - .5) * FW);
  parent.innerHTML = '';
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fretboard' }, parent);
  svg('rect', { x: NUT, y: 12, width: frets * FW, height: 130, rx: 4, class: 'fb-wood' }, root);
  for (const m of [3, 5, 7, 9, 12]) {
    if (m > frets) continue;
    if (m === 12) {
      svg('circle', { cx: fx(m), cy: sy(.5), r: 6, class: 'fb-inlay' }, root);
      svg('circle', { cx: fx(m), cy: sy(2.5), r: 6, class: 'fb-inlay' }, root);
    } else svg('circle', { cx: fx(m), cy: sy(1.5), r: 6, class: 'fb-inlay' }, root);
    svg('text', { x: fx(m), y: H - 8, class: 'fb-num' }, root, m);
  }
  for (let f = 1; f <= frets; f++) svg('line', { x1: NUT + f * FW, x2: NUT + f * FW, y1: 12, y2: 142, class: 'fb-fret' }, root);
  svg('rect', { x: NUT - 5, y: 10, width: 6, height: 134, rx: 2, class: 'fb-nut' }, root);
  const names = latin ? { G: 'Sol', D: 'Re', A: 'La', E: 'Mi' } : { G: 'G', D: 'D', A: 'A', E: 'E' };
  STRING_NAMES.forEach((n, s) => {
    svg('line', { x1: NUT - 44, x2: W - 14, y1: sy(s), y2: sy(s), class: 'fb-string', 'stroke-width': 1.6 + s * .8 }, root);
    svg('text', { x: 4, y: sy(s) + 5, class: 'fb-sname' }, root, names[n]);
  });
  const layer = svg('g', {}, root);
  if (onPick) {
    for (let s = 0; s < 4; s++) for (let f = 0; f <= frets; f++) {
      const hit = svg('rect', { x: f === 0 ? NUT - 46 : NUT + (f - 1) * FW, y: sy(s) - 17, width: f === 0 ? 44 : FW, height: 34, class: 'fb-hit' }, root);
      hit.addEventListener('click', () => onPick(s, f));
    }
  }
  return {
    frets,
    /** dots: [{string, fret, cls, label}] */
    set(dots) {
      layer.innerHTML = '';
      for (const d of dots) {
        if (d.fret > frets) continue;
        const g = svg('g', { class: 'fb-dot ' + (d.cls || ''), transform: `translate(${fx(d.fret)} ${sy(d.string)})` }, layer);
        svg('circle', { r: 14 }, g);
        if (d.label) svg('text', { y: 5 }, g, d.label);
      }
    },
  };
}
