import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { can, type Permission, type Session } from '@/domain/access';
import { useServices } from '../services/ServicesContext';

const KEY = ['session'];

export function useSessionQuery() {
  const { authenticator } = useServices();
  return useQuery({ queryKey: KEY, queryFn: () => authenticator.currentSession() });
}

/**
 * RequireAuth provee la sesión ya abierta. Al cerrar sesión, las pantallas siguen leyendo la
 * última hasta que RequireAuth las desmonta, en lugar de fallar a mitad del cambio.
 */
export const SessionContext = createContext<Session | null>(null);

/** Solo dentro de RequireAuth: ahí la sesión ya existe. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession requiere RequireAuth.');
  return session;
}

export function useCan(permission: Permission): boolean {
  return can(useContext(SessionContext), permission);
}

/** Los datos de otro usuario no deben quedar en la caché. */
function clearUserData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== KEY[0] });
}

export function useSignIn() {
  const { authenticator } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authenticator.signIn(input.email, input.password),
    onSuccess: (session) => {
      clearUserData(queryClient);
      queryClient.setQueryData(KEY, session);
    },
  });
}

export function useSignOut() {
  const { authenticator } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authenticator.signOut(),
    onSuccess: () => {
      queryClient.setQueryData(KEY, null);
      clearUserData(queryClient);
    },
  });
}
