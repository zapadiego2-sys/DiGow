import type { CostLine } from '@/domain/cost';
import { materialCost, type Material } from '@/domain/material';
import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE, type Quote } from '@/domain/quote';

// Datos ficticios: el sitio es público y todo esto viaja en el JavaScript publicado.
const SEED_DATE = '2026-01-15T12:00:00.000Z';

function factorMaterial(
  id: string,
  name: string,
  purchasePrice: number,
  factor: number,
  options: { supplier?: string; sheetAreaCm2?: number } = {},
): Material {
  return {
    id,
    name,
    supplier: options.supplier ?? '',
    pricing: { mode: 'factor', purchasePrice, factor, sheetAreaCm2: options.sheetAreaCm2 ?? null },
  };
}

function directMaterial(id: string, name: string, unitCost: number): Material {
  return { id, name, supplier: '', pricing: { mode: 'direct', unitCost } };
}

const MATERIALS = {
  mdf9: factorMaterial('mat-mdf-9', 'MDF 9 mm', 90000, 0.5),
  polystyrene: factorMaterial('mat-poliestireno-100', 'Poliestireno cal 100', 120000, 0.75, {
    sheetAreaCm2: 100 * 300,
  }),
  mdf12: factorMaterial('mat-mdf-12', 'MDF 12 mm', 120000, 0.5),
  tube: factorMaterial('mat-tubo-inox', 'Tubo acero inox 1" red cal 18', 60000, 0.75, {
    supplier: 'Aceros Demo',
  }),
  canvas: directMaterial('mat-lona-roja', 'Lona roja', 4),
  vinyl: directMaterial('mat-vinilo', 'Vinilo', 6),
  wheels: factorMaterial('mat-ruedas-freno', 'Ruedas con freno', 15000, 0.75),
  hinge: factorMaterial('mat-bisagra', 'Bisagra cápsula con aleta', 3000, 0.75),
  bolts: factorMaterial('mat-pasadores', 'Pasadores', 4500, 0.75),
} satisfies Record<string, Material>;

export function seedMaterials(): Material[] {
  return Object.values(MATERIALS);
}

function unitLine(
  id: string,
  material: Material,
  quantity: number,
  label = material.name,
): CostLine {
  return {
    id,
    kind: 'unit',
    label,
    note: '',
    materialId: material.id,
    quantity,
    unitCost: materialCost(material),
  };
}

function areaLine(id: string, material: Material, areasCm2: number[]): CostLine {
  return {
    id,
    kind: 'area',
    label: material.name,
    note: '',
    materialId: material.id,
    areasCm2,
    costPerCm2: materialCost(material),
  };
}

export function seedCostLines(): CostLine[] {
  return [
    unitLine('line-mdf-9', MATERIALS.mdf9, 2),
    areaLine('line-poliestireno', MATERIALS.polystyrene, [120 * 80, 2 * 80 * 70]),
    unitLine('line-mdf-12', MATERIALS.mdf12, 1, 'MDF 12 mm (superficie, base y techo)'),
    unitLine(
      'line-tubo',
      MATERIALS.tube,
      1.5,
      'Tubo acero inox 1" red cal 18 (proveedor Aceros Demo)',
    ),
    areaLine('line-lona', MATERIALS.canvas, [180 * 140]),
    areaLine('line-vinilo', MATERIALS.vinyl, [30000]),
    {
      id: 'line-mano-obra',
      kind: 'labor',
      label: 'Mano de obra',
      note: '',
      materialId: null,
      days: 2,
      people: 2,
      dailyRate: 200000,
    },
    unitLine('line-ruedas', MATERIALS.wheels, 4),
    unitLine('line-bisagra', MATERIALS.hinge, 6),
    unitLine('line-pasadores', MATERIALS.bolts, 6),
    { id: 'line-otros', kind: 'fixed', label: 'Otros', note: '', materialId: null, value: 150000 },
  ];
}

export function seedQuotes(): Quote[] {
  return [
    {
      id: 'quote-carrito-demo',
      status: 'draft',
      client: 'EMPRESA DEMO',
      contact: 'Ana Ejemplo',
      date: '2026-01-15',
      project: 'Carrito Demo',
      managerName: 'Laura Prueba',
      managerRole: 'Gestora de proyectos',
      items: [
        {
          id: 'item-carrito-ejemplo',
          product: 'Carrito de ejemplo',
          description:
            'Medida: 120 x 80 x 70 profund Alto: 1,9 mt aprox / Mdf 9mm + mdf 12mm + imagen en poliestireno cal 100 + parales en tubo redondo acero inox + lona roja + vinilo + ruedas con freno + bisagras y pasadores',
          photoUrl: `${import.meta.env.BASE_URL}seed/carrito-ejemplo.png`,
          width: 120,
          height: 190,
          depth: 70,
          quantity: 1,
          unitPrice: 2400000,
          costLines: seedCostLines(),
          internalNotes: [
            'Revisar riel',
            'Cotización de referencia: para 3 und $1.900.000 / para una unidad $2.000.000',
          ],
        },
      ],
      conditions: [...DEFAULT_CONDITIONS],
      paymentTerms: 'A convenir',
      validity: '30 días',
      deliveryTime: 'A convenir',
      vatRate: DEFAULT_VAT_RATE,
      createdAt: SEED_DATE,
      updatedAt: SEED_DATE,
    },
  ];
}
