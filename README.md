# Cuatro Cuerdas

Sala de ensayo para bajo eléctrico: elige una progresión de acordes y un estilo, y la web
inventa una línea de bajo, la escribe en partitura y tablatura, y la toca con batería y
acordes mientras marca cada nota, como un karaoke.

- **Tocar**: progresiones de blues, rock, pop, jazz… en cualquier tono, o tus propios acordes
  (`A7 | D7 | A7 E7`). Diez estilos, tres niveles y un botón para generar otra línea.
  Activa «El bajo lo toco yo» para quedarte solo con el acompañamiento.
- **Diapasón**: juego para aprender dónde está cada nota.
- **Afinador**: tonos de referencia y afinador con micrófono.

Todo se guarda en el navegador (`localStorage`): ajustes, progresiones propias y días de práctica.

## Publicar en GitHub Pages

Es una web estática sin compilación. En GitHub: **Settings → Pages → Deploy from a branch**,
elige la rama y la carpeta `/ (root)`.

Para probarla en local: `python3 -m http.server` y abre `http://localhost:8000`.
