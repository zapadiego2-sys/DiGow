import { describe, expect, it } from 'vitest';
import { recalculateLine, pendingRecalculations } from '@/domain/autoQuantities';
import {
  addVersion,
  conditionsFrom,
  latestVersion,
  type ConditionsTemplate,
} from '@/domain/conditions';
import { lineCost, type CostLine, type FormulaCostLine } from '@/domain/cost';
import { analyzeFormula, evaluateFormula, FormulaError, allowedVariables } from '@/domain/formula';
import { gateProblems } from '@/domain/gates';
import {
  costUnit,
  deriveMaterialQuantity,
  materialCostPerCm2,
  rulesForUnit,
  type Material,
} from '@/domain/material';
import { createEmptyItem, createEmptySubItem, itemCost, type Quote } from '@/domain/quote';
import { mergeRestrictedEdit, withoutCosts } from '@/domain/quoteAccess';
import { convertLength, deriveMeasures, dimensionsInCm } from '@/domain/units';
import { seedQuotes } from '@/infrastructure/seed/seedData';

describe('motor de fórmulas', () => {
  const values = { ancho: 120, alto: 190, costo: 1000, desperdicio: 0.1 };

  it('respeta la precedencia, los paréntesis y la potencia', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('2 ^ 3 ^ 2', {})).toBe(512);
    expect(evaluateFormula('-2 * -3', {})).toBe(6);
  });

  it('acepta decimales con coma o punto y argumentos separados por punto y coma', () => {
    expect(evaluateFormula('1,5 + 0.5', {})).toBe(2);
    expect(evaluateFormula('max(ancho; alto)', values)).toBe(190);
    expect(evaluateFormula('redondear(10 / 3; 2)', {})).toBe(3.33);
    expect(evaluateFormula('redondear_arriba(2.1)', {})).toBe(3);
    expect(evaluateFormula('si_mayor(ancho; 100; 1; 0)', values)).toBe(1);
  });

  it('usa variables sin distinguir mayúsculas y conserva los decimales', () => {
    expect(evaluateFormula('ANCHO * Alto / 10000 * costo * (1 + desperdicio)', values)).toBeCloseTo(
      2508,
      9,
    );
  });

  it('rechaza lo que no es una fórmula: nunca ejecuta código', () => {
    expect(() => evaluateFormula('alert(1)', {})).toThrow(FormulaError);
    expect(() => evaluateFormula('constructor.constructor("x")()', {})).toThrow(FormulaError);
    expect(() => evaluateFormula('ancho; alto', values)).toThrow(FormulaError);
    expect(() => evaluateFormula('1 +', {})).toThrow(FormulaError);
    expect(() => evaluateFormula('(1 + 2', {})).toThrow('Falta ")".');
    expect(() => evaluateFormula('1 / 0', {})).toThrow('La fórmula divide entre 0.');
    expect(() => evaluateFormula('x * 2', {})).toThrow('Falta el valor de "x".');
  });

  it('el análisis valida variables y funciones antes de guardar', () => {
    const allowed = allowedVariables([{ name: 'desperdicio' }]);
    expect(analyzeFormula('area_m2 * costo * (1 + desperdicio)', allowed).variables).toEqual([
      'area_m2',
      'costo',
      'desperdicio',
    ]);
    expect(() => analyzeFormula('area * costo', allowed)).toThrow('La variable "area" no existe.');
    expect(() => analyzeFormula('raiz(4)', allowed)).toThrow('La función "raiz" no existe.');
    expect(() => analyzeFormula('redondear(1; 2; 3)', allowed)).toThrow(FormulaError);
  });

  it('una línea por fórmula calcula su costo y da NaN si no se puede evaluar', () => {
    const line: FormulaCostLine = {
      id: 'f',
      kind: 'formula',
      label: 'Área con desperdicio',
      note: '',
      materialId: null,
      formula: { id: 'x', name: 'x', expression: 'area_m2 * costo', version: 1 },
      values: { area_m2: 2, costo: 45000 },
    };
    expect(lineCost(line)).toBe(90000);
    expect(lineCost({ ...line, values: {} })).toBeNaN();
    expect(lineCost({ ...line, formula: null })).toBe(0);
  });
});

const material = (overrides: Partial<Material>): Material => ({
  id: 'm',
  name: 'Material',
  supplier: '',
  pricing: { mode: 'direct', unitCost: 45000 },
  unit: 'm2',
  quantityRule: 'area_width_height',
  ...overrides,
});

