import { applyMaterialCost, linesCost, type CostLine } from '@/domain/cost';
import { materialCost, type Material } from '@/domain/material';
import type {
  CostSuggester,
  CostSuggestion,
  CostSuggestionRequest,
  CostSuggestionResult,
  QuoteReader,
  SimilarItem,
} from '@/domain/ports';
import { itemCost, type Quote, type QuoteItem } from '@/domain/quote';
import { formatNumber } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { catalogSuggestions } from './KeywordCostSuggester';
import { meaningfulTokens, textSimilarity } from './text';

const MIN_SIMILARITY = 0.3;
const MAX_SIMILAR = 3;
const TEXT_WEIGHT = 0.75;

type Measured = Pick<QuoteItem, 'width' | 'height' | 'depth'>;

/** Promedio de la proporción menor/mayor de cada medida conocida en ambos ítems. */
export function measureSimilarity(a: Measured, b: Measured): number | null {
  const ratios: number[] = [];
  for (const key of ['width', 'height', 'depth'] as const) {
    const [x, y] = [a[key], b[key]];
    if (x && y && x > 0 && y > 0) ratios.push(Math.min(x, y) / Math.max(x, y));
  }
  return ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : null;
}

function sameMeasures(a: Measured, b: Measured): boolean {
  return a.width === b.width && a.height === b.height && a.depth === b.depth;
}

interface Match {
  quote: Quote;
  item: QuoteItem;
  similarity: number;
}

/** Copia una línea con el precio actual de su material. */
function refresh(
  line: CostLine,
  materials: readonly Material[],
): { line: CostLine; found: boolean } {
  const copy = { ...line, id: createId() } as CostLine;
  if (!line.materialId) return { line: copy, found: true };
  const material = materials.find((m) => m.id === line.materialId);
  if (!material) return { line: copy, found: false };
  return { line: applyMaterialCost(copy, material.id, materialCost(material)), found: true };
}

function fromHistory(
  match: Match,
  request: CostSuggestionRequest,
  materials: readonly Material[],
): CostSuggestion[] {
  const { quote, item } = match;
  const source = {
    kind: 'history',
    quoteId: quote.id,
    project: quote.project,
    product: item.product,
  } as const;
  const measures = [item.width, item.height, item.depth].map(formatNumber).join(' × ');
  return item.costLines.map((original) => {
    const { line, found } = refresh(original, materials);
    let missing: string | null = null;
    if (!found) missing = 'El material ya no está en el catálogo: revisa el costo.';
    else if (line.kind === 'area' && !sameMeasures(item, request)) {
      missing = `El ítem de referencia mide ${measures}: ajusta las áreas.`;
    }
    return { line, missing, source };
  });
}

function toSimilar(
  { quote, item, similarity }: Match,
  materials: readonly Material[],
): SimilarItem {
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
    currentUnitCost: linesCost(item.costLines.map((line) => refresh(line, materials).line)),
    unitPrice: item.unitPrice,
    similarity,
  };
}

/**
 * Busca ítems parecidos en cotizaciones anteriores, por descripción y medidas, y propone sus
 * líneas de costo con los precios actuales. Completa con los materiales que la descripción nombra.
 */
export class HistoricalCostSuggester implements CostSuggester {
  private readonly quotes: QuoteReader;

  constructor(quotes: QuoteReader) {
    this.quotes = quotes;
  }

  async suggest(
    request: CostSuggestionRequest,
    materials: readonly Material[],
  ): Promise<CostSuggestionResult> {
    const target = meaningfulTokens(`${request.product} ${request.description}`);
    const matches: Match[] = [];
    for (const quote of await this.quotes.list()) {
      for (const item of quote.items) {
        if (quote.id === request.quoteId && item.id === request.itemId) continue;
        if (item.costLines.length === 0) continue;
        const text = textSimilarity(
          target,
          meaningfulTokens(`${item.product} ${item.description}`),
        );
        if (text === 0) continue;
        const measures = measureSimilarity(request, item);
        const similarity =
          measures === null ? text : TEXT_WEIGHT * text + (1 - TEXT_WEIGHT) * measures;
        if (similarity >= MIN_SIMILARITY) matches.push({ quote, item, similarity });
      }
    }
    matches.sort(
      (a, b) => b.similarity - a.similarity || b.quote.updatedAt.localeCompare(a.quote.updatedAt),
    );
    const top = matches.slice(0, MAX_SIMILAR);
    const history = top[0] ? fromHistory(top[0], request, materials) : [];
    const covered = new Set(history.map((s) => s.line.materialId).filter(Boolean));
    const catalog = catalogSuggestions(request.description, materials).filter(
      (s) => !covered.has(s.line.materialId),
    );
    return {
      suggestions: [...history, ...catalog],
      similar: top.map((match) => toSimilar(match, materials)),
    };
  }
}
