import { productKinds, type ProductKind } from '@/domain/catalog';

const KIND_LABELS: Record<ProductKind, string> = {
  internal: 'Producto interno',
  external: 'Producto externo',
  hybrid: 'Producto híbrido',
};

export const PRODUCT_KIND_OPTIONS = productKinds.map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

export function productKindLabel(kind: ProductKind | null): string {
  return kind ? KIND_LABELS[kind] : 'Sin clasificar';
}