describe('unidades de medida', () => {
  it('convierte entre mm, cm y m sin perder decimales', () => {
    expect(convertLength(1.8, 'm', 'cm')).toBeCloseTo(180, 9);
    expect(convertLength(25, 'mm', 'cm')).toBeCloseTo(2.5, 9);
    expect(convertLength(null, 'm', 'cm')).toBeNull();
    expect(dimensionsInCm({ width: 1, height: 2, depth: null }, 'm')).toEqual({
      width: 100,
      height: 200,
      depth: null,
    });
  });

  it('deriva área, perímetro y volumen desde las medidas en cm', () => {
    expect(deriveMeasures({ width: 100, height: 200, depth: 50 })).toMatchObject({
      area_m2: 2,
      perimetro_m: 6,
      volumen_m3: 1,
    });
  });

  it('una lámina queda por cm² y un material por m² se convierte a cm² en una línea por área', () => {
    const sheet = material({
      pricing: { mode: 'factor', purchasePrice: 120000, factor: 0.75, sheetAreaCm2: 30000 },
      unit: 'unit',
    });
    expect(costUnit(sheet)).toBe('cm2');
    expect(materialCostPerCm2(material({}))).toBe(4.5);
  });

  it('las reglas de cantidad dependen de la unidad', () => {
    expect(rulesForUnit('unit')).toEqual(['manual']);
    expect(rulesForUnit('linear_m')).toContain('perimeter_width_height');
    expect(rulesForUnit('m2')).toContain('box_surface');
  });

  it('la regla desprende la cantidad de las medidas y nunca inventa una medida faltante', () => {
    const dims = { width: 100, height: 200, depth: 50 };
    expect(deriveMaterialQuantity(material({}), dims)).toEqual({ kind: 'area', areaCm2: 20000 });
    expect(
      deriveMaterialQuantity(
        material({ unit: 'linear_m', quantityRule: 'perimeter_width_height' }),
        dims,
      ),
    ).toEqual({ kind: 'unit', quantity: 6 });
    expect(deriveMaterialQuantity(material({ quantityRule: 'box_surface' }), dims)).toEqual({
      kind: 'area',
      areaCm2: 2 * (100 * 200 + 100 * 50 + 200 * 50),
    });
    expect(
      deriveMaterialQuantity(material({ quantityRule: 'area_width_depth' }), {
        ...dims,
        depth: null,
      }),
    ).toBeNull();
    expect(deriveMaterialQuantity(material({ quantityRule: 'manual' }), dims)).toBeNull();
  });
});

describe('cantidades automáticas', () => {
  const item = { width: 1, height: 1.8, depth: 0.6, quantity: 2, measureUnit: 'm' as const };
  const canvas = material({ id: 'lona' });
  const areaLine: CostLine = {
    id: 'a',
    kind: 'area',
    label: 'Lona',
    note: '',
    materialId: 'lona',
    areasCm2: [],
    costPerCm2: 4.5,
  };

  it('recalcula el área de una línea con la regla de su material', () => {
    expect(recalculateLine(areaLine, canvas, item)).toMatchObject({ areasCm2: [18000] });
    expect(lineCost(recalculateLine(areaLine, canvas, item)!)).toBeCloseTo(81000, 6);
  });

  it('actualiza las variables de una fórmula con las medidas y el costo del material', () => {
    const formula: FormulaCostLine = {
      id: 'f',
      kind: 'formula',
      label: 'Fórmula',
      note: '',
      materialId: 'lona',
      formula: { id: 'x', name: 'x', expression: 'area_m2 * costo * cantidad', version: 1 },
      values: { desperdicio: 0.1 },
    };
    const updated = recalculateLine(formula, canvas, item) as FormulaCostLine;
    expect(updated.values).toMatchObject({ ancho: 100, alto: 180, cantidad: 2, costo: 45000 });
    expect(updated.values.desperdicio).toBe(0.1);
    expect(lineCost(updated)).toBeCloseTo(1.8 * 45000 * 2, 6);
  });

  it('solo propone lo que cambia y deja quieta una línea manual', () => {
    const manual = { ...areaLine, id: 'b', materialId: null };
    const pending = pendingRecalculations([areaLine, manual], [canvas], item);
    expect(pending.map((p) => p.index)).toEqual([0]);
    const applied = pending[0]!.after;
    expect(pendingRecalculations([applied], [canvas], item)).toEqual([]);
  });
});

