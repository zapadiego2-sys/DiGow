# Reglas de desarrollo

Son obligatorias. Si una tarea choca con una regla, pregunta antes de continuar.

## Negocio

- En el Excel, las columnas A a I son lo que ve el cliente, y las columnas K a W son costos internos. **Costos, factores y utilidad nunca aparecen en la vista para el cliente ni en la impresión.** La vista del cliente recibe un `ClientQuoteView` que no contiene esos campos, y una prueba lo verifica.
- El precio de venta se ingresa manualmente. La app sugiere el costo como referencia y muestra la utilidad.
- Los cálculos conservan los decimales y se redondea solo al mostrar.
- Los factores son números decimales mayores que 0 y editables. La interfaz los llama "Factor", sin atribuirles otro significado.
- Las áreas se pueden ingresar manualmente. La app no exige calcularlas a partir de las medidas.

## Accesos y flujos

- Toda pantalla, salvo ingresar, exige sesión. Cada sección exige su permiso, y la interfaz oculta lo que el rol no permite.
- Sin el permiso `quotes.costing` no se muestran ni se editan hoja de costos, costo, utilidad, valor unitario ni IVA, y los hooks entregan la cotización sin costos (`withoutCosts`). Al guardar, `mergeRestrictedEdit` conserva los costos y precios guardados.
- El asesor de una cotización es quien la crea. Solo `quotes.assignAdvisor` lo cambia.
- Un paso con validación (`gate`) no avanza si falta algo: el panel lo lista y el servicio lo rechaza con `gate-incomplete`.
- Mientras un flujo está abierto, solo el responsable del paso edita la cotización; los demás la consultan. `quotes.editAll` puede editar siempre.
- Devolver una cotización exige un motivo. Cada movimiento queda en el historial.
- Al terminar el flujo, la cotización pasa a "Enviada". Los demás pasos no cambian su estado.
- Debe existir siempre un super admin activo y exactamente un flujo por defecto, activo y con pasos.
- Las contraseñas simuladas se guardan con hash, nunca en texto plano. Los usuarios y la contraseña de prueba son ficticios.
- Un campo de plantilla es interno por defecto; solo aparece al cliente si se marca como visible.

## Costeo

- Las fórmulas se evalúan con el analizador de `domain/formula.ts`, nunca con `eval` ni `Function`. Se validan al guardarlas.
- Una línea por fórmula guarda una copia de la fórmula y su versión; cambiar la fórmula no altera cotizaciones existentes. Lo mismo vale para las condiciones comerciales: la cotización guarda la versión aplicada.
- Las cantidades calculadas desde las medidas se muestran antes de aplicarlas: nunca cambian la hoja sin confirmación. Una medida faltante nunca se completa con un valor inventado.
- Todas las medidas de una cotización usan una sola unidad. Las fórmulas y las reglas de los materiales reciben las medidas en cm.
- Los sub-ítems son internos: no aparecen en la vista para el cliente.
- Un ítem o sub-ítem sin la marca predictiva no se usa como referencia ni recibe sugerencias del historial.

## Importación de Excel

- La importación nunca guarda directamente: siempre pasa por una vista previa editable y crea un borrador.
- Los campos se localizan por sus etiquetas y encabezados, no por coordenadas fijas.
- Un dato faltante o no reconocido genera un aviso visible, nunca un valor inventado.
- Las fórmulas no se ejecutan: se lee el valor ya calculado que guarda el archivo.
- Solo se aceptan archivos `.xlsx` de hasta 10 MB. Un archivo dañado muestra un error comprensible.
- La importación funciona sin conexión.
- Los costos importados nunca aparecen en la vista para el cliente.
- La carga masiva de materiales también pasa por una vista previa. Una fila con datos faltantes o inválidos no se carga ni se completa con valores inventados.

## Logo

- La app busca el logo en este orden: URL de `VITE_BRAND_LOGO_URL`, archivo `public/brand/logo.png` y, si ninguno carga, el texto "Cotizador".
- Un logo que no carga nunca rompe la pantalla ni la impresión.

## SOLID

- **S:** cálculos en `domain`, datos en hooks de cada feature, presentación en componentes. Divide un componente si mezcla estas responsabilidades.
- **O:** cada tipo de línea de costo es una estrategia registrada en un mapa `kind → calculadora` (incluida `formula`). Agregar un tipo no debe requerir cambios en el código que calcula totales. Lo mismo vale para los campos de plantilla y los tipos de producto.
- **L:** toda implementación de un repositorio cumple el mismo contrato, verificado con una suite de pruebas de contrato reutilizable.
- **I:** interfaces pequeñas por capacidad (`QuoteReader`, `QuoteWriter`, `MaterialCatalog`), no un único servicio general.
- **D:** las pantallas dependen de interfaces de `domain`. Las implementaciones se inyectan por Context desde `app/`. Ningún componente importa mocks directamente.

## Reutilización

- Antes de crear un componente, revisa `shared/ui` y `features`.
- `shared/ui` recibe datos por props, usa composición en lugar de muchas variantes booleanas, y no contiene textos ni reglas del negocio.
- Si un patrón aparece por segunda vez, extráelo. No crees abstracciones para un solo uso.

## Datos reales

- El repositorio y los datos semilla solo contienen datos ficticios. Nombres, costos, fotos y archivos reales de clientes nunca se versionan.

## Mocks

- Los repositorios usan `localStorage` detrás de un adaptador, con una clave versionada para poder migrar datos.
- Simulan latencia de 200 a 500 ms y permiten forzar errores con una variable de entorno.
- Existe una acción "Restablecer datos de prueba".
- La implementación se selecciona en un único punto: `app/`.

## PWA y multiplataforma

- Instalable en Android, iOS y escritorio: manifest, íconos normales y `maskable`, `theme-color` y metaetiquetas para iOS.
- Funciona sin conexión, con precarga del app shell y datos locales. Muestra un indicador sin conexión y un aviso de "nueva versión disponible".
- Mobile-first desde 360 px, sin scroll horizontal de página.
- Accesibilidad WCAG 2.1 AA: teclado, foco visible, etiquetas y objetivos táctiles de al menos 44 px.
- Interfaz en español con formato `es-CO` y pesos colombianos sin decimales. Código en inglés.
- En Windows, las pruebas se ejecutan desde PowerShell en `C:\work\...`. Desde Git Bash (`/c/...`) Vitest carga dos copias de sí mismo y todas las suites fallan antes de empezar.

## Diseño

- `DESIGN.md` es la fuente de verdad. Los componentes usan solo sus tokens, sin valores escritos a mano.
- Si cambias un token, actualiza `DESIGN.md` y las variables CSS en el mismo cambio.

## Skills

- Las skills de diseño sirven para revisar y mejorar, pero no sustituyen estas reglas. Ninguna puede cambiar tokens, alcance o arquitectura sin aprobación.
- Orden de prioridad ante un conflicto: instrucción del usuario, `context/reglas.md`, `DESIGN.md`, skills.

## Calidad

- Una tarea termina cuando `typecheck`, `lint`, `test` y `build` pasan sin errores.
- No hagas commits salvo que se te pida.
