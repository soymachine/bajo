// Service worker: guarda la web para que funcione sin conexión.
// Primero intenta la red (así siempre se ve la última versión) y, si no hay, usa la copia.
const CACHE = 'cuatro-cuerdas-v6';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/theory.js', 'js/generator.js', 'js/audio.js', 'js/score.js',
  'js/fretboard.js', 'js/fretgame.js', 'js/tuner.js', 'js/exercises.js', 'js/songs.js', 'js/riffs.js', 'js/gpimport.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
  ...['E1', 'G1', 'Bb1', 'Db2', 'E2', 'G2', 'Bb2', 'Db3', 'E3', 'G3'].map(n => `audio/bass/${n}.mp3`),
  ...['E3', 'G3', 'Bb3', 'Db4', 'E4'].map(n => `audio/keys/${n}.mp3`),
  ...['kick1', 'kick2', 'snare1', 'snare2', 'rim1', 'hat1', 'hat2', 'hat3', 'hatsoft1', 'hatsoft2',
    'ohat1', 'ohat2', 'ride1', 'ride2'].map(n => `audio/drums/${n}.mp3`),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;
  if (fonts) {
    // las fuentes no cambian: primero la copia guardada
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
