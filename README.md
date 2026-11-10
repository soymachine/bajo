# Cuatro Cuerdas

Sala de ensayo para bajo eléctrico: elige una progresión de acordes y un estilo, y la web
inventa una línea de bajo, la escribe en partitura y tablatura, y la toca con batería y
acordes mientras marca cada nota, como un karaoke.

- **Hoy**: una rutina de unos 15 minutos que cambia cada día (calentamiento, técnica y
  groove), con tiempo por paso y un diario de práctica de las últimas cuatro semanas.
  Debajo, una biblioteca de ejercicios: araña cromática, escalas, arpegios, octavas…
- **Tocar**: progresiones de blues, rock, pop, jazz… en cualquier tono, o tus propios acordes
  (`A7 | D7 | A7 E7`). Diez estilos, tres niveles y un botón para generar otra línea.
  - «El bajo lo toco yo» deja solo el acompañamiento.
  - **Tramo**: elige unos compases en la partitura para repetir solo esa parte.
  - **Acelerar cada vuelta**: sube el tempo unos ppm por vuelta hasta el objetivo.
  - **Pantalla grande**: solo la partitura y la nota actual, en letra grande (tecla `F`).
- **Canciones**: acordes, tono, tempo y estructura de clásicos (Beat It, Stand By Me,
  Johnny B. Goode, The Thrill Is Gone…). Se toca la canción entera o una parte; la línea de
  bajo la genera la web en el estilo de la canción (no se copian las líneas originales).
  Para añadir canciones, edita `js/songs.js`.
- **Diapasón**: juego para aprender dónde está cada nota.
- **Afinador**: tonos de referencia y afinador con micrófono.

## Pedal o teclado

Los pedales Bluetooth para pasar páginas funcionan como teclado:
`Espacio`, `→`, `↓` o `AvPág` tocan y paran; `←`, `↑` o `RePág` vuelven a empezar;
`+` y `−` cambian el tempo; `F` activa la pantalla grande.

## App en el iPad

Desde Safari: **Compartir → Añadir a pantalla de inicio**. Se abre como una app y funciona
sin internet (service worker en `sw.js`; al publicar cambios grandes, sube la versión de
`CACHE`).

Todo se guarda en el navegador (`localStorage`): ajustes, progresiones propias y práctica.

## Publicar en GitHub Pages

Es una web estática sin compilación. En GitHub: **Settings → Pages → Deploy from a branch**,
rama `main`, carpeta `/ (root)`.

Para probarla en local: `python3 -m http.server` y abre `http://localhost:8000`.
