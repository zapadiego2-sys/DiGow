import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { createDraftFromTemplate, createEmptyQuoteDraft } from '@/domain/quote';
import type { ItemMeasures, QuoteTemplate } from '@/domain/template';
import { todayIso } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { useSession } from '../auth/useSession';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { useTemplates } from '../templates/useTemplates';
import { useWorkflowCommand, useWorkflows } from '../workflow/useWorkflow';
import { QuoteForm } from './QuoteForm';
import { useCreateQuote } from './useQuotes';

export const TEMPLATE_PARAM = 'plantilla';

const MEASURE_LABELS: Record<keyof ItemMeasures, string> = {
  width: 'ancho',
  height: 'alto',
  depth: 'profundidad',
};

function measuresText(measures: ItemMeasures): string {
  const names = (Object.keys(MEASURE_LABELS) as (keyof ItemMeasures)[])
    .filter((key) => measures[key])
    .map((key) => MEASURE_LABELS[key]);
  return names.length ? `Medidas: ${names.join(', ')}` : 'Sin medidas';
}

function TemplatePicker({ templates }: { templates: readonly QuoteTemplate[] }) {
  const workflows = useWorkflows();
  const workflowName = (id: string | null) =>
    workflows.data?.find((w) => (id ? w.id === id : w.isDefault))?.name;

  return (
    <section aria-labelledby="picker-heading" className="flex flex-col gap-md">
      <p id="picker-heading" className="text-body text-text-muted">
        Elige la plantilla según el tipo de proyecto. Define los campos del formulario, las medidas
        de cada ítem y el flujo que seguirá la cotización.
      </p>
      <ul className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <li key={template.id}>
            <Link
              to={`?${TEMPLATE_PARAM}=${template.id}`}
              className="flex h-full flex-col gap-sm rounded-lg border border-border bg-surface p-md transition-colors hover:border-primary hover:bg-primary-subtle"
            >
              <span className="flex items-center justify-between gap-sm">
                <span className="text-subtitle text-primary">{template.name}</span>
                <Icon name="arrowRight" />
              </span>
              <span className="text-body-sm text-text-muted">{template.description}</span>
              <span className="mt-auto flex flex-wrap gap-xs pt-sm">
                <Badge tone="neutral">
                  {template.fields.length === 1
                    ? '1 campo propio'
                    : `${template.fields.length} campos propios`}
                </Badge>
                <Badge tone="neutral">{measuresText(template.measures)}</Badge>
                {workflowName(template.workflowId) ? (
                  <Badge tone="info">Flujo: {workflowName(template.workflowId)}</Badge>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NewQuoteScreen() {
  const session = useSession();
  const templates = useTemplates();
  const [params] = useSearchParams();
  const create = useCreateQuote();
  const startFlow = useWorkflowCommand();
  const navigate = useNavigate();
  const toast = useToast();

  const active = useMemo(() => (templates.data ?? []).filter((t) => t.active), [templates.data]);
  const requested = params.get(TEMPLATE_PARAM);
  const template =
    active.find((t) => t.id === requested) ?? (active.length === 1 ? active[0] : undefined);
  const initial = useMemo(
    () =>
      template
        ? createDraftFromTemplate(template, todayIso(), session.user.id)
        : { ...createEmptyQuoteDraft(todayIso()), createdBy: session.user.id },
    [template, session.user.id],
  );

  const body = () => {
    if (templates.isPending) return <Skeleton className="h-photo w-full" />;
    if (templates.isError) {
      return <QueryError error={templates.error} onRetry={() => void templates.refetch()} />;
    }
    if (!template && active.length > 1) return <TemplatePicker templates={active} />;
    return (
      <QuoteForm
        key={template?.id ?? 'sin-plantilla'}
        initial={initial}
        submitLabel="Crear cotización"
        onSubmit={async (draft) => {
          const quote = await create.mutateAsync({ ...draft, createdBy: session.user.id });
          try {
            await startFlow.mutateAsync({
              kind: 'start',
              quoteId: quote.id,
              actorId: session.user.id,
              workflowId: template?.workflowId ?? null,
            });
            toast({ tone: 'success', text: 'Cotización creada.' });
          } catch (error) {
            toast({
              tone: 'danger',
              text: `La cotización se creó, pero no pudo entrar al flujo. ${errorMessage(error)}`,
            });
          }
          await navigate(`/cotizaciones/${quote.id}`, { replace: true });
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-lg">
      <title>Nueva cotización · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-display">Nueva cotización</h1>
        {template && active.length > 1 ? (
          <Link
            to="/cotizaciones/nueva"
            className="inline-flex min-h-control items-center text-label text-primary underline"
          >
            Cambiar plantilla
          </Link>
        ) : null}
      </header>
      {body()}
    </div>
  );
}
