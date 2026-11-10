import {
  keepsActiveSuperAdmin,
  normalizeEmail,
  SUPER_ADMIN_ROLE_ID,
  type Role,
  type RoleDraft,
  type Session,
  type User,
} from '@/domain/access';
import { RepositoryError, RuleError } from '@/domain/errors';
import type { Authenticator, NewUser, RoleCatalog, UserDirectory } from '@/domain/ports';
import type { Workflow } from '@/domain/workflow';
import { createId } from '@/shared/lib/id';
import type { Credential } from '../seed/accessSeed';
import { simulate, type MockBehavior } from './behavior';
import { byName, MockCrud } from './crud';
import { createSalt, hashPassword } from './password';
import type { VersionedCollection } from './storage';

export interface AccessCollections {
  users: VersionedCollection<User>;
  roles: VersionedCollection<Role>;
  credentials: VersionedCollection<Credential>;
  /** Cero o un elemento: el usuario con la sesión abierta en este dispositivo. */
  session: VersionedCollection<{ userId: string }>;
  workflows: VersionedCollection<Workflow>;
}

/** Arma la sesión de un usuario activo con un rol existente. */
export function sessionFor(collections: AccessCollections, userId: string): Session | null {
  const user = collections.users.read().find((u) => u.id === userId);
  if (!user?.active) return null;
  const role = collections.roles.read().find((r) => r.id === user.roleId);
  return role ? { user, role } : null;
}

/** Inicio de sesión simulado: sirve para probar los roles, no protege datos reales. */
export class MockAuthenticator implements Authenticator {
  private readonly collections: AccessCollections;
  private readonly behavior: MockBehavior;

  constructor(collections: AccessCollections, behavior: MockBehavior) {
    this.collections = collections;
    this.behavior = behavior;
  }

  async signIn(email: string, password: string): Promise<Session> {
    await simulate(this.behavior, () => undefined);
    const { users, credentials, session } = this.collections;
    const user = users.read().find((u) => normalizeEmail(u.email) === normalizeEmail(email));
    const credential = credentials.read().find((c) => c.userId === user?.id);
    // El mismo error para correo y contraseña: no revela qué correos existen.
    if (!user || !credential) throw new RuleError('invalid-credentials');
    if ((await hashPassword(credential.salt, password)) !== credential.hash) {
      throw new RuleError('invalid-credentials');
    }
    if (!user.active) throw new RuleError('inactive-user');
    const opened = sessionFor(this.collections, user.id);
    if (!opened) throw new RuleError('inactive-user');
    session.write([{ userId: user.id }]);
    return opened;
  }

  signOut(): Promise<void> {
    return simulate(this.behavior, () => this.collections.session.clear());
  }

  currentSession(): Promise<Session | null> {
    return simulate(this.behavior, () => {
      const [current] = this.collections.session.read();
      return current ? sessionFor(this.collections, current.userId) : null;
    });
  }
}

export class MockUserDirectory implements UserDirectory {
  private readonly collections: AccessCollections;
  private readonly behavior: MockBehavior;

  constructor(collections: AccessCollections, behavior: MockBehavior) {
    this.collections = collections;
    this.behavior = behavior;
  }

  list(): Promise<User[]> {
    return simulate(this.behavior, () => this.collections.users.read().sort(byName));
  }

  async create(input: NewUser): Promise<User> {
    const { password, ...draft } = input;
    await simulate(this.behavior, () => undefined);
    const user: User = { ...draft, email: normalizeEmail(draft.email), id: createId() };
    const all = this.collections.users.read();
    this.assertUniqueEmail(user, all);
    const credential = await this.credentialFor(user.id, password);
    this.collections.users.write([...all, user]);
    this.collections.credentials.write([...this.collections.credentials.read(), credential]);
    return user;
  }

  update(user: User): Promise<User> {
    return simulate(this.behavior, () => {
      const all = this.collections.users.read();
      if (!all.some((u) => u.id === user.id)) throw new RepositoryError('not-found');
      const updated = { ...user, email: normalizeEmail(user.email) };
      this.assertUniqueEmail(updated, all);
      if (!keepsActiveSuperAdmin(all, updated)) throw new RuleError('last-admin');
      this.collections.users.write(all.map((u) => (u.id === user.id ? updated : u)));
      return updated;
    });
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await simulate(this.behavior, () => undefined);
    if (!this.collections.users.read().some((u) => u.id === userId)) {
      throw new RepositoryError('not-found');
    }
    const credential = await this.credentialFor(userId, password);
    const others = this.collections.credentials.read().filter((c) => c.userId !== userId);
    this.collections.credentials.write([...others, credential]);
  }

  private assertUniqueEmail(user: User, all: User[]) {
    if (all.some((u) => u.id !== user.id && normalizeEmail(u.email) === user.email)) {
      throw new RuleError('email-taken');
    }
  }

  private async credentialFor(userId: string, password: string): Promise<Credential> {
    const salt = createSalt();
    return { userId, salt, hash: await hashPassword(salt, password) };
  }
}

export class MockRoleCatalog extends MockCrud<Role, RoleDraft> implements RoleCatalog {
  private readonly collections: AccessCollections;

  constructor(collections: AccessCollections, behavior: MockBehavior) {
    super({
      items: collections.roles,
      behavior,
      build: (draft, id) => ({ ...draft, id, system: false }),
      compare: byName,
    });
    this.collections = collections;
  }

  protected override prepare(role: Role, all: Role[]): Role[] {
    if (role.id === SUPER_ADMIN_ROLE_ID) throw new RuleError('system-role');
    return all;
  }

  override update(role: Role): Promise<Role> {
    // El campo system no se puede cambiar desde la interfaz.
    const stored = this.items.read().find((r) => r.id === role.id);
    return super.update({ ...role, system: stored?.system ?? false });
  }

  remove(id: string): Promise<void> {
    return simulate(this.behavior, () => {
      const role = this.items.read().find((r) => r.id === id);
      if (!role) throw new RepositoryError('not-found');
      if (role.system) throw new RuleError('system-role');
      const usedByUser = this.collections.users.read().some((u) => u.roleId === id);
      const usedByStep = this.collections.workflows
        .read()
        .some((workflow) => workflow.steps.some((step) => step.roleId === id));
      if (usedByUser || usedByStep) throw new RuleError('role-in-use');
      this.items.write(this.items.read().filter((r) => r.id !== id));
    });
  }
}
