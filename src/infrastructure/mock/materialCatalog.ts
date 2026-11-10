import { materialNameKey, type Material, type MaterialDraft } from '@/domain/material';
import type { MaterialCatalog, MaterialImportSummary } from '@/domain/ports';
import { createId } from '@/shared/lib/id';
import { simulate, type MockBehavior } from './behavior';
import { byName, MockCrud } from './crud';
import type { VersionedCollection } from './storage';

export class MockMaterialCatalog
  extends MockCrud<Material, MaterialDraft>
  implements MaterialCatalog
{
  constructor(items: VersionedCollection<Material>, behavior: MockBehavior) {
    super({ items, behavior, build: (draft, id) => ({ ...draft, id }), compare: byName });
  }

  importMany(drafts: readonly MaterialDraft[]): Promise<MaterialImportSummary> {
    return simulate(this.behavior, () => {
      const all = this.items.read();
      const byKey = new Map(all.map((material) => [materialNameKey(material.name), material]));
      let created = 0;
      let updated = 0;
      for (const draft of drafts) {
        const existing = byKey.get(materialNameKey(draft.name));
        if (existing) {
          byKey.set(materialNameKey(draft.name), { ...existing, ...draft, id: existing.id });
          updated++;
        } else {
          byKey.set(materialNameKey(draft.name), { ...draft, id: createId() });
          created++;
        }
      }
      this.items.write([...byKey.values()]);
      return { created, updated };
    });
  }
}
