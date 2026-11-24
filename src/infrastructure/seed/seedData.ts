import type { CostLine } from '@/domain/cost';
import {
  materialCost,
  materialCostPerCm2,
  type Material,
  type MaterialUnit,
  type QuantityRule,
} from '@/domain/material';
import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE, type Quote } from '@/domain/quote';
import { ALL_MEASURES } from '@/domain/template';
import type { QuoteWorkflowState, WorkflowEvent } from '@/domain/workflow';
import { seedUsers, USER_IDS } from './accessSeed';
import { CATALOG_IDS, CONDITIONS_IDS, STANDARD_STEPS, STEPS, WORKFLOW_IDS } from './processSeed';

// Datos ficticios: el sitio es público y todo esto viaja en el JavaScript publicado.
const SEED_DATE = '2026-01-15T12:00:00.000Z';

function factorMaterial(
  id: string,
  name: string,
  purchasePrice: number,
  factor: number,
  options: {
    supplier?: string;
    sheetAreaCm2?: number;
    unit?: MaterialUnit;
    quantityRule?: QuantityRule;
  } = {},
): Material {
  return {
    id,
    name,
    supplier: options.supplier ?? '',
    pricing: { mode: 'factor', purchasePrice, factor, sheetAreaCm2: options.sheetAreaCm2 ?? null },
    unit: options.unit ?? (options.sheetAreaCm2 ? 'cm2' : 'unit'),
    quantityRule: options.quantityRule ?? 'manual',
  };
}

function directMaterial(
  id: string,
  name: string,
  unitCost: number,
  unit: MaterialUnit,
  quantityRule: QuantityRule,
): Material {
  return { id, name, supplier: '', pricing: { mode: 'direct', unitCost }, unit, quantityRule };
}

