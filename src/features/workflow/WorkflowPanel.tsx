import { useState } from 'react';
import { can } from '@/domain/access';
import type { Quote } from '@/domain/quote';
import { canMoveWorkflow } from '@/domain/quoteAccess';
import {
  currentStep,
  defaultWorkflow,
  type QuoteWorkflowState,
  type WorkflowEvent,
} from '@/domain/workflow';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Textarea } from '@/shared/ui/Input';
import { Notice } from '@/shared/ui/Notice';
import { Select } from '@/shared/ui/Select';
import { Steps, type StepItem } from '@/shared/ui/Steps';
import { useToast } from '@/shared/ui/Toast';
import { useRoles, useUsers } from '../admin/useAccess';
import { useSession } from '../auth/useSession';
import { useQuoteFormControls } from '../quotes/QuoteForm';
import { errorMessage } from '../services/errorMessages';
import { useWorkflowCommand, useWorkflows } from './useWorkflow';

const ACTION_TEXT: Record<WorkflowEvent['action'], string> = {
  started: 'inició el flujo',
  advanced: 'envió la cotización',
  returned: 'devolvió la cotización',
  reassigned: 'reasignó el paso',
  completed: 'terminó el flujo',
};

function stepItems(state: QuoteWorkflowState): StepItem[] {
  const index = state.steps.findIndex((step) => step.id === state.currentStepId);
  return state.steps.map((step, i) => ({
    key: step.id,
    label: step.name,
    state: state.currentStepId === null || i < index ? 'done' : i === index ? 'current' : 'pending',
  }));
}

