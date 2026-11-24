import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  productKinds,
  type CatalogItem,
  type CatalogItemDraft,
  type CatalogSubItem,
  type CatalogSubItemDraft,
} from '@/domain/catalog';
import { formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import {
  useCatalogItems,
  useCatalogSubItems,
  useSaveCatalogItem,
  useSaveCatalogSubItem,
} from '../catalog/useCatalog';
import {
  CheckboxField,
  NumericField,
  SelectField,
  TextAreaField,
  TextField,
} from '../forms/fields';
import { PRODUCT_KIND_OPTIONS, productKindLabel } from '../catalog/productLabels';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';

const UNLINKED = 'none';

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.'),
  description: z.string().trim(),
  kind: z.enum(productKinds, 'Elige el tipo de producto.'),
  predictive: z.boolean(),
  active: z.boolean(),
});

const subItemSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.'),
  description: z.string().trim(),
  parentItemId: z.string(),
  defaultQuantity: z.number('Escribe un número.').positive('Debe ser mayor que 0.'),
  predictive: z.boolean(),
  active: z.boolean(),
});

type SubItemForm = Omit<CatalogSubItemDraft, 'parentItemId'> & { parentItemId: string };

const PREDICTIVE_HINT =
  'Sin la marca, no se usa como referencia ni recibe sugerencias del modelo predictivo.';

function DialogActions({
  onClose,
  label,
  pending,
}: {
  onClose: () => void;
  label: string;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancelar</Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {label}
      </Button>
    </div>
  );
}

