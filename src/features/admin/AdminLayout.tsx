import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { can, type Permission } from '@/domain/access';
import { cn } from '@/shared/lib/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { useSession } from '../auth/useSession';

export const ADMIN_SECTIONS: {
  to: string;
  label: string;
  icon: IconName;
  permission: Permission;
}[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'users', permission: 'admin.users' },
  { to: '/admin/roles', label: 'Roles y permisos', icon: 'shield', permission: 'admin.roles' },
  { to: '/admin/flujos', label: 'Flujos y pasos', icon: 'flow', permission: 'admin.workflows' },
  { to: '/admin/plantillas', label: 'Plantillas', icon: 'template', permission: 'admin.templates' },
];

export function AdminLayout() {
  const session = useSession();
  const { pathname } = useLocation();
  const sections = ADMIN_SECTIONS.filter((section) => can(session, section.permission));

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No tienes acceso a la administración"
        description="Tu rol no incluye permisos de administración."
      />
    );
  }
  if (pathname === '/admin') return <Navigate to={sections[0]!.to} replace />;

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-display">Administración</h1>
      <nav aria-label="Administración" className="-mx-md overflow-x-auto px-md md:mx-0 md:px-0">
        <ul className="flex gap-xs border-b border-border">
          {sections.map((section) => (
            <li key={section.to} className="shrink-0">
              <NavLink
                to={section.to}
                className={({ isActive }) =>
                  cn(
                    '-mb-px flex min-h-control items-center gap-sm border-b-2 px-sm text-label',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-muted hover:text-text',
                  )
                }
              >
                <Icon name={section.icon} />
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
