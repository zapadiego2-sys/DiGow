export const MEASURE_TOKEN = /^\d+(?:mm|cm|mt|m)$/;

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/(\d)\s+(mm|cm|mt|m)\b/g, '$1$2');
}

/** Singular aproximado: "ruedas" y "pasadores" coinciden con "rueda" y "pasador". */
export function stem(token: string): string {
  if (/[^aeiou]es$/.test(token) && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

export function tokens(text: string): string[] {
  return (normalize(text).match(/[a-z0-9]+/g) ?? []).map(stem);
}

const STOPWORDS = new Set([
  'con',
  'sin',
  'para',
  'por',
  'los',
  'las',
  'del',
  'una',
  'uno',
  'que',
  'muy',
  'mas',
  'aprox',
  'medida',
  'alto',
  'ancho',
  'profund',
  'profundidad',
  'tipo',
  'cal',
  'red',
]);

/** Palabras que describen el producto, sin conectores ni números sueltos. */
export function meaningfulTokens(text: string): Set<string> {
  return new Set(
    tokens(text).filter(
      (token) =>
        MEASURE_TOKEN.test(token) ||
        (token.length >= 3 && !/^\d+$/.test(token) && !STOPWORDS.has(token)),
    ),
  );
}

/** Coeficiente de Dice: el doble de las palabras en común sobre el total de ambos textos. */
export function textSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return (2 * shared) / (a.size + b.size);
}
