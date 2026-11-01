import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BrandLogo } from '@/features/brand/BrandLogo';
import { cn } from '@/shared/lib/cn';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { Icon, type IconName } from '@/shared/ui/Icon';

const NAV_ITEMS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Cotizaciones', icon: 'document', end: true },
  { to: '/materiales', label: 'Materiales', icon: 'layers' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
];

function Navigation({ className }: { className: string }) {
  return (
    <ul className={className}>
      {NAV_ITEMS.map((item) => (
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

export function Shell() {
  const online = useOnlineStatus();
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
          <div className="flex min-h-control items-center p-sm px-md">
            <BrandLogo />
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
