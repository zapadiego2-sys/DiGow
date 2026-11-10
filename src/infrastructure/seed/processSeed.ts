import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE } from '@/domain/quote';
import { ALL_MEASURES, type QuoteTemplate, type TemplateField } from '@/domain/template';
import type { Workflow, WorkflowStep } from '@/domain/workflow';
import { ROLE_IDS } from './accessSeed';

export const WORKFLOW_IDS = { standard: 'wf-estandar', express: 'wf-rapido' } as const;

export const STEPS = {
  request: {
    id: 'step-solicitud',
    name: 'Solicitud',
    roleId: ROLE_IDS.advisor,
    assignment: 'requester',
    instructions:
      'Registra el cliente, el proyecto y cada ítem con su descripción y medidas. Al terminar, envíala a costeo.',
  },
  costing: {
    id: 'step-costeo',
    name: 'Costeo',
    roleId: ROLE_IDS.analyst,
    assignment: 'workload',
    instructions:
      'Arma la hoja de costos de cada ítem y escribe el precio de venta. Si falta información, devuélvela con un comentario.',
  },
  review: {
    id: 'step-revision',
    name: 'Revisión y envío',
    roleId: ROLE_IDS.advisor,
    assignment: 'requester',
    instructions: 'Revisa los precios, envía la cotización al cliente y marca su estado.',
  },
} satisfies Record<string, WorkflowStep>;

export function seedWorkflows(): Workflow[] {
  return [
    {
      id: WORKFLOW_IDS.standard,
      name: 'Cotización estándar',
      description: 'El asesor registra la solicitud, un analista la costea y el asesor la envía.',
      active: true,
      isDefault: true,
      steps: [STEPS.request, STEPS.costing, STEPS.review],
    },
    {
      id: WORKFLOW_IDS.express,
      name: 'Cotización rápida',
      description: 'Para impresos sencillos: el analista costea y la cotización queda lista.',
      active: true,
      isDefault: false,
      steps: [
        { ...STEPS.request, id: 'step-rapido-solicitud' },
        { ...STEPS.costing, id: 'step-rapido-costeo' },
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
  const defaults = {
    conditions: [...DEFAULT_CONDITIONS],
    paymentTerms: 'A convenir',
    validity: '30 días',
    deliveryTime: 'A convenir',
    vatRate: DEFAULT_VAT_RATE,
  };
  return [
    {
      id: 'tpl-estandar',
      name: 'Estándar',
      description: 'Cotización general con las medidas completas y las condiciones por defecto.',
      active: true,
      workflowId: null,
      fields: [],
      measures: { ...ALL_MEASURES },
      ...defaults,
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
      ...defaults,
    },
    {
      id: 'tpl-impresos',
      name: 'Impresos y gráficas',
      description: 'Vinilos, lonas y piezas planas: solo piden ancho y alto.',
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
      ...defaults,
      paymentTerms: '50 % de anticipo y 50 % contra entrega',
      validity: '15 días',
      deliveryTime: '5 días hábiles',
    },
  ];
}
