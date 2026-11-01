import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Quote, QuoteDraft, QuoteFilter } from '@/domain/quote';
import { useServices } from '../services/ServicesContext';

const ALL = ['quotes'];

export function useQuotes(filter: QuoteFilter) {
  const { quoteReader } = useServices();
  return useQuery({
    queryKey: [...ALL, 'list', filter],
    queryFn: () => quoteReader.list(filter),
    placeholderData: keepPreviousData,
  });
}

export function useQuote(id: string) {
  const { quoteReader } = useServices();
  return useQuery({ queryKey: [...ALL, 'detail', id], queryFn: () => quoteReader.get(id) });
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
