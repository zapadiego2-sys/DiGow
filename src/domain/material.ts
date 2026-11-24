import { deriveMeasures, type Dimensions } from './units';

export type MaterialPricing =
  | {
      mode: 'factor';
      purchasePrice: number;
      /** Decimal mayor que 0, sin significado de negocio atribuido. */
      factor: number;
      /** Solo para láminas: el costo queda expresado por cm². */
      sheetAreaCm2: number | null;
    }
  | { mode: 'direct'; unitCost: number };

/** Unidad en que se expresa el costo del material. */
export const materialUnits = ['unit', 'cm2', 'm2', 'linear_cm', 'linear_m'] as const;
export type MaterialUnit = (typeof materialUnits)[number];

/**
 * Cómo se desprende la cantidad del material a partir de las medidas del ítem.
 * `manual`: el analista la escribe; las demás se calculan solas.
 */
export const quantityRules = [
  'manual',
  'area_width_height',
  'area_width_depth',
  'area_height_depth',
  'box_surface',
  'perimeter_width_height',
  'length_width',
  'length_height',
  'length_depth',
] as const;
export type QuantityRule = (typeof quantityRules)[number];

export interface Material {
  id: string;
  name: string;
  supplier: string;
  pricing: MaterialPricing;
  unit: MaterialUnit;
  quantityRule: QuantityRule;
}

export type MaterialDraft = Omit<Material, 'id'>;

/** Una lámina siempre queda por cm²: su costo se divide por el área de la lámina. */
export function costUnit(material: Pick<Material, 'pricing' | 'unit'>): MaterialUnit {
  const { pricing } = material;
  return pricing.mode === 'factor' && pricing.sheetAreaCm2 ? 'cm2' : material.unit;
}

/** Costo por la unidad que indica costUnit. */
export function materialCost(material: Pick<Material, 'pricing'>): number {
  const { pricing } = material;
  if (pricing.mode === 'direct') return pricing.unitCost;
  if (pricing.factor <= 0) throw new RangeError('El factor debe ser mayor que 0.');
  const unitCost = pricing.purchasePrice / pricing.factor;
  return pricing.sheetAreaCm2 ? unitCost / pricing.sheetAreaCm2 : unitCost;
}

export function isAreaUnit(unit: MaterialUnit): boolean {
  return unit === 'cm2' || unit === 'm2';
}

/** Para una línea por área, que siempre trabaja en cm². */
export function materialCostPerCm2(material: Pick<Material, 'pricing' | 'unit'>): number {
  const cost = materialCost(material);
  return costUnit(material) === 'm2' ? cost / 10_000 : cost;
}

const AREA_RULES: Partial<Record<QuantityRule, (w: number, h: number, d: number) => number>> = {
  area_width_height: (w, h) => w * h,
  area_width_depth: (w, _h, d) => w * d,
  area_height_depth: (_w, h, d) => h * d,
  box_surface: (w, h, d) => 2 * (w * h + w * d + h * d),
};

const LENGTH_RULES: Partial<Record<QuantityRule, (w: number, h: number, d: number) => number>> = {
  perimeter_width_height: (w, h) => 2 * (w + h),
  length_width: (w) => w,
  length_height: (_w, h) => h,
  length_depth: (_w, _h, d) => d,
};

export type DerivedQuantity =
  { kind: 'area'; areaCm2: number } | { kind: 'unit'; quantity: number };

/**
 * Cantidad que la regla del material desprende de las medidas del ítem, en cm.
 * Devuelve null si la regla es manual, si no corresponde a la unidad o si falta una medida
 * que la regla usa: nunca inventa un valor.
 */
export function deriveMaterialQuantity(
  material: Pick<Material, 'pricing' | 'unit' | 'quantityRule'>,
  dimensionsCm: Dimensions,
): DerivedQuantity | null {
  const rule = material.quantityRule;
  if (rule === 'manual') return null;
  const used = RULE_DIMENSIONS[rule];
  if (used.some((key) => !dimensionsCm[key])) return null;
  const { ancho: w, alto: h, profundidad: d } = deriveMeasures(dimensionsCm);
  const unit = costUnit(material);
  const area = AREA_RULES[rule];
  if (area && isAreaUnit(unit)) return { kind: 'area', areaCm2: area(w, h, d) };
  const length = LENGTH_RULES[rule];
  if (length && unit === 'linear_cm') return { kind: 'unit', quantity: length(w, h, d) };
  if (length && unit === 'linear_m') return { kind: 'unit', quantity: length(w, h, d) / 100 };
  return null;
}

const RULE_DIMENSIONS: Record<QuantityRule, (keyof Dimensions)[]> = {
  manual: [],
  area_width_height: ['width', 'height'],
  area_width_depth: ['width', 'depth'],
  area_height_depth: ['height', 'depth'],
  box_surface: ['width', 'height', 'depth'],
  perimeter_width_height: ['width', 'height'],
  length_width: ['width'],
  length_height: ['height'],
  length_depth: ['depth'],
};

/** Qué reglas tienen sentido para cada unidad. */
export function rulesForUnit(unit: MaterialUnit): QuantityRule[] {
  if (isAreaUnit(unit)) return ['manual', ...(Object.keys(AREA_RULES) as QuantityRule[])];
  if (unit === 'linear_cm' || unit === 'linear_m') {
    return ['manual', ...(Object.keys(LENGTH_RULES) as QuantityRule[])];
  }
  return ['manual'];
}

/** El nombre identifica al material en una carga masiva: sin tildes, mayúsculas ni espacios extra. */
export function materialNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
