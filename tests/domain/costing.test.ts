// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toClientQuoteView } from '@/domain/clientView';
import {
  applyMaterialCost,
  changeLineKind,
  costLineKinds,
  costLineStrategies,
  lineCost,
  type CostLine,
} from '@/domain/cost';
import { materialCost } from '@/domain/material';
import { parseMeasureTerms } from '@/domain/measure';
import {
  createEmptyItem,
  createEmptyQuoteDraft,
  itemCost,
  itemUnitProfit,
  matchesQuoteFilter,
  quoteCost,
  quoteProfit,
  quoteTotals,
  toDuplicateDraft,
  type Quote,
} from '@/domain/quote';

const base = (label: string) => ({ id: label, label, note: '', materialId: null });
const factor = (purchasePrice: number, f: number, sheetAreaCm2: number | null = null) => ({
  pricing: { mode: 'factor' as const, purchasePrice, factor: f, sheetAreaCm2 },
});
const direct = (unitCost: number) => ({ pricing: { mode: 'direct' as const, unitCost } });

// Tabla de context/dominio.md: [línea, resultado esperado]
const REFERENCE: [CostLine, number][] = [
  [
    {
      ...base('MDF 9 mm'),
      kind: 'unit',
      quantity: 2,
      unitCost: materialCost(factor(90000, 0.5)),
    },
    360000,
  ],
  [
    {
      ...base('Poliestireno cal 100'),
      kind: 'area',
      areasCm2: parseMeasureTerms('120×80 + 2×80×70')!,
      costPerCm2: materialCost(factor(120000, 0.75, 100 * 300)),
    },
    110933.33,
  ],
  [
    {
      ...base('MDF 12 mm'),
      kind: 'unit',
      quantity: 1,
      unitCost: materialCost(factor(120000, 0.5)),
    },
    240000,
  ],
  [
    { ...base('Tubo'), kind: 'unit', quantity: 1.5, unitCost: materialCost(factor(60000, 0.75)) },
    120000,
  ],
  [
    {
      ...base('Lona roja'),
      kind: 'area',
      areasCm2: [180 * 140],
      costPerCm2: materialCost(direct(4)),
    },
    100800,
  ],
  [
    { ...base('Vinilo'), kind: 'area', areasCm2: [30000], costPerCm2: materialCost(direct(6)) },
    180000,
  ],
  [{ ...base('Mano de obra'), kind: 'labor', days: 2, people: 2, dailyRate: 200000 }, 800000],
  [
    { ...base('Ruedas'), kind: 'unit', quantity: 4, unitCost: materialCost(factor(15000, 0.75)) },
    80000,
  ],
  [
    { ...base('Bisagra'), kind: 'unit', quantity: 6, unitCost: materialCost(factor(3000, 0.75)) },
    24000,
  ],
  [
    { ...base('Pasadores'), kind: 'unit', quantity: 6, unitCost: materialCost(factor(4500, 0.75)) },
    36000,
  ],
  [{ ...base('Otros'), kind: 'fixed', value: 150000 }, 150000],
];

const item = {
  ...createEmptyItem('i'),
  quantity: 1,
  unitPrice: 2400000,
  costLines: REFERENCE.map(([line]) => line),
};
const quote = { ...createEmptyQuoteDraft('2026-01-15'), items: [item] };

describe('líneas de costo de referencia', () => {
  it.each(REFERENCE.map(([line, value]) => [line.label, line, value] as const))(
    '%s',
    (_label, line, value) => {
      expect(lineCost(line)).toBeCloseTo(value, 2);
    },
  );
});

describe('resultados de referencia', () => {
  it('costo total', () => expect(itemCost(item)).toBeCloseTo(2201733.33, 2));
  it('utilidad', () => expect(itemUnitProfit(item)).toBeCloseTo(198266.67, 2));
  it('subtotal', () => expect(quoteTotals(quote).subtotal).toBe(2400000));
  it('IVA', () => expect(quoteTotals(quote).vat).toBeCloseTo(456000, 6));
  it('total', () => expect(quoteTotals(quote).total).toBeCloseTo(2856000, 6));
  it('conserva los decimales al calcular', () => {
    expect(itemCost(item)).toBeCloseTo(2201733 + 1 / 3, 6);
  });
});

