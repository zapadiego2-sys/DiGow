---
version: alpha
name: Cotizador
description: Herramienta de trabajo para crear, costear y presentar cotizaciones de productos fabricados a medida.
colors:
  primary: "#1F3864"
  primary-hover: "#2A4A82"
  primary-subtle: "#E8EDF6"
  on-primary: "#FFFFFF"
  accent: "#C8102E"
  background: "#F5F7FA"
  surface: "#FFFFFF"
  surface-muted: "#EEF1F5"
  text: "#1A2233"
  text-muted: "#556070"
  border: "#D5DAE1"
  border-strong: "#7C8796"
  success: "#1B7A43"
  success-subtle: "#E3F4EA"
  warning: "#8A5A00"
  warning-subtle: "#FBF0D9"
  danger: "#B3261E"
  danger-subtle: "#FBE9E7"
  neutral-subtle: "#E6E9EE"
  internal: "#6B4700"
  internal-subtle: "#FFF7E0"
typography:
  display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  subtitle:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
  money:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
  money-total:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 16px
  button-secondary-hover:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 16px
  table-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    padding: 12px
  table-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-sm}"
    padding: 12px
  panel-internal:
    backgroundColor: "{colors.internal-subtle}"
    textColor: "{colors.internal}"
    rounded: "{rounded.lg}"
    padding: 16px
  badge-draft:
    backgroundColor: "{colors.neutral-subtle}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-sent:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-approved:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-rejected:
    backgroundColor: "{colors.danger-subtle}"
    textColor: "{colors.danger}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 8px
---

# Cotizador

## Overview

Herramienta de trabajo para gestoras de proyectos: sobria, densa en información y confiable con las cifras. Debe sentirse como una evolución ordenada de la cotización en Excel, no como una tienda ni como una app de consumo. Cada pantalla prioriza leer y comparar valores rápidamente.

La app tiene dos contextos visuales que nunca se mezclan:

- **Interno:** editor, hoja de costos y catálogo. Puede ser denso y mostrar costos y utilidad.
- **Cliente:** vista e impresión de la cotización. Es limpia, formal y no contiene datos internos.

## Colors

- **Primary (#1F3864):** azul marino de los encabezados de la cotización en Excel. Se usa en acciones principales, navegación y encabezados de tabla.
- **Accent (#C8102E):** rojo de marca para detalles puntuales, como los separadores de la cotización. No se usa en botones ni para indicar errores.
- **Danger, success y warning:** solo comunican estados. Siempre van acompañados de texto o ícono, nunca solo de color.
- **Internal (#6B4700 sobre #FFF7E0):** ámbar reservado para costos, factores y utilidad. Indica "esto no lo ve el cliente". No se usa con ningún otro fin.

La app usa solo tema claro en el MVP, porque la vista del cliente se imprime sobre blanco.

## Typography

Inter, autoalojada con `@fontsource-variable/inter` para que funcione sin conexión. Fuentes de respaldo: `Calibri, system-ui, sans-serif`.

- Todo valor monetario o medida usa `money` o `money-total`, con cifras tabulares y alineado a la derecha.
- Los campos de formulario usan siempre al menos 16 px, para evitar el zoom automático en iOS.
- Formato de moneda `es-CO` sin decimales: `$ 2.400.000`.

## Layout

- Enfoque mobile-first, con cuadrícula de 8 px y márgenes laterales de 16 px en móvil y 24 px desde `md`.
- Puntos de quiebre: `sm` 640 px, `md` 768 px, `lg` 1024 px y `xl` 1280 px.
- **Móvil:** navegación inferior; las tablas se convierten en tarjetas; la acción principal y el total quedan fijos abajo, respetando `safe-area-inset`.
- **Desde `lg`:** navegación lateral y contenido con ancho máximo de 1280 px. En el editor, el resumen de totales queda fijo en una columna lateral.
- **Impresión:** tamaño carta, fondo blanco, sin navegación ni controles, y con los encabezados de tabla repetidos en cada página.
- **Medidas derivadas:** barra lateral (`2xl` × 5), resumen del editor (`2xl` × 7), miniatura (`2xl` × 2), foto (`2xl` × 5) y diálogo (`2xl` × 10). Se calculan a partir de `spacing` en `tokens.css`.

## Elevation & Depth

La jerarquía se construye con bordes y fondos, no con sombras. Las tarjetas usan un borde de 1 px en `border`. Solo los elementos flotantes, como diálogos, menús y toasts, llevan sombra: `0 8px 24px rgb(26 34 51 / 0.16)`.

## Shapes

Formas contenidas: 8 px en controles, 12 px en tarjetas y diálogos, y forma de píldora solo en badges. Las fotos de producto usan 8 px y `object-fit: contain`, para no recortar el producto.

## Components

- **Botones:** un solo botón primario por vista. La altura mínima de 44 px también aplica a los íconos táctiles. El botón secundario lleva borde de 1 px en `primary`.
- **Inputs:** borde de 1 px en `border-strong`; etiqueta siempre visible encima; el error se muestra debajo con texto en `danger`. El foco se indica con un contorno de 2 px en `primary` y separación de 2 px.
- **Tablas:** encabezado en `primary`, filas separadas por una línea en `border`, y números alineados a la derecha.
- **Badges de estado:** borrador, enviada, aprobada y rechazada, siempre con su texto.
- **Panel interno:** todo costo, factor o utilidad se muestra dentro de `panel-internal`, con la etiqueta visible "Interno". Nunca se renderiza en la vista del cliente.
- **Carga y vacío:** usar `Skeleton` con la forma del contenido, y `EmptyState` con una explicación breve y una acción.

## Do's and Don'ts

- Do usar siempre tokens; ningún componente lleva colores, tamaños o radios escritos a mano.
- Do mantener un contraste mínimo de 4.5:1 en texto y de 3:1 en bordes de controles e íconos.
- Do confirmar con un diálogo solo las acciones destructivas, y avisar el resto con un toast.
- Don't usar `accent` para errores ni `danger` como decoración.
- Don't usar el ámbar de `internal` para advertencias generales; para eso está `warning`.
- Don't mostrar datos internos en la vista del cliente, ni siquiera ocultos con CSS.
- Don't agregar gradientes, sombras en tarjetas ni animaciones de más de 200 ms; respeta `prefers-reduced-motion`.
