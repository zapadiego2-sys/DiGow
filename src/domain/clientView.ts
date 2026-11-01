import { itemLineTotal, quoteTotals, type Quote } from './quote';

export interface ClientQuoteItem {
  id: string;
  product: string;
  description: string;
  photoUrl: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number;
}

/** Lo único que recibe la vista para el cliente. No contiene costos, factores, utilidad ni notas. */
export interface ClientQuoteView {
  client: string;
  contact: string;
  date: string;
  project: string;
  managerName: string;
  managerRole: string;
  items: ClientQuoteItem[];
  subtotal: number;
  vatRate: number;
  vat: number;
  total: number;
  conditions: string[];
  paymentTerms: string;
  validity: string;
  deliveryTime: string;
}

/** Copia campo por campo: un campo interno nuevo no puede filtrarse por omisión. */
export function toClientQuoteView(quote: Quote): ClientQuoteView {
  const { subtotal, vat, total } = quoteTotals(quote);
  return {
    client: quote.client,
    contact: quote.contact,
    date: quote.date,
    project: quote.project,
    managerName: quote.managerName,
    managerRole: quote.managerRole,
    items: quote.items.map((item) => ({
      id: item.id,
      product: item.product,
      description: item.description,
      photoUrl: item.photoUrl,
      width: item.width,
      height: item.height,
      depth: item.depth,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: itemLineTotal(item),
    })),
    subtotal,
    vatRate: quote.vatRate,
    vat,
    total,
    conditions: [...quote.conditions],
    paymentTerms: quote.paymentTerms,
    validity: quote.validity,
    deliveryTime: quote.deliveryTime,
  };
}
