import { lineCost } from './cost';
import type { Quote, QuoteItem } from './quote';
import { ALL_MEASURES, type ItemMeasures } from './template';
import type { StepGate } from './workflow';

const MEASURE_NAMES: Record<keyof ItemMeasures, string> = {
  width: 'el ancho',
  height: 'el alto',
  depth: 'la profundidad',
};

function itemName(item: QuoteItem, index: number): string {
  return item.product.trim() || `Ítem ${index + 1}`;
}

function measureProblems(quote: Pick<Quote, 'items' | 'template'>): string[] {
  if (quote.items.length === 0) return ['Agrega al menos un ítem.'];
  const required = quote.template?.measures ?? ALL_MEASURES;
  const problems: string[] = [];
  quote.items.forEach((item, index) => {
    const name = itemName(item, index);
    if (!item.product.trim()) problems.push(`${name}: escribe el producto.`);
    if (!item.kind) problems.push(`${name}: clasifica el tipo de producto.`);
    if (!item.quantity) problems.push(`${name}: escribe la cantidad.`);
    for (const key of Object.keys(MEASURE_NAMES) as (keyof ItemMeasures)[]) {
      if (required[key] && !item[key]) problems.push(`${name}: falta ${MEASURE_NAMES[key]}.`);
    }
    item.subItems.forEach((sub) => {
      if (!sub.name.trim()) problems.push(`${name}: un sub-ítem no tiene nombre.`);
      if (!sub.quantity) problems.push(`${name}: escribe la cantidad de "${sub.name}".`);
    });
  });
  return problems;
}

function costProblems(quote: Pick<Quote, 'items'>): string[] {
  const problems: string[] = [];
  quote.items.forEach((item, index) => {
    const name = itemName(item, index);
    const lines = [...item.costLines, ...item.subItems.flatMap((sub) => sub.costLines)];
    if (item.costLines.length === 0 && item.subItems.length === 0) {
      problems.push(`${name}: la hoja de costos está vacía.`);
    }
    item.subItems.forEach((sub) => {
      if (sub.costLines.length === 0) problems.push(`${name}: "${sub.name}" no tiene costos.`);
    });
    if (lines.some((line) => !Number.isFinite(lineCost(line)))) {
      problems.push(`${name}: una fórmula no se puede calcular.`);
    }
    if (item.unitPrice === null) problems.push(`${name}: falta el precio de venta.`);
  });
  return problems;
}

/** Lo que falta para salir del paso. Vacío significa que se puede avanzar. */
export function gateProblems(gate: StepGate, quote: Quote): string[] {
  if (gate === 'measures') return measureProblems(quote);
  if (gate === 'costs') return [...measureProblems(quote), ...costProblems(quote)];
  return [];
}
