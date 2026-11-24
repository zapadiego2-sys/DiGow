import type { CatalogItem, CatalogSubItem } from '@/domain/catalog';
import type { ConditionsTemplate } from '@/domain/conditions';
import type { CostFormula } from '@/domain/formula';
import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE } from '@/domain/quote';
import { ALL_MEASURES, type QuoteTemplate, type TemplateField } from '@/domain/template';
import type { Workflow, WorkflowStep } from '@/domain/workflow';
import { ROLE_IDS } from './accessSeed';

// Datos ficticios: el sitio es público y todo esto viaja en el JavaScript publicado.
const SEED_DATE = '2026-01-01T12:00:00.000Z';

export const WORKFLOW_IDS = { standard: 'wf-estandar', express: 'wf-rapido' } as const;

export const STEPS = {
  request: {
    id: 'step-solicitud',
    name: 'Solicitud',
    roleId: ROLE_IDS.advisor,
    assignment: 'requester',
    gate: 'none',
    instructions:
      'Registra el cliente, el proyecto y cada ítem con su descripción y medidas. No escribas precios: los define el analista.',
  },
  measures: {
    id: 'step-medidas',
    name: 'Aprobar medidas',
    roleId: ROLE_IDS.analyst,
    assignment: 'workload',
    gate: 'measures',
    instructions:
      'Valida las medidas, la unidad y el tipo de cada producto. Las cantidades de los materiales se calculan solas a partir de las medidas.',
  },
  costing: {
    id: 'step-costeo',
    name: 'Aprobar costos',
    roleId: ROLE_IDS.analyst,
    assignment: 'previousStep',
    gate: 'costs',
    instructions:
      'Arma la hoja de costos de cada ítem y sub-ítem, aplica las fórmulas y escribe el precio de venta. Si falta información, devuélvela con un comentario.',
  },
  review: {
    id: 'step-revision',
    name: 'Revisión y envío',
    roleId: ROLE_IDS.advisor,
    assignment: 'requester',
    gate: 'none',
    instructions: 'Revisa la cotización y envíala al cliente. Al terminar, queda como Enviada.',
  },
} satisfies Record<string, WorkflowStep>;

export const STANDARD_STEPS: WorkflowStep[] = [
  STEPS.request,
  STEPS.measures,
  STEPS.costing,
  STEPS.review,
];

export function seedWorkflows(): Workflow[] {
  return [
    {
      id: WORKFLOW_IDS.standard,
      name: 'Cotización estándar',
      description:
        'El asesor registra la solicitud; un analista aprueba las medidas y luego los costos; el asesor la envía.',
      active: true,
      isDefault: true,
      steps: STANDARD_STEPS.map((step) => ({ ...step })),
    },
    {
      id: WORKFLOW_IDS.express,
      name: 'Cotización rápida',
      description: 'Para impresos sencillos: el analista costea y la cotización queda lista.',
      active: true,
      isDefault: false,
      steps: [
        { ...STEPS.request, id: 'step-rapido-solicitud' },
        { ...STEPS.costing, id: 'step-rapido-costeo', name: 'Costeo', assignment: 'workload' },
      ],
    },
  ];
}

export const CONDITIONS_IDS = { standard: 'cond-estandar', print: 'cond-impresos' } as const;

export function seedConditions(): ConditionsTemplate[] {
  return [
    {
      id: CONDITIONS_IDS.standard,
      name: 'Condiciones estándar',
      active: true,
      versions: [
        {
          version: 1,
          conditions: [...DEFAULT_CONDITIONS],
          paymentTerms: 'A convenir',
          validity: '30 días',
          deliveryTime: 'A convenir',
          createdAt: SEED_DATE,
          createdBy: null,
        },
      ],
    },
    {
      id: CONDITIONS_IDS.print,
      name: 'Condiciones de impresos',
      active: true,
      versions: [
        {
          version: 1,
          conditions: [
            'Los precios incluyen transporte local.',
            'Los colores impresos pueden variar ligeramente respecto a la pantalla.',
            'Luego de 5 días de recibido el trabajo no se aceptarán reclamos.',
          ],
          paymentTerms: '50 % de anticipo y 50 % contra entrega',
          validity: '15 días',
          deliveryTime: '5 días hábiles',
          createdAt: SEED_DATE,
          createdBy: null,
        },
      ],
    },
  ];
}

