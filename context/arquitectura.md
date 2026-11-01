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
  features/       # quotes/, costing/, materials/, import/, settings/, brand/, forms/, services/
  shared/ui/      # sistema de componentes reutilizables, sin conocimiento del negocio
  shared/lib/     # formato de moneda y fechas, utilidades
  infrastructure/ # mock/ (repositorios y almacenamiento), seed/ (datos semilla), xlsx/ (importador)
tests/            # architecture/, contracts/, design/, domain/, features/, infrastructure/, shared/, fixtures/
```

`features/services/` define el Context con el que `app/` inyecta las implementaciones.

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

## Logo

Un único componente `BrandLogo` resuelve el logo según `context/reglas.md`. Un logo en `public/brand/` queda disponible sin conexión. Uno externo por URL puede no estarlo, y en ese caso se muestra el texto.

## Componentes mínimos de `shared/ui`

`Button`, `Input`, `NumberField`, `MoneyField`, `Select`, `Dialog`, `Card`, `Badge`, `DataTable`, `FormField`, `EmptyState`, `Skeleton` y `Toast`. Además existen `IconButton`, `Textarea`, `ConfirmDialog`, `Notice` e `Icon`.
