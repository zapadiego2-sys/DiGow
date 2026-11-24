import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogSubItem,
  CatalogSubItemDraft,
} from '@/domain/catalog';
import {
  addVersion,
  type ConditionsContent,
  type ConditionsTemplate,
  type NewConditionsTemplate,
} from '@/domain/conditions';
import { RepositoryError, RuleError } from '@/domain/errors';
import {
  allowedVariables,
  analyzeFormula,
  FormulaError,
  type CostFormula,
  type CostFormulaDraft,
} from '@/domain/formula';
import type { ConditionsCatalog, FormulaCatalog, ProductCatalog } from '@/domain/ports';
import { createId } from '@/shared/lib/id';
import { simulate, type MockBehavior } from './behavior';
import { byName, MockCrud } from './crud';
import type { VersionedCollection } from './storage';

function assertValidFormula(formula: CostFormulaDraft) {
  try {
    analyzeFormula(formula.expression, allowedVariables(formula.params));
  } catch (error) {
    if (error instanceof FormulaError) throw new RuleError('invalid-formula', [error.message]);
    throw error;
  }
}

export class MockFormulaCatalog
  extends MockCrud<CostFormula, CostFormulaDraft>
  implements FormulaCatalog
{
  constructor(items: VersionedCollection<CostFormula>, behavior: MockBehavior) {
    super({
      items,
      behavior,
      build: (draft, id) => ({ ...draft, id, version: 1 }),
      compare: byName,
    });
  }

  protected override prepare(formula: CostFormula, all: CostFormula[]): CostFormula[] {
    assertValidFormula(formula);
    return all;
  }

  override update(formula: CostFormula): Promise<CostFormula> {
    const stored = this.items.read().find((f) => f.id === formula.id);
    const changed =
      stored !== undefined &&
      (stored.expression !== formula.expression ||
        JSON.stringify(stored.params) !== JSON.stringify(formula.params));
    const version = (stored?.version ?? formula.version) + (changed ? 1 : 0);
    return super.update({ ...formula, version });
  }
}

export class MockProductCatalog implements ProductCatalog {
  private readonly items: MockCrud<CatalogItem, CatalogItemDraft>;
  private readonly subItems: MockCrud<CatalogSubItem, CatalogSubItemDraft>;

  constructor(
    items: VersionedCollection<CatalogItem>,
    subItems: VersionedCollection<CatalogSubItem>,
    behavior: MockBehavior,
  ) {
    const build = <T>(draft: T, id: string) => ({ ...draft, id });
    this.items = new MockCrud({ items, behavior, build, compare: byName });
    this.subItems = new MockCrud({ items: subItems, behavior, build, compare: byName });
  }

  listItems() {
    return this.items.list();
  }

  createItem(draft: CatalogItemDraft) {
    return this.items.create(draft);
  }

  updateItem(item: CatalogItem) {
    return this.items.update(item);
  }

  listSubItems() {
    return this.subItems.list();
  }

  createSubItem(draft: CatalogSubItemDraft) {
    return this.subItems.create(draft);
  }

  updateSubItem(subItem: CatalogSubItem) {
    return this.subItems.update(subItem);
  }
}

export class MockConditionsCatalog implements ConditionsCatalog {
  private readonly templates: VersionedCollection<ConditionsTemplate>;
  private readonly behavior: MockBehavior;

  constructor(templates: VersionedCollection<ConditionsTemplate>, behavior: MockBehavior) {
    this.templates = templates;
    this.behavior = behavior;
  }

  list(): Promise<ConditionsTemplate[]> {
    return simulate(this.behavior, () => this.templates.read().sort(byName));
  }

  create(input: NewConditionsTemplate, actorId: string): Promise<ConditionsTemplate> {
    return simulate(this.behavior, () => {
      const { name, ...content } = input;
      const template: ConditionsTemplate = {
        id: createId(),
        name,
        active: true,
        versions: [
          { ...content, version: 1, createdAt: new Date().toISOString(), createdBy: actorId },
        ],
      };
      this.templates.write([...this.templates.read(), template]);
      return template;
    });
  }

  publish(id: string, content: ConditionsContent, actorId: string): Promise<ConditionsTemplate> {
    return this.change(id, (template) =>
      addVersion(template, content, new Date().toISOString(), actorId),
    );
  }

  rename(id: string, name: string, active: boolean): Promise<ConditionsTemplate> {
    return this.change(id, (template) => ({ ...template, name, active }));
  }

  private change(
    id: string,
    apply: (template: ConditionsTemplate) => ConditionsTemplate,
  ): Promise<ConditionsTemplate> {
    return simulate(this.behavior, () => {
      const all = this.templates.read();
      const stored = all.find((t) => t.id === id);
      if (!stored) throw new RepositoryError('not-found');
      const updated = apply(stored);
      this.templates.write(all.map((t) => (t.id === id ? updated : t)));
      return updated;
    });
  }
}