function field(
  id: string,
  label: string,
  type: TemplateField['type'],
  options: Partial<TemplateField> = {},
): TemplateField {
  return {
    id,
    label,
    type,
    required: false,
    options: [],
    hint: '',
    showToClient: false,
    ...options,
  };
}

const INSTALLATION = field('field-instalacion', 'Requiere instalación', 'checkbox', {
  showToClient: true,
});

export function seedTemplates(): QuoteTemplate[] {
  return [
    {
      id: 'tpl-estandar',
      name: 'Estándar',
      description: 'Cotización general con las medidas completas y las condiciones estándar.',
      active: true,
      workflowId: null,
      fields: [],
      measures: { ...ALL_MEASURES },
      measureUnit: 'cm',
      standardSizes: [],
      conditionsTemplateId: CONDITIONS_IDS.standard,
      vatRate: DEFAULT_VAT_RATE,
    },
    {
      id: 'tpl-punto-venta',
      name: 'Mobiliario de punto de venta',
      description: 'Carritos, exhibidores y estructuras que se instalan en un punto de venta.',
      active: true,
      workflowId: null,
      fields: [
        field('field-ciudad', 'Ciudad de instalación', 'text', {
          required: true,
          showToClient: true,
        }),
        INSTALLATION,
        field('field-evento', 'Fecha del evento', 'date', {
          hint: 'Ayuda a priorizar la producción.',
        }),
        field('field-marca', 'Marca o campaña', 'text'),
      ],
      measures: { ...ALL_MEASURES },
      measureUnit: 'cm',
      standardSizes: [
        { id: 'size-carrito', name: 'Carrito estándar', width: 120, height: 190, depth: 70 },
        { id: 'size-exhibidor', name: 'Exhibidor de mostrador', width: 60, height: 40, depth: 30 },
        { id: 'size-gondola', name: 'Góndola', width: 100, height: 200, depth: 60 },
      ],
      conditionsTemplateId: CONDITIONS_IDS.standard,
      vatRate: DEFAULT_VAT_RATE,
    },
    {
      id: 'tpl-impresos',
      name: 'Impresos y gráficas',
      description: 'Vinilos, lonas y piezas planas: solo piden ancho y alto, en metros.',
      active: true,
      workflowId: WORKFLOW_IDS.express,
      fields: [
        field('field-material-impresion', 'Material de impresión', 'select', {
          required: true,
          showToClient: true,
          options: ['Vinilo', 'Lona', 'Poliestireno'],
        }),
        field('field-acabado', 'Acabado', 'select', {
          showToClient: true,
          options: ['Mate', 'Brillante'],
        }),
        INSTALLATION,
      ],
      measures: { width: true, height: true, depth: false },
      measureUnit: 'm',
      standardSizes: [
        { id: 'size-pendon', name: 'Pendón', width: 0.8, height: 1.8, depth: null },
        { id: 'size-valla', name: 'Valla', width: 3, height: 2, depth: null },
      ],
      conditionsTemplateId: CONDITIONS_IDS.print,
      vatRate: DEFAULT_VAT_RATE,
    },
  ];
}

export const FORMULA_IDS = {
  wasteArea: 'formula-area-desperdicio',
  sheets: 'formula-laminas',
  perimeter: 'formula-perimetro',
  labor: 'formula-mano-obra-area',
} as const;

