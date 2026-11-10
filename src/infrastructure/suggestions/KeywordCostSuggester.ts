import { applyMaterialCost, createCostLine, type CostLine } from '@/domain/cost';
import { materialCost, type Material } from '@/domain/material';
import type {
  CostSuggester,
  CostSuggestion,
  CostSuggestionRequest,
  CostSuggestionResult,
} from '@/domain/ports';
import { createId } from '@/shared/lib/id';
import { MEASURE_TOKEN, normalize, tokens } from './text';

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
};

function detectQuantity(description: string, head: string): number | null {
  const words = Object.keys(NUMBER_WORDS).join('|');
  const pattern = new RegExp(`(?:^|[^\\d.,])(\\d+|\\b(?:${words}))\\s+${head}`);
  const found = normalize(description).match(pattern)?.[1];
  if (!found) return null;
  return NUMBER_WORDS[found] ?? Number(found);
}

/**
 * Coincide si la descripción nombra el material y, cuando el nombre trae una medida como
 * "9 mm", también esa medida: "mdf 12mm" no debe sugerir el MDF de 9 mm.
 */
function matches(material: Material, description: Set<string>): boolean {
  const [head, ...rest] = tokens(material.name);
  if (!head || !description.has(head)) return false;
  return rest.filter((token) => MEASURE_TOKEN.test(token)).every((t) => description.has(t));
}

function buildSuggestion(material: Material, description: string): CostSuggestion {
  const { pricing } = material;
  const usesArea = pricing.mode === 'direct' || pricing.sheetAreaCm2 !== null;
  const empty = createCostLine(createId(), usesArea ? 'area' : 'unit');
  const line: CostLine = {
    ...applyMaterialCost(empty, material.id, materialCost(material)),
    label: material.name,
  };

  const source = { kind: 'catalog' } as const;
  if (line.kind === 'area') return { line, missing: 'Escribe las áreas en cm².', source };

  const head = tokens(material.name)[0] ?? '';
  const quantity = detectQuantity(description, head);
  if (line.kind === 'unit' && quantity !== null) {
    return { line: { ...line, quantity }, missing: null, source };
  }
  // Sin cantidad en el texto queda en 0: el costo no se inventa.
  return { line: { ...line, quantity: 0 } as CostLine, missing: 'Escribe la cantidad.', source };
}

/** Materiales del catálogo que la descripción nombra. */
export function catalogSuggestions(
  description: string,
  materials: readonly Material[],
): CostSuggestion[] {
  const words = new Set(tokens(description));
  return materials
    .filter((material) => matches(material, words))
    .map((material) => buildSuggestion(material, description));
}

/** Sugiere por coincidencia de palabras con el catálogo, sin servicios externos. */
export class KeywordCostSuggester implements CostSuggester {
  suggest(
    request: CostSuggestionRequest,
    materials: readonly Material[],
  ): Promise<CostSuggestionResult> {
    return Promise.resolve({
      suggestions: catalogSuggestions(request.description, materials),
      similar: [],
    });
  }
}
