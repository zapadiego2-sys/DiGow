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

/**
 * Lo que recibe quien no tiene el permiso de costos: sin hojas de costos ni notas internas.
 * El precio de venta se conserva para que el asesor vea, sin editar, lo que se envía al cliente.
 */
export function withoutCosts(quote: Quote): Quote {
  return {
    ...quote,
    items: quote.items.map((item) => ({
      ...item,
      costLines: [],
      internalNotes: [],
      subItems: item.subItems.map((sub) => ({ ...sub, costLines: [] })),
    })),
  };
}

/**
 * Une lo que editó alguien sin permiso de costos con lo guardado: los costos, los precios,
 * las notas internas y el IVA quedan como estaban. Un ítem nuevo llega sin costos ni precio.
 */
export function mergeRestrictedEdit(stored: Quote, edited: Quote): Quote {
  return {
    ...edited,
    vatRate: stored.vatRate,
    items: edited.items.map((item) => {
      const before = stored.items.find((candidate) => candidate.id === item.id);
      return {
        ...item,
        unitPrice: before?.unitPrice ?? null,
        costLines: before?.costLines ?? [],
        internalNotes: before?.internalNotes ?? [],
        subItems: item.subItems.map((sub) => ({
          ...sub,
          costLines: before?.subItems.find((candidate) => candidate.id === sub.id)?.costLines ?? [],
        })),
      };
    }),
  };
}
