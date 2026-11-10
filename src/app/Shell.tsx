import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { can, type Permission, type Session } from '@/domain/access';
import { ADMIN_SECTIONS } from '@/features/admin/AdminLayout';
import { SIGN_IN_PATH } from '@/features/auth/RequireAuth';
import { useSession, useSignOut } from '@/features/auth/useSession';
import { BrandLogo } from '@/features/brand/BrandLogo';
import { cn } from '@/shared/lib/cn';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { IconButton } from '@/shared/ui/Button';
import { Icon, type IconName } from '@/shared/ui/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  /** Basta con uno de estos permisos para ver la sección. */
  anyOf?: Permission[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Mis tareas', icon: 'inbox', end: true },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: 'document' },
  { to: '/materiales', label: 'Materiales', icon: 'layers', anyOf: ['materials.view'] },
  {
    to: '/admin',
    label: 'Admin',
    icon: 'shield',
    anyOf: ADMIN_SECTIONS.map((section) => section.permission),
  },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
];

function visibleItems(session: Session) {
  return NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((permission) => can(session, permission)),
  );
}

function Navigation({ className }: { className: string }) {
  const session = useSession();
  return (
    <ul className={className}>
      {visibleItems(session).map((item) => (
        <li key={item.to} className="flex-1 lg:flex-none">
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex min-h-control flex-col items-center justify-center gap-xs rounded-md p-xs text-caption lg:flex-row lg:justify-start lg:gap-sm lg:px-sm lg:text-label',
                isActive
                  ? 'bg-primary-subtle text-primary'
                  : 'text-text-muted hover:bg-surface-muted',
              )
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function useSignOutAndLeave() {
  const signOut = useSignOut();
  const navigate = useNavigate();
  return () =>
    signOut.mutate(undefined, { onSuccess: () => void navigate(SIGN_IN_PATH, { replace: true }) });
}

function UserCard() {
  const session = useSession();
  const leave = useSignOutAndLeave();
  return (
    <div className="mt-auto flex items-center gap-sm border-t border-border pt-md">
      <span className="inline-flex size-control shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Icon name="user" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label">{session.user.name}</span>
        <span className="truncate text-caption text-text-muted">{session.role.name}</span>
      </span>
      <IconButton label="Cerrar sesión" onClick={leave}>
        <Icon name="logout" />
      </IconButton>
    </div>
  );
}

export function Shell() {
  const online = useOnlineStatus();
  const session = useSession();
  const leave = useSignOutAndLeave();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // Un cambio de ruta no mueve el foco por sí solo: se lleva al contenido nuevo.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only z-50 bg-surface p-sm text-primary focus:not-sr-only focus:absolute"
      >
        Saltar al contenido
      </a>
      <nav
        aria-label="Principal"
        className="hidden shrink-0 flex-col gap-lg border-r border-border bg-surface p-md lg:flex lg:w-sidebar"
      >
        <BrandLogo />
        <Navigation className="flex flex-col gap-xs" />
        <UserCard />
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {online ? null : (
          <p
            role="status"
            className="bg-warning-subtle p-sm px-md text-center text-label text-warning"
          >
            Sin conexión. Tus cambios se guardan en este dispositivo.
          </p>
        )}
        <header className="pt-safe shrink-0 border-b border-border bg-surface lg:hidden">
          <div className="flex min-h-control items-center justify-between gap-sm p-sm px-md">
            <BrandLogo />
            <span className="flex min-w-0 items-center gap-xs">
              <span className="truncate text-caption text-text-muted">{session.user.name}</span>
              <IconButton label="Cerrar sesión" onClick={leave}>
                <Icon name="logout" />
              </IconButton>
            </span>
          </div>
        </header>
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="min-h-0 flex-1 scroll-pb-thumb overflow-x-clip overflow-y-auto outline-none lg:scroll-pb-0"
        >
          <div className="mx-auto w-full max-w-content px-md pt-md md:px-lg lg:pt-lg">
            <Outlet />
            <div className="h-md" />
          </div>
        </main>
        <nav
          aria-label="Principal móvil"
          className="pb-safe shrink-0 border-t border-border bg-surface lg:hidden"
        >
          <Navigation className="flex gap-xs p-xs" />
        </nav>
      </div>
    </div>
  );
}
