import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/routes';
import type { Services } from '@/features/services/ServicesContext';
import type { MockBehavior } from '@/infrastructure/mock/behavior';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { createMemoryStore } from '@/infrastructure/mock/storage';
import { KeywordCostSuggester } from '@/infrastructure/suggestions/KeywordCostSuggester';
import { XlsxQuoteImporter } from '@/infrastructure/xlsx/XlsxQuoteImporter';

const instant: MockBehavior = { forceErrors: false, wait: () => Promise.resolve() };

export function createTestServices(overrides: Partial<Services> = {}): Services {
  return {
    ...createMockServices(createMemoryStore(), instant),
    quoteImporter: new XlsxQuoteImporter(),
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
