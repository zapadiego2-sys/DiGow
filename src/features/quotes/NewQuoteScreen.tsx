import { useState } from 'react';
import { useNavigate } from 'react-router';
import { createEmptyQuoteDraft } from '@/domain/quote';
import { todayIso } from '@/shared/lib/format';
import { useToast } from '@/shared/ui/Toast';
import { QuoteForm } from './QuoteForm';
import { useCreateQuote } from './useQuotes';

export function NewQuoteScreen() {
  const [initial] = useState(() => createEmptyQuoteDraft(todayIso()));
  const create = useCreateQuote();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className="flex flex-col gap-lg">
      <title>Nueva cotización · Cotizador</title>
      <h1 className="text-display">Nueva cotización</h1>
      <QuoteForm
        initial={initial}
        submitLabel="Crear cotización"
        onSubmit={async (draft) => {
          const quote = await create.mutateAsync(draft);
          toast({ tone: 'success', text: 'Cotización creada.' });
          await navigate(`/cotizaciones/${quote.id}`, { replace: true });
        }}
      />
    </div>
  );
}
