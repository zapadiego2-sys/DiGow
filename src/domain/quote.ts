import { linesCost, sum, type CostLine } from './cost';

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

export interface QuoteItem {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export type QuoteDraft = Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>;

export interface QuoteTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export function itemCost(item: Pick<QuoteItem, 'costLines'>): number {
  return linesCost(item.costLines);
}

export function itemLineTotal(item: Pick<QuoteItem, 'quantity' | 'unitPrice'>): number {
  return (item.quantity ?? 0) * (item.unitPrice ?? 0);
}

/** Utilidad de una unidad: precio de venta menos costo. */
export function itemUnitProfit(item: Pick<QuoteItem, 'unitPrice' | 'costLines'>): number {
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
    product: '',
    description: '',
    photoUrl: null,
    width: null,
    height: null,
    depth: null,
    quantity: 1,
    unitPrice: null,
    costLines: [],
    internalNotes: [],
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
  };
}

/** Punto de partida de otra opción del mismo proyecto. */
export function toDuplicateDraft(quote: Quote): QuoteDraft {
  const { id, createdAt, updatedAt, ...draft } = quote;
  return { ...draft, status: 'draft', project: `${quote.project} (copia)` };
}

export interface QuoteFilter {
  search?: string;
  status?: QuoteStatus;
}

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function matchesQuoteFilter(quote: Quote, filter: QuoteFilter): boolean {
  if (filter.status && quote.status !== filter.status) return false;
  const search = normalizeSearch(filter.search?.trim() ?? '');
  if (!search) return true;
  return normalizeSearch(`${quote.client} ${quote.contact} ${quote.project}`).includes(search);
}
