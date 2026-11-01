export type MaterialPricing =
  | {
      mode: 'factor';
      purchasePrice: number;
      /** Decimal mayor que 0, sin significado de negocio atribuido. */
      factor: number;
      /** Solo para láminas: el costo queda expresado por cm². */
      sheetAreaCm2: number | null;
    }
  | { mode: 'direct'; unitCost: number };

export interface Material {
  id: string;
  name: string;
  supplier: string;
  pricing: MaterialPricing;
}

export type MaterialDraft = Omit<Material, 'id'>;

export function materialCost(material: Pick<Material, 'pricing'>): number {
  const { pricing } = material;
  if (pricing.mode === 'direct') return pricing.unitCost;
  if (pricing.factor <= 0) throw new RangeError('El factor debe ser mayor que 0.');
  const unitCost = pricing.purchasePrice / pricing.factor;
  return pricing.sheetAreaCm2 ? unitCost / pricing.sheetAreaCm2 : unitCost;
}
