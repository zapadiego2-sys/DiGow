import { RepositoryError } from '@/domain/errors';
import type { Material, MaterialDraft } from '@/domain/material';
import type { MaterialCatalog } from '@/domain/ports';
import { createId } from '@/shared/lib/id';
import { simulate, type MockBehavior } from './behavior';
import type { VersionedCollection } from './storage';

export class MockMaterialCatalog implements MaterialCatalog {
  private readonly materials: VersionedCollection<Material>;
  private readonly behavior: MockBehavior;

  constructor(materials: VersionedCollection<Material>, behavior: MockBehavior) {
    this.materials = materials;
    this.behavior = behavior;
  }

  list(): Promise<Material[]> {
    return simulate(this.behavior, () =>
      this.materials.read().sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
  }

  create(draft: MaterialDraft): Promise<Material> {
    return simulate(this.behavior, () => {
      const material = { ...draft, id: createId() };
      this.materials.write([...this.materials.read(), material]);
      return material;
    });
  }

  update(material: Material): Promise<Material> {
    return simulate(this.behavior, () => {
      const all = this.materials.read();
      if (!all.some((m) => m.id === material.id)) throw new RepositoryError('not-found');
      this.materials.write(all.map((m) => (m.id === material.id ? material : m)));
      return material;
    });
  }
}
