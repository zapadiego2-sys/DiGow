import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/routes';
import type { Services } from '@/features/services/ServicesContext';
import type { MockBehavior } from '@/infrastructure/mock/behavior';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { createMemoryStore, type KeyValueStore } from '@/infrastructure/mock/storage';
import { USER_IDS } from '@/infrastructure/seed/accessSeed';
import { KeywordCostSuggester } from '@/infrastructure/suggestions/KeywordCostSuggester';
import { XlsxMaterialImporter } from '@/infrastructure/xlsx/XlsxMaterialImporter';
import { XlsxQuoteImporter } from '@/infrastructure/xlsx/XlsxQuoteImporter';

export const instant: MockBehavior = { forceErrors: false, wait: () => Promise.resolve() };

export { USER_IDS };

/** Deja abierta la sesión de un usuario semilla, como si ya hubiera ingresado. */
export function signedInStore(userId: string | null): KeyValueStore {
  const store = createMemoryStore();
  if (userId) store.setItem('cotizador:session:v1', JSON.stringify([{ userId }]));
  return store;
}

interface TestOptions {
  /** Por defecto, el super admin. null deja la sesión cerrada. */
  userId?: string | null;
}

export function createTestServices(
  overrides: Partial<Services> = {},
  { userId = USER_IDS.admin }: TestOptions = {},
): Services {
  return {
    ...createMockServices(signedInStore(userId), instant),
    quoteImporter: new XlsxQuoteImporter(),
    materialImporter: new XlsxMaterialImporter(),
    costSuggester: new KeywordCostSuggester(),
    ...overrides,
  };
}

export function renderApp(path: string, services: Services = createTestServices()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Providers services={services}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, services };
}

export const SEED_QUOTE_ID = 'quote-carrito-demo';
export const SEED_REQUEST_ID = 'quote-exhibidor-demo';
export const NEW_STANDARD_QUOTE = '/cotizaciones/nueva?plantilla=tpl-estandar';
