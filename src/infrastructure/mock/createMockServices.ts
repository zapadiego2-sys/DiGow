import type { Role, User } from '@/domain/access';
import type { Material } from '@/domain/material';
import type { DemoDataControl } from '@/domain/ports';
import type { Quote } from '@/domain/quote';
import type { QuoteTemplate } from '@/domain/template';
import type { Workflow } from '@/domain/workflow';
import { seedCredentials, seedRoles, seedUsers, type Credential } from '../seed/accessSeed';
import { seedTemplates, seedWorkflows } from '../seed/processSeed';
import { seedMaterials, seedQuotes } from '../seed/seedData';
import {
  MockAuthenticator,
  MockRoleCatalog,
  MockUserDirectory,
  type AccessCollections,
} from './accessRepositories';
import { simulate, type MockBehavior } from './behavior';
import { MockMaterialCatalog } from './materialCatalog';
import {
  MockQuoteWorkflowService,
  MockTemplateCatalog,
  MockWorkflowCatalog,
} from './processRepositories';
import { MockQuoteRepository } from './quoteRepository';
import { createVersionedCollection, type KeyValueStore } from './storage';

/** v2 agrega a la cotización su autor, plantilla, campos propios y flujo. */
const QUOTES_VERSION = 2;
const VERSION = 1;

const migrateQuotesV1 = (data: unknown) =>
  (data as Omit<Quote, 'createdBy' | 'template' | 'customFields' | 'workflow'>[]).map(
    (quote): Quote => ({
      ...quote,
      createdBy: null,
      template: null,
      customFields: [],
      workflow: null,
    }),
  );

export function createMockServices(store: KeyValueStore, behavior: MockBehavior) {
  const collection = <T>(name: string, seed: () => T[], version = VERSION) =>
    createVersionedCollection<T>({ store, name, version, seed });

  const quotes = createVersionedCollection<Quote>({
    store,
    name: 'quotes',
    version: QUOTES_VERSION,
    seed: seedQuotes,
    migrations: { 1: migrateQuotesV1 },
  });
  const materials = collection<Material>('materials', seedMaterials);
  const templates = collection<QuoteTemplate>('templates', seedTemplates);
  const access: AccessCollections = {
    users: collection<User>('users', seedUsers),
    roles: collection<Role>('roles', seedRoles),
    credentials: collection<Credential>('credentials', seedCredentials),
    session: collection<{ userId: string }>('session', () => []),
    workflows: collection<Workflow>('workflows', seedWorkflows),
  };

  const quoteRepository = new MockQuoteRepository(quotes, behavior);
  // La sesión se conserva: el usuario sigue dentro si existe en los datos de prueba.
  const resettable = [
    quotes,
    materials,
    templates,
    access.users,
    access.roles,
    access.credentials,
    access.workflows,
  ];
  const demoData: DemoDataControl = {
    reset: () => simulate(behavior, () => resettable.forEach((item) => item.clear())),
  };

  return {
    quoteReader: quoteRepository,
    quoteWriter: quoteRepository,
    materialCatalog: new MockMaterialCatalog(materials, behavior),
    authenticator: new MockAuthenticator(access, behavior),
    userDirectory: new MockUserDirectory(access, behavior),
    roleCatalog: new MockRoleCatalog(access, behavior),
    workflowCatalog: new MockWorkflowCatalog(access.workflows, behavior),
    templateCatalog: new MockTemplateCatalog(templates, behavior),
    quoteWorkflow: new MockQuoteWorkflowService(quotes, access, behavior),
    demoData,
  };
}
