import { RepositoryError } from '@/domain/errors';
import { createId } from '@/shared/lib/id';
import { simulate, type MockBehavior } from './behavior';
import type { VersionedCollection } from './storage';

/** Listar, crear y actualizar sobre una colección local. Cada repositorio agrega sus reglas. */
export class MockCrud<T extends { id: string }, D> {
  protected readonly items: VersionedCollection<T>;
  protected readonly behavior: MockBehavior;
  private readonly build: (draft: D, id: string) => T;
  private readonly compare: (a: T, b: T) => number;

  constructor(options: {
    items: VersionedCollection<T>;
    behavior: MockBehavior;
    build: (draft: D, id: string) => T;
    compare: (a: T, b: T) => number;
  }) {
    this.items = options.items;
    this.behavior = options.behavior;
    this.build = options.build;
    this.compare = options.compare;
  }

  list(): Promise<T[]> {
    return simulate(this.behavior, () => this.items.read().sort(this.compare));
  }

  create(draft: D): Promise<T> {
    return simulate(this.behavior, () => {
      const item = this.build(draft, createId());
      this.items.write([...this.prepare(item, this.items.read()), item]);
      return item;
    });
  }

  update(item: T): Promise<T> {
    return simulate(this.behavior, () => {
      const all = this.items.read();
      if (!all.some((existing) => existing.id === item.id)) throw new RepositoryError('not-found');
      const prepared = this.prepare(item, all);
      this.items.write(prepared.map((existing) => (existing.id === item.id ? item : existing)));
      return item;
    });
  }

  /**
   * Valida antes de guardar y devuelve la colección, con los ajustes que el cambio exija
   * en los demás elementos. Lanza un error para impedir el cambio.
   */
  protected prepare(item: T, all: T[]): T[] {
    void item;
    return all;
  }
}

export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'es');
