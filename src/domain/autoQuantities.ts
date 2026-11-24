import type { CostLine } from './cost';
import { deriveMaterialQuantity, materialCost, type Material } from './material';
import { deriveMeasures, dimensionsInCm, type Dimensions, type LengthUnit } from './units';

export interface ItemMeasureContext extends Dimensions {
  quantity: number | null;
  measureUnit: LengthUnit;
}

/** Valores que una fórmula recibe del ítem: medidas en cm, derivados y cantidad. */
export function itemFormulaValues(item: ItemMeasureContext): Record<string, number> {
  return {
    ...deriveMeasures(dimensionsInCm(item, item.measureUnit)),
    cantidad: item.quantity ?? 0,
  };
}

/**
 * Recalcula una línea con las medidas del ítem: las cantidades que la regla del material
 * desprende y los valores de una fórmula. Devuelve null si no hay nada que se pueda calcular,
 * para que la línea quede como la escribió el analista.
 */
export function recalculateLine(
  line: CostLine,
  material: Material | undefined,
  item: ItemMeasureContext,
): CostLine | null {
  if (line.kind === 'formula') {
    return {
      ...line,
      values: {
        ...line.values,
        ...itemFormulaValues(item),
        ...(material ? { costo: materialCost(material) } : {}),
      },
    };
  }
  if (!material) return null;
  const derived = deriveMaterialQuantity(material, dimensionsInCm(item, item.measureUnit));
  if (!derived) return null;
  if (line.kind === 'area' && derived.kind === 'area') {
    return { ...line, areasCm2: [derived.areaCm2] };
  }
  if (line.kind === 'unit' && derived.kind === 'unit') {
    return { ...line, quantity: derived.quantity };
  }
  return null;
}

export interface LineRecalculation {
  index: number;
  before: CostLine;
  after: CostLine;
}

/** Las líneas que cambiarían al recalcular, para mostrarlas antes de aplicarlas. */
export function pendingRecalculations(
  lines: readonly CostLine[],
  materials: readonly Material[],
  item: ItemMeasureContext,
): LineRecalculation[] {
  return lines.flatMap((line, index) => {
    const material = materials.find((m) => m.id === line.materialId);
    const after = recalculateLine(line, material, item);
    if (!after || JSON.stringify(after) === JSON.stringify(line)) return [];
    return [{ index, before: line, after }];
  });
}
