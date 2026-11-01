import { Link, useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { buttonClass } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { QueryError } from '../services/QueryError';
import { QuoteForm } from './QuoteForm';
import { useQuote, useUpdateQuote } from './useQuotes';

export function QuoteEditorScreen() {
  const { id = '' } = useParams();
  const quote = useQuote(id);
  const update = useUpdateQuote();
  const toast = useToast();

  if (quote.isPending) {
    return (
      <div className="flex flex-col gap-md" aria-busy="true">
        <Skeleton className="h-2xl w-full" />
        <Skeleton className="h-photo w-full" />
      </div>
    );
  }
  if (quote.isError) {
    return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />;
  }

  const { id: quoteId, createdAt, updatedAt } = quote.data;

  return (
    <div className="flex flex-col gap-lg">
      <title>{`${quote.data.project || 'Cotización'} · Cotizador`}</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-display">{quote.data.project || 'Cotización'}</h1>
          <p className="text-body-sm text-text-muted">
            {quote.data.client}
            {quote.data.date ? ` · ${formatDate(quote.data.date)}` : ''}
          </p>
        </div>
        <Link to={`/cotizaciones/${quoteId}/cliente`} className={buttonClass('secondary')}>
          <Icon name="document" />
          Vista para el cliente
        </Link>
      </header>
      <QuoteForm
        key={quoteId}
        initial={quote.data}
        submitLabel="Guardar cambios"
        onSubmit={async (draft) => {
          await update.mutateAsync({ ...draft, id: quoteId, createdAt, updatedAt });
          toast({ tone: 'success', text: 'Cotización guardada.' });
        }}
      />
    </div>
  );
}
