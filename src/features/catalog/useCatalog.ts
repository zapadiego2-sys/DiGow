import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogSubItem,
  CatalogSubItemDraft,
} from '@/domain/catalog';
import type { ConditionsContent, NewConditionsTemplate } from '@/domain/conditions';
import type { CostFormula, CostFormulaDraft } from '@/domain/formula';
import { useServices } from '../services/ServicesContext';

const FORMULAS = ['formulas'];
const ITEMS = ['catalog-items'];
const SUB_ITEMS = ['catalog-subitems'];
const CONDITIONS = ['conditions'];

export function useFormulas() {
  const { formulaCatalog } = useServices();
  return useQuery({ queryKey: FORMULAS, queryFn: () => formulaCatalog.list() });
}

export function useSaveFormula() {
  const { formulaCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { formula: CostFormula | null; draft: CostFormulaDraft }) =>
      input.formula
        ? formulaCatalog.update({ ...input.formula, ...input.draft })
        : formulaCatalog.create(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FORMULAS }),
  });
}

export function useCatalogItems() {
  const { productCatalog } = useServices();
  return useQuery({ queryKey: ITEMS, queryFn: () => productCatalog.listItems() });
}

export function useCatalogSubItems() {
  const { productCatalog } = useServices();
  return useQuery({ queryKey: SUB_ITEMS, queryFn: () => productCatalog.listSubItems() });
}

export function useSaveCatalogItem() {
  const { productCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { item: CatalogItem | null; draft: CatalogItemDraft }) =>
      input.item
        ? productCatalog.updateItem({ ...input.item, ...input.draft })
        : productCatalog.createItem(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS }),
  });
}

export function useSaveCatalogSubItem() {
  const { productCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { subItem: CatalogSubItem | null; draft: CatalogSubItemDraft }) =>
      input.subItem
        ? productCatalog.updateSubItem({ ...input.subItem, ...input.draft })
        : productCatalog.createSubItem(input.draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUB_ITEMS }),
  });
}

export function useConditionsTemplates() {
  const { conditionsCatalog } = useServices();
  return useQuery({ queryKey: CONDITIONS, queryFn: () => conditionsCatalog.list() });
}

type ConditionsCommand =
  | { kind: 'create'; template: NewConditionsTemplate; actorId: string }
  | { kind: 'publish'; id: string; content: ConditionsContent; actorId: string }
  | { kind: 'rename'; id: string; name: string; active: boolean };

export function useConditionsCommand() {
  const { conditionsCatalog } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: ConditionsCommand) => {
      if (command.kind === 'create')
        return conditionsCatalog.create(command.template, command.actorId);
      if (command.kind === 'publish') {
        return conditionsCatalog.publish(command.id, command.content, command.actorId);
      }
      return conditionsCatalog.rename(command.id, command.name, command.active);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONDITIONS }),
  });
}