function ItemDialog({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const save = useSaveCatalogItem();
  const toast = useToast();
  const form = useForm<CatalogItemDraft>({
    resolver: zodResolver(itemSchema) as never,
    defaultValues: item ?? {
      name: '',
      description: '',
      kind: 'internal',
      predictive: true,
      active: true,
    },
  });
  const submit = form.handleSubmit(async (draft) => {
    try {
      await save.mutateAsync({ item, draft });
      toast({ tone: 'success', text: item ? 'Producto guardado.' : 'Producto creado.' });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  });
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={item ? `Editar ${item.name}` : 'Nuevo producto'}
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextAreaField name="description" label="Descripción (opcional)" />
          <SelectField name="kind" label="Tipo de producto" options={PRODUCT_KIND_OPTIONS} />
          <CheckboxField
            name="predictive"
            label="Aplica para el modelo predictivo"
            hint={PREDICTIVE_HINT}
          />
          <CheckboxField
            name="active"
            label="Activo"
            hint="Un producto inactivo no se ofrece al cotizar."
          />
          <DialogActions
            onClose={onClose}
            label={item ? 'Guardar producto' : 'Crear producto'}
            pending={save.isPending}
          />
        </form>
      </FormProvider>
    </Dialog>
  );
}

function SubItemDialog({
  subItem,
  items,
  onClose,
}: {
  subItem: CatalogSubItem | null;
  items: readonly CatalogItem[];
  onClose: () => void;
}) {
  const save = useSaveCatalogSubItem();
  const toast = useToast();
  const form = useForm<SubItemForm>({
    resolver: zodResolver(subItemSchema) as never,
    defaultValues: subItem
      ? { ...subItem, parentItemId: subItem.parentItemId ?? UNLINKED }
      : {
          name: '',
          description: '',
          parentItemId: UNLINKED,
          defaultQuantity: 1,
          predictive: true,
          active: true,
        },
  });
  const submit = form.handleSubmit(async ({ parentItemId, ...values }) => {
    try {
      await save.mutateAsync({
        subItem,
        draft: { ...values, parentItemId: parentItemId === UNLINKED ? null : parentItemId },
      });
      toast({ tone: 'success', text: subItem ? 'Sub-ítem guardado.' : 'Sub-ítem creado.' });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  });
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={subItem ? `Editar ${subItem.name}` : 'Nuevo sub-ítem'}
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextAreaField name="description" label="Descripción (opcional)" />
          <SelectField
            name="parentItemId"
            label="Ligado a"
            options={[
              { value: UNLINKED, label: 'Desligado: se puede usar en cualquier ítem' },
              ...items.map((item) => ({ value: item.id, label: item.name })),
            ]}
            hint="Un sub-ítem ligado se agrega solo al elegir ese producto en una cotización."
          />
          <NumericField name="defaultQuantity" label="Cantidad por unidad del ítem" />
          <CheckboxField
            name="predictive"
            label="Aplica para el modelo predictivo"
            hint={PREDICTIVE_HINT}
          />
          <CheckboxField name="active" label="Activo" />
          <DialogActions
            onClose={onClose}
            label={subItem ? 'Guardar sub-ítem' : 'Crear sub-ítem'}
            pending={save.isPending}
          />
        </form>
      </FormProvider>
    </Dialog>
  );
}

const flags = (row: { predictive: boolean; active: boolean }) => (
  <span className="flex flex-wrap justify-end gap-xs md:justify-start">
    {row.predictive ? (
      <Badge tone="info">Predictivo</Badge>
    ) : (
      <Badge tone="neutral">No predictivo</Badge>
    )}
    {row.active ? null : <Badge tone="neutral">Inactivo</Badge>}
  </span>
);

export function CatalogScreen() {
  const items = useCatalogItems();
  const subItems = useCatalogSubItems();
  const [editingItem, setEditingItem] = useState<{ item: CatalogItem | null } | null>(null);
  const [editingSub, setEditingSub] = useState<{ subItem: CatalogSubItem | null } | null>(null);
  const itemName = (id: string | null) =>
    id ? (items.data?.find((item) => item.id === id)?.name ?? '—') : 'Desligado';

  const itemColumns: DataTableColumn<CatalogItem>[] = [
    {
      key: 'name',
      header: 'Producto',
      cell: (item) => (
        <span className="flex flex-col">
          <span className="text-label">{item.name}</span>
          <span className="text-caption text-text-muted">{item.description}</span>
        </span>
      ),
    },
    { key: 'kind', header: 'Tipo', cell: (item) => productKindLabel(item.kind) },
    {
      key: 'subs',
      header: 'Sub-ítems ligados',
      numeric: true,
      cell: (item) => (subItems.data ?? []).filter((sub) => sub.parentItemId === item.id).length,
    },
    { key: 'flags', header: 'Marcas', cell: flags },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (item) => (
        <Button aria-label={`Editar ${item.name}`} onClick={() => setEditingItem({ item })}>
          <Icon name="edit" />
          Editar
        </Button>
      ),
    },
  ];

  const subColumns: DataTableColumn<CatalogSubItem>[] = [
    { key: 'name', header: 'Sub-ítem', cell: (sub) => sub.name },
    { key: 'parent', header: 'Ligado a', cell: (sub) => itemName(sub.parentItemId) },
    {
      key: 'qty',
      header: 'Cantidad',
      numeric: true,
      cell: (sub) => formatNumber(sub.defaultQuantity),
    },
    { key: 'flags', header: 'Marcas', cell: flags },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (sub) => (
        <Button aria-label={`Editar ${sub.name}`} onClick={() => setEditingSub({ subItem: sub })}>
          <Icon name="edit" />
          Editar
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-lg">
      <title>Catálogo de productos · Cotizador</title>
      <header className="flex flex-col">
        <h2 id="catalog-heading" className="text-title">
          Catálogo de productos
        </h2>
        <p className="text-body-sm text-text-muted">
          Productos clasificados como internos, externos o híbridos, y sus sub-ítems. La marca
          predictiva decide qué usa la sugerencia de costos.
        </p>
      </header>

      {items.isPending || subItems.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : items.isError ? (
        <QueryError error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <>
          <Card className="flex flex-col gap-md" aria-labelledby="items-catalog-heading">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <h3 id="items-catalog-heading" className="text-subtitle">
                Productos ({items.data.length})
              </h3>
              <Button variant="primary" onClick={() => setEditingItem({ item: null })}>
                <Icon name="plus" />
                Nuevo producto
              </Button>
            </div>
            <DataTable
              caption="Productos"
              columns={itemColumns}
              rows={items.data}
              rowKey={(i) => i.id}
            />
          </Card>
          <Card className="flex flex-col gap-md" aria-labelledby="subs-catalog-heading">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <h3 id="subs-catalog-heading" className="text-subtitle">
                Sub-ítems ({subItems.data?.length ?? 0})
              </h3>
              <Button onClick={() => setEditingSub({ subItem: null })}>
                <Icon name="plus" />
                Nuevo sub-ítem
              </Button>
            </div>
            <DataTable
              caption="Sub-ítems"
              columns={subColumns}
              rows={subItems.data ?? []}
              rowKey={(s) => s.id}
            />
          </Card>
        </>
      )}
      {editingItem ? (
        <ItemDialog
          key={editingItem.item?.id ?? 'nuevo'}
          item={editingItem.item}
          onClose={() => setEditingItem(null)}
        />
      ) : null}
      {editingSub ? (
        <SubItemDialog
          key={editingSub.subItem?.id ?? 'nuevo'}
          subItem={editingSub.subItem}
          items={items.data ?? []}
          onClose={() => setEditingSub(null)}
        />
      ) : null}
    </section>
  );
}
