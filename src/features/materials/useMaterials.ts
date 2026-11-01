import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Material, MaterialDraft } from '@/domain/material';
import { useServices } from '../services/ServicesContext';

const KEY = ['materials'];

export function useMaterials() {
  const { materialCatalog } = useServices();
  return useQuery({ queryKey: KEY, queryFn: () => materialCatalog.list() });
}

export function useSaveMaterial() {
  const { materialCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string | null; draft: MaterialDraft }) =>
      input.id
        ? materialCatalog.update({ ...input.draft, id: input.id } satisfies Material)
        : materialCatalog.create(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
