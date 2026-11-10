import type { CostLine } from '@/domain/cost';
import { materialCost, type Material } from '@/domain/material';
import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE, type Quote } from '@/domain/quote';
import { ALL_MEASURES } from '@/domain/template';
import type { QuoteWorkflowState, WorkflowEvent } from '@/domain/workflow';
import { seedUsers, USER_IDS } from './accessSeed';
import { STEPS, WORKFLOW_IDS } from './processSeed';

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

const STANDARD_STEPS = [STEPS.request, STEPS.costing, STEPS.review];

function nameOf(userId: string): string {
  return seedUsers().find((user) => user.id === userId)?.name ?? '';
}

function seedEvent(
  id: string,
  at: string,
  action: WorkflowEvent['action'],
  actorId: string,
  fromStepId: string | null,
  toStepId: string | null,
  assigneeId: string | null,
  comment = '',
): WorkflowEvent {
  return {
    id,
    at,
    action,
    actorId,
    actorName: nameOf(actorId),
    fromStepId,
    toStepId,
    assigneeId,
    assigneeName: assigneeId ? nameOf(assigneeId) : null,
    comment,
  };
}

function completedWorkflow(): QuoteWorkflowState {
  return {
    workflowId: WORKFLOW_IDS.standard,
    workflowName: 'Cotización estándar',
    steps: STANDARD_STEPS,
    currentStepId: null,
    assigneeId: null,
    enteredStepAt: '2026-01-15T16:00:00.000Z',
    completedAt: '2026-01-15T16:00:00.000Z',
    history: [
      seedEvent(
        'ev-1',
        '2026-01-15T09:00:00.000Z',
        'started',
        USER_IDS.advisor,
        null,
        STEPS.request.id,
        USER_IDS.advisor,
      ),
      seedEvent(
        'ev-2',
        '2026-01-15T10:00:00.000Z',
        'advanced',
        USER_IDS.advisor,
        STEPS.request.id,
        STEPS.costing.id,
        USER_IDS.analyst,
      ),
      seedEvent(
        'ev-3',
        '2026-01-15T14:00:00.000Z',
        'advanced',
        USER_IDS.analyst,
        STEPS.costing.id,
        STEPS.review.id,
        USER_IDS.advisor,
      ),
      seedEvent(
        'ev-4',
        '2026-01-15T16:00:00.000Z',
        'completed',
        USER_IDS.advisor,
        STEPS.review.id,
        null,
        null,
      ),
    ],
  };
}

function costingWorkflow(): QuoteWorkflowState {
  return {
    workflowId: WORKFLOW_IDS.standard,
    workflowName: 'Cotización estándar',
    steps: STANDARD_STEPS,
    currentStepId: STEPS.costing.id,
    assigneeId: USER_IDS.analyst,
    enteredStepAt: '2026-02-03T11:00:00.000Z',
    completedAt: null,
    history: [
      seedEvent(
        'ev-5',
        '2026-02-03T10:00:00.000Z',
        'started',
        USER_IDS.advisor2,
        null,
        STEPS.request.id,
        USER_IDS.advisor2,
      ),
      seedEvent(
        'ev-6',
        '2026-02-03T11:00:00.000Z',
        'advanced',
        USER_IDS.advisor2,
        STEPS.request.id,
        STEPS.costing.id,
        USER_IDS.analyst,
        'El cliente necesita la propuesta esta semana.',
      ),
    ],
  };
}

export const SEED_IDS = { cart: 'quote-carrito-demo', request: 'quote-exhibidor-demo' } as const;

export function seedQuotes(): Quote[] {
  return [
    {
      id: SEED_IDS.cart,
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
      createdBy: USER_IDS.advisor,
      template: { id: 'tpl-estandar', name: 'Estándar', measures: { ...ALL_MEASURES } },
      customFields: [],
      workflow: completedWorkflow(),
      createdAt: SEED_DATE,
      updatedAt: SEED_DATE,
    },
    {
      id: SEED_IDS.request,
      status: 'draft',
      client: 'TIENDAS EJEMPLO',
      contact: 'Mario Demo',
      date: '2026-02-03',
      project: 'Exhibidor Demo',
      managerName: 'Carlos Asesor',
      managerRole: 'Asesor comercial',
      items: [
        {
          id: 'item-carrito-exhibicion',
          product: 'Carrito de exhibición',
          description:
            'Carrito en mdf 9mm y mdf 12mm, forrado en vinilo, con ruedas con freno y bisagras',
          photoUrl: null,
          width: 100,
          height: 180,
          depth: 60,
          quantity: 2,
          unitPrice: null,
          costLines: [],
          internalNotes: [],
        },
      ],
      conditions: [...DEFAULT_CONDITIONS],
      paymentTerms: 'A convenir',
      validity: '30 días',
      deliveryTime: 'A convenir',
      vatRate: DEFAULT_VAT_RATE,
      createdBy: USER_IDS.advisor2,
      template: {
        id: 'tpl-punto-venta',
        name: 'Mobiliario de punto de venta',
        measures: { ...ALL_MEASURES },
      },
      customFields: [
        {
          id: 'field-ciudad',
          label: 'Ciudad de instalación',
          type: 'text',
          required: true,
          options: [],
          hint: '',
          showToClient: true,
          value: 'Bogotá',
        },
        {
          id: 'field-instalacion',
          label: 'Requiere instalación',
          type: 'checkbox',
          required: false,
          options: [],
          hint: '',
          showToClient: true,
          value: true,
        },
      ],
      workflow: costingWorkflow(),
      createdAt: '2026-02-03T10:00:00.000Z',
      updatedAt: '2026-02-03T11:00:00.000Z',
    },
  ];
}
