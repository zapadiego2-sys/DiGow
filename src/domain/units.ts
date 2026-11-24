/** Unidad en que se escriben las medidas de los ítems de una cotización. */
export const lengthUnits = ['mm', 'cm', 'm'] as const;
export type LengthUnit = (typeof lengthUnits)[number];

export const DEFAULT_LENGTH_UNIT: LengthUnit = 'cm';

const CM_PER_UNIT: Record<LengthUnit, number> = { mm: 0.1, cm: 1, m: 100 };

export function toCm(value: number | null, unit: LengthUnit): number | null {
  return value === null ? null : value * CM_PER_UNIT[unit];
}

/** Convierte una medida entre unidades sin perder decimales. */
export function convertLength(
  value: number | null,
  from: LengthUnit,
  to: LengthUnit,
): number | null {
  if (value === null || from === to) return value;
  return (value * CM_PER_UNIT[from]) / CM_PER_UNIT[to];
}

export interface Dimensions {
  width: number | null;
  height: number | null;
  depth: number | null;
}

export function dimensionsInCm(item: Dimensions, unit: LengthUnit): Dimensions {
  return {
    width: toCm(item.width, unit),
    height: toCm(item.height, unit),
    depth: toCm(item.depth, unit),
  };
}

/**
 * Valores derivados de las medidas, para fórmulas y cantidades. Una medida faltante cuenta
 * como 0 solo dentro de un producto: el resultado queda en 0 y nunca se inventa.
 */
export interface DerivedMeasures {
  ancho: number;
  alto: number;
  profundidad: number;
  area_m2: number;
  perimetro_m: number;
  volumen_m3: number;
}

export function deriveMeasures(dimensionsCm: Dimensions): DerivedMeasures {
  const w = dimensionsCm.width ?? 0;
  const h = dimensionsCm.height ?? 0;
  const d = dimensionsCm.depth ?? 0;
  return {
    ancho: w,
    alto: h,
    profundidad: d,
    area_m2: (w * h) / 10_000,
    perimetro_m: (2 * (w + h)) / 100,
    volumen_m3: (w * h * d) / 1_000_000,
  };
}
