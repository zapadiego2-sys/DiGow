interface CostLineBase {
  id: string;
  label: string;
  /** Texto libre interno, por ejemplo la fórmula original del Excel. */
  note: string;
  materialId: string | null;
}

export interface UnitCostLine extends CostLineBase {
  kind: 'unit';
  quantity: number;
  unitCost: number;
}

export interface AreaCostLine extends CostLineBase {
  kind: 'area';
  areasCm2: number[];
  costPerCm2: number;
}

export interface LaborCostLine extends CostLineBase {
  kind: 'labor';
  days: number;
  people: number;
  dailyRate: number;
}

export interface FixedCostLine extends CostLineBase {
  kind: 'fixed';
  value: number;
}

export type CostLine = UnitCostLine | AreaCostLine | LaborCostLine | FixedCostLine;
export type CostLineKind = CostLine['kind'];
type LineOf<K extends CostLineKind> = Extract<CostLine, { kind: K }>;

/** Una estrategia por tipo de línea. Un tipo nuevo se agrega aquí, sin tocar los totales. */
interface CostLineStrategy<K extends CostLineKind> {
  calculate(line: LineOf<K>): number;
  /** Convierte una línea a este tipo. Conserva el costo cuando el tipo lo permite. */
  fromCost(base: CostLineBase, cost: number): LineOf<K>;
  /** Aplica el costo derivado de un material del catálogo. */
  withMaterialCost(line: LineOf<K>, materialCost: number): LineOf<K>;
}

type CostLineStrategies = { [K in CostLineKind]: CostLineStrategy<K> };

export const costLineStrategies: CostLineStrategies = {
  unit: {
    calculate: (line) => line.quantity * line.unitCost,
    fromCost: (base, cost) => ({ ...base, kind: 'unit', quantity: 1, unitCost: cost }),
    withMaterialCost: (line, materialCost) => ({ ...line, unitCost: materialCost }),
  },
  area: {
    calculate: (line) => sum(line.areasCm2) * line.costPerCm2,
    fromCost: (base) => ({ ...base, kind: 'area', areasCm2: [], costPerCm2: 0 }),
    withMaterialCost: (line, materialCost) => ({ ...line, costPerCm2: materialCost }),
  },
  labor: {
    calculate: (line) => line.days * line.people * line.dailyRate,
    fromCost: (base, cost) => ({ ...base, kind: 'labor', days: 1, people: 1, dailyRate: cost }),
    withMaterialCost: (line, materialCost) => ({ ...line, dailyRate: materialCost }),
  },
  fixed: {
    calculate: (line) => line.value,
    fromCost: (base, cost) => ({ ...base, kind: 'fixed', value: cost }),
    withMaterialCost: (line, materialCost) => ({ ...line, value: materialCost }),
  },
};

export const costLineKinds = Object.keys(costLineStrategies) as CostLineKind[];

function strategyFor<K extends CostLineKind>(kind: K) {
  return costLineStrategies[kind] as unknown as CostLineStrategy<CostLineKind>;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function lineCost(line: CostLine): number {
  return strategyFor(line.kind).calculate(line as never);
}

export function linesCost(lines: readonly CostLine[]): number {
  return sum(lines.map(lineCost));
}

export function changeLineKind(line: CostLine, kind: CostLineKind): CostLine {
  if (line.kind === kind) return line;
  const base: CostLineBase = {
    id: line.id,
    label: line.label,
    note: line.note,
    materialId: line.materialId,
  };
  return strategyFor(kind).fromCost(base, lineCost(line));
}

export function applyMaterialCost(line: CostLine, materialId: string, cost: number): CostLine {
  const updated = strategyFor(line.kind).withMaterialCost(line as never, cost);
  return { ...updated, materialId };
}

export function createCostLine(id: string, kind: CostLineKind = 'unit'): CostLine {
  const base: CostLineBase = { id, label: '', note: '', materialId: null };
  return strategyFor(kind).fromCost(base, 0);
}
