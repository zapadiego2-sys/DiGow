import { createContext, useContext, type ReactNode } from 'react';
import type {
  Authenticator,
  ConditionsCatalog,
  CostSuggester,
  DemoDataControl,
  FormulaCatalog,
  MaterialCatalog,
  MaterialImporter,
  ProductCatalog,
  QuoteImporter,
  QuoteReader,
  QuoteWorkflowService,
  QuoteWriter,
  RoleCatalog,
  TemplateCatalog,
  UserDirectory,
  WorkflowCatalog,
} from '@/domain/ports';

export interface Services {
  quoteReader: QuoteReader;
  quoteWriter: QuoteWriter;
  materialCatalog: MaterialCatalog;
  materialImporter: MaterialImporter;
  quoteImporter: QuoteImporter;
  costSuggester: CostSuggester;
  authenticator: Authenticator;
  userDirectory: UserDirectory;
  roleCatalog: RoleCatalog;
  workflowCatalog: WorkflowCatalog;
  templateCatalog: TemplateCatalog;
  quoteWorkflow: QuoteWorkflowService;
  formulaCatalog: FormulaCatalog;
  productCatalog: ProductCatalog;
  conditionsCatalog: ConditionsCatalog;
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
