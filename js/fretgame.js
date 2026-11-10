// Juego del diapasón: aprender dónde está cada nota.
import { createFretboard } from './fretboard.js';
import { OPEN, SHARP, noteName } from './theory.js';

export function initGame(root, engine, store, getLatin) {
  const $ = s => root.querySelector(s);
  const st = { mode: 'name', frets: 5, ok: 0, tries: 0, streak: 0, target: null, lock: false };
  let fb;

  const label = pc => SHARP[pc].length === 1
    ? noteName(pc, false, getLatin())
    : `${noteName(pc, false, getLatin())} / ${noteName(pc, true, getLatin())}`;

  function stats() {
    $('#gOk').textContent = st.ok;
    $('#gTries').textContent = st.tries;
    $('#gStreak').textContent = st.streak;
    $('#gBest').textContent = store.data.gameBest || 0;
  }
  function answer(good) {
    st.tries++;
    if (good) {
      st.ok++; st.streak++;
      if (st.streak > (store.data.gameBest || 0)) { store.data.gameBest = st.streak; store.save(); }
    } else st.streak = 0;
    stats();
  }
  function build() {
    fb = createFretboard($('#gameBoard'), { frets: st.frets, latin: getLatin(), onPick: pick });
    const box = $('#gameAnswers');
    box.innerHTML = '';
    box.hidden = st.mode !== 'name';
    for (let pc = 0; pc < 12; pc++) {
      const b = document.createElement('button');
      b.className = 'ans' + (SHARP[pc].length > 1 ? ' alt' : '');
      b.textContent = label(pc);
      b.onclick = () => choose(pc, b);
      box.appendChild(b);
    }
    next();
  }
  function next() {
    st.lock = false;
    root.querySelectorAll('.ans').forEach(b => b.classList.remove('good', 'bad'));
    let t;
    do {
      t = { string: Math.floor(Math.random() * 4), fret: Math.floor(Math.random() * (st.frets + 1)) };
    } while (st.target && t.string === st.target.string && t.fret === st.target.fret);
    t.midi = OPEN[t.string] + t.fret; t.pc = t.midi % 12;
    st.target = t;
    if (st.mode === 'name') {
      $('#gamePrompt').innerHTML = '¿Qué nota es <em>esta</em>?';
      fb.set([{ ...t, cls: 'ask', label: '?' }]);
    } else {
      $('#gamePrompt').innerHTML = `Toca en el diapasón un <em>${label(t.pc)}</em>`;
      fb.set([]);
    }
  }
  function choose(pc, btn) {
    if (st.lock || st.mode !== 'name') return;
    const t = st.target, good = pc === t.pc;
    st.lock = true;
    engine.pluck(t.midi, .8);
    answer(good);
    btn.classList.add(good ? 'good' : 'bad');
    if (!good) root.querySelectorAll('.ans')[t.pc].classList.add('good');
    fb.set([{ ...t, cls: good ? 'good' : 'bad', label: noteName(t.pc, false, getLatin()) }]);
    setTimeout(next, good ? 800 : 1800);
  }
  function pick(string, fret) {
    if (st.lock || st.mode !== 'find') return;
    const midi = OPEN[string] + fret, good = midi % 12 === st.target.pc;
    engine.pluck(midi, .8);
    answer(good);
    const dots = [{ string, fret, cls: good ? 'good' : 'bad', label: noteName(midi % 12, false, getLatin()) }];
    if (good) {
      // muestra también el resto de sitios donde está la nota
      for (let s = 0; s < 4; s++) for (let f = 0; f <= st.frets; f++) {
        if ((OPEN[s] + f) % 12 === st.target.pc && !(s === string && f === fret)) dots.push({ string: s, fret: f, cls: 'ghost' });
      }
      st.lock = true;
      setTimeout(next, 1100);
    }
    fb.set(dots);
  }

  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    st.mode = b.dataset.mode;
    root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b));
    build();
  });
  root.querySelectorAll('[data-frets]').forEach(b => b.onclick = () => {
    st.frets = +b.dataset.frets;
    root.querySelectorAll('[data-frets]').forEach(x => x.classList.toggle('active', x === b));
    build();
  });
  stats();
  build();
  return { refresh: build };
}
