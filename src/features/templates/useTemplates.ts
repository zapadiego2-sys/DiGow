import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuoteTemplate, QuoteTemplateDraft } from '@/domain/template';
import { useServices } from '../services/ServicesContext';

const KEY = ['templates'];

export function useTemplates() {
  const { templateCatalog } = useServices();
  return useQuery({ queryKey: KEY, queryFn: () => templateCatalog.list() });
}

export function useSaveTemplate() {
  const { templateCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string | null; draft: QuoteTemplateDraft }) =>
      input.id
        ? templateCatalog.update({ ...input.draft, id: input.id } satisfies QuoteTemplate)
        : templateCatalog.create(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
