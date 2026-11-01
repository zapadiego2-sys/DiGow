# Prompt inicial: Cotizador (MVP solo frontend)

Actúa como ingeniero frontend senior. Crea en este directorio (`c:\work\Me\DiGow`) el MVP de la PWA descrita en `context/`.

## Antes de escribir código

1. Lee `CLAUDE.md`, todos los archivos de `context/` y `DESIGN.md`. Allí están el alcance, las reglas, la arquitectura, los datos y el diseño.
2. Confirma qué preguntas de `context/producto.md` siguen abiertas. Si una bloquea el trabajo, pregunta. Si no, elige la opción más simple y regístrala en `context/decisiones.md`.
3. Comprueba si la skill `better-interface` está disponible. Si no lo está, avísalo y continúa.

## Cómo trabajar

- Sigue las fases de `context/estado.md`, en orden.
- Antes de cada fase, vuelve a consultar `context/reglas.md` y `context/decisiones.md`.
- Al terminar cada fase, ejecuta las verificaciones, actualiza `context/estado.md`, resume el resultado y continúa con la siguiente.
- Al terminar las pantallas, revísalas con `better-interface`. Corrige lo que marque, siempre que respete `context/reglas.md` y `DESIGN.md`.

## Criterios de aceptación

- `typecheck`, `lint`, `test` y `build` terminan sin errores.
- Las pruebas reproducen todos los valores de `context/dominio.md`.
- La vista para el cliente y su impresión no exponen datos internos.
- Importar `tests/fixtures/cotizacion-ejemplo.xlsx` crea un borrador con los mismos totales, tras pasar por la vista previa.
- Un archivo dañado o con datos faltantes muestra un error o un aviso, sin inventar valores.
- El logo se puede cambiar por archivo o URL, y si falla se muestra el texto "Cotizador".
- Tras la primera carga, la versión de producción funciona sin conexión y Chrome permite instalarla.
- Las pantallas funcionan sin scroll horizontal de página a 360 px y en escritorio.
- Ninguna pantalla importa desde `infrastructure`, y la regla de ESLint lo impide.
- Los componentes usan solo tokens de `DESIGN.md`, sin colores escritos a mano, y `npx @google/design.md lint DESIGN.md` no reporta errores.
- `context/` refleja el estado final del proyecto.
