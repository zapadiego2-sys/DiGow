import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { materialCost, materialNameKey, type Material } from '@/domain/material';
import type { MaterialImportRow } from '@/domain/ports';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonClass } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { Icon } from '@/shared/ui/Icon';
import { Notice } from '@/shared/ui/Notice';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { InternalPanel } from '../costing/InternalPanel';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';
import { useMaterials } from './useMaterials';

function rowStatus(row: MaterialImportRow, existing: readonly Material[]) {
  if (!row.draft) return <Badge tone="danger">Con errores</Badge>;
  const found = existing.some((m) => materialNameKey(m.name) === materialNameKey(row.name));
  return found ? <Badge tone="info">Actualiza</Badge> : <Badge tone="success">Nuevo</Badge>;
}

function pricingText(row: MaterialImportRow): string {
  const pricing = row.draft?.pricing;
  if (!pricing) return '—';
  if (pricing.mode === 'direct') return `Costo directo ${formatNumber(pricing.unitCost)}`;
  const sheet = pricing.sheetAreaCm2 ? ` · lámina ${formatNumber(pricing.sheetAreaCm2)} cm²` : '';
  return `${formatMoney(pricing.purchasePrice)} / ${formatNumber(pricing.factor)}${sheet}`;
}

/** El analista revisa cada fila antes de cargar: nada se guarda sin confirmar. */
export function MaterialImportScreen() {
  const { materialImporter, materialCatalog } = useServices();
  const materials = useMaterials();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const read = useMutation({
    mutationFn: async (file: File) => ({
      fileName: file.name,
      result: await materialImporter.read(file),
    }),
  });
  const save = useMutation({
    mutationFn: (rows: MaterialImportRow[]) =>
      materialCatalog.importMany(rows.flatMap((row) => (row.draft ? [row.draft] : []))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });
  const download = useMutation({
    mutationFn: async () => {
      const blob = await materialImporter.template();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla-materiales.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
  });

  const preview = read.data;
  const rows = preview?.result.rows ?? [];
  const valid = rows.filter((row) => row.draft);
  const invalid = rows.length - valid.length;

  const columns: DataTableColumn<MaterialImportRow>[] = [
    { key: 'row', header: 'Fila', numeric: true, cell: (row) => row.row },
    { key: 'name', header: 'Material', cell: (row) => row.name || '—' },
    { key: 'status', header: 'Estado', cell: (row) => rowStatus(row, materials.data ?? []) },
    { key: 'pricing', header: 'Precio y factor', cell: pricingText },
    {
      key: 'cost',
      header: 'Costo',
      numeric: true,
      cell: (row) => (row.draft ? formatNumber(materialCost(row.draft)) : '—'),
    },
    {
      key: 'errors',
      header: 'Observaciones',
      cell: (row) =>
        row.errors.length ? (
          <ul className="flex flex-col gap-xs text-danger">
            {row.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <title>Cargar materiales · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-display">Cargar materiales desde Excel</h1>
        <Link to="/materiales" className={buttonClass('secondary')}>
          <Icon name="arrowLeft" />
          Volver al catálogo
        </Link>
      </header>

      <label htmlFor="materials-file" className="sr-only">
        Archivo de materiales en formato .xlsx
      </label>
      <input
        ref={inputRef}
        id="materials-file"
        type="file"
        accept=".xlsx"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) read.mutate(file);
        }}
      />

      <Card className="flex flex-col gap-md" aria-label="Elegir archivo">
        <ol className="flex list-decimal flex-col gap-xs pl-lg text-body-sm">
          <li>Descarga la plantilla y escribe un material por fila.</li>
          <li>
            Usa precio de compra y factor, o costo directo. El área de la lámina es opcional y deja
            el costo por cm².
          </li>
          <li>
            Elige el archivo y revisa la vista previa. Un material con el mismo nombre se actualiza.
          </li>
        </ol>
        <div className="flex flex-wrap gap-sm">
          <Button disabled={download.isPending} onClick={() => download.mutate()}>
            <Icon name="download" />
            Descargar plantilla
          </Button>
          <Button disabled={read.isPending} onClick={() => inputRef.current?.click()}>
            <Icon name="upload" />
            {read.isPending
              ? 'Leyendo el archivo…'
              : preview
                ? 'Elegir otro archivo'
                : 'Elegir archivo'}
          </Button>
        </div>
      </Card>

      {read.isError ? (
        <Notice tone="danger" title="No se pudo leer el archivo">
          <p>{errorMessage(read.error)}</p>
        </Notice>
      ) : null}
      {read.isPending ? <Skeleton className="h-photo w-full" /> : null}

      {preview && !read.isPending ? (
        <>
          {preview.result.warnings.length > 0 ? (
            <Notice tone="warning" title="Revisa estos avisos">
              <ul className="flex list-disc flex-col gap-xs pl-md">
                {preview.result.warnings.map((warning) => (
                  <li key={warning.message}>{warning.message}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <InternalPanel title={`Vista previa de ${preview.fileName}`}>
            <p className="text-body-sm">
              {valid.length === 1 ? '1 material listo' : `${valid.length} materiales listos`}
              {invalid > 0
                ? ` y ${invalid === 1 ? '1 fila' : `${invalid} filas`} con errores, que no se cargarán`
                : ''}
              .
            </p>
            {rows.length > 0 ? (
              <DataTable
                caption="Vista previa de materiales"
                columns={columns}
                rows={rows}
                rowKey={(r) => String(r.row)}
              />
            ) : null}
          </InternalPanel>
          <div className="flex flex-wrap justify-end gap-sm">
            <Button
              variant="primary"
              disabled={valid.length === 0 || save.isPending}
              onClick={() =>
                save.mutate(rows, {
                  onSuccess: async ({ created, updated }) => {
                    toast({
                      tone: 'success',
                      text: `Carga lista: ${created} nuevos y ${updated} actualizados.`,
                    });
                    await navigate('/materiales');
                  },
                  onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
                })
              }
            >
              {save.isPending
                ? 'Cargando…'
                : `Cargar ${valid.length === 1 ? '1 material' : `${valid.length} materiales`}`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
