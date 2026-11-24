import type { ProductKind } from './catalog';
import { conditionsFrom, type ConditionsRef, type ConditionsTemplate } from './conditions';
import { linesCost, sum, type CostLine } from './cost';
import {
  emptyFieldValue,
  type QuoteCustomField,
  type QuoteTemplate,
  type QuoteTemplateRef,
} from './template';
import { DEFAULT_LENGTH_UNIT, type LengthUnit } from './units';
import { isOpenTask, type QuoteWorkflowState } from './workflow';

export const quoteStatuses = ['draft', 'sent', 'approved', 'rejected'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const DEFAULT_VAT_RATE = 0.19;

export const DEFAULT_CONDITIONS: readonly string[] = [
  'Los precios incluyen transporte local.',
  'El tiempo de producción contará a partir de la aprobación por parte del cliente y entrega de artes finales.',
  'Este trabajo se cotiza para producirse en horarios de producción que no sean festivos. En caso de requerirse, los valores pueden variar.',
  'Los precios no incluyen el diseño gráfico, en caso de que por un acuerdo de nivel de servicio se solicite, éstos tendrán un costo adicional.',
  'Si las especificaciones de la producción final cambian con respecto a la cotización previa, se procederá a recotizar según las características del trabajo entregado.',
  'Luego de 5 días de recibido el trabajo no se aceptarán reclamos.',
  'Esta cotización está basada en la información suministrada por el cliente, cualquier cambio afectará el valor de la misma.',
];

/** Parte de un ítem con su propia hoja de costos. Es interna: el cliente no la ve. */
export interface QuoteSubItem {
  id: string;
  catalogSubItemId: string | null;
  name: string;
  description: string;
  /** Cantidad por unidad del ítem. */
  quantity: number | null;
  predictive: boolean;
  /** Costo de una unidad del sub-ítem. */
  costLines: CostLine[];
}

export interface QuoteItem {
  id: string;
  /** null si el producto se escribió a mano. */
  catalogItemId: string | null;
  /** null mientras no se clasifique; aprobar medidas lo exige. */
  kind: ProductKind | null;
  /** Si cuenta para el modelo predictivo. */
  predictive: boolean;
  product: string;
  description: string;
  photoUrl: string | null;
  /** null significa dato faltante; nunca se reemplaza por un valor inventado. */
  width: number | null;
  height: number | null;
  depth: number | null;
  quantity: number | null;
  /** Precio de venta unitario, ingresado manualmente. */
  unitPrice: number | null;
  /** Hoja de costos de una unidad del ítem. */
  costLines: CostLine[];
  subItems: QuoteSubItem[];
  internalNotes: string[];
}

export interface Quote {
  id: string;
  status: QuoteStatus;
  client: string;
  contact: string;
  /** Fecha ISO (AAAA-MM-DD), o vacía si falta. */
  date: string;
  project: string;
  managerName: string;
  managerRole: string;
  items: QuoteItem[];
  conditions: string[];
  paymentTerms: string;
  validity: string;
  deliveryTime: string;
  vatRate: number;
  /** Las medidas de todos los ítems se escriben en esta unidad. */
  measureUnit: LengthUnit;
  /** Plantilla y versión de condiciones aplicadas; null si se escribieron a mano. */
  conditionsRef: ConditionsRef | null;
  /** Usuario que creó la cotización; null en datos anteriores a los usuarios. */
  createdBy: string | null;
  template: QuoteTemplateRef | null;
  customFields: QuoteCustomField[];
  workflow: QuoteWorkflowState | null;
  createdAt: string;
  updatedAt: string;
}

export type QuoteDraft = Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>;

export interface QuoteTotals {
  subtotal: number;
  vat: number;
  total: number;
}

type Costed = Pick<QuoteItem, 'costLines'> & {
  subItems?: readonly Pick<QuoteSubItem, 'quantity' | 'costLines'>[];
};

export function subItemCost(subItem: Pick<QuoteSubItem, 'quantity' | 'costLines'>): number {
  return linesCost(subItem.costLines) * (subItem.quantity ?? 0);
}

/** Costo de una unidad: sus líneas más las de cada sub-ítem por su cantidad. */
export function itemCost(item: Costed): number {
  return linesCost(item.costLines) + sum((item.subItems ?? []).map(subItemCost));
}

export function itemLineTotal(item: Pick<QuoteItem, 'quantity' | 'unitPrice'>): number {
  return (item.quantity ?? 0) * (item.unitPrice ?? 0);
}

/** Utilidad de una unidad: precio de venta menos costo. */
export function itemUnitProfit(item: Pick<QuoteItem, 'unitPrice'> & Costed): number {
  return (item.unitPrice ?? 0) - itemCost(item);
}

export function quoteTotals(quote: Pick<Quote, 'items' | 'vatRate'>): QuoteTotals {
  const subtotal = sum(quote.items.map(itemLineTotal));
  const vat = subtotal * quote.vatRate;
  return { subtotal, vat, total: subtotal + vat };
}

export function quoteCost(quote: Pick<Quote, 'items'>): number {
  return sum(quote.items.map((item) => itemCost(item) * (item.quantity ?? 0)));
}

export function quoteProfit(quote: Pick<Quote, 'items'>): number {
  return sum(quote.items.map((item) => itemUnitProfit(item) * (item.quantity ?? 0)));
}

export function createEmptyItem(id: string): QuoteItem {
  return {
    id,
    catalogItemId: null,
    kind: null,
    predictive: true,
    product: '',
    description: '',
    photoUrl: null,
    width: null,
    height: null,
    depth: null,
    quantity: 1,
    unitPrice: null,
    costLines: [],
    subItems: [],
    internalNotes: [],
  };
}

export function createEmptySubItem(id: string): QuoteSubItem {
  return {
    id,
    catalogSubItemId: null,
    name: '',
    description: '',
    quantity: 1,
    predictive: true,
    costLines: [],
  };
}

export function createEmptyQuoteDraft(today: string): QuoteDraft {
  return {
    status: 'draft',
    client: '',
    contact: '',
    date: today,
    project: '',
    managerName: '',
    managerRole: '',
    items: [],
    conditions: [...DEFAULT_CONDITIONS],
    paymentTerms: 'A convenir',
    validity: '30 días',
    deliveryTime: 'A convenir',
    vatRate: DEFAULT_VAT_RATE,
    measureUnit: DEFAULT_LENGTH_UNIT,
    conditionsRef: null,
    createdBy: null,
    template: null,
    customFields: [],
    workflow: null,
  };
}

export interface Advisor {
  id: string;
  name: string;
  /** Cargo que firma la cotización. */
  title: string;
}

interface DraftOptions {
  today: string;
  /** Quien crea la cotización: queda como autor y como asesor. */
  advisor: Advisor | null;
  template?: QuoteTemplate | null;
  /** Las condiciones que indica la plantilla, en su versión más reciente. */
  conditions?: ConditionsTemplate | null;
}

/** Borrador con el asesor en sesión y, si hay, la plantilla y sus condiciones. */
export function createQuoteDraft({
  today,
  advisor,
  template,
  conditions,
}: DraftOptions): QuoteDraft {
  const draft: QuoteDraft = {
    ...createEmptyQuoteDraft(today),
    createdBy: advisor?.id ?? null,
    managerName: advisor?.name ?? '',
    managerRole: advisor?.title ?? '',
    ...(conditions ? conditionsFrom(conditions) : {}),
  };
  if (!template) return draft;
  return {
    ...draft,
    template: {
      id: template.id,
      name: template.name,
      measures: { ...template.measures },
      standardSizes: template.standardSizes.map((size) => ({ ...size })),
    },
    measureUnit: template.measureUnit,
    customFields: template.fields.map((field) => ({
      ...field,
      options: [...field.options],
      value: emptyFieldValue(field.type),
    })),
    vatRate: template.vatRate,
  };
}

/** Punto de partida de otra opción del mismo proyecto. */
export function toDuplicateDraft(quote: Quote): QuoteDraft {
  const { id, createdAt, updatedAt, ...draft } = quote;
  return {
    ...draft,
    status: 'draft',
    project: `${quote.project} (copia)`,
    workflow: null,
  };
}

export interface QuoteFilter {
  search?: string;
  status?: QuoteStatus;
  /** Solo las que creó o tiene asignadas este usuario. */
  participantId?: string;
  /** Solo las que este usuario tiene asignadas en un paso abierto. */
  assigneeId?: string;
}

/** Aplica un nuevo estado del flujo. Al terminar el flujo, la cotización queda enviada. */
export function withWorkflowState(quote: Quote, workflow: QuoteWorkflowState): Quote {
  const completes = isOpenTask(quote.workflow) && !isOpenTask(workflow);
  return { ...quote, workflow, status: completes ? 'sent' : quote.status };
}

export function isParticipant(quote: Quote, userId: string): boolean {
  return quote.createdBy === userId || quote.workflow?.assigneeId === userId;
}

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function matchesQuoteFilter(quote: Quote, filter: QuoteFilter): boolean {
  if (filter.status && quote.status !== filter.status) return false;
  if (filter.participantId && !isParticipant(quote, filter.participantId)) return false;
  if (filter.assigneeId) {
    if (!isOpenTask(quote.workflow) || quote.workflow?.assigneeId !== filter.assigneeId) {
      return false;
    }
  }
  const search = normalizeSearch(filter.search?.trim() ?? '');
  if (!search) return true;
  return normalizeSearch(`${quote.client} ${quote.contact} ${quote.project}`).includes(search);
}
