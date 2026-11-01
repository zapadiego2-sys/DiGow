# Cotizador

PWA para crear, costear y presentar cotizaciones de productos fabricados a medida. Es un MVP solo frontend: todos los datos se guardan en el navegador, en `localStorage`.

El alcance, las reglas y las decisiones están en [`context/`](context/), y el diseño en [`DESIGN.md`](DESIGN.md).

## Comandos

Requiere Node 24 o superior.

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila la versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/`. Úsalo para probar la instalación y el modo sin conexión |
| `npm run typecheck` | Verifica los tipos |
| `npm run lint` | Ejecuta ESLint, incluidas las reglas de arquitectura |
| `npm test` | Ejecuta las pruebas |
| `npm run icons` | Regenera los íconos de la PWA en `public/icons/` |
| `npm run fixtures` | Regenera la foto de ejemplo y el Excel ficticio de las pruebas |
| `npx @google/design.md lint DESIGN.md` | Valida `DESIGN.md` |

## Configuración

Copia `.env.example` a `.env`. Las variables se leen al compilar.

| Variable | Efecto |
|---|---|
| `VITE_BASE_PATH` | Ruta donde se publica la app, con barra inicial y final, como `/nombre-repo/` en GitHub Pages. Por defecto, `/` |
| `VITE_BRAND_LOGO_URL` | URL de un logo externo |
| `VITE_MOCK_FORCE_ERRORS` | Con `true`, todas las operaciones de los repositorios fallan, para probar los estados de error |

### Logo

La app busca el logo en este orden: `VITE_BRAND_LOGO_URL`, `public/brand/logo.png` y, si ninguno carga, el texto "Cotizador". Un archivo en `public/brand/` queda disponible sin conexión si existe al compilar; una URL externa puede no estarlo.

## Despliegue

`.github/workflows/deploy.yml` verifica y publica la app en GitHub Pages con cada push a `main`, usando el nombre del repositorio como ruta base. Solo requiere elegir una vez **Settings → Pages → Source: GitHub Actions**. El sitio es público: no guardes datos reales en el repositorio ni en los datos semilla.

## Reemplazar los mocks por una API

Las pantallas dependen solo de las interfaces de `src/domain/ports.ts`, y la implementación se elige en un único punto: `src/app/createServices.ts`.

1. **Implementa las interfaces** en una carpeta nueva, por ejemplo `src/infrastructure/api/`:

   | Interfaz | Métodos |
   |---|---|
   | `QuoteReader` | `list(filter)`, `get(id)` |
   | `QuoteWriter` | `create(draft)`, `update(quote)`, `duplicate(id)` |
   | `MaterialCatalog` | `list()`, `create(draft)`, `update(material)` |

2. **Traduce los errores** a `RepositoryError` (`src/domain/errors.ts`). Las pantallas muestran un mensaje según su `code`; por ejemplo, un 404 debe ser `not-found`.

3. **Comprueba el contrato.** Ejecuta sobre tu implementación las suites de `tests/contracts/repositories.contract.ts`, como hace `tests/infrastructure/mock.test.ts`:

   ```ts
   describeQuoteRepositoryContract('api', () => createApiQuoteRepository(testServer));
   describeMaterialCatalogContract('api', () => createApiMaterialCatalog(testServer));
   ```

4. **Cámbiala en `createServices.ts`.** No hace falta tocar ninguna pantalla:

   ```ts
   export function createServices(): Services {
     const quotes = createApiQuoteRepository(import.meta.env.VITE_API_URL);
     return {
       quoteReader: quotes,
       quoteWriter: quotes,
       materialCatalog: createApiMaterialCatalog(import.meta.env.VITE_API_URL),
       quoteImporter: new XlsxQuoteImporter(),
       demoData: { reset: () => Promise.reject(new Error('No disponible')) },
     };
   }
   ```

5. **Revisa lo que depende de que los datos sean locales:**

   - **Sin conexión.** `src/app/Providers.tsx` usa `networkMode: 'always'` porque los mocks no necesitan red. Con una API, usa `'online'` o agrega una cola de escritura; decide también si el mensaje de `src/app/Shell.tsx` sigue siendo cierto.
   - **Reintentos.** `retry` está en `false`. Con una API conviene reintentar los fallos de red.
   - **Restablecer datos.** "Restablecer datos de prueba" (`src/features/settings/SettingsScreen.tsx`) deja de tener sentido: retira la pantalla y `DemoDataControl`.
   - **Fotos.** Hoy se guardan como data URL dentro de la cotización. `photoUrl` admite una URL normal, así que puedes subirlas aparte y guardar solo la dirección.
   - **Vista para el cliente.** Si la API la sirve aparte, el endpoint debe devolver la forma de `ClientQuoteView`, sin costos, factores, utilidad ni notas.
   - **Generación de ids.** La asignan los repositorios, así que la API puede generarlos.

El importador de `.xlsx` funciona en el navegador y no depende de los mocks. Se puede cambiar de la misma forma, con otra implementación de `QuoteImporter`.

## Agregar un tipo de línea de costo

1. En `src/domain/cost.ts`, agrega la interfaz al tipo `CostLine` y su estrategia a `costLineStrategies`. Los totales no cambian.
2. En `src/features/costing/CostSheet.tsx`, agrega su etiqueta a `KIND_LABELS` y sus campos a `KIND_FIELDS`.
3. En `src/features/quotes/quoteSchema.ts`, agrega su validación a `costLineSchema`.

El compilador señala las dos entradas de los mapas si faltan.
