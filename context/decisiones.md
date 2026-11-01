# Decisiones

Registra aquí cada decisión que cambie el producto, la arquitectura o el diseño, con la más reciente al final. Usa este formato: fecha, decisión y motivo.

- **2026-11-01. React en lugar de Angular.** Arranque más liviano para el MVP, PWA resuelta con `vite-plugin-pwa` y posibilidad de empaquetar con Capacitor.
- **2026-11-01. Solo tema claro en el MVP.** La vista del cliente se imprime sobre blanco.
- **2026-11-01. `better-interface` como única skill de diseño del proyecto.** Revisa las pantallas sin competir con `DESIGN.md`. Se descartan `taste-skill` por su costo y porque propone su propia dirección de arte, y `landing-page-design` porque la app no es una landing.
- **2026-11-01. La app es el cotizador.** Confirmado por el usuario.
- **2026-11-01. El MVP importa `.xlsx`.** Solo archivos con la estructura de referencia, con vista previa antes de guardar. Se usa `exceljs` detrás de `QuoteImporter`, para poder cambiarla sin tocar las pantallas.
- **2026-11-01. Logo por archivo o URL.** `public/brand/logo.png` o `VITE_BRAND_LOGO_URL`, con el texto "Cotizador" como respaldo.
- **2026-11-01. Los factores son decimales.** Se tratan como un número editable, sin atribuirles significado de negocio.
- **2026-11-01. Las áreas son datos ingresados.** Incluye el área del vinilo.
- **2026-11-01. TypeScript 6.0 en lugar de 7.** `typescript-eslint` todavía exige `<6.1.0`. Subir cuando lo admita.
- **2026-11-01. `no-restricted-imports` para la arquitectura.** Cubre las capas sin otra dependencia; `tests/architecture` verifica que la regla rechaza los imports prohibidos.
- **2026-11-01. Dependencias añadidas.** `workbox-window` la exige `vite-plugin-pwa` para el aviso de nueva versión; `typescript-eslint`, `eslint-plugin-react-hooks`, `@testing-library/*` y `jsdom` son soporte de ESLint y Vitest. Los íconos son SVG propios para no añadir una librería.
- **2026-11-01. La hoja de costos es por unidad.** Como en el Excel, se compara con el valor unitario; costo y utilidad de la cotización se multiplican por la cantidad.
- **2026-11-01. El costo del material se copia a la línea al elegirlo.** Cambiar un precio del catálogo no altera cotizaciones existentes.
- **2026-11-01. La hoja de costos vive dentro del editor, no en otra ruta.** Así el mismo formulario sirve para la vista previa de importación, que aún no está guardada.
- **2026-11-01. Medidas faltantes como `null`.** Dimensiones, cantidad y precio pueden faltar en un borrador; se muestran con "—" y no suman.
- **2026-11-01. Gestora en la cotización.** Se lee bajo `Cordialmente,` y se muestra como firma en la vista para el cliente.
- **2026-11-01. Comparación de totales al importar.** El IVA se deduce de los valores del archivo; si subtotal, IVA, total o costo no coinciden con lo calculado se genera un aviso.
- **2026-11-01. Un valor debe estar contiguo a su etiqueta al importar.** Evita tomar un encabezado de costos de la misma fila como dato del cliente.
- **2026-11-01. Medidas en una sola columna en la vista para el cliente.** Con ancho, alto y profundidad por separado, la tabla no cabía en una hoja carta y se recortaba el valor total.
- **2026-11-01. Medidas de layout derivadas de los tokens.** Barra lateral, resumen, miniatura y foto se calculan como múltiplos de `spacing.2xl`, sin valores nuevos; quedan documentadas en `DESIGN.md`.
- **2026-11-01. Los toasts de error no se cierran solos.** Resultado de la revisión con `better-interface`; un error debe poder leerse con calma.
- **2026-11-01. Ruta base configurable con `VITE_BASE_PATH`.** Permite publicar en una subruta, como GitHub Pages, sin afectar el desarrollo local, que sigue en `/`.
- **2026-11-01. Solo datos ficticios en el repositorio.** El sitio de GitHub Pages es público y los datos semilla viajan en su JavaScript. Semilla, foto, Excel de prueba y documentación son ficticios, se generan con `npm run fixtures`, y `tests/privacy` rechaza los nombres del archivo real. El Excel real queda fuera del repositorio.
- **2026-11-01. Despliegue en GitHub Pages con GitHub Actions.** Cada push a `main` ejecuta `typecheck`, `lint` y `test` antes de publicar; si fallan, no se publica. Copia `index.html` a `404.html` para que abran los enlaces directos.
- **2026-11-01. Sugerencia de costos por palabras clave, sin IA por ahora.** Sin backend, una clave de un modelo quedaría expuesta en el sitio público. `KeywordCostSuggester` compara la descripción con el catálogo detrás de la interfaz `CostSuggester`, para cambiarla por IA cuando exista una API.
- **2026-11-01. Una sugerencia no inventa datos.** Sin cantidad escrita queda en 0 y sin áreas queda vacía, con un aviso. Los materiales por lámina o con costo directo se proponen como `area`. No sugiere mano de obra ni el precio de venta, que sigue siendo manual.
- **2026-11-01. Sin logo de la empresa en `public/brand/`.** El Excel trae un logo blanco, pero no se extrae: no fue pedido y el nombre de la empresa sigue por confirmar. Se muestra el texto "Cotizador".
