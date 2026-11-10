# Arquitectura

## Stack

- React + TypeScript en modo `strict` + Vite, en sus últimas versiones estables (TypeScript en 6.0, ver `context/decisiones.md`)
- `vite-plugin-pwa` (Workbox)
- React Router
- TanStack Query para datos asíncronos, de modo que cambiar los mocks por una API no afecte a las pantallas
- React Hook Form + Zod para formularios y validación
- Tailwind CSS con los tokens de `DESIGN.md` expuestos como variables CSS, y Radix UI para primitivas accesibles
- `@fontsource-variable/inter` para la tipografía sin conexión
- `exceljs` para leer `.xlsx`, cargada con importación dinámica y solo al importar
- Vitest + Testing Library, ESLint y Prettier

No agregues otras dependencias sin justificarlo y registrarlo en `context/decisiones.md`.

## Estructura

```text
src/
  app/            # composition root: providers, rutas, inyección de repositorios
  domain/         # entidades, reglas y cálculos; TypeScript puro, sin React
  features/       # quotes/, costing/, materials/, import/, settings/, brand/, forms/, services/,
                  # auth/, admin/, workflow/, templates/, tasks/
  shared/ui/      # sistema de componentes reutilizables, sin conocimiento del negocio
  shared/lib/     # formato de moneda y fechas, utilidades
  infrastructure/ # mock/ (repositorios y almacenamiento), seed/ (datos semilla), xlsx/ (importador)
tests/            # architecture/, contracts/, design/, domain/, features/, infrastructure/, shared/, fixtures/
```

`features/services/` define el Context con el que `app/` inyecta las implementaciones.

## Accesos, flujos y plantillas

- `domain/access.ts` define permisos, roles, usuarios y sesión; `domain/quoteAccess.ts` decide quién ve y edita una cotización. Las pantallas consultan permisos con `useCan`, nunca con el nombre del rol.
- `features/auth/RequireAuth` protege las rutas y provee la sesión por contexto; `RequirePermission` protege cada sección. Un backend real debe validar lo mismo del lado del servidor.
- `domain/workflow.ts` contiene el motor del flujo en funciones puras: iniciar, avanzar, devolver, reasignar y elegir responsable. `QuoteWorkflowService` lo aplica sobre el repositorio.
- La cotización copia de su plantilla los campos y las medidas, y de su flujo los pasos. Cambiar la configuración no altera cotizaciones existentes.
- Los repositorios simulados de catálogos configurables (materiales, roles, flujos y plantillas) heredan de `infrastructure/mock/crud.ts` y cumplen el contrato `describeCrudContract`.
- `infrastructure/suggestions/HistoricalCostSuggester` implementa `CostSuggester` con el historial de cotizaciones y el catálogo.

## Dependencias permitidas

- `features → domain` y `features → shared`.
- `domain` no depende de nada.
- `infrastructure` implementa las interfaces de `domain`, y solo `app/` la conoce.
- `infrastructure` puede usar `shared/lib` para utilidades sin negocio, como generar ids.
- Una regla de ESLint (`no-restricted-imports`) lo hace cumplir, y `tests/architecture` verifica la regla.

## Importación de Excel

- `domain` define la interfaz `QuoteImporter`, que recibe un archivo y devuelve `{ draft, warnings }`.
- `infrastructure/xlsx/` la implementa con `exceljs`. Ningún otro módulo conoce la librería.
- `features/import/` contiene la selección del archivo y la vista previa.
- `MaterialImporter` lee la carga masiva de materiales y genera su plantilla. `infrastructure/xlsx/XlsxMaterialImporter` la implementa; ubica las columnas por sus encabezados y comparte con el importador de cotizaciones la carga del archivo (`loadWorkbook.ts`).

## Logo

Un único componente `BrandLogo` resuelve el logo según `context/reglas.md`. Un logo en `public/brand/` queda disponible sin conexión. Uno externo por URL puede no estarlo, y en ese caso se muestra el texto.

## Componentes mínimos de `shared/ui`

`Button`, `Input`, `NumberField`, `MoneyField`, `Select`, `Dialog`, `Card`, `Badge`, `DataTable`, `FormField`, `EmptyState`, `Skeleton` y `Toast`. Además existen `IconButton`, `Textarea`, `ConfirmDialog`, `Notice`, `Icon`, `Checkbox` y `Steps`.