describe('reglas de costos', () => {
  it('rechaza un factor que no sea mayor que 0', () => {
    expect(() => materialCost(factor(100, 0))).toThrow(RangeError);
    expect(() => materialCost(factor(100, -1))).toThrow(RangeError);
  });

  it('acepta un factor mayor que 1', () => {
    expect(materialCost(factor(100, 1.25))).toBe(80);
  });

  it('todo tipo de línea tiene una estrategia', () => {
    expect(costLineKinds.sort()).toEqual(['area', 'fixed', 'labor', 'unit']);
    for (const kind of costLineKinds)
      expect(costLineStrategies[kind].calculate).toBeTypeOf('function');
  });

  it('cambiar de tipo conserva el costo cuando es posible', () => {
    const fixed: CostLine = { ...base('x'), kind: 'fixed', value: 500 };
    expect(lineCost(changeLineKind(fixed, 'unit'))).toBe(500);
    expect(lineCost(changeLineKind(fixed, 'labor'))).toBe(500);
    expect(changeLineKind(fixed, 'area')).toMatchObject({ areasCm2: [], label: 'x' });
  });

  it('aplicar un material actualiza el costo de la línea según su tipo', () => {
    const unit: CostLine = { ...base('x'), kind: 'unit', quantity: 2, unitCost: 0 };
    const updated = applyMaterialCost(unit, 'm1', 10);
    expect(updated).toMatchObject({ materialId: 'm1', unitCost: 10 });
    expect(lineCost(updated)).toBe(20);
  });

  it('la hoja de costos es por unidad: la cantidad escala costo y utilidad', () => {
    const three = { items: [{ ...item, quantity: 3 }] };
    expect(quoteCost(three)).toBeCloseTo(2201733.33 * 3, 1);
    expect(quoteProfit(three)).toBeCloseTo(198266.67 * 3, 1);
  });

  it('un valor faltante no se inventa y no suma', () => {
    const missing = { ...item, quantity: null, unitPrice: null };
    expect(quoteTotals({ items: [missing], vatRate: 0.19 }).total).toBe(0);
    expect(toClientQuoteView(stored({ items: [missing] })).items[0]?.unitPrice).toBeNull();
  });
});

describe('medidas', () => {
  it.each([
    ['90+110', [90, 110]],
    [' 90 + 110 ', [90, 110]],
    ['32400', [32400]],
    ['100*90+2x90×90', [9000, 16200]],
    ['1,5+2.5', [1.5, 2.5]],
  ])('suma %s', (text, terms) => expect(parseMeasureTerms(text)).toEqual(terms));

  it.each(['', '  ', 'abc', '90+', '+90', '90-10', '90+aprox', '1,2,3'])('no adivina %j', (text) =>
    expect(parseMeasureTerms(text)).toBeNull(),
  );
});

function stored(overrides: Partial<Quote> = {}): Quote {
  return {
    ...createEmptyQuoteDraft('2026-01-15'),
    id: 'q1',
    client: 'EMPRESA DEMO',
    contact: 'Ana Núñez',
    project: 'Carrito Demo',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('filtro y duplicado', () => {
  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(matchesQuoteFilter(stored(), { search: 'nunez' })).toBe(true);
    expect(matchesQuoteFilter(stored(), { search: 'CARRITO' })).toBe(true);
    expect(matchesQuoteFilter(stored(), { search: 'otro' })).toBe(false);
  });

  it('filtra por estado', () => {
    expect(matchesQuoteFilter(stored(), { status: 'draft' })).toBe(true);
    expect(matchesQuoteFilter(stored(), { status: 'sent' })).toBe(false);
  });

  it('duplicar crea un borrador sin identidad', () => {
    const draft = toDuplicateDraft(stored({ status: 'approved' }));
    expect(draft.status).toBe('draft');
    expect(draft.project).toBe('Carrito Demo (copia)');
    expect(draft).not.toHaveProperty('id');
  });
});

describe('ClientQuoteView', () => {
  const view = toClientQuoteView(
    stored({
      items: [{ ...item, internalNotes: ['SECRETO'], costLines: REFERENCE.map(([line]) => line) }],
    }),
  );
  const serialized = JSON.stringify(view);

  it('no contiene campos internos', () => {
    for (const key of [
      'costLines',
      'internalNotes',
      'cost',
      'profit',
      'factor',
      'note',
      'materialId',
    ]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain('SECRETO');
    expect(serialized).not.toContain('Mano de obra');
  });

  it('expone solo las claves permitidas por ítem', () => {
    expect(Object.keys(view.items[0]!).sort()).toEqual(
      [
        'depth',
        'description',
        'height',
        'id',
        'lineTotal',
        'photoUrl',
        'product',
        'quantity',
        'unitPrice',
        'width',
      ].sort(),
    );
  });

  it('conserva los totales', () => {
    expect(view.subtotal).toBe(2400000);
    expect(view.total).toBeCloseTo(2856000, 6);
  });
});
