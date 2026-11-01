import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { quoteTotals, type Quote, type QuoteStatus } from '@/domain/quote';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Button, buttonClass, IconButton } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { QuoteStatusBadge, STATUS_OPTIONS } from './statusLabels';
import { useDuplicateQuote, useQuotes } from './useQuotes';

type StatusFilter = QuoteStatus | 'all';

const FILTER_OPTIONS = [{ value: 'all' as const, label: 'Todos los estados' }, ...STATUS_OPTIONS];

export function QuoteListScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const deferredSearch = useDeferredValue(search);
  const quotes = useQuotes({
    search: deferredSearch,
    ...(status === 'all' ? {} : { status }),
  });
  const duplicate = useDuplicateQuote();
  const toast = useToast();
  const isFiltering = Boolean(search.trim()) || status !== 'all';

  const onDuplicate = async (quote: Quote) => {
    try {
      await duplicate.mutateAsync(quote.id);
      toast({ tone: 'success', text: `Creamos una copia de "${quote.project || quote.client}".` });
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  };

  const columns: DataTableColumn<Quote>[] = [
    {
      key: 'project',
      header: 'Proyecto',
      cell: (quote) => (
        <Link
          to={`/cotizaciones/${quote.id}`}
          className="inline-flex min-h-control items-center text-label text-primary underline"
        >
          {quote.project || 'Sin proyecto'}
        </Link>
      ),
    },
    { key: 'client', header: 'Cliente', cell: (quote) => quote.client },
    { key: 'date', header: 'Fecha', cell: (quote) => (quote.date ? formatDate(quote.date) : '—') },
    {
      key: 'status',
      header: 'Estado',
      cell: (quote) => <QuoteStatusBadge status={quote.status} />,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      cell: (quote) => formatMoney(quoteTotals(quote).total),
    },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (quote) => (
        <div className="flex justify-end gap-xs md:justify-start">
          <Link
            to={`/cotizaciones/${quote.id}/cliente`}
            aria-label={`Vista para el cliente de ${quote.project || quote.client}`}
            title="Vista para el cliente"
            className="inline-flex size-control items-center justify-center rounded-md text-primary hover:bg-primary-subtle"
          >
            <Icon name="document" />
          </Link>
          <IconButton
            label={`Duplicar ${quote.project || quote.client}`}
            disabled={duplicate.isPending}
            onClick={() => void onDuplicate(quote)}
          >
            <Icon name="copy" />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <title>Cotizaciones · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-display">Cotizaciones</h1>
        <div className="flex flex-wrap gap-sm">
          <Link to="/cotizaciones/importar" className={buttonClass('secondary')}>
            <Icon name="upload" />
            Importar Excel
          </Link>
          <Link to="/cotizaciones/nueva" className={buttonClass('primary')}>
            <Icon name="plus" />
            Nueva cotización
          </Link>
        </div>
      </header>

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Buscar">
          {(control) => (
            <Input
              {...control}
              type="search"
              placeholder="Cliente, contacto o proyecto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Estado">
          {(control) => (
            <Select
              {...control}
              value={status}
              options={FILTER_OPTIONS}
              onValueChange={setStatus}
            />
          )}
        </FormField>
      </div>

      {quotes.isPending ? (
        <div className="flex flex-col gap-sm" aria-busy="true">
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
        </div>
      ) : quotes.isError ? (
        <QueryError error={quotes.error} onRetry={() => void quotes.refetch()} />
      ) : quotes.data.length === 0 ? (
        isFiltering ? (
          <EmptyState
            title="Sin resultados"
            description="Ninguna cotización coincide con la búsqueda o el estado elegido."
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Aún no hay cotizaciones"
            description="Crea la primera o importa un archivo de Excel."
            action={
              <Link to="/cotizaciones/importar" className={buttonClass('secondary')}>
                Importar Excel
              </Link>
            }
          />
        )
      ) : (
        <DataTable
          caption="Cotizaciones"
          columns={columns}
          rows={quotes.data}
          rowKey={(quote) => quote.id}
        />
      )}
    </div>
  );
}
