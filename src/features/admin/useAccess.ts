import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, RoleDraft, User } from '@/domain/access';
import type { NewUser } from '@/domain/ports';
import { useServices } from '../services/ServicesContext';

const USERS = ['users'];
const ROLES = ['roles'];

export function useUsers() {
  const { userDirectory } = useServices();
  return useQuery({ queryKey: USERS, queryFn: () => userDirectory.list() });
}

export function useRoles() {
  const { roleCatalog } = useServices();
  return useQuery({ queryKey: ROLES, queryFn: () => roleCatalog.list() });
}

/** Cambiar un usuario o un rol puede cambiar la sesión abierta. */
function useInvalidateAccess() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: USERS });
    await queryClient.invalidateQueries({ queryKey: ROLES });
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  };
}

export function useCreateUser() {
  const { userDirectory } = useServices();
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (user: NewUser) => userDirectory.create(user),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const { userDirectory } = useServices();
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (user: User) => userDirectory.update(user),
    onSuccess: invalidate,
  });
}

export function useSetPassword() {
  const { userDirectory } = useServices();
  return useMutation({
    mutationFn: (input: { userId: string; password: string }) =>
      userDirectory.setPassword(input.userId, input.password),
  });
}

export function useSaveRole() {
  const { roleCatalog } = useServices();
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (input: { role: Role | null; draft: RoleDraft }) =>
      input.role
        ? roleCatalog.update({ ...input.role, ...input.draft })
        : roleCatalog.create(input.draft),
    onSuccess: invalidate,
  });
}

export function useRemoveRole() {
  const { roleCatalog } = useServices();
  const invalidate = useInvalidateAccess();
  return useMutation({ mutationFn: (id: string) => roleCatalog.remove(id), onSuccess: invalidate });
}
