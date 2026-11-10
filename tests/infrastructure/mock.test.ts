import { describe, expect, it } from 'vitest';
import { RepositoryError } from '@/domain/errors';
import { itemCost, itemUnitProfit, quoteTotals } from '@/domain/quote';
import { pickLatency, simulatedBehavior, type MockBehavior } from '@/infrastructure/mock/behavior';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { SEED_IDS, seedQuotes } from '@/infrastructure/seed/seedData';
import {
  createMemoryStore,
  createVersionedCollection,
  type KeyValueStore,
} from '@/infrastructure/mock/storage';
import {
  describeMaterialCatalogContract,
  describeQuoteRepositoryContract,
} from '../contracts/repositories.contract';

const instant: MockBehavior = { forceErrors: false, wait: () => Promise.resolve() };

const stores: [string, () => KeyValueStore][] = [
  ['memoria', createMemoryStore],
  ['localStorage', () => window.localStorage],
];

for (const [name, store] of stores) {
  const services = () => createMockServices(store(), instant);
  describeQuoteRepositoryContract(name, () => {
    const { quoteReader, quoteWriter } = services();
    return Object.assign(quoteReader, quoteWriter);
  });
  describeMaterialCatalogContract(name, () => services().materialCatalog);
}

describe('comportamiento simulado', () => {
  it('la latencia está entre 200 y 500 ms', () => {
    expect(pickLatency(() => 0)).toBe(200);
    expect(pickLatency(() => 0.999999)).toBeLessThanOrEqual(500);
  });

  it('permite forzar errores', async () => {
    const { quoteReader } = createMockServices(createMemoryStore(), {
      ...simulatedBehavior(true),
      wait: () => Promise.resolve(),
    });
    await expect(quoteReader.list()).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('almacenamiento versionado', () => {
  it('usa una clave con versión', async () => {
    const store = createMemoryStore();
    const { quoteWriter } = createMockServices(store, instant);
    await quoteWriter.duplicate(SEED_IDS.cart);
    expect(store.getItem('cotizador:quotes:v2')).toContain('Carrito Demo (copia)');
  });

  it('migra las cotizaciones v1 agregando autor, plantilla, campos y flujo vacíos', async () => {
    const store = createMemoryStore();
    const { createdBy, template, customFields, workflow, ...v1 } = seedQuotes()[0]!;
    void [createdBy, template, customFields, workflow];
    store.setItem('cotizador:quotes:v1', JSON.stringify([v1]));
    const { quoteReader } = createMockServices(store, instant);
    await expect(quoteReader.get(SEED_IDS.cart)).resolves.toMatchObject({
      createdBy: null,
      template: null,
      customFields: [],
      workflow: null,
    });
    expect(store.getItem('cotizador:quotes:v1')).toBeNull();
  });

  it('migra datos de una versión anterior', () => {
    const store = createMemoryStore();
    store.setItem('cotizador:things:v1', JSON.stringify([{ name: 'a' }]));
    const things = createVersionedCollection<{ title: string }>({
      store,
      name: 'things',
      version: 2,
      seed: () => [],
      migrations: {
        1: (data) => (data as { name: string }[]).map(({ name }) => ({ title: name })),
      },
    });
    expect(things.read()).toEqual([{ title: 'a' }]);
    expect(store.getItem('cotizador:things:v1')).toBeNull();
    expect(store.getItem('cotizador:things:v2')).not.toBeNull();
  });

  it('informa datos dañados sin sobrescribirlos', async () => {
    const store = createMemoryStore();
    store.setItem('cotizador:quotes:v2', '{no es json');
    const { quoteReader } = createMockServices(store, instant);
    await expect(quoteReader.list()).rejects.toMatchObject({ code: 'storage-corrupted' });
    expect(store.getItem('cotizador:quotes:v2')).toBe('{no es json');
  });

  it('informa cuando el almacenamiento está lleno', async () => {
    const store = createMemoryStore();
    store.setItem = () => {
      throw new DOMException('lleno', 'QuotaExceededError');
    };
    const { quoteReader, quoteWriter } = createMockServices(store, instant);
    const first = await quoteReader.get(SEED_IDS.cart);
    await expect(quoteWriter.update(first)).rejects.toBeInstanceOf(RepositoryError);
    await expect(quoteWriter.update(first)).rejects.toMatchObject({ code: 'storage-full' });
  });

  it('restablecer vuelve a los datos semilla', async () => {
    const store = createMemoryStore();
    const { quoteReader, quoteWriter, materialCatalog, demoData } = createMockServices(
      store,
      instant,
    );
    await quoteWriter.duplicate(SEED_IDS.cart);
    await materialCatalog.create({
      name: 'Nuevo',
      supplier: '',
      pricing: { mode: 'direct', unitCost: 1 },
    });
    await demoData.reset();
    expect(await quoteReader.list()).toHaveLength(2);
    expect((await materialCatalog.list()).some((m) => m.name === 'Nuevo')).toBe(false);
  });
});

describe('datos semilla', () => {
  it('reproducen los valores de context/dominio.md', async () => {
    const { quoteReader } = createMockServices(createMemoryStore(), instant);
    const quote = await quoteReader.get(SEED_IDS.cart);
    const item = quote.items[0]!;
    expect(quote).toMatchObject({
      client: 'EMPRESA DEMO',
      contact: 'Ana Ejemplo',
      date: '2026-01-15',
      project: 'Carrito Demo',
      managerName: 'Laura Prueba',
      paymentTerms: 'A convenir',
      validity: '30 días',
    });
    expect(item).toMatchObject({ width: 120, height: 190, depth: 70, quantity: 1 });
    expect(item.costLines).toHaveLength(11);
    expect(quote.conditions).toHaveLength(7);
    expect(itemCost(item)).toBeCloseTo(2201733.33, 2);
    expect(item.unitPrice).toBe(2400000);
    expect(itemUnitProfit(item)).toBeCloseTo(198266.67, 2);
    const totals = quoteTotals(quote);
    expect(totals.subtotal).toBe(2400000);
    expect(totals.vat).toBeCloseTo(456000, 6);
    expect(totals.total).toBeCloseTo(2856000, 6);
  });

  it('el catálogo deriva los costos de precio y factor', async () => {
    const { materialCatalog } = createMockServices(createMemoryStore(), instant);
    const materials = await materialCatalog.list();
    expect(materials).toHaveLength(9);
    expect(materials.find((m) => m.name === 'Vinilo')?.pricing).toEqual({
      mode: 'direct',
      unitCost: 6,
    });
  });
});