function History({ state }: { state: QuoteWorkflowState }) {
  const [open, setOpen] = useState(false);
  const stepName = (id: string | null) => state.steps.find((s) => s.id === id)?.name;
  const events = [...state.history].reverse();
  return (
    <div className="flex flex-col gap-sm">
      <div>
        <Button aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="clock" />
          {open ? 'Ocultar historial' : `Ver historial (${events.length})`}
        </Button>
      </div>
      {open ? (
        <ol
          aria-label="Historial del flujo"
          className="flex flex-col gap-sm border-l border-border pl-md"
        >
          {events.map((event) => (
            <li key={event.id} className="flex flex-col text-body-sm">
              <span>
                <strong className="text-label">{event.actorName}</strong>{' '}
                {ACTION_TEXT[event.action]}
                {event.toStepId && event.action !== 'reassigned'
                  ? ` a ${stepName(event.toStepId)}`
                  : ''}
                {event.assigneeName ? `. Responsable: ${event.assigneeName}` : ''}
              </span>
              {event.comment ? <span className="text-text-muted">“{event.comment}”</span> : null}
              <span className="text-caption text-text-muted">{formatDateTime(event.at)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function StartWorkflow({ quote }: { quote: Quote }) {
  const session = useSession();
  const workflows = useWorkflows();
  const command = useWorkflowCommand();
  const toast = useToast();
  const active = (workflows.data ?? []).filter((w) => w.active && w.steps.length > 0);
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? defaultWorkflow(active)?.id ?? null;

  return (
    <Card className="flex flex-col gap-md" aria-labelledby="workflow-heading">
      <h2 id="workflow-heading" className="text-title">
        Flujo de la cotización
      </h2>
      <p className="text-body-sm text-text-muted">
        Esta cotización todavía no está en un flujo. Al iniciarlo, cada paso se asigna a su
        responsable.
      </p>
      {active.length > 0 ? (
        <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FormField label="Flujo">
              {(control) => (
                <Select
                  {...control}
                  value={selected ?? undefined}
                  options={active.map((w) => ({ value: w.id, label: w.name }))}
                  onValueChange={setChosen}
                />
              )}
            </FormField>
          </div>
          <Button
            disabled={command.isPending || !selected}
            onClick={() =>
              command.mutate(
                {
                  kind: 'start',
                  quoteId: quote.id,
                  actorId: session.user.id,
                  workflowId: selected,
                },
                {
                  onSuccess: () => toast({ tone: 'success', text: 'Flujo iniciado.' }),
                  onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
                },
              )
            }
          >
            <Icon name="flow" />
            Iniciar flujo
          </Button>
        </div>
      ) : (
        <p className="text-body-sm">No hay flujos activos. Un administrador debe configurar uno.</p>
      )}
    </Card>
  );
}

/** Va dentro de QuoteForm: si hay cambios sin guardar, los guarda antes de mover el flujo. */
export function WorkflowPanel({ quote }: { quote: Quote }) {
  const { isDirty, save } = useQuoteFormControls();
  const session = useSession();
  const users = useUsers();
  const roles = useRoles();
  const command = useWorkflowCommand();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const state = quote.workflow;

  if (!state) return <StartWorkflow quote={quote} />;

  const step = currentStep(state);
  const index = state.steps.findIndex((s) => s.id === state.currentStepId);
  const next = state.steps[index + 1];
  const previous = index > 0 ? state.steps[index - 1] : undefined;
  const assignee = users.data?.find((u) => u.id === state.assigneeId);
  const roleName = roles.data?.find((r) => r.id === step?.roleId)?.name;
  const canMove = canMoveWorkflow(state, session);
  const canManage = can(session, 'workflow.manage');
  const candidates = (users.data ?? []).filter(
    (u) => u.active && u.roleId === step?.roleId && u.id !== state.assigneeId,
  );

  const target = next ? `enviar a ${next.name}` : 'terminar el flujo';
  const advanceLabel = isDirty
    ? `Guardar y ${target}`
    : `${target.charAt(0).toUpperCase()}${target.slice(1)}`;

  const run = async (kind: 'advance' | 'sendBack') => {
    if (kind === 'sendBack' && !comment.trim()) {
      setCommentError('Escribe el motivo para devolverla.');
      return;
    }
    if (isDirty && !(await save())) return;
    try {
      await command.mutateAsync({ kind, quoteId: quote.id, actorId: session.user.id, comment });
      setComment('');
      setCommentError(null);
      toast({
        tone: 'success',
        text:
          kind === 'sendBack'
            ? `Devuelta a ${previous?.name}.`
            : next
              ? `Enviada a ${next.name}.`
              : 'Flujo terminado. La cotización quedó como Enviada.',
      });
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  };

  return (
    <Card className="flex flex-col gap-md" aria-labelledby="workflow-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 id="workflow-heading" className="text-title">
          {state.workflowName}
        </h2>
        {step ? (
          <span className="text-caption text-text-muted">
            En este paso {formatRelative(state.enteredStepAt)}
          </span>
        ) : null}
      </div>
      <Steps label="Pasos del flujo" steps={stepItems(state)} />

      {step ? (
        <div className="flex flex-col gap-sm rounded-md bg-surface-muted p-md">
          <p className="text-body-sm">
            <span className="text-label">Paso actual: {step.name}.</span>{' '}
            {assignee ? (
              <>
                Responsable:{' '}
                <strong>{assignee.id === session.user.id ? 'tú' : assignee.name}</strong>
                {roleName ? ` (${roleName})` : ''}.
              </>
            ) : (
              <>Sin responsable: no hay usuarios activos con el rol {roleName ?? 'del paso'}.</>
            )}
          </p>
          {step.instructions ? (
            <p className="text-body-sm text-text-muted">{step.instructions}</p>
          ) : null}
        </div>
      ) : (
        <Notice tone="success" title="Flujo terminado">
          <p>Terminó el {state.completedAt ? formatDateTime(state.completedAt) : '—'}.</p>
        </Notice>
      )}

      {step && canMove ? (
        <div className="flex flex-col gap-sm">
          <FormField
            label={previous ? 'Comentario (obligatorio para devolver)' : 'Comentario (opcional)'}
            error={commentError ?? undefined}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setCommentError(null);
                }}
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-sm">
            <Button disabled={command.isPending} onClick={() => void run('advance')}>
              <Icon name={next ? 'arrowRight' : 'check'} />
              {advanceLabel}
            </Button>
            {previous ? (
              <Button disabled={command.isPending} onClick={() => void run('sendBack')}>
                <Icon name="arrowLeft" />
                Devolver a {previous.name}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step && canManage && candidates.length > 0 ? (
        <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FormField label="Reasignar a">
              {(control) => (
                <Select
                  {...control}
                  value={reassignTo ?? undefined}
                  placeholder="Elige una persona"
                  options={candidates.map((u) => ({ value: u.id, label: u.name }))}
                  onValueChange={setReassignTo}
                />
              )}
            </FormField>
          </div>
          <Button
            disabled={!reassignTo || command.isPending}
            onClick={() =>
              reassignTo &&
              command.mutate(
                {
                  kind: 'reassign',
                  quoteId: quote.id,
                  actorId: session.user.id,
                  assigneeId: reassignTo,
                },
                {
                  onSuccess: () => {
                    setReassignTo(null);
                    toast({ tone: 'success', text: 'Paso reasignado.' });
                  },
                  onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
                },
              )
            }
          >
            <Icon name="user" />
            Reasignar
          </Button>
        </div>
      ) : null}

      <History state={state} />
    </Card>
  );
}
