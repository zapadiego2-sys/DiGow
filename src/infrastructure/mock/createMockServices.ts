import type { Material } from '@/domain/material';
import type { DemoDataControl } from '@/domain/ports';
import type { Quote } from '@/domain/quote';
import { seedMaterials, seedQuotes } from '../seed/seedData';
import { simulate, type MockBehavior } from './behavior';
import { MockMaterialCatalog } from './materialCatalog';
import { MockQuoteRepository } from './quoteRepository';
import { createVersionedCollection, type KeyValueStore } from './storage';

const SCHEMA_VERSION = 1;

export function createMockServices(store: KeyValueStore, behavior: MockBehavior) {
  const quotes = createVersionedCollection<Quote>({
    store,
    name: 'quotes',
    version: SCHEMA_VERSION,
    seed: seedQuotes,
  });
  const materials = createVersionedCollection<Material>({
    store,
    name: 'materials',
    version: SCHEMA_VERSION,
    seed: seedMaterials,
  });
  const quoteRepository = new MockQuoteRepository(quotes, behavior);
  const demoData: DemoDataControl = {
    reset: () =>
      simulate(behavior, () => {
        quotes.clear();
        materials.clear();
      }),
  };

  return {
    quoteReader: quoteRepository,
    quoteWriter: quoteRepository,
    materialCatalog: new MockMaterialCatalog(materials, behavior),
    demoData,
  };
}
