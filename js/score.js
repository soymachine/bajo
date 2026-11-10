// Dibuja la partitura (clave de fa) y la tablatura en SVG, y marca la nota
// que suena al estilo karaoke.
import { staffSpell, noteName, pretty } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const GAP = 10, STEM = 32, LEFT = 58, PAD_L = 22, PAD_R = 8;
const BOTTOM_STEP = 18, MID_STEP = 22; // Sol2 (línea inferior) y Re3 (línea central)

function restPieces(from, to) {
  const out = [];
  let t = from;
  while (to - t > .01) {
    const rem = to - t;
    const d = t % 1 ? .5 : rem >= 4 && t === 0 ? 4 : rem >= 2 && t % 2 === 0 ? 2 : rem >= 1 ? 1 : .5;
    out.push({ beat: t, dur: d });
    t += d;
  }
  return out;
}

export function renderScore(container, song, opts) {
  container.innerHTML = '';
  const Z = opts.zoom || 1;
  const W = Math.max(520, container.clientWidth / Z);
  const perLine = opts.perLine;
  const barW = (W - LEFT - 10) / perLine, inner = barW - PAD_L - PAD_R;
  const xOf = (col, beat) => LEFT + col * barW + PAD_L + (beat / 4) * inner;

  // distribución vertical
  const top = opts.marks ? 18 : 0;
  let y = 34 + top;
  const chordY = 26 + top;
  let staffTop = null, namesY = null, tabTop = null;
  if (opts.staff) { staffTop = y + 40; y = staffTop + 4 * GAP + 30; }
  if (opts.names) { namesY = y + 4; y += 20; }
  if (opts.tab) { tabTop = y + 12; y = tabTop + 42 + 14; }
  const H = y + 6;

  const noteEls = song.notes.map(() => []);
  const barEls = [], systems = [];
  const nBars = song.bars.length;

  for (let first = 0; first < nBars; first += perLine) {
    const count = Math.min(perLine, nBars - first);
    const sys = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W * Z, height: H * Z, class: 'system' }, container);
    if (opts.onBar) {
      sys.addEventListener('click', e => {
        const r = sys.getBoundingClientRect();
        const c = Math.floor(((e.clientX - r.left) * W / r.width - LEFT) / barW);
        if (c >= 0 && c < count) opts.onBar(first + c);
      });
    }
    const xEnd = LEFT + count * barW;
    systems.push(sys);

    for (let c = 0; c < count; c++) {
      barEls[first + c] = svg('rect', { x: LEFT + c * barW + 2, y: 6, width: barW - 4, height: H - 12, rx: 8, class: 'barbg' }, sys);
    }
    if (opts.staff) {
      for (let i = 0; i < 5; i++) svg('line', { x1: 14, x2: xEnd, y1: staffTop + i * GAP, y2: staffTop + i * GAP, class: 'ln' }, sys);
      const g = svg('g', { transform: `translate(20 ${staffTop})`, class: 'clef' }, sys);
      svg('path', { d: 'M6 12 C1 3 12 -3 20 3 C28 10 24 24 5 35', class: 'clef-c' }, g);
      svg('circle', { cx: 6.5, cy: 11.5, r: 3.6 }, g);
      svg('circle', { cx: 30, cy: 5, r: 2.1 }, g);
      svg('circle', { cx: 30, cy: 15, r: 2.1 }, g);
    }
    if (opts.tab) {
      for (let i = 0; i < 4; i++) svg('line', { x1: 14, x2: xEnd, y1: tabTop + i * 14, y2: tabTop + i * 14, class: 'ln' }, sys);
      ['T', 'A', 'B'].forEach((ch, i) => svg('text', { x: 30, y: tabTop + 12 + i * 13, class: 'tablabel' }, sys, ch));
    }
    for (let c = 0; c <= count; c++) {
      const x = c === 0 ? 14 : LEFT + c * barW;
      const last = first + c === nBars;
      for (const [top, h] of [[staffTop, 4 * GAP], [tabTop, 42]]) {
        if (top === null) continue;
        svg('line', { x1: x, x2: x, y1: top, y2: top + h, class: last ? 'ln end' : 'ln' }, sys);
        if (last) svg('line', { x1: x - 5, x2: x - 5, y1: top, y2: top + h, class: 'ln' }, sys);
      }
    }
    svg('text', { x: 14, y: chordY - 8, class: 'barnum' }, sys, first + 1);
    if (opts.marks) {
      for (let c = 0; c < count; c++) {
        const m = opts.marks[first + c];
        if (!m) continue;
        const x = LEFT + c * barW + 6;
        svg('path', { d: `M${x} 4v18`, class: 'markline' }, sys);
        svg('text', { x: x + 6, y: 15, class: 'mark' }, sys, m);
      }
    }

    for (let c = 0; c < count; c++) {
      const b = first + c;
      for (const seg of song.bars[b].segs) {
        svg('text', { x: xOf(c, seg.beat) - 7, y: chordY, class: 'chord' }, sys, pretty(seg.chord.name));
      }
      const notes = song.notes.map((n, i) => ({ ...n, i })).filter(n => n.bar === b);
      drawBar(sys, c, notes);
    }
    sys.ph = svg('line', { y1: 8, y2: H - 8, class: 'playhead', visibility: 'hidden' }, sys);
  }

  function drawBar(sys, col, notes) {
    const accState = {};
    const info = notes.map(n => {
      const sp = staffSpell(n.midi, n.flats);
      let acc = '';
      const prev = accState[sp.key] || '';
      if (sp.acc !== prev) acc = sp.acc === '#' ? '♯' : sp.acc === 'b' ? '♭' : '♮';
      accState[sp.key] = sp.acc;
      const g = svg('g', { class: 'n' }, sys);
      noteEls[n.i].push(g);
      return { ...n, sp, acc, g, x: xOf(col, n.beat), y: staffTop + 4 * GAP - (sp.step - BOTTOM_STEP) * GAP / 2 };
    });

    if (opts.staff) {
      // grupos de corcheas unidas por barra, dentro de cada mitad del compás
      const groups = [];
      info.forEach((n, k) => {
        const p = info[k - 1], g = groups[groups.length - 1];
        if (n.dur === .5 && p && p.dur === .5 && g && g.includes(p) &&
          Math.abs(p.beat + .5 - n.beat) < .01 && Math.floor(p.beat / 2) === Math.floor(n.beat / 2)) g.push(n);
        else groups.push([n]);
      });
      for (const grp of groups) {
        const avg = grp.reduce((s, n) => s + n.sp.step, 0) / grp.length;
        const up = avg < MID_STEP, dir = up ? -1 : 1;
        grp.forEach(n => { n.sx = n.x + (up ? 5.6 : -5.6); });
        const a = grp[0], z = grp[grp.length - 1];
        let m = grp.length > 1 ? Math.max(-.25, Math.min(.25, (z.y - a.y) / (z.sx - a.sx))) : 0;
        let y0 = a.y + dir * STEM;
        const need = Math.max(...grp.map(n => 26 - dir * ((y0 + (n.sx - a.sx) * m) - n.y)));
        if (need > 0) y0 += dir * need;
        for (const n of grp) {
          n.up = up;
          n.single = grp.length === 1;
          n.stemEnd = y0 + (n.sx - a.sx) * m;
          drawNote(n);
        }
        if (grp.length > 1) {
          const y1 = y0 + (z.sx - a.sx) * m, t = dir * -5;
          svg('polygon', { points: `${a.sx - .7},${y0} ${z.sx + .7},${y1} ${z.sx + .7},${y1 + t} ${a.sx - .7},${y0 + t}`, class: 'beam' }, sys);
        }
      }
      // silencios
      let t = 0;
      const gaps = [];
      for (const n of info) { if (n.beat - t > .01) gaps.push([t, n.beat]); t = n.beat + n.dur; }
      if (4 - t > .01) gaps.push([t, 4]);
      for (const [a, b] of gaps) for (const r of restPieces(a, b)) drawRest(sys, xOf(col, r.beat), r.dur);
    }

    for (const n of info) {
      if (opts.names) {
        const t = svg('text', { x: n.x, y: namesY + 10, class: 'nname' }, sys, noteName(n.midi, n.flats, opts.latin));
        noteEls[n.i].push(t);
      }
      if (opts.tab) {
        const g = svg('g', { class: 't' }, sys);
        const ty = tabTop + n.string * 14;
        svg('rect', { x: n.x - 8, y: ty - 8, width: 16, height: 16, rx: 4, class: 'tabbg' }, g);
        svg('text', { x: n.x, y: ty + 5, class: 'tabnum' }, g, n.fret);
        noteEls[n.i].push(g);
      }
    }
  }

  function drawNote(n) {
    const g = n.g, bottom = staffTop + 4 * GAP;
    for (let ly = bottom + GAP; ly <= n.y + .1; ly += GAP) svg('line', { x1: n.x - 10, x2: n.x + 10, y1: ly, y2: ly, class: 'ln' }, g);
    for (let ly = staffTop - GAP; ly >= n.y - .1; ly -= GAP) svg('line', { x1: n.x - 10, x2: n.x + 10, y1: ly, y2: ly, class: 'ln' }, g);
    const open = n.dur >= 2;
    svg('ellipse', { cx: n.x, cy: n.y, rx: 6.2, ry: 4.4, transform: `rotate(-20 ${n.x} ${n.y})`, class: open ? 'head open' : 'head' }, g);
    if (n.dur < 4) svg('line', { x1: n.sx, x2: n.sx, y1: n.y, y2: n.stemEnd, class: 'stem' }, g);
    if (n.acc) svg('text', { x: n.x - 17, y: n.y + 6, class: 'acc' }, g, n.acc);
    if (n.dur === 1.5 || n.dur === 3) {
      const onLine = (n.sp.step - BOTTOM_STEP) % 2 === 0;
      svg('circle', { cx: n.x + 11, cy: n.y - (onLine ? GAP / 2 : 0), r: 1.9, class: 'dot' }, g);
    }
    if (n.dur === .5 && n.single) {
      const d = n.up ? 1 : -1;
      svg('path', { d: `M${n.sx} ${n.stemEnd} c1 ${8 * d} 9 ${9 * d} 7 ${19 * d}`, class: 'flag' }, g);
    }
  }

  function drawRest(sys, x, dur) {
    const g = svg('g', { class: 'rest' }, sys), m = staffTop + 2 * GAP;
    if (dur >= 4) svg('rect', { x: x + inner / 2 - 20, y: staffTop + GAP, width: 13, height: 5.5 }, g);
    else if (dur >= 2) svg('rect', { x: x - 6, y: m - 5.5, width: 13, height: 5.5 }, g);
    else if (dur >= 1) svg('path', { d: `M${x - 3} ${m - 14} l7 9 l-6 7 l6 8 c-6 -3 -10 1 -5 7`, class: 'rq' }, g);
    else {
      svg('circle', { cx: x - 3, cy: m - 4, r: 2.4 }, g);
      svg('path', { d: `M${x - 3} ${m - 3} q5 1 7 -3 l-5 17`, class: 'rq' }, g);
    }
  }

  let curNote = -1, curBar = -1, curSys = null;
  const api = {
    /** Resalta los compases del tramo elegido (a..b) o lo quita (null). */
    setRange(a, b) {
      barEls.forEach((el, i) => {
        const inside = a !== null && i >= a && i <= b;
        el.classList.toggle('sel', inside);
        el.classList.toggle('out', a !== null && !inside);
      });
    },
    /** Marca compás, nota y cursor para el tiempo dado. Devuelve el índice de la nota actual. */
    setBeat(beat) {
      const bar = Math.floor(beat / 4);
      if (bar !== curBar) {
        if (barEls[curBar]) barEls[curBar].classList.remove('on');
        if (barEls[bar]) barEls[bar].classList.add('on');
        curBar = bar;
        const sys = systems[Math.floor(bar / perLine)];
        if (sys !== curSys) {
          if (curSys) curSys.ph.setAttribute('visibility', 'hidden');
          curSys = sys;
          if (sys) {
            sys.ph.setAttribute('visibility', 'visible');
            const r = sys.getBoundingClientRect();
            if (r.top < 150 || r.bottom > window.innerHeight - 10) {
              window.scrollTo({ top: window.scrollY + r.top - 170, behavior: 'smooth' });
            }
          }
        }
      }
      if (curSys) {
        const x = xOf(bar % perLine, beat - bar * 4);
        curSys.ph.setAttribute('x1', x); curSys.ph.setAttribute('x2', x);
      }
      let idx = -1;
      for (let i = 0; i < song.notes.length; i++) {
        const n = song.notes[i];
        if (n.at > beat + .001) break;
        if (beat < n.at + n.dur) idx = i;
      }
      if (idx !== curNote) {
        if (curNote >= 0) noteEls[curNote].forEach(e => e.classList.remove('on'));
        if (idx >= 0) noteEls[idx].forEach(e => e.classList.add('on'));
        curNote = idx;
      }
      return idx;
    },
    clear() {
      if (curNote >= 0) noteEls[curNote].forEach(e => e.classList.remove('on'));
      if (barEls[curBar]) barEls[curBar].classList.remove('on');
      if (curSys) curSys.ph.setAttribute('visibility', 'hidden');
      curNote = curBar = -1; curSys = null;
    },
  };
  return api;
}
