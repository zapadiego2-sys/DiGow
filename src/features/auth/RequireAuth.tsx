import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import type { Permission } from '@/domain/access';
import { buttonClass } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { QueryError } from '../services/QueryError';
import { SessionContext, useCan, useSessionQuery } from './useSession';

export const SIGN_IN_PATH = '/ingresar';

export interface SignInState {
  from?: string;
}

/** Sin sesión, lleva a ingresar y recuerda a dónde quería ir la persona. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSessionQuery();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="flex h-dvh flex-col gap-md p-md" aria-busy="true">
        <Skeleton className="h-2xl w-full" />
        <Skeleton className="h-photo w-full" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <div className="p-md">
        <QueryError error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) {
    const state: SignInState = { from: `${location.pathname}${location.search}` };
    return <Navigate to={SIGN_IN_PATH} replace state={state} />;
  }
  return <SessionContext.Provider value={session.data}>{children}</SessionContext.Provider>;
}

/** La interfaz oculta lo que el rol no permite. Un backend real debe validarlo también. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const allowed = useCan(permission);
  if (allowed) return children;
  return (
    <EmptyState
      title="No tienes acceso a esta sección"
      description="Tu rol no incluye este permiso. Si lo necesitas, pídeselo a un administrador."
      action={
        <Link to="/" className={buttonClass('secondary')}>
          Ir a mis tareas
        </Link>
      }
    />
  );
}
