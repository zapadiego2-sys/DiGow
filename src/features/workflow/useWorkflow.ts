import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Workflow, WorkflowDraft } from '@/domain/workflow';
import { useServices } from '../services/ServicesContext';

const WORKFLOWS = ['workflows'];
const WORKLOAD = ['workload'];

export function useWorkflows() {
  const { workflowCatalog } = useServices();
  return useQuery({ queryKey: WORKFLOWS, queryFn: () => workflowCatalog.list() });
}

export function useSaveWorkflow() {
  const { workflowCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string | null; draft: WorkflowDraft }) =>
      input.id
        ? workflowCatalog.update({ ...input.draft, id: input.id } satisfies Workflow)
        : workflowCatalog.create(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKFLOWS }),
  });
}

export function useWorkload() {
  const { quoteWorkflow } = useServices();
  return useQuery({ queryKey: WORKLOAD, queryFn: () => quoteWorkflow.workload() });
}

type WorkflowCommand =
  | { kind: 'start'; quoteId: string; actorId: string; workflowId: string | null }
  | { kind: 'advance'; quoteId: string; actorId: string; comment: string }
  | { kind: 'sendBack'; quoteId: string; actorId: string; comment: string }
  | { kind: 'reassign'; quoteId: string; actorId: string; assigneeId: string };

/** Un solo punto para mover el flujo: todas las acciones refrescan cotizaciones y carga. */
export function useWorkflowCommand() {
  const { quoteWorkflow } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: WorkflowCommand) => {
      switch (command.kind) {
        case 'start':
          return quoteWorkflow.start(command.quoteId, command.actorId, command.workflowId);
        case 'advance':
          return quoteWorkflow.advance(command.quoteId, command.actorId, command.comment);
        case 'sendBack':
          return quoteWorkflow.sendBack(command.quoteId, command.actorId, command.comment);
        case 'reassign':
          return quoteWorkflow.reassign(command.quoteId, command.actorId, command.assigneeId);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quotes'] });
      await queryClient.invalidateQueries({ queryKey: WORKLOAD });
    },
  });
}
