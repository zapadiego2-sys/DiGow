import { Link } from 'react-router';
import { can } from '@/domain/access';
import type { Quote } from '@/domain/quote';
import { currentStep, isOpenTask } from '@/domain/workflow';
import { formatRelative } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { buttonClass } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useRoles, useUsers } from '../admin/useAccess';
import { useSession } from '../auth/useSession';
import { useQuotes } from '../quotes/useQuotes';
import { QueryError } from '../services/QueryError';
import { useWorkload } from '../workflow/useWorkflow';

function byWaitingTime(a: Quote, b: Quote) {
  return (a.workflow?.enteredStepAt ?? '').localeCompare(b.workflow?.enteredStepAt ?? '');
}

function TaskList({ quotes, label }: { quotes: readonly Quote[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-sm">
      {quotes.map((quote) => {
        const step = currentStep(quote.workflow);
        return (
          <li key={quote.id}>
            <Link
              to={`/cotizaciones/${quote.id}`}
              className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-md transition-colors hover:border-primary hover:bg-primary-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-md"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-subtitle text-primary">
                  {quote.project || 'Sin proyecto'}
                </span>
                <span className="truncate text-body-sm text-text-muted">
                  {quote.client || 'Sin cliente'} · {quote.items.length}{' '}
                  {quote.items.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-sm">
                {step ? <Badge tone="info">{step.name}</Badge> : null}
                {quote.workflow ? (
                  <span className="inline-flex items-center gap-xs text-caption text-text-muted">
                    <Icon name="clock" />
                    {formatRelative(quote.workflow.enteredStepAt)}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface WorkloadRow {
  id: string;
  name: string;
  role: string;
  open: number;
}

function Workload() {
  const workload = useWorkload();
  const users = useUsers();
  const roles = useRoles();
  const all = useQuotes({});
  const unassigned = (all.data ?? [])
    .filter((quote) => isOpenTask(quote.workflow) && !quote.workflow?.assigneeId)
    .sort(byWaitingTime);

  if (workload.isPending || users.isPending || roles.isPending) {
    return <Skeleton className="h-photo w-full" />;
  }
  if (workload.isError) {
    return <QueryError error={workload.error} onRetry={() => void workload.refetch()} />;
  }

  const rows: WorkloadRow[] = (users.data ?? [])
    .filter((user) => user.active)
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: roles.data?.find((role) => role.id === user.roleId)?.name ?? '—',
      open: workload.data[user.id] ?? 0,
    }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'es'));
  const columns: DataTableColumn<WorkloadRow>[] = [
    { key: 'name', header: 'Persona', cell: (row) => row.name },
    { key: 'role', header: 'Rol', cell: (row) => row.role },
    { key: 'open', header: 'Tareas abiertas', numeric: true, cell: (row) => row.open },
  ];

  return (
    <section aria-labelledby="workload-heading" className="flex flex-col gap-md">
      <h2 id="workload-heading" className="text-title">
        Carga de trabajo
      </h2>
      <p className="text-body-sm text-text-muted">
        Cada paso automático se asigna a la persona del rol con menos tareas abiertas.
      </p>
      <DataTable caption="Carga de trabajo" columns={columns} rows={rows} rowKey={(r) => r.id} />
      {unassigned.length > 0 ? (
        <>
          <h3 className="text-subtitle">Sin responsable ({unassigned.length})</h3>
          <TaskList quotes={unassigned} label="Cotizaciones sin responsable" />
        </>
      ) : null}
    </section>
  );
}

export function TasksScreen() {
  const session = useSession();
  const tasks = useQuotes({ assigneeId: session.user.id });
  const firstName = session.user.name.split(' ')[0];
  const mine = [...(tasks.data ?? [])].sort(byWaitingTime);

  return (
    <div className="flex flex-col gap-xl">
      <title>Mis tareas · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-display">Hola, {firstName}</h1>
          <p className="text-body-sm text-text-muted">{session.role.name}</p>
        </div>
        {can(session, 'quotes.create') ? (
          <Link to="/cotizaciones/nueva" className={buttonClass('primary')}>
            <Icon name="plus" />
            Nueva cotización
          </Link>
        ) : null}
      </header>

      <section aria-labelledby="tasks-heading" className="flex flex-col gap-md">
        <div className="flex flex-wrap items-baseline justify-between gap-sm">
          <h2 id="tasks-heading" className="text-title">
            Mis tareas
          </h2>
          {tasks.data ? (
            <span className="text-body-sm text-text-muted">
              {mine.length === 1 ? '1 pendiente' : `${mine.length} pendientes`}, la más antigua
              primero
            </span>
          ) : null}
        </div>
        {tasks.isPending ? (
          <div className="flex flex-col gap-sm" aria-busy="true">
            <Skeleton className="h-2xl w-full" />
            <Skeleton className="h-2xl w-full" />
          </div>
        ) : tasks.isError ? (
          <QueryError error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : mine.length === 0 ? (
          <EmptyState
            title="No tienes tareas pendientes"
            description="Cuando una cotización llegue a un paso tuyo, aparecerá aquí."
            action={
              <Link to="/cotizaciones" className={buttonClass('secondary')}>
                Ver cotizaciones
              </Link>
            }
          />
        ) : (
          <TaskList quotes={mine} label="Mis tareas" />
        )}
      </section>

      {can(session, 'workflow.manage') ? (
        <Card className="flex flex-col gap-md">
          <Workload />
        </Card>
      ) : null}
    </div>
  );
}
