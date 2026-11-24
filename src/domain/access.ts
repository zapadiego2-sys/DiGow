/** Permisos que un rol puede conceder. La interfaz y el backend deciden con estos códigos. */
export const permissions = [
  'quotes.create',
  'quotes.viewAll',
  'quotes.editAll',
  'quotes.costing',
  'quotes.import',
  'quotes.assignAdvisor',
  'materials.view',
  'materials.manage',
  'workflow.manage',
  'admin.users',
  'admin.roles',
  'admin.workflows',
  'admin.templates',
  'admin.conditions',
  'admin.formulas',
  'admin.catalog',
  'settings.demoData',
] as const;

export type Permission = (typeof permissions)[number];

/** El rol de super admin siempre tiene todos los permisos y no se puede editar. */
export const SUPER_ADMIN_ROLE_ID = 'role-superadmin';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Un rol del sistema no se puede borrar. */
  system: boolean;
}

export type RoleDraft = Omit<Role, 'id' | 'system'>;

export interface User {
  id: string;
  name: string;
  email: string;
  /** Cargo con que firma las cotizaciones. */
  title: string;
  roleId: string;
  active: boolean;
}

export type UserDraft = Omit<User, 'id'>;

export interface Session {
  user: User;
  role: Role;
}

export function permissionsOf(role: Pick<Role, 'id' | 'permissions'>): readonly Permission[] {
  return role.id === SUPER_ADMIN_ROLE_ID ? permissions : role.permissions;
}

export function can(session: Session | null, permission: Permission): boolean {
  return session !== null && permissionsOf(session.role).includes(permission);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Impide dejar el sistema sin un super admin activo. */
export function keepsActiveSuperAdmin(users: readonly User[], changed: User): boolean {
  const after = users.map((user) => (user.id === changed.id ? changed : user));
  return after.some((user) => user.active && user.roleId === SUPER_ADMIN_ROLE_ID);
}
