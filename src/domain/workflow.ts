import { RuleError } from './errors';
import type { User } from './access';

/**
 * `requester`: lo atiende quien creó la cotización.
 * `workload`: se asigna a la persona del rol con menos tareas abiertas.
 */
export const assignmentModes = ['workload', 'requester'] as const;
export type AssignmentMode = (typeof assignmentModes)[number];

export interface WorkflowStep {
  id: string;
  name: string;
  roleId: string;
  assignment: AssignmentMode;
  /** Qué debe hacer el responsable en este paso. */
  instructions: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  /** El flujo que se usa cuando la plantilla no indica otro. */
  isDefault: boolean;
  steps: WorkflowStep[];
}

export type WorkflowDraft = Omit<Workflow, 'id'>;

export type WorkflowAction = 'started' | 'advanced' | 'returned' | 'reassigned' | 'completed';

export interface WorkflowEvent {
  id: string;
  at: string;
  action: WorkflowAction;
  actorId: string;
  actorName: string;
  fromStepId: string | null;
  toStepId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  comment: string;
}

/**
 * Estado del flujo dentro de una cotización. Los pasos se copian al iniciar:
 * cambiar la configuración no altera las cotizaciones que ya están en curso.
 */
export interface QuoteWorkflowState {
  workflowId: string;
  workflowName: string;
  steps: WorkflowStep[];
  /** null cuando el flujo terminó. */
  currentStepId: string | null;
  /** null si no hay nadie activo con el rol del paso. */
  assigneeId: string | null;
  enteredStepAt: string;
  completedAt: string | null;
  history: WorkflowEvent[];
}

export interface AssignmentContext {
  users: readonly User[];
  /** Tareas abiertas por persona, sin contar la cotización que se está moviendo. */
  openTasks: ReadonlyMap<string, number>;
  requesterId: string | null;
}

export interface WorkflowActor {
  id: string;
  name: string;
}

export interface WorkflowChange {
  now: string;
  eventId: string;
  actor: WorkflowActor;
  comment: string;
}

/** La persona con menos tareas abiertas; un empate se resuelve por nombre para ser predecible. */
export function pickLeastBusy(
  candidates: readonly Pick<User, 'id' | 'name'>[],
  openTasks: ReadonlyMap<string, number>,
): string | null {
  const sorted = [...candidates].sort(
    (a, b) =>
      (openTasks.get(a.id) ?? 0) - (openTasks.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'es'),
  );
  return sorted[0]?.id ?? null;
}

export function resolveAssignee(step: WorkflowStep, context: AssignmentContext): string | null {
  const active = context.users.filter((user) => user.active);
  if (step.assignment === 'requester') {
    const requester = active.find((user) => user.id === context.requesterId);
    if (requester) return requester.id;
  }
  const candidates = active.filter((user) => user.roleId === step.roleId);
  return pickLeastBusy(candidates, context.openTasks);
}

function nameOf(users: readonly User[], id: string | null): string | null {
  return users.find((user) => user.id === id)?.name ?? null;
}

function stepIndex(state: QuoteWorkflowState): number {
  if (state.currentStepId === null) throw new RuleError('workflow-finished');
  return state.steps.findIndex((step) => step.id === state.currentStepId);
}

export function currentStep(state: QuoteWorkflowState | null): WorkflowStep | null {
  if (!state || state.currentStepId === null) return null;
  return state.steps.find((step) => step.id === state.currentStepId) ?? null;
}

export function isOpenTask(state: QuoteWorkflowState | null): boolean {
  return state !== null && state.currentStepId !== null;
}

export function startWorkflow(
  workflow: Workflow,
  context: AssignmentContext,
  change: WorkflowChange,
): QuoteWorkflowState {
  const first = workflow.steps[0];
  if (!first) throw new RuleError('workflow-empty');
  const assigneeId = resolveAssignee(first, context);
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    steps: workflow.steps.map((step) => ({ ...step })),
    currentStepId: first.id,
    assigneeId,
    enteredStepAt: change.now,
    completedAt: null,
    history: [
      event(change, 'started', null, first.id, assigneeId, nameOf(context.users, assigneeId)),
    ],
  };
}

export function advanceWorkflow(
  state: QuoteWorkflowState,
  context: AssignmentContext,
  change: WorkflowChange,
): QuoteWorkflowState {
  const index = stepIndex(state);
  const from = state.currentStepId;
  const next = state.steps[index + 1];
  if (!next) {
    return {
      ...state,
      currentStepId: null,
      assigneeId: null,
      completedAt: change.now,
      history: [...state.history, event(change, 'completed', from, null, null, null)],
    };
  }
  const assigneeId = resolveAssignee(next, context);
  return moveTo(state, next.id, assigneeId, 'advanced', context, change);
}

/** Devuelve al paso anterior, a la última persona que lo atendió. Exige un motivo. */
export function returnWorkflow(
  state: QuoteWorkflowState,
  context: AssignmentContext,
  change: WorkflowChange,
): QuoteWorkflowState {
  if (!change.comment.trim()) throw new RuleError('comment-required');
  const index = stepIndex(state);
  const previous = state.steps[index - 1];
  if (!previous) throw new RuleError('first-step');
  const lastHandler = [...state.history]
    .reverse()
    .find((entry) => entry.toStepId === previous.id)?.assigneeId;
  const stillActive = context.users.some((user) => user.id === lastHandler && user.active);
  const assigneeId = stillActive ? (lastHandler ?? null) : resolveAssignee(previous, context);
  return moveTo(state, previous.id, assigneeId, 'returned', context, change);
}

export function reassignWorkflow(
  state: QuoteWorkflowState,
  assignee: User,
  change: WorkflowChange,
): QuoteWorkflowState {
  const from = state.currentStepId;
  stepIndex(state);
  if (!assignee.active) throw new RuleError('inactive-user');
  return {
    ...state,
    assigneeId: assignee.id,
    history: [
      ...state.history,
      event(change, 'reassigned', from, from, assignee.id, assignee.name),
    ],
  };
}

function moveTo(
  state: QuoteWorkflowState,
  stepId: string,
  assigneeId: string | null,
  action: WorkflowAction,
  context: AssignmentContext,
  change: WorkflowChange,
): QuoteWorkflowState {
  return {
    ...state,
    currentStepId: stepId,
    assigneeId,
    enteredStepAt: change.now,
    history: [
      ...state.history,
      event(
        change,
        action,
        state.currentStepId,
        stepId,
        assigneeId,
        nameOf(context.users, assigneeId),
      ),
    ],
  };
}

function event(
  change: WorkflowChange,
  action: WorkflowAction,
  fromStepId: string | null,
  toStepId: string | null,
  assigneeId: string | null,
  assigneeName: string | null,
): WorkflowEvent {
  return {
    id: change.eventId,
    at: change.now,
    action,
    actorId: change.actor.id,
    actorName: change.actor.name,
    fromStepId,
    toStepId,
    assigneeId,
    assigneeName,
    comment: change.comment.trim(),
  };
}

/** Cuenta las tareas abiertas de cada persona. */
export function countOpenTasks(
  states: readonly (QuoteWorkflowState | null)[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const state of states) {
    if (!isOpenTask(state) || !state?.assigneeId) continue;
    counts.set(state.assigneeId, (counts.get(state.assigneeId) ?? 0) + 1);
  }
  return counts;
}

export function defaultWorkflow(workflows: readonly Workflow[]): Workflow | null {
  const active = workflows.filter((workflow) => workflow.active && workflow.steps.length > 0);
  return active.find((workflow) => workflow.isDefault) ?? active[0] ?? null;
}
