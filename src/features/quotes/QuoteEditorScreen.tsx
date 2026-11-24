import { Link, useParams } from 'react-router';
import { can } from '@/domain/access';
import { canEditQuote, canViewQuote, mergeRestrictedEdit } from '@/domain/quoteAccess';
import { formatDate } from '@/shared/lib/format';
import { buttonClass } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { useSession } from '../auth/useSession';
import { QueryError } from '../services/QueryError';
import { useServices } from '../services/ServicesContext';
import { WorkflowPanel } from '../workflow/WorkflowPanel';
import { QuoteForm } from './QuoteForm';
import { useQuote, useUpdateQuote } from './useQuotes';

export function QuoteEditorScreen() {
  const { id = '' } = useParams();
  const session = useSession();
  const quote = useQuote(id);
  const update = useUpdateQuote();
  const { quoteReader } = useServices();
  const toast = useToast();
  const showCosts = can(session, 'quotes.costing');

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
  if (!canViewQuote(quote.data, session)) {
    return (
      <EmptyState
        title="No tienes acceso a esta cotización"
        description="Solo la ven quien la creó, su responsable actual y los roles que ven todas las cotizaciones."
        action={
          <Link to="/cotizaciones" className={buttonClass('secondary')}>
            Ir a cotizaciones
          </Link>
        }
      />
    );
  }

  const current = quote.data;
  const { id: quoteId, createdAt, updatedAt } = current;

  return (
    <div className="flex flex-col gap-lg">
      <title>{`${current.project || 'Cotización'} · Cotizador`}</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-display">{current.project || 'Cotización'}</h1>
          <p className="text-body-sm text-text-muted">
            {current.client}
            {current.date ? ` · ${formatDate(current.date)}` : ''}
          </p>
        </div>
        <Link to={`/cotizaciones/${quoteId}/cliente`} className={buttonClass('secondary')}>
          <Icon name="document" />
          Vista para el cliente
        </Link>
      </header>
      <QuoteForm
        // El estado puede cambiar al terminar el flujo: el formulario se rearma con el nuevo.
        key={`${quoteId}:${current.status}`}
        initial={current}
        submitLabel="Guardar cambios"
        showCosts={showCosts}
        readOnly={!canEditQuote(current, session)}
        header={<WorkflowPanel quote={current} />}
        onSubmit={async (draft) => {
          // El flujo solo cambia con sus acciones: se conserva el guardado más reciente.
          const edited = {
            ...draft,
            workflow: current.workflow,
            id: quoteId,
            createdAt,
            updatedAt,
          };
          // Sin permiso de costos, el formulario no tiene costos ni precios: se conservan los guardados.
          const toSave = showCosts
            ? edited
            : mergeRestrictedEdit(await quoteReader.get(quoteId), edited);
          await update.mutateAsync(toSave);
          toast({ tone: 'success', text: 'Cotización guardada.' });
        }}
      />
    </div>
  );
}
