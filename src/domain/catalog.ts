/** Interno: se fabrica en la empresa. Externo: se compra o terceriza. Híbrido: combina ambos. */
export const productKinds = ['internal', 'external', 'hybrid'] as const;
export type ProductKind = (typeof productKinds)[number];

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  kind: ProductKind;
  /** Si cuenta para el modelo predictivo: buscar parecidos y recibir sugerencias del historial. */
  predictive: boolean;
  active: boolean;
}

export type CatalogItemDraft = Omit<CatalogItem, 'id'>;

export interface CatalogSubItem {
  id: string;
  name: string;
  description: string;
  /** Ligado: se agrega solo al elegir ese ítem. null: desligado, se puede usar en cualquiera. */
  parentItemId: string | null;
  /** Cantidad por unidad del ítem que se propone al agregarlo. */
  defaultQuantity: number;
  predictive: boolean;
  active: boolean;
}

export type CatalogSubItemDraft = Omit<CatalogSubItem, 'id'>;

export function linkedSubItems(
  subItems: readonly CatalogSubItem[],
  itemId: string,
): CatalogSubItem[] {
  return subItems.filter((sub) => sub.active && sub.parentItemId === itemId);
}

/** Los que se pueden agregar a un ítem: los suyos y los desligados. */
export function availableSubItems(
  subItems: readonly CatalogSubItem[],
  itemId: string | null,
): CatalogSubItem[] {
  return subItems.filter(
    (sub) => sub.active && (sub.parentItemId === null || sub.parentItemId === itemId),
  );
}
