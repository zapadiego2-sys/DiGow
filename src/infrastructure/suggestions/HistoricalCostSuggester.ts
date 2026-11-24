import { recalculateLine, type ItemMeasureContext } from '@/domain/autoQuantities';
import { linkedSubItems } from '@/domain/catalog';
import { applyMaterialCost, linesCost, type CostLine } from '@/domain/cost';
import { materialCost, materialCostPerCm2, type Material } from '@/domain/material';
import type {
  CostSuggester,
  CostSuggestion,
  CostSuggestionRequest,
  CostSuggestionResult,
  ProductCatalog,
  QuoteReader,
  SimilarItem,
  SuggestedSubItem,
} from '@/domain/ports';
import { itemCost, type Quote, type QuoteItem } from '@/domain/quote';
import { dimensionsInCm, type Dimensions } from '@/domain/units';
import { formatNumber } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { catalogSuggestions, itemContext } from './KeywordCostSuggester';
import { meaningfulTokens, textSimilarity } from './text';

const MIN_SIMILARITY = 0.3;
const MAX_SIMILAR = 3;
const TEXT_WEIGHT = 0.75;

/** Promedio de la proporción menor/mayor de cada medida conocida en ambos ítems. */
export function measureSimilarity(a: Dimensions, b: Dimensions): number | null {
  const ratios: number[] = [];
  for (const key of ['width', 'height', 'depth'] as const) {
    const [x, y] = [a[key], b[key]];
    if (x && y && x > 0 && y > 0) ratios.push(Math.min(x, y) / Math.max(x, y));
  }
  return ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : null;
}

function sameDimensions(a: Dimensions, b: Dimensions): boolean {
  const close = (x: number | null, y: number | null) =>
    x === y || (x !== null && y !== null && Math.abs(x - y) < 1e-9);
  return close(a.width, b.width) && close(a.height, b.height) && close(a.depth, b.depth);
}

interface Match {
  quote: Quote;
  item: QuoteItem;
  similarity: number;
}

/**
 * Copia una línea con el precio actual de su material y, si se puede, la recalcula con las
 * medidas del ítem que se está costeando.
 */
function adapt(
  original: CostLine,
  materials: readonly Material[],
  target: ItemMeasureContext | null,
): { line: CostLine; found: boolean; recalculated: boolean } {
  const copy = { ...original, id: createId() } as CostLine;
  if (!original.materialId) {
    const recalculated =
      target && copy.kind === 'formula' ? recalculateLine(copy, undefined, target) : null;
    return { line: recalculated ?? copy, found: true, recalculated: recalculated !== null };
  }
  const material = materials.find((m) => m.id === original.materialId);
  if (!material) return { line: copy, found: false, recalculated: false };
  const cost = copy.kind === 'area' ? materialCostPerCm2(material) : materialCost(material);
  const priced = applyMaterialCost(copy, material.id, cost);
  const recalculated = target ? recalculateLine(priced, material, target) : null;
  return { line: recalculated ?? priced, found: true, recalculated: recalculated !== null };
}

function historySource(match: Match) {
  return {
    kind: 'history',
    quoteId: match.quote.id,
    project: match.quote.project,
    product: match.item.product,
  } as const;
}

function fromHistory(
  match: Match,
  request: CostSuggestionRequest,
  materials: readonly Material[],
): CostSuggestion[] {
  const { quote, item } = match;
  const target = itemContext(request);
  const source = historySource(match);
  const referenceCm = dimensionsInCm(item, quote.measureUnit);
  const differs = !sameDimensions(referenceCm, dimensionsInCm(target, target.measureUnit));
  const measures = [item.width, item.height, item.depth].map(formatNumber).join(' × ');
  return item.costLines.map((original) => {
    const { line, found, recalculated } = adapt(original, materials, target);
    let missing: string | null = null;
    if (!found) missing = 'El material ya no está en el catálogo: revisa el costo.';
    else if (differs && !recalculated && (line.kind === 'area' || line.kind === 'formula')) {
      missing = `El ítem de referencia mide ${measures} ${quote.measureUnit}: ajusta las cantidades.`;
    }
    return { line, missing, source };
  });
}

