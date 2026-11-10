import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { materialCost, materialNameKey, type Material } from '@/domain/material';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { Button, buttonClass } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useCan } from '../auth/useSession';
import { InternalPanel } from '../costing/InternalPanel';
import { QueryError } from '../services/QueryError';
import { MaterialDialog } from './MaterialDialog';
import { useMaterials } from './useMaterials';

export function MaterialsScreen() {
  const materials = useMaterials();
  const [editing, setEditing] = useState<{ material: Material | null } | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = materialNameKey(useDeferredValue(search));
  const canManage = useCan('materials.manage');
  const visible = (materials.data ?? []).filter((m) =>
    materialNameKey(`${m.name} ${m.supplier}`).includes(deferredSearch),
  );

  const columns: DataTableColumn<Material>[] = [
    { key: 'name', header: 'Material', cell: (m) => m.name },
    { key: 'supplier', header: 'Proveedor', cell: (m) => m.supplier || '—' },
    {
      key: 'price',
      header: 'Precio de compra',
      numeric: true,
      cell: (m) => (m.pricing.mode === 'factor' ? formatMoney(m.pricing.purchasePrice) : '—'),
    },
    {
      key: 'factor',
      header: 'Factor',
      numeric: true,
      cell: (m) => (m.pricing.mode === 'factor' ? formatNumber(m.pricing.factor) : '—'),
    },
    {
      key: 'area',
      header: 'Lámina (cm²)',
      numeric: true,
      cell: (m) => (m.pricing.mode === 'factor' ? formatNumber(m.pricing.sheetAreaCm2) : '—'),
    },
    { key: 'cost', header: 'Costo', numeric: true, cell: (m) => formatNumber(materialCost(m)) },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Acciones',
      cell: (m) => (
        <Button onClick={() => setEditing({ material: m })} aria-label={`Editar ${m.name}`}>
          Editar
        </Button>
      ),
    });
  }

  const addButton = canManage ? (
    <div className="flex flex-wrap gap-sm">
      <Link to="/materiales/cargar" className={buttonClass('secondary')}>
        <Icon name="upload" />
        Cargar desde Excel
      </Link>
      <Button variant="primary" onClick={() => setEditing({ material: null })}>
        <Icon name="plus" />
        Nuevo material
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-lg">
      <title>Materiales · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-display">Materiales</h1>
          <p className="text-body-sm text-text-muted">
            El inventario que usan las hojas de costos y las sugerencias.
          </p>
        </div>
        {addButton}
      </header>

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Buscar">
          {(control) => (
            <Input
              {...control}
              type="search"
              placeholder="Material o proveedor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </FormField>
      </div>

      {materials.isPending ? (
        <div className="flex flex-col gap-sm" aria-busy="true">
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
        </div>
      ) : materials.isError ? (
        <QueryError error={materials.error} onRetry={() => void materials.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={materials.data.length === 0 ? 'Sin materiales' : 'Sin resultados'}
          description={
            materials.data.length === 0
              ? 'Agrega un material o cárgalos desde Excel para usar su costo en las hojas de costos.'
              : 'Ningún material coincide con la búsqueda.'
          }
        />
      ) : (
        <InternalPanel title="Precios y factores">
          <DataTable
            caption="Catálogo de materiales"
            columns={columns}
            rows={visible}
            rowKey={(m) => m.id}
          />
        </InternalPanel>
      )}

      <MaterialDialog
        open={editing !== null}
        material={editing?.material ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