describe('sub-ítems', () => {
  it('el costo del ítem suma sus líneas y las de cada sub-ítem por su cantidad', () => {
    const fixed = (value: number): CostLine => ({
      id: `l${value}`,
      kind: 'fixed',
      label: 'x',
      note: '',
      materialId: null,
      value,
    });
    const item = {
      ...createEmptyItem('i'),
      costLines: [fixed(100)],
      subItems: [{ ...createEmptySubItem('s'), quantity: 2, costLines: [fixed(30)] }],
    };
    expect(itemCost(item)).toBe(160);
  });
});

describe('validaciones de los pasos', () => {
  const [cart] = seedQuotes() as [Quote];

  it('aprobar medidas exige producto, tipo, cantidad y las medidas de la plantilla', () => {
    expect(gateProblems('measures', cart)).toEqual([]);
    const incomplete: Quote = {
      ...cart,
      items: [{ ...cart.items[0]!, kind: null, depth: null, quantity: null }],
    };
    expect(gateProblems('measures', incomplete)).toEqual([
      'Carrito de ejemplo: clasifica el tipo de producto.',
      'Carrito de ejemplo: escribe la cantidad.',
      'Carrito de ejemplo: falta la profundidad.',
    ]);
    expect(gateProblems('measures', { ...cart, items: [] })).toEqual(['Agrega al menos un ítem.']);
  });

  it('aprobar costos exige además hoja de costos y precio de venta', () => {
    expect(gateProblems('costs', cart)).toEqual([]);
    const noCosts: Quote = {
      ...cart,
      items: [{ ...cart.items[0]!, costLines: [], unitPrice: null }],
    };
    expect(gateProblems('costs', noCosts)).toEqual([
      'Carrito de ejemplo: la hoja de costos está vacía.',
      'Carrito de ejemplo: falta el precio de venta.',
    ]);
    expect(gateProblems('none', noCosts)).toEqual([]);
  });
});

describe('separación de roles', () => {
  const [cart] = seedQuotes() as [Quote];

  it('quien no costea recibe la cotización sin costos ni notas internas, pero con el precio', () => {
    const restricted = withoutCosts(cart);
    expect(restricted.items[0]!.costLines).toEqual([]);
    expect(restricted.items[0]!.internalNotes).toEqual([]);
    expect(restricted.items[0]!.unitPrice).toBe(2400000);
    expect(JSON.stringify(restricted)).not.toContain('costPerCm2');
  });

  it('al guardar lo que editó, se conservan los costos, precios e IVA guardados', () => {
    const restricted = withoutCosts(cart);
    const edited: Quote = {
      ...restricted,
      vatRate: 0,
      client: 'Otro cliente',
      items: [
        { ...restricted.items[0]!, product: 'Renombrado', unitPrice: 1 },
        { ...createEmptyItem('nuevo'), product: 'Nuevo', unitPrice: 999 },
      ],
    };
    const merged = mergeRestrictedEdit(cart, edited);
    expect(merged.client).toBe('Otro cliente');
    expect(merged.vatRate).toBe(cart.vatRate);
    expect(merged.items[0]).toMatchObject({ product: 'Renombrado', unitPrice: 2400000 });
    expect(merged.items[0]!.costLines).toHaveLength(11);
    expect(merged.items[1]).toMatchObject({ product: 'Nuevo', unitPrice: null, costLines: [] });
  });
});

describe('condiciones con versiones', () => {
  const template: ConditionsTemplate = {
    id: 'c',
    name: 'Condiciones',
    active: true,
    versions: [
      {
        version: 1,
        conditions: ['Una'],
        paymentTerms: 'Contado',
        validity: '30 días',
        deliveryTime: '5 días',
        createdAt: '2026-01-01',
        createdBy: null,
      },
    ],
  };

  it('editar agrega una versión y conserva la anterior intacta', () => {
    const updated = addVersion(
      template,
      { ...latestVersion(template), validity: '15 días' },
      '2026-02-01',
      'u',
    );
    expect(updated.versions.map((v) => [v.version, v.validity])).toEqual([
      [1, '30 días'],
      [2, '15 días'],
    ]);
    expect(conditionsFrom(updated).conditionsRef).toEqual({
      templateId: 'c',
      name: 'Condiciones',
      version: 2,
    });
  });

  it('si el contenido no cambia, no crea otra versión', () => {
    expect(addVersion(template, latestVersion(template), '2026-02-01', 'u')).toBe(template);
  });
});
