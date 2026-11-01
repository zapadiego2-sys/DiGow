import { RepositoryError } from '@/domain/errors';

/** Adaptador sobre el almacenamiento, para no depender directamente de localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

interface CollectionOptions<T> {
  store: KeyValueStore;
  name: string;
  version: number;
  seed: () => T[];
  /** Migración desde cada versión anterior: migrations[1] convierte datos v1 en v2. */
  migrations?: Record<number, (data: unknown) => unknown>;
}

export interface VersionedCollection<T> {
  read(): T[];
  write(items: T[]): void;
  clear(): void;
}

function keyFor(name: string, version: number) {
  return `cotizador:${name}:v${version}`;
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new RepositoryError('storage-corrupted');
  }
}

export function createVersionedCollection<T>(
  options: CollectionOptions<T>,
): VersionedCollection<T> {
  const { store, name, version, seed, migrations = {} } = options;
  const key = keyFor(name, version);

  const write = (items: T[]) => {
    try {
      store.setItem(key, JSON.stringify(items));
    } catch {
      throw new RepositoryError('storage-full');
    }
  };

  const migrateFromOlderVersion = (): T[] | null => {
    for (let from = version - 1; from >= 1; from--) {
      const raw = store.getItem(keyFor(name, from));
      if (raw === null) continue;
      let data = parse(raw);
      for (let step = from; step < version; step++) {
        const migrate = migrations[step];
        if (!migrate) throw new RepositoryError('storage-corrupted');
        data = migrate(data);
      }
      write(data as T[]);
      store.removeItem(keyFor(name, from));
      return data as T[];
    }
    return null;
  };

  return {
    read() {
      const raw = store.getItem(key);
      if (raw !== null) {
        const data = parse(raw);
        if (!Array.isArray(data)) throw new RepositoryError('storage-corrupted');
        return data as T[];
      }
      return migrateFromOlderVersion() ?? seed();
    },
    write,
    clear: () => store.removeItem(key),
  };
}
