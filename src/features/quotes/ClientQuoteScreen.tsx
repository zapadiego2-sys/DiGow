import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { toClientQuoteView } from '@/domain/clientView';
import { Button, buttonClass } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { QueryError } from '../services/QueryError';
import { ClientQuoteDocument } from './ClientQuoteDocument';
import { useQuote } from './useQuotes';

export function ClientQuoteScreen() {
  const { id = '' } = useParams();
  const quote = useQuote(id);
  const view = useMemo(() => (quote.data ? toClientQuoteView(quote.data) : null), [quote.data]);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-md p-md md:p-lg print:p-0">
      <div className="flex flex-wrap justify-between gap-sm print:hidden">
        <Link to={`/cotizaciones/${id}`} className={buttonClass('secondary')}>
          Volver al editor
        </Link>
        <Button variant="primary" disabled={!view} onClick={() => window.print()}>
          <Icon name="print" />
          Imprimir o guardar PDF
        </Button>
      </div>
      {quote.isPending ? (
        <div aria-busy="true">
          <Skeleton className="h-photo w-full" />
        </div>
      ) : quote.isError ? (
        <QueryError error={quote.error} onRetry={() => void quote.refetch()} />
      ) : view ? (
        <>
          <title>{`Cotización ${view.project}`}</title>
          <ClientQuoteDocument view={view} />
        </>
      ) : null}
    </div>
  );
}