function hasSubItem(request: CostSuggestionRequest, name: string, catalogId: string | null) {
  return request.existingSubItems.some(
    (sub) =>
      (catalogId !== null && sub.catalogSubItemId === catalogId) ||
      sub.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
}

/** Sub-ítems que tenía el ítem de referencia y que el actual todavía no tiene. */
function subItemsFromHistory(
  match: Match,
  request: CostSuggestionRequest,
  materials: readonly Material[],
): SuggestedSubItem[] {
  return match.item.subItems
    .filter((sub) => sub.predictive && !hasSubItem(request, sub.name, sub.catalogSubItemId))
    .map((sub) => ({
      catalogSubItemId: sub.catalogSubItemId,
      name: sub.name,
      quantity: sub.quantity ?? 1,
      lines: sub.costLines.map((line) => adapt(line, materials, null).line),
      source: historySource(match),
      reason: `En "${match.quote.project}", "${match.item.product}" llevaba este sub-ítem con sus costos.`,
    }));
}

function toSimilar(
  { quote, item, similarity }: Match,
  materials: readonly Material[],
): SimilarItem {
  const current = (lines: readonly CostLine[]) =>
    linesCost(lines.map((line) => adapt(line, materials, null).line));
  return {
    quoteId: quote.id,
    itemId: item.id,
    project: quote.project,
    client: quote.client,
    date: quote.date,
    product: item.product,
    width: item.width,
    height: item.height,
    depth: item.depth,
    unitCost: itemCost(item),
    currentUnitCost:
      current(item.costLines) +
      item.subItems.reduce((total, sub) => total + current(sub.costLines) * (sub.quantity ?? 0), 0),
    unitPrice: item.unitPrice,
    similarity,
  };
}

/**
 * Modelo predictivo sin IA: busca ítems parecidos en cotizaciones anteriores, por descripción y
 * medidas, y propone sus líneas con los precios de hoy, recalculadas con las medidas del ítem.
 * También propone los sub-ítems que el parecido tenía y los que el catálogo liga al producto.
 * Solo usa y sugiere ítems y sub-ítems marcados para el modelo predictivo.
 */
export class HistoricalCostSuggester implements CostSuggester {
  private readonly quotes: QuoteReader;
  private readonly products: ProductCatalog | null;

  constructor(quotes: QuoteReader, products: ProductCatalog | null = null) {
    this.quotes = quotes;
    this.products = products;
  }

  async suggest(
    request: CostSuggestionRequest,
    materials: readonly Material[],
  ): Promise<CostSuggestionResult> {
    const fromCatalog = await this.catalogSubItems(request);
    const catalog = catalogSuggestions(request.description, materials, itemContext(request));
    if (!request.predictive) return { suggestions: catalog, similar: [], subItems: fromCatalog };

    const target = meaningfulTokens(`${request.product} ${request.description}`);
    const targetCm = dimensionsInCm(request, request.measureUnit);
    const matches: Match[] = [];
    for (const quote of await this.quotes.list()) {
      for (const item of quote.items) {
        if (quote.id === request.quoteId && item.id === request.itemId) continue;
        if (!item.predictive) continue;
        if (item.costLines.length === 0 && item.subItems.length === 0) continue;
        const text = textSimilarity(
          target,
          meaningfulTokens(`${item.product} ${item.description}`),
        );
        if (text === 0) continue;
        const measures = measureSimilarity(targetCm, dimensionsInCm(item, quote.measureUnit));
        const similarity =
          measures === null ? text : TEXT_WEIGHT * text + (1 - TEXT_WEIGHT) * measures;
        if (similarity >= MIN_SIMILARITY) matches.push({ quote, item, similarity });
      }
    }
    matches.sort(
      (a, b) => b.similarity - a.similarity || b.quote.updatedAt.localeCompare(a.quote.updatedAt),
    );
    const top = matches.slice(0, MAX_SIMILAR);
    const best = top[0];
    const history = best ? fromHistory(best, request, materials) : [];
    const covered = new Set(history.map((s) => s.line.materialId).filter(Boolean));
    const historySubItems = best ? subItemsFromHistory(best, request, materials) : [];
    const coveredSubs = new Set(historySubItems.map((s) => s.catalogSubItemId).filter(Boolean));
    return {
      suggestions: [...history, ...catalog.filter((s) => !covered.has(s.line.materialId))],
      similar: top.map((match) => toSimilar(match, materials)),
      subItems: [
        ...historySubItems,
        ...fromCatalog.filter((s) => !coveredSubs.has(s.catalogSubItemId)),
      ],
    };
  }

  /** Sub-ítems que el catálogo liga al producto elegido y que el ítem todavía no tiene. */
  private async catalogSubItems(request: CostSuggestionRequest): Promise<SuggestedSubItem[]> {
    if (!this.products || !request.catalogItemId) return [];
    const [items, subItems] = await Promise.all([
      this.products.listItems(),
      this.products.listSubItems(),
    ]);
    const product = items.find((item) => item.id === request.catalogItemId);
    return linkedSubItems(subItems, request.catalogItemId)
      .filter((sub) => !hasSubItem(request, sub.name, sub.id))
      .map((sub) => ({
        catalogSubItemId: sub.id,
        name: sub.name,
        quantity: sub.defaultQuantity,
        lines: [],
        source: { kind: 'catalog' } as const,
        reason: `El catálogo lo liga a "${product?.name ?? 'este producto'}".`,
      }));
  }
}
