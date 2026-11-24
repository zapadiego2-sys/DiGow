import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Quote, QuoteDraft, QuoteFilter } from '@/domain/quote';
import { withoutCosts } from '@/domain/quoteAccess';
import { useCan } from '../auth/useSession';
import { useServices } from '../services/ServicesContext';

const ALL = ['quotes'];

/**
 * Sin el permiso de costos, las pantallas reciben las cotizaciones sin hojas de costos.
 * Con un backend, este recorte debe hacerlo el servidor.
 */
function useCostVisibility() {
  const canSeeCosts = useCan('quotes.costing');
  return {
    scope: canSeeCosts ? 'full' : 'restricted',
    shape: (quote: Quote) => (canSeeCosts ? quote : withoutCosts(quote)),
  };
}

export function useQuotes(filter: QuoteFilter) {
  const { quoteReader } = useServices();
  const { scope, shape } = useCostVisibility();
  return useQuery({
    queryKey: [...ALL, 'list', scope, filter],
    queryFn: async () => (await quoteReader.list(filter)).map(shape),
    placeholderData: keepPreviousData,
  });
}

export function useQuote(id: string) {
  const { quoteReader } = useServices();
  const { scope, shape } = useCostVisibility();
  return useQuery({
    queryKey: [...ALL, 'detail', scope, id],
    queryFn: async () => shape(await quoteReader.get(id)),
  });
}

export function useCreateQuote() {
  const { quoteWriter } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: QuoteDraft) => quoteWriter.create(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALL }),
  });
}

export function useUpdateQuote() {
  const { quoteWriter } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quote: Quote) => quoteWriter.update(quote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALL }),
  });
}

export function useDuplicateQuote() {
  const { quoteWriter } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quoteWriter.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALL }),
  });
}
