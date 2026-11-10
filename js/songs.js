// Canciones míticas: solo acordes, tonalidad, tempo y estructura (datos que no están
// protegidos). La línea de bajo la genera la web en el estilo indicado; no se
// reproducen las líneas originales.

export const GENRES = ['Blues', "Rock'n'roll", 'Rock', 'Pop', 'Soul'];

export const SONGS = [
  { id: 'beatit', title: 'Beat It', artist: 'Michael Jackson', year: 1982, genre: 'Pop',
    key: 'Eb', tempo: 139, style: 'rock',
    feel: 'Pop con pegada de rock: corcheas firmes en Mi♭ menor y un empujón en el pre-estribillo.',
    sections: [
      { name: 'Intro', chords: 'Ebm | Db | Ebm | Db', times: 1 },
      { name: 'Estrofa', chords: 'Ebm | Db | Ebm | Db', times: 2 },
      { name: 'Pre-estribillo', chords: 'B | Db | B | Db', times: 1 },
      { name: 'Estribillo', chords: 'Ebm | Db | B | Db', times: 2 },
    ] },
  { id: 'standbyme', title: 'Stand By Me', artist: 'Ben E. King', year: 1961, genre: 'Soul',
    key: 'A', tempo: 118, style: 'pop',
    feel: 'Cuatro acordes que giran sin parar. El bajo es el protagonista: toca relajado y redondo.',
    sections: [
      { name: 'Estrofa', chords: 'A | A | F#m | F#m | D | E | A | A', times: 2 },
      { name: 'Estribillo', chords: 'A | A | F#m | F#m | D | E | A | A', times: 1 },
    ] },
  { id: 'johnnybgoode', title: 'Johnny B. Goode', artist: 'Chuck Berry', year: 1958, genre: "Rock'n'roll",
    key: 'Bb', tempo: 168, style: 'rocknroll',
    feel: 'El rock\'n\'roll por excelencia: blues de 12 compases a toda velocidad.',
    sections: [
      { name: 'Estrofa y estribillo', chords: 'Bb | Bb | Bb | Bb | Eb | Eb | Bb | Bb | F | Eb | Bb | F', times: 2 },
    ] },
  { id: 'hitroad', title: 'Hit the Road Jack', artist: 'Ray Charles', year: 1961, genre: 'Soul',
    key: 'A', tempo: 168, style: 'rock',
    feel: 'Cuatro acordes que bajan escalón a escalón (la cadencia andaluza). Rápida y con chispa.',
    sections: [
      { name: 'Estribillo', chords: 'Am | G | F | E7', times: 2 },
      { name: 'Estrofa', chords: 'Am | G | F | E7', times: 2 },
    ] },
  { id: 'thrill', title: 'The Thrill Is Gone', artist: 'B.B. King', year: 1969, genre: 'Blues',
    key: 'B', tempo: 92, style: 'walking',
    feel: 'Blues menor, lento y elegante. Cada nota cuenta: sin prisa.',
    sections: [
      { name: 'Blues menor', chords: 'Bm | Bm | Bm | Bm | Em | Em | Bm | Bm | G7 | F#7 | Bm | Bm', times: 2 },
    ] },
  { id: 'prideandjoy', title: 'Pride and Joy', artist: 'Stevie Ray Vaughan', year: 1983, genre: 'Blues',
    key: 'E', tempo: 120, style: 'blues',
    feel: 'Shuffle de Texas con mucho balanceo. Original afinado medio tono abajo; aquí, en Mi.',
    sections: [
      { name: 'Blues de 12', chords: 'E7 | E7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7', times: 2 },
    ] },
  { id: 'labamba', title: 'La Bamba', artist: 'Ritchie Valens', year: 1958, genre: "Rock'n'roll",
    key: 'C', tempo: 148, style: 'rocknroll',
    feel: 'Son jarocho convertido en rock\'n\'roll. Tres acordes y mucha alegría.',
    sections: [
      { name: 'Todo el tema', chords: 'C F | G | C F | G', times: 4 },
    ] },
  { id: 'twistshout', title: 'Twist and Shout', artist: 'The Isley Brothers / The Beatles', year: 1962, genre: "Rock'n'roll",
    key: 'D', tempo: 124, style: 'rocknroll',
    feel: 'Re, Sol y La una y otra vez. Ideal para soltarse.',
    sections: [
      { name: 'Estrofa', chords: 'D G | A | D G | A', times: 4 },
      { name: 'Subida', chords: 'A | A | A | A', times: 1 },
    ] },
  { id: 'louie', title: 'Louie Louie', artist: 'The Kingsmen', year: 1963, genre: 'Rock',
    key: 'A', tempo: 120, style: 'rock',
    feel: 'El riff de garaje más famoso: tres acordes con el ritmo 1-2-3, 1-2.',
    sections: [
      { name: 'Riff', chords: 'A D | Em D | A D | Em D', times: 4 },
    ] },
  { id: 'wildthing', title: 'Wild Thing', artist: 'The Troggs', year: 1966, genre: 'Rock',
    key: 'A', tempo: 106, style: 'rock',
    feel: 'Rock primitivo y contundente. Cuatro acordes y actitud.',
    sections: [
      { name: 'Estribillo', chords: 'A D | E D | A D | E D', times: 2 },
      { name: 'Estrofa', chords: 'A D | E D | A D | E D', times: 2 },
    ] },
  { id: 'alabama', title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', year: 1974, genre: 'Rock',
    key: 'D', tempo: 98, style: 'rock',
    feel: 'Rock sureño: Re, Do y Sol en bucle. Tranquilo pero con empuje.',
    sections: [
      { name: 'Riff', chords: 'D | C | G | G', times: 4 },
    ] },
  { id: 'browneyed', title: 'Brown Eyed Girl', artist: 'Van Morrison', year: 1967, genre: 'Pop',
    key: 'G', tempo: 150, style: 'pop',
    feel: 'Pop luminoso de los 60. Saltarín y fácil de seguir.',
    sections: [
      { name: 'Estrofa', chords: 'G | C | G | D', times: 4 },
      { name: 'Estribillo', chords: 'C | D | G | Em | C | D | G | D', times: 1 },
    ] },
  { id: 'heavensdoor', title: 'Knockin\' on Heaven\'s Door', artist: 'Bob Dylan', year: 1973, genre: 'Rock',
    key: 'G', tempo: 69, style: 'balada',
    feel: 'Lenta y sencillísima. Perfecta para trabajar el sonido y el tempo.',
    sections: [
      { name: 'Estrofa y estribillo', chords: 'G | D | Am | Am | G | D | C | C', times: 4 },
    ] },
  { id: 'letitbe', title: 'Let It Be', artist: 'The Beatles', year: 1970, genre: 'Pop',
    key: 'C', tempo: 72, style: 'balada',
    feel: 'Balada de piano: dos acordes por compás, bajo sereno.',
    sections: [
      { name: 'Estrofa', chords: 'C G | Am F | C G | F C', times: 2 },
      { name: 'Estribillo', chords: 'Am G | F C | C G | F C', times: 2 },
    ] },
  { id: 'imagine', title: 'Imagine', artist: 'John Lennon', year: 1971, genre: 'Pop',
    key: 'C', tempo: 76, style: 'balada',
    feel: 'Notas largas y mucho espacio. Toca poco y bonito.',
    sections: [
      { name: 'Estrofa', chords: 'Cmaj7 | F | Cmaj7 | F', times: 2 },
      { name: 'Puente', chords: 'F Am/E | Dm7 Am/C | G | G7', times: 1 },
      { name: 'Estribillo', chords: 'F G | C E7 | F G | C E7', times: 1 },
    ] },
  { id: 'wonderful', title: 'Wonderful Tonight', artist: 'Eric Clapton', year: 1977, genre: 'Pop',
    key: 'G', tempo: 96, style: 'balada',
    feel: 'Balada suave: cuatro acordes y todo el tiempo del mundo.',
    sections: [
      { name: 'Estrofa', chords: 'G | D | C | D', times: 4 },
    ] },
  { id: 'mygirl', title: 'My Girl', artist: 'The Temptations', year: 1964, genre: 'Soul',
    key: 'C', tempo: 104, style: 'pop',
    feel: 'Soul de Motown: alegre, limpio y con el bajo bien marcado.',
    sections: [
      { name: 'Estrofa', chords: 'C | F | C | F', times: 2 },
      { name: 'Estribillo', chords: 'C Dm | F G | C Dm | F G', times: 1 },
    ] },
];

const barsOf = chords => chords.split('|').map(b => b.trim()).filter(Boolean);

/** Progresión (texto) y marcas de sección para una canción entera o una sección. */
export function songProgression(song, sectionIdx = null) {
  const parts = sectionIdx === null ? song.sections : [{ ...song.sections[sectionIdx], times: 1 }];
  const bars = [], marks = {};
  for (const s of parts) {
    marks[bars.length] = s.times > 1 ? `${s.name} ×${s.times}` : s.name;
    for (let t = 0; t < s.times; t++) bars.push(...barsOf(s.chords));
  }
  return { text: bars.join(' | '), marks, bars: bars.length };
}

/** Objeto con la misma forma que una progresión guardada, para el selector de la vista Tocar. */
export function songPreset(id) {
  const [, sid, sec] = id.split(':');
  const song = SONGS.find(s => s.id === sid);
  if (!song) return null;
  const idx = sec === undefined ? null : +sec;
  const { text, marks } = songProgression(song, idx);
  return {
    id, key: song.key, text, marks, style: song.style, tempo: song.tempo, song,
    name: `${song.title} · ${song.artist}${idx === null ? '' : ' · ' + song.sections[idx].name}`,
  };
}
