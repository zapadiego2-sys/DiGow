import { applyMaterialCost, createCostLine, type CostLine } from '@/domain/cost';
import { recalculateLine, type ItemMeasureContext } from '@/domain/autoQuantities';
import {
  costUnit,
  isAreaUnit,
  materialCost,
  materialCostPerCm2,
  type Material,
} from '@/domain/material';
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

/** Línea vacía del tipo que corresponde a la unidad del material, con su costo. */
export function lineForMaterial(material: Material): CostLine {
  const area = isAreaUnit(costUnit(material));
  const empty = createCostLine(createId(), area ? 'area' : 'unit');
  const cost = area ? materialCostPerCm2(material) : materialCost(material);
  return { ...applyMaterialCost(empty, material.id, cost), label: material.name };
}

function buildSuggestion(
  material: Material,
  description: string,
  item: ItemMeasureContext | null,
): CostSuggestion {
  const source = { kind: 'catalog' } as const;
  const line = lineForMaterial(material);

  // Si la regla del material desprende la cantidad de las medidas, no hace falta escribirla.
  const derived = item ? recalculateLine(line, material, item) : null;
  if (derived) return { line: derived, missing: null, source };

  if (line.kind === 'area') return { line, missing: 'Escribe las áreas en cm².', source };
  const head = tokens(material.name)[0] ?? '';
  const quantity = costUnit(material) === 'unit' ? detectQuantity(description, head) : null;
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
  item: ItemMeasureContext | null = null,
): CostSuggestion[] {
  const words = new Set(tokens(description));
  return materials
    .filter((material) => matches(material, words))
    .map((material) => buildSuggestion(material, description, item));
}

export function itemContext(request: CostSuggestionRequest): ItemMeasureContext {
  return {
    width: request.width,
    height: request.height,
    depth: request.depth,
    quantity: null,
    measureUnit: request.measureUnit,
  };
}

/** Sugiere por coincidencia de palabras con el catálogo, sin servicios externos. */
export class KeywordCostSuggester implements CostSuggester {
  suggest(
    request: CostSuggestionRequest,
    materials: readonly Material[],
  ): Promise<CostSuggestionResult> {
    return Promise.resolve({
      suggestions: catalogSuggestions(request.description, materials, itemContext(request)),
      similar: [],
      subItems: [],
    });
  }
}
