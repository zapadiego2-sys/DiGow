import type { Role, User } from '@/domain/access';
import type { CatalogItem, CatalogSubItem } from '@/domain/catalog';
import type { ConditionsTemplate } from '@/domain/conditions';
import type { CostFormula } from '@/domain/formula';
import type { Material } from '@/domain/material';
import type { DemoDataControl } from '@/domain/ports';
import type { Quote } from '@/domain/quote';
import type { QuoteTemplate } from '@/domain/template';
import type { Workflow } from '@/domain/workflow';
import { seedCredentials, seedRoles, seedUsers, type Credential } from '../seed/accessSeed';
import {
  seedCatalogItems,
  seedCatalogSubItems,
  seedConditions,
  seedFormulas,
  seedTemplates,
  seedWorkflows,
} from '../seed/processSeed';
import { seedMaterials, seedQuotes } from '../seed/seedData';
import {
  MockAuthenticator,
  MockRoleCatalog,
  MockUserDirectory,
  type AccessCollections,
} from './accessRepositories';
import { simulate, type MockBehavior } from './behavior';
import {
  MockConditionsCatalog,
  MockFormulaCatalog,
  MockProductCatalog,
} from './catalogRepositories';
import { MockMaterialCatalog } from './materialCatalog';
import {
  MockQuoteWorkflowService,
  MockTemplateCatalog,
  MockWorkflowCatalog,
} from './processRepositories';
import {
  materialMigrations,
  quoteMigrations,
  templateMigrations,
  userMigrations,
  workflowMigrations,
} from './migrations';
import { MockQuoteRepository } from './quoteRepository';
import { createVersionedCollection, type KeyValueStore } from './storage';

const VERSION = 1;

export function createMockServices(store: KeyValueStore, behavior: MockBehavior) {
  const collection = <T>(
    name: string,
    seed: () => T[],
    version = VERSION,
    migrations: Record<number, (data: unknown) => unknown> = {},
  ) => createVersionedCollection<T>({ store, name, version, seed, migrations });

  const quotes = collection<Quote>('quotes', seedQuotes, 3, quoteMigrations);
  const materials = collection<Material>('materials', seedMaterials, 2, materialMigrations);
  const templates = collection<QuoteTemplate>('templates', seedTemplates, 2, templateMigrations);
  const formulas = collection<CostFormula>('formulas', seedFormulas);
  const conditions = collection<ConditionsTemplate>('conditions', seedConditions);
  const catalogItems = collection<CatalogItem>('catalog-items', seedCatalogItems);
  const catalogSubItems = collection<CatalogSubItem>('catalog-subitems', seedCatalogSubItems);
  const access: AccessCollections = {
    users: collection<User>('users', seedUsers, 2, userMigrations),
    roles: collection<Role>('roles', seedRoles),
    credentials: collection<Credential>('credentials', seedCredentials),
    session: collection<{ userId: string }>('session', () => []),
    workflows: collection<Workflow>('workflows', seedWorkflows, 2, workflowMigrations),
  };

  const quoteRepository = new MockQuoteRepository(quotes, behavior);
  // La sesión se conserva: el usuario sigue dentro si existe en los datos de prueba.
  const resettable = [
    quotes,
    materials,
    templates,
    formulas,
    conditions,
    catalogItems,
    catalogSubItems,
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
    formulaCatalog: new MockFormulaCatalog(formulas, behavior),
    productCatalog: new MockProductCatalog(catalogItems, catalogSubItems, behavior),
    conditionsCatalog: new MockConditionsCatalog(conditions, behavior),
    demoData,
  };
}
