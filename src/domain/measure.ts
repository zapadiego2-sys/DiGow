const NUMBER = /^\d+(?:[.,]\d+)?$/;

function parseProduct(term: string): number | null {
  const factors = term.split(/[x×*]/i).map((factor) => factor.trim());
  let product = 1;
  for (const factor of factors) {
    if (!NUMBER.test(factor)) return null;
    product *= Number(factor.replace(',', '.'));
  }
  return product;
}

/**
 * Convierte una suma de medidas como "90+110" o "100×90 + 2×90×90" en sus términos.
 * Devuelve null si el texto no se puede sumar: nunca adivina un valor.
 */
export function parseMeasureTerms(text: string): number[] | null {
  if (!text.trim()) return null;
  const terms: number[] = [];
  for (const term of text.split('+')) {
    const value = parseProduct(term);
    if (value === null) return null;
    terms.push(value);
  }
  return terms;
}
