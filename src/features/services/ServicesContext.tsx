import { createContext, useContext, type ReactNode } from 'react';
import type {
  CostSuggester,
  DemoDataControl,
  MaterialCatalog,
  QuoteImporter,
  QuoteReader,
  QuoteWriter,
} from '@/domain/ports';

export interface Services {
  quoteReader: QuoteReader;
  quoteWriter: QuoteWriter;
  materialCatalog: MaterialCatalog;
  quoteImporter: QuoteImporter;
  costSuggester: CostSuggester;
  demoData: DemoDataControl;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices requiere ServicesProvider.');
  return services;
}
