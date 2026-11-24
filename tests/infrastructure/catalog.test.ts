import { describe, expect, it } from 'vitest';
import { latestVersion } from '@/domain/conditions';
import { RuleError } from '@/domain/errors';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { createMemoryStore } from '@/infrastructure/mock/storage';
import { USER_IDS } from '@/infrastructure/seed/accessSeed';
import { seedQuotes, SEED_IDS } from '@/infrastructure/seed/seedData';
import { describeCrudContract } from '../contracts/repositories.contract';
import { instant } from '../features/helpers';

const services = () => createMockServices(createMemoryStore(), instant);
const rule = (code: string) => expect.objectContaining({ name: RuleError.name, code });

describeCrudContract('fórmulas', () => services().formulaCatalog, {
  draft: {
    name: 'Prueba',
    description: '',
    expression: 'area_m2 * costo',
    params: [],
    active: true,
  },
  change: (formula) => ({ ...formula, name: 'Otro nombre' }),
});

describeCrudContract(
  'productos del catálogo',
  () => {
    const { productCatalog } = services();
    return {
      list: () => productCatalog.listItems(),
      create: (draft) => productCatalog.createItem(draft),
      update: (item) => productCatalog.updateItem(item),
    };
  },
  {
    draft: {
      name: 'Producto',
      description: '',
      kind: 'hybrid' as const,
      predictive: true,
      active: true,
    },
    change: (item) => ({ ...item, kind: 'external' as const }),
  },
);

describeCrudContract(
  'sub-ítems del catálogo',
  () => {
    const { productCatalog } = services();
    return {
      list: () => productCatalog.listSubItems(),
      create: (draft) => productCatalog.createSubItem(draft),
      update: (sub) => productCatalog.updateSubItem(sub),
    };
  },
  {
    draft: {
      name: 'Sub-ítem',
      description: '',
      parentItemId: null,
      defaultQuantity: 1,
      predictive: false,
      active: true,
    },
    change: (sub) => ({ ...sub, parentItemId: 'cat-carrito' }),
  },
);

describe('fórmulas administrables', () => {
  it('sube la versión solo si cambian la expresión o los parámetros', async () => {
    const { formulaCatalog } = services();
    const [formula] = (await formulaCatalog.list()).filter((f) => f.id === 'formula-perimetro');
    const renamed = await formulaCatalog.update({ ...formula!, name: 'Perfil' });
    expect(renamed.version).toBe(1);
    const changed = await formulaCatalog.update({
      ...renamed,
      expression: 'perimetro_m * costo * 1.1',
    });
    expect(changed.version).toBe(2);
  });

  it('no guarda una fórmula inválida y explica por qué', async () => {
    const { formulaCatalog } = services();
    await expect(
      formulaCatalog.create({
        name: 'Mala',
        description: '',
        expression: 'area * costo',
        params: [],
        active: true,
      }),
    ).rejects.toMatchObject({
      code: 'invalid-formula',
      details: ['La variable "area" no existe.'],
    });
  });
});