const MATERIALS = {
  mdf9: factorMaterial('mat-mdf-9', 'MDF 9 mm', 90000, 0.5),
  polystyrene: factorMaterial('mat-poliestireno-100', 'Poliestireno cal 100', 120000, 0.75, {
    sheetAreaCm2: 100 * 300,
    quantityRule: 'area_width_height',
  }),
  mdf12: factorMaterial('mat-mdf-12', 'MDF 12 mm', 120000, 0.5),
  tube: factorMaterial('mat-tubo-inox', 'Tubo acero inox 1" red cal 18', 60000, 0.75, {
    supplier: 'Aceros Demo',
  }),
  canvas: directMaterial('mat-lona-roja', 'Lona roja', 4, 'cm2', 'area_width_height'),
  vinyl: directMaterial('mat-vinilo', 'Vinilo', 6, 'cm2', 'area_width_height'),
  wheels: factorMaterial('mat-ruedas-freno', 'Ruedas con freno', 15000, 0.75),
  hinge: factorMaterial('mat-bisagra', 'Bisagra cápsula con aleta', 3000, 0.75),
  bolts: factorMaterial('mat-pasadores', 'Pasadores', 4500, 0.75),
  printedCanvas: directMaterial(
    'mat-lona-impresa',
    'Lona impresa m2',
    45000,
    'm2',
    'area_width_height',
  ),
  profile: directMaterial(
    'mat-perfil-aluminio',
    'Perfil de aluminio',
    25000,
    'linear_m',
    'perimeter_width_height',
  ),
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
    costPerCm2: materialCostPerCm2(material),
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

function nameOf(userId: string): string {
  return seedUsers().find((user) => user.id === userId)?.name ?? '';
}

type EventSpec = [
  at: string,
  action: WorkflowEvent['action'],
  actorId: string,
  fromStepId: string | null,
  toStepId: string | null,
  assigneeId: string | null,
  comment?: string,
];

function events(prefix: string, specs: EventSpec[]): WorkflowEvent[] {
  return specs.map(([at, action, actorId, fromStepId, toStepId, assigneeId, comment], index) => ({
    id: `${prefix}-${index + 1}`,
    at,
    action,
    actorId,
    actorName: nameOf(actorId),
    fromStepId,
    toStepId,
    assigneeId,
    assigneeName: assigneeId ? nameOf(assigneeId) : null,
    comment: comment ?? '',
  }));
}

const { request, measures, costing, review } = STEPS;

function standardWorkflow(
  state: Pick<QuoteWorkflowState, 'currentStepId' | 'assigneeId' | 'enteredStepAt' | 'completedAt'>,
  history: WorkflowEvent[],
): QuoteWorkflowState {
  return {
    workflowId: WORKFLOW_IDS.standard,
    workflowName: 'Cotización estándar',
    steps: STANDARD_STEPS.map((step) => ({ ...step })),
    ...state,
    history,
  };
}

function completedWorkflow(prefix: string, advisor: string, day: string): QuoteWorkflowState {
  const at = (hour: number) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  return standardWorkflow(
    { currentStepId: null, assigneeId: null, enteredStepAt: at(16), completedAt: at(16) },
    events(prefix, [
      [at(9), 'started', advisor, null, request.id, advisor],
      [at(10), 'advanced', advisor, request.id, measures.id, USER_IDS.analyst],
      [at(11), 'advanced', USER_IDS.analyst, measures.id, costing.id, USER_IDS.analyst],
      [at(14), 'advanced', USER_IDS.analyst, costing.id, review.id, advisor],
      [at(16), 'completed', advisor, review.id, null, null],
    ]),
  );
}

function measuresWorkflow(): QuoteWorkflowState {
  return standardWorkflow(
    {
      currentStepId: measures.id,
      assigneeId: USER_IDS.analyst,
      enteredStepAt: '2026-02-03T11:00:00.000Z',
      completedAt: null,
    },
    events('ev-exhibidor', [
      [
        '2026-02-03T10:00:00.000Z',
        'started',
        USER_IDS.advisor2,
        null,
        request.id,
        USER_IDS.advisor2,
      ],
      [
        '2026-02-03T11:00:00.000Z',
        'advanced',
        USER_IDS.advisor2,
        request.id,
        measures.id,
        USER_IDS.analyst,
        'El cliente necesita la propuesta esta semana.',
      ],
    ]),
  );
}

export const SEED_IDS = {
  cart: 'quote-carrito-demo',
  request: 'quote-exhibidor-demo',
  gondola: 'quote-gondola-demo',
} as const;

const STANDARD_TEMPLATE = {
  id: 'tpl-estandar',
  name: 'Estándar',
  measures: { ...ALL_MEASURES },
  standardSizes: [],
};

const POS_TEMPLATE = {
  id: 'tpl-punto-venta',
  name: 'Mobiliario de punto de venta',
  measures: { ...ALL_MEASURES },
  standardSizes: [
    { id: 'size-carrito', name: 'Carrito estándar', width: 120, height: 190, depth: 70 },
    { id: 'size-exhibidor', name: 'Exhibidor de mostrador', width: 60, height: 40, depth: 30 },
    { id: 'size-gondola', name: 'Góndola', width: 100, height: 200, depth: 60 },
  ],
};

const STANDARD_CONDITIONS = {
  conditions: [...DEFAULT_CONDITIONS],
  paymentTerms: 'A convenir',
  validity: '30 días',
  deliveryTime: 'A convenir',
  conditionsRef: { templateId: CONDITIONS_IDS.standard, name: 'Condiciones estándar', version: 1 },
};

const CITY = {
  id: 'field-ciudad',
  label: 'Ciudad de instalación',
  type: 'text',
  required: true,
  options: [],
  hint: '',
  showToClient: true,
} as const;

const INSTALLATION = {
  id: 'field-instalacion',
  label: 'Requiere instalación',
  type: 'checkbox',
  required: false,
  options: [],
  hint: '',
  showToClient: true,
} as const;

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
          catalogItemId: CATALOG_IDS.cart,
          kind: 'internal',
          predictive: true,
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
          subItems: [],
          internalNotes: [
            'Revisar riel',
            'Cotización de referencia: para 3 und $1.900.000 / para una unidad $2.000.000',
          ],
        },
      ],
      ...STANDARD_CONDITIONS,
      vatRate: DEFAULT_VAT_RATE,
      measureUnit: 'cm',
      createdBy: USER_IDS.advisor,
      template: STANDARD_TEMPLATE,
      customFields: [],
      workflow: completedWorkflow('ev-carrito', USER_IDS.advisor, '2026-01-15'),
      createdAt: SEED_DATE,
      updatedAt: SEED_DATE,
    },
    {
      id: SEED_IDS.gondola,
      status: 'sent',
      client: 'MERCADOS DEMO',
      contact: 'Sara Ejemplo',
      date: '2026-01-20',
      project: 'Góndola Demo',
      managerName: 'Laura Prueba',
      managerRole: 'Gestora de proyectos',
      items: [
        {
          id: 'item-gondola',
          catalogItemId: CATALOG_IDS.cart,
          kind: 'internal',
          predictive: true,
          product: 'Carrito de exhibición con cabezote',
          description:
            'Carrito en mdf 9mm forrado en vinilo, con ruedas con freno y cabezote iluminado',
          photoUrl: null,
          width: 100,
          height: 200,
          depth: 60,
          quantity: 3,
          unitPrice: 1850000,
          costLines: [
            unitLine('line-gondola-mdf', MATERIALS.mdf9, 2),
            areaLine('line-gondola-vinilo', MATERIALS.vinyl, [100 * 200]),
            unitLine('line-gondola-ruedas', MATERIALS.wheels, 4),
            {
              id: 'line-gondola-mano-obra',
              kind: 'labor',
              label: 'Mano de obra',
              note: '',
              materialId: null,
              days: 2,
              people: 1,
              dailyRate: 200000,
            },
          ],
          subItems: [
            {
              id: 'sub-gondola-cabezote',
              catalogSubItemId: 'sub-cabezote',
              name: 'Cabezote iluminado',
              description: 'Cabezote en mdf con tira LED',
              quantity: 1,
              predictive: true,
              costLines: [
                unitLine('line-cabezote-mdf', MATERIALS.mdf9, 0.5),
                {
                  id: 'line-cabezote-led',
                  kind: 'fixed',
                  label: 'Kit LED',
                  note: '',
                  materialId: null,
                  value: 120000,
                },
              ],
            },
          ],
          internalNotes: [],
        },
      ],
      ...STANDARD_CONDITIONS,
      vatRate: DEFAULT_VAT_RATE,
      measureUnit: 'cm',
      createdBy: USER_IDS.advisor,
      template: POS_TEMPLATE,
      customFields: [
        { ...CITY, options: [], value: 'Cali' },
        { ...INSTALLATION, options: [], value: true },
      ],
      workflow: completedWorkflow('ev-gondola', USER_IDS.advisor, '2026-01-20'),
      createdAt: '2026-01-20T09:00:00.000Z',
      updatedAt: '2026-01-20T16:00:00.000Z',
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
          catalogItemId: CATALOG_IDS.cart,
          kind: 'internal',
          predictive: true,
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
          subItems: [],
          internalNotes: [],
        },
      ],
      ...STANDARD_CONDITIONS,
      vatRate: DEFAULT_VAT_RATE,
      measureUnit: 'cm',
      createdBy: USER_IDS.advisor2,
      template: POS_TEMPLATE,
      customFields: [
        { ...CITY, options: [], value: 'Bogotá' },
        { ...INSTALLATION, options: [], value: true },
      ],
      workflow: measuresWorkflow(),
      createdAt: '2026-02-03T10:00:00.000Z',
      updatedAt: '2026-02-03T11:00:00.000Z',
    },
  ];
}
