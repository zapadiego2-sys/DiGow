import type { Services } from '@/features/services/ServicesContext';
import { simulatedBehavior } from '@/infrastructure/mock/behavior';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { HistoricalCostSuggester } from '@/infrastructure/suggestions/HistoricalCostSuggester';
import { XlsxMaterialImporter } from '@/infrastructure/xlsx/XlsxMaterialImporter';
import { XlsxQuoteImporter } from '@/infrastructure/xlsx/XlsxQuoteImporter';

/** Único punto donde se elige la implementación. Para usar una API, cámbiala aquí. */
export function createServices(): Services {
  const forceErrors = import.meta.env.VITE_MOCK_FORCE_ERRORS === 'true';
  const mocks = createMockServices(window.localStorage, simulatedBehavior(forceErrors));
  return {
    ...mocks,
    quoteImporter: new XlsxQuoteImporter(),
    materialImporter: new XlsxMaterialImporter(),
    costSuggester: new HistoricalCostSuggester(mocks.quoteReader),
  };
}
