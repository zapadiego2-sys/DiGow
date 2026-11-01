import { useState } from 'react';
import { materialCost, type Material } from '@/domain/material';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { InternalPanel } from '../costing/InternalPanel';
import { QueryError } from '../services/QueryError';
import { MaterialDialog } from './MaterialDialog';
import { useMaterials } from './useMaterials';

export function MaterialsScreen() {
  const materials = useMaterials();
  const [editing, setEditing] = useState<{ material: Material | null } | null>(null);

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
    {
      key: 'actions',
      header: 'Acciones',
      cell: (m) => (
        <Button onClick={() => setEditing({ material: m })} aria-label={`Editar ${m.name}`}>
          Editar
        </Button>
      ),
    },
  ];

  const addButton = (
    <Button variant="primary" onClick={() => setEditing({ material: null })}>
      <Icon name="plus" />
      Nuevo material
    </Button>
  );

  return (
    <div className="flex flex-col gap-lg">
      <title>Materiales · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-display">Materiales</h1>
        {addButton}
      </header>

      {materials.isPending ? (
        <div className="flex flex-col gap-sm" aria-busy="true">
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-2xl w-full" />
        </div>
      ) : materials.isError ? (
        <QueryError error={materials.error} onRetry={() => void materials.refetch()} />
      ) : materials.data.length === 0 ? (
        <EmptyState
          title="Sin materiales"
          description="Agrega un material para usar su costo en las hojas de costos."
        />
      ) : (
        <InternalPanel title="Precios y factores">
          <DataTable
            caption="Catálogo de materiales"
            columns={columns}
            rows={materials.data}
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
