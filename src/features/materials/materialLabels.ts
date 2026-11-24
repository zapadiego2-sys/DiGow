import type { MaterialUnit, QuantityRule } from '@/domain/material';
import type { LengthUnit } from '@/domain/units';

export const UNIT_LABELS: Record<MaterialUnit, string> = {
  unit: 'unidad',
  cm2: 'cm²',
  m2: 'm²',
  linear_cm: 'cm lineal',
  linear_m: 'metro lineal',
};

export const RULE_LABELS: Record<QuantityRule, string> = {
  manual: 'La escribe el analista',
  area_width_height: 'Ancho × alto',
  area_width_depth: 'Ancho × profundidad',
  area_height_depth: 'Alto × profundidad',
  box_surface: 'Superficie de la caja (todas las caras)',
  perimeter_width_height: 'Perímetro de ancho y alto',
  length_width: 'El ancho',
  length_height: 'El alto',
  length_depth: 'La profundidad',
};

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  mm: 'Milímetros (mm)',
  cm: 'Centímetros (cm)',
  m: 'Metros (m)',
};