export function seedFormulas(): CostFormula[] {
  return [
    {
      id: FORMULA_IDS.wasteArea,
      name: 'Área con desperdicio',
      description: 'Material por m² sobre ancho × alto, más un porcentaje de desperdicio.',
      expression: 'area_m2 * costo * (1 + desperdicio)',
      params: [{ name: 'desperdicio', label: 'Desperdicio (0,1 = 10 %)', defaultValue: 0.1 }],
      active: true,
      version: 1,
    },
    {
      id: FORMULA_IDS.sheets,
      name: 'Láminas completas',
      description: 'Cuántas láminas enteras se necesitan para cubrir ancho × alto.',
      expression: 'redondear_arriba(area_m2 / area_lamina) * costo',
      params: [{ name: 'area_lamina', label: 'Área de la lámina en m²', defaultValue: 2.9768 }],
      active: true,
      version: 1,
    },
    {
      id: FORMULA_IDS.perimeter,
      name: 'Perfil por perímetro',
      description: 'Material por metro lineal sobre el perímetro de ancho y alto.',
      expression: 'perimetro_m * costo',
      params: [],
      active: true,
      version: 1,
    },
    {
      id: FORMULA_IDS.labor,
      name: 'Mano de obra por área',
      description: 'Tarifa por m², con un valor mínimo por unidad.',
      expression: 'max(minimo; area_m2 * tarifa)',
      params: [
        { name: 'minimo', label: 'Valor mínimo', defaultValue: 150000 },
        { name: 'tarifa', label: 'Tarifa por m²', defaultValue: 80000 },
      ],
      active: true,
      version: 1,
    },
  ];
}

export const CATALOG_IDS = {
  cart: 'cat-carrito',
  counter: 'cat-exhibidor',
  sign: 'cat-aviso',
  stand: 'cat-stand',
} as const;

export function seedCatalogItems(): CatalogItem[] {
  return [
    {
      id: CATALOG_IDS.cart,
      name: 'Carrito',
      description: 'Carrito de punto de venta fabricado en taller.',
      kind: 'internal',
      predictive: true,
      active: true,
    },
    {
      id: CATALOG_IDS.counter,
      name: 'Exhibidor de mostrador',
      description: 'Exhibidor pequeño para mostrador o vitrina.',
      kind: 'internal',
      predictive: true,
      active: true,
    },
    {
      id: CATALOG_IDS.sign,
      name: 'Aviso impreso',
      description: 'Impresión tercerizada en gran formato.',
      kind: 'external',
      predictive: true,
      active: true,
    },
    {
      id: CATALOG_IDS.stand,
      name: 'Stand modular',
      description: 'Estructura propia con piezas compradas a terceros.',
      kind: 'hybrid',
      predictive: true,
      active: true,
    },
  ];
}

export function seedCatalogSubItems(): CatalogSubItem[] {
  return [
    {
      id: 'sub-cabezote',
      name: 'Cabezote iluminado',
      description: 'Pieza superior con la marca y luz LED.',
      parentItemId: CATALOG_IDS.cart,
      defaultQuantity: 1,
      predictive: true,
      active: true,
    },
    {
      id: 'sub-ruedas',
      name: 'Juego de ruedas con freno',
      description: 'Cuatro ruedas, dos con freno.',
      parentItemId: CATALOG_IDS.cart,
      defaultQuantity: 1,
      predictive: true,
      active: true,
    },
    {
      id: 'sub-instalacion',
      name: 'Instalación en sitio',
      description: 'Montaje en el punto de venta.',
      parentItemId: null,
      defaultQuantity: 1,
      // El costo depende del lugar, no del producto: no sirve como referencia.
      predictive: false,
      active: true,
    },
    {
      id: 'sub-iluminacion',
      name: 'Iluminación LED',
      description: 'Tira de LED con fuente.',
      parentItemId: null,
      defaultQuantity: 1,
      predictive: true,
      active: true,
    },
  ];
}
