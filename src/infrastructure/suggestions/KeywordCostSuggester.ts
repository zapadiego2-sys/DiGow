import { applyMaterialCost, createCostLine, type CostLine } from '@/domain/cost';
import { materialCost, type Material } from '@/domain/material';
import type { CostSuggester, CostSuggestion } from '@/domain/ports';
import { createId } from '@/shared/lib/id';

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

const MEASURE_TOKEN = /^\d+(?:mm|cm|mt|m)$/;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/(\d)\s+(mm|cm|mt|m)\b/g, '$1$2');
}

/** Singular aproximado: "ruedas" y "pasadores" coinciden con "rueda" y "pasador". */
function stem(token: string): string {
  if (/[^aeiou]es$/.test(token) && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function tokens(text: string): string[] {
  return (normalize(text).match(/[a-z0-9]+/g) ?? []).map(stem);
}

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

  if (line.kind === 'area') return { line, missing: 'Escribe las áreas en cm².' };

  const head = tokens(material.name)[0] ?? '';
  const quantity = detectQuantity(description, head);
  if (line.kind === 'unit' && quantity !== null) {
    return { line: { ...line, quantity }, missing: null };
  }
  // Sin cantidad en el texto queda en 0: el costo no se inventa.
  return { line: { ...line, quantity: 0 } as CostLine, missing: 'Escribe la cantidad.' };
}

/** Sugiere por coincidencia de palabras con el catálogo, sin servicios externos. */
export class KeywordCostSuggester implements CostSuggester {
  suggest(description: string, materials: readonly Material[]): Promise<CostSuggestion[]> {
    const words = new Set(tokens(description));
    return Promise.resolve(
      materials
        .filter((material) => matches(material, words))
        .map((material) => buildSuggestion(material, description)),
    );
  }
}
