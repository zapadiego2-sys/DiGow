import type { Services } from '@/features/services/ServicesContext';
import { simulatedBehavior } from '@/infrastructure/mock/behavior';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { KeywordCostSuggester } from '@/infrastructure/suggestions/KeywordCostSuggester';
import { XlsxQuoteImporter } from '@/infrastructure/xlsx/XlsxQuoteImporter';

/** Único punto donde se elige la implementación. Para usar una API, cámbiala aquí. */
export function createServices(): Services {
  const forceErrors = import.meta.env.VITE_MOCK_FORCE_ERRORS === 'true';
  return {
    ...createMockServices(window.localStorage, simulatedBehavior(forceErrors)),
    quoteImporter: new XlsxQuoteImporter(),
    costSuggester: new KeywordCostSuggester(),
  };
}
