import { permissionsOf } from '@/domain/access';
import { RepositoryError, RuleError } from '@/domain/errors';
import type { QuoteWorkflowService, TemplateCatalog, WorkflowCatalog } from '@/domain/ports';
import { withWorkflowState, type Quote } from '@/domain/quote';
import type { QuoteTemplate, QuoteTemplateDraft } from '@/domain/template';
import { gateProblems } from '@/domain/gates';
import {
  advanceWorkflow,
  currentStep,
  countOpenTasks,
  defaultWorkflow,
  reassignWorkflow,
  returnWorkflow,
  startWorkflow,
  type AssignmentContext,
  type QuoteWorkflowState,
  type Workflow,
  type WorkflowChange,
  type WorkflowDraft,
} from '@/domain/workflow';
import { createId } from '@/shared/lib/id';
import { sessionFor, type AccessCollections } from './accessRepositories';
import { simulate, type MockBehavior } from './behavior';
import { byName, MockCrud } from './crud';
import type { VersionedCollection } from './storage';

export class MockWorkflowCatalog
  extends MockCrud<Workflow, WorkflowDraft>
  implements WorkflowCatalog
{
  constructor(items: VersionedCollection<Workflow>, behavior: MockBehavior) {
    super({ items, behavior, build: (draft, id) => ({ ...draft, id }), compare: byName });
  }

  /** Siempre queda exactamente un flujo por defecto, activo y con pasos. */
  protected override prepare(workflow: Workflow, all: Workflow[]): Workflow[] {
    if (workflow.steps.length === 0) throw new RuleError('workflow-empty');
    if (workflow.isDefault && !workflow.active) throw new RuleError('default-required');
    const others = all.filter((w) => w.id !== workflow.id);
    if (!workflow.isDefault && !others.some((w) => w.isDefault)) {
      throw new RuleError('default-required');
    }
    if (!workflow.isDefault) return all;
    return all.map((w) => (w.id === workflow.id ? w : { ...w, isDefault: false }));
  }
}

export class MockTemplateCatalog
  extends MockCrud<QuoteTemplate, QuoteTemplateDraft>
  implements TemplateCatalog
{
  constructor(items: VersionedCollection<QuoteTemplate>, behavior: MockBehavior) {
    super({ items, behavior, build: (draft, id) => ({ ...draft, id }), compare: byName });
  }
}

export class MockQuoteWorkflowService implements QuoteWorkflowService {
  private readonly quotes: VersionedCollection<Quote>;
  private readonly access: AccessCollections;
  private readonly behavior: MockBehavior;

  constructor(
    quotes: VersionedCollection<Quote>,
    access: AccessCollections,
    behavior: MockBehavior,
  ) {
    this.quotes = quotes;
    this.access = access;
    this.behavior = behavior;
  }

  start(quoteId: string, actorId: string, workflowId: string | null): Promise<Quote> {
    return this.change(quoteId, actorId, '', (_quote, context, change) => {
      const workflows = this.access.workflows.read();
      const workflow = workflowId
        ? workflows.find((w) => w.id === workflowId && w.active && w.steps.length > 0)
        : null;
      const chosen = workflow ?? defaultWorkflow(workflows);
      if (!chosen) throw new RuleError('workflow-empty');
      return startWorkflow(chosen, context, change);
    });
  }

  /** No avanza si falta algo de lo que exige el paso, como medidas o costos completos. */
  advance(quoteId: string, actorId: string, comment: string): Promise<Quote> {
    return this.change(quoteId, actorId, comment, (quote, context, change) => {
      const state = this.ownedBy(quote, actorId);
      const problems = gateProblems(currentStep(state)?.gate ?? 'none', quote);
      if (problems.length > 0) throw new RuleError('gate-incomplete', problems);
      return advanceWorkflow(state, context, change);
    });
  }

  sendBack(quoteId: string, actorId: string, comment: string): Promise<Quote> {
    return this.change(quoteId, actorId, comment, (quote, context, change) =>
      returnWorkflow(this.ownedBy(quote, actorId), context, change),
    );
  }

  reassign(quoteId: string, actorId: string, assigneeId: string): Promise<Quote> {
    return this.change(quoteId, actorId, '', (quote, _context, change) => {
      if (!this.canManage(actorId)) throw new RuleError('not-assignee');
      const assignee = this.access.users.read().find((u) => u.id === assigneeId);
      if (!assignee || !quote.workflow) throw new RepositoryError('not-found');
      return reassignWorkflow(quote.workflow, assignee, change);
    });
  }

  workload(): Promise<Record<string, number>> {
    return simulate(this.behavior, () =>
      Object.fromEntries(countOpenTasks(this.quotes.read().map((q) => q.workflow))),
    );
  }

  private canManage(actorId: string): boolean {
    const session = sessionFor(this.access, actorId);
    return session !== null && permissionsOf(session.role).includes('workflow.manage');
  }

  /** Solo el responsable del paso, o quien gestiona los flujos, puede moverlo. */
  private ownedBy(quote: Quote, actorId: string): QuoteWorkflowState {
    if (!quote.workflow) throw new RuleError('workflow-finished');
    if (quote.workflow.assigneeId !== actorId && !this.canManage(actorId)) {
      throw new RuleError('not-assignee');
    }
    return quote.workflow;
  }

  private change(
    quoteId: string,
    actorId: string,
    comment: string,
    apply: (quote: Quote, context: AssignmentContext, change: WorkflowChange) => QuoteWorkflowState,
  ): Promise<Quote> {
    return simulate(this.behavior, () => {
      const all = this.quotes.read();
      const quote = all.find((q) => q.id === quoteId);
      if (!quote) throw new RepositoryError('not-found');
      const actor = sessionFor(this.access, actorId)?.user;
      if (!actor) throw new RuleError('inactive-user');
      const context: AssignmentContext = {
        users: this.access.users.read(),
        openTasks: countOpenTasks(all.filter((q) => q.id !== quoteId).map((q) => q.workflow)),
        requesterId: quote.createdBy,
      };
      const now = new Date().toISOString();
      const change: WorkflowChange = {
        now,
        eventId: createId(),
        actor: { id: actor.id, name: actor.name },
        comment,
      };
      const updated: Quote = {
        ...withWorkflowState(quote, apply(quote, context, change)),
        updatedAt: now,
      };
      this.quotes.write(all.map((q) => (q.id === quoteId ? updated : q)));
      return updated;
    });
  }
}
