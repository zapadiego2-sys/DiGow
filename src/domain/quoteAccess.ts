import { can, type Session } from './access';
import { isParticipant, type Quote } from './quote';
import { isOpenTask, type QuoteWorkflowState } from './workflow';

export function canViewQuote(quote: Quote, session: Session): boolean {
  return can(session, 'quotes.viewAll') || isParticipant(quote, session.user.id);
}

/**
 * Mientras el flujo está abierto solo edita el responsable del paso. Sin flujo, o al terminar,
 * edita quien la creó. `quotes.editAll` puede editar siempre.
 */
export function canEditQuote(quote: Quote, session: Session): boolean {
  if (can(session, 'quotes.editAll')) return true;
  if (isOpenTask(quote.workflow)) return quote.workflow?.assigneeId === session.user.id;
  return quote.createdBy === session.user.id;
}

export function canMoveWorkflow(state: QuoteWorkflowState, session: Session): boolean {
  if (!isOpenTask(state)) return false;
  return state.assigneeId === session.user.id || can(session, 'workflow.manage');
}