describe('condiciones comerciales con versiones', () => {
  it('publicar crea una versión y la anterior queda igual', async () => {
    const { conditionsCatalog } = services();
    const [standard] = (await conditionsCatalog.list()).filter((c) => c.id === 'cond-estandar');
    const before = latestVersion(standard!);
    const updated = await conditionsCatalog.publish(
      'cond-estandar',
      { ...before, validity: '20 días' },
      USER_IDS.admin,
    );
    expect(updated.versions.map((v) => [v.version, v.validity])).toEqual([
      [1, '30 días'],
      [2, '20 días'],
    ]);
    expect(updated.versions[1]!.createdBy).toBe(USER_IDS.admin);
  });

  it('las cotizaciones conservan la versión que aplicaron', async () => {
    const { conditionsCatalog, quoteReader } = services();
    const [standard] = (await conditionsCatalog.list()).filter((c) => c.id === 'cond-estandar');
    await conditionsCatalog.publish(
      'cond-estandar',
      { ...latestVersion(standard!), conditions: ['Otra condición'] },
      USER_IDS.admin,
    );
    const cart = await quoteReader.get(SEED_IDS.cart);
    expect(cart.conditionsRef?.version).toBe(1);
    expect(cart.conditions).toHaveLength(7);
  });

  it('crea, renombra y desactiva', async () => {
    const { conditionsCatalog } = services();
    const created = await conditionsCatalog.create(
      { name: 'Nuevas', conditions: ['Una'], paymentTerms: '', validity: '', deliveryTime: '' },
      USER_IDS.admin,
    );
    expect(latestVersion(created).version).toBe(1);
    const renamed = await conditionsCatalog.rename(created.id, 'Renombradas', false);
    expect(renamed).toMatchObject({ name: 'Renombradas', active: false });
    await expect(conditionsCatalog.rename('no-existe', 'x', true)).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});

describe('validaciones al mover el flujo', () => {
  it('no aprueba medidas con datos faltantes y dice cuáles', async () => {
    const { quoteReader, quoteWriter, quoteWorkflow } = services();
    const request = await quoteReader.get(SEED_IDS.request);
    await quoteWriter.update({
      ...request,
      items: request.items.map((item) => ({ ...item, kind: null, depth: null })),
    });
    await expect(quoteWorkflow.advance(SEED_IDS.request, USER_IDS.analyst, '')).rejects.toEqual(
      expect.objectContaining({
        code: 'gate-incomplete',
        details: [
          'Carrito de exhibición: clasifica el tipo de producto.',
          'Carrito de exhibición: falta la profundidad.',
        ],
      }),
    );
  });

  it('con medidas completas pasa a aprobar costos con la misma analista', async () => {
    const { quoteWorkflow } = services();
    const moved = await quoteWorkflow.advance(SEED_IDS.request, USER_IDS.analyst, 'Medidas ok');
    expect(moved.workflow).toMatchObject({
      currentStepId: 'step-costeo',
      assigneeId: USER_IDS.analyst,
    });
    await expect(quoteWorkflow.advance(SEED_IDS.request, USER_IDS.analyst, '')).rejects.toEqual(
      rule('gate-incomplete'),
    );
  });
});

describe('migraciones de datos guardados', () => {
  it('cotizaciones v2: agrega unidad, catálogo, tipo, sub-ítems y validación de pasos', async () => {
    const store = createMemoryStore();
    const v2 = seedQuotes().map(({ measureUnit, conditionsRef, ...quote }) => {
      void [measureUnit, conditionsRef];
      return {
        ...quote,
        template: quote.template && {
          id: quote.template.id,
          name: quote.template.name,
          measures: quote.template.measures,
        },
        items: quote.items.map(({ catalogItemId, kind, predictive, subItems, ...item }) => {
          void [catalogItemId, kind, predictive, subItems];
          return item;
        }),
        workflow: quote.workflow && {
          ...quote.workflow,
          steps: quote.workflow.steps.map(({ gate, ...step }) => {
            void gate;
            return step;
          }),
        },
      };
    });
    store.setItem('cotizador:quotes:v2', JSON.stringify(v2));
    const { quoteReader } = createMockServices(store, instant);
    const cart = await quoteReader.get(SEED_IDS.cart);
    expect(cart).toMatchObject({ measureUnit: 'cm', conditionsRef: null });
    expect(cart.template?.standardSizes).toEqual([]);
    expect(cart.items[0]).toMatchObject({
      catalogItemId: null,
      kind: null,
      predictive: true,
      subItems: [],
    });
    expect(cart.workflow?.steps.every((step) => step.gate === 'none')).toBe(true);
    expect(store.getItem('cotizador:quotes:v2')).toBeNull();
  });

  it('materiales, usuarios, plantillas y flujos v1', async () => {
    const store = createMemoryStore();
    store.setItem(
      'cotizador:materials:v1',
      JSON.stringify([
        { id: 'a', name: 'Vinilo', supplier: '', pricing: { mode: 'direct', unitCost: 6 } },
        {
          id: 'b',
          name: 'MDF',
          supplier: '',
          pricing: { mode: 'factor', purchasePrice: 1, factor: 0.5, sheetAreaCm2: null },
        },
      ]),
    );
    store.setItem(
      'cotizador:users:v1',
      JSON.stringify([
        { id: 'u', name: 'U', email: 'u@demo.co', roleId: 'role-superadmin', active: true },
      ]),
    );
    store.setItem(
      'cotizador:templates:v1',
      JSON.stringify([
        {
          id: 't',
          name: 'T',
          description: '',
          active: true,
          workflowId: null,
          fields: [],
          measures: { width: true, height: true, depth: true },
          conditions: ['x'],
          paymentTerms: 'x',
          validity: 'x',
          deliveryTime: 'x',
          vatRate: 0.19,
        },
      ]),
    );
    store.setItem(
      'cotizador:workflows:v1',
      JSON.stringify([
        {
          id: 'w',
          name: 'W',
          description: '',
          active: true,
          isDefault: true,
          steps: [{ id: 's', name: 'S', roleId: 'r', assignment: 'workload', instructions: '' }],
        },
      ]),
    );
    const { materialCatalog, userDirectory, templateCatalog, workflowCatalog } = createMockServices(
      store,
      instant,
    );
    expect((await materialCatalog.list()).map((m) => [m.name, m.unit, m.quantityRule])).toEqual([
      ['MDF', 'unit', 'manual'],
      ['Vinilo', 'cm2', 'manual'],
    ]);
    expect((await userDirectory.list())[0]).toMatchObject({ title: '' });
    expect((await templateCatalog.list())[0]).toMatchObject({
      measureUnit: 'cm',
      standardSizes: [],
      conditionsTemplateId: 'cond-estandar',
    });
    expect((await templateCatalog.list())[0]).not.toHaveProperty('conditions');
    expect((await workflowCatalog.list())[0]!.steps[0]).toMatchObject({ gate: 'none' });
  });
});
