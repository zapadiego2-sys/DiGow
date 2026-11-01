import { useMemo, useState, type ComponentType } from 'react';
import {
  useController,
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import {
  applyMaterialCost,
  changeLineKind,
  createCostLine,
  lineCost,
  linesCost,
  type CostLine,
  type CostLineKind,
} from '@/domain/cost';
import { materialCost } from '@/domain/material';
import { parseMeasureTerms } from '@/domain/measure';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { Button, IconButton } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { CurrencyField, LinesField, NumericField, TextField } from '../forms/fields';
import { useMaterials } from '../materials/useMaterials';
import { CostSuggestions } from './CostSuggestions';
import { InternalPanel, InternalRow } from './InternalPanel';

const KIND_LABELS: Record<CostLineKind, string> = {
  unit: 'Por unidad',
  area: 'Por área',
  labor: 'Mano de obra',
  fixed: 'Valor directo',
};

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as CostLineKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

const NO_MATERIAL = 'none';

function AreasField({ name }: { name: string }) {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ control, name });
  const areas = (field.value ?? []) as number[];
  const [text, setText] = useState(areas.join(' + '));
  const error =
    fieldState.error?.message ??
    (fieldState.error && 'Escribe las áreas como números o una suma de medidas.');

  return (
    <FormField
      label="Áreas en cm²"
      hint={`Un valor o una suma, como 100×90 + 2×90×90. Total: ${formatNumber(areas.reduce((a, b) => a + b, 0))} cm²`}
      error={error}
    >
      {(fieldControl) => (
        <Input
          {...fieldControl}
          name={field.name}
          ref={field.ref}
          inputMode="text"
          value={text}
          onBlur={field.onBlur}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            // Un texto que no se puede sumar queda como NaN: la validación impide guardarlo.
            field.onChange(next.trim() ? (parseMeasureTerms(next) ?? [Number.NaN]) : []);
          }}
        />
      )}
    </FormField>
  );
}

/** Campos propios de cada tipo. Un tipo nuevo solo agrega una entrada aquí. */
const KIND_FIELDS: Record<CostLineKind, ComponentType<{ path: string }>> = {
  unit: ({ path }) => (
    <>
      <NumericField name={`${path}.quantity`} label="Cantidad" />
      <CurrencyField name={`${path}.unitCost`} label="Costo unitario" />
    </>
  ),
  area: ({ path }) => (
    <>
      <AreasField name={`${path}.areasCm2`} />
      <NumericField name={`${path}.costPerCm2`} label="Costo por cm²" />
    </>
  ),
  labor: ({ path }) => (
    <>
      <NumericField name={`${path}.days`} label="Días" />
      <NumericField name={`${path}.people`} label="Personas" />
      <CurrencyField name={`${path}.dailyRate`} label="Tarifa diaria" />
    </>
  ),
  fixed: ({ path }) => <CurrencyField name={`${path}.value`} label="Valor" />,
};

interface CostLineEditorProps {
  path: string;
  onReplace: (line: CostLine) => void;
  onRemove: () => void;
}

function CostLineEditor({ path, onReplace, onRemove }: CostLineEditorProps) {
  const line = useWatch({ name: path }) as CostLine;
  const materials = useMaterials();
  const [confirming, setConfirming] = useState(false);
  const Fields = KIND_FIELDS[line.kind];

  const materialOptions = useMemo(
    () => [
      { value: NO_MATERIAL, label: 'Sin material' },
      ...(materials.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    ],
    [materials.data],
  );
  const selectedMaterial = materials.data?.some((m) => m.id === line.materialId)
    ? (line.materialId as string)
    : NO_MATERIAL;

  const selectMaterial = (id: string) => {
    if (id === NO_MATERIAL) {
      onReplace({ ...line, materialId: null });
      return;
    }
    const material = materials.data?.find((m) => m.id === id);
    if (!material) return;
    const updated = applyMaterialCost(line, material.id, materialCost(material));
    onReplace({ ...updated, label: line.label || material.name });
  };

  return (
    <div className="flex flex-col gap-md rounded-md border border-internal p-md">
      <div className="flex items-start gap-sm">
        <div className="min-w-0 flex-1">
          <TextField name={`${path}.label`} label="Línea" />
        </div>
        <IconButton
          label={`Quitar línea ${line.label}`}
          onClick={() => setConfirming(true)}
          className="mt-lg"
        >
          <Icon name="trash" />
        </IconButton>
      </div>
      <div className="grid gap-md sm:grid-cols-2">
        <FormField label="Tipo">
          {(control) => (
            <Select
              {...control}
              value={line.kind}
              options={KIND_OPTIONS}
              onValueChange={(kind) => onReplace(changeLineKind(line, kind))}
            />
          )}
        </FormField>
        <FormField label="Material">
          {(control) => (
            <Select
              {...control}
              value={selectedMaterial}
              options={materialOptions}
              onValueChange={selectMaterial}
            />
          )}
        </FormField>
        <Fields key={line.kind} path={path} />
      </div>
      <TextField name={`${path}.note`} label="Nota" />
      <InternalRow label="Costo de la línea" value={formatMoney(lineCost(line))} />
      <ConfirmDialog
        open={confirming}
        title="¿Quitar esta línea?"
        description={`Se quitará "${line.label || 'línea sin nombre'}" de la hoja de costos al guardar.`}
        confirmLabel="Quitar línea"
        cancelLabel="Cancelar"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    </div>
  );
}

export function CostSheet({ itemPath }: { itemPath: string }) {
  const { control, setValue } = useFormContext();
  const linesPath = `${itemPath}.costLines`;
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: linesPath,
    keyName: 'fieldKey',
  });
  const lines = (useWatch({ name: linesPath }) ?? []) as CostLine[];
  const unitPrice = useWatch({ name: `${itemPath}.unitPrice` }) as number | null;
  const { errors } = useFormState({ control, name: linesPath });
  const [open, setOpen] = useState(false);

  const cost = linesCost(lines);
  const hasErrors = linesPath
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], errors);
  const expanded = open || Boolean(hasErrors);

  return (
    <InternalPanel title="Hoja de costos">
      <InternalRow label="Costo de referencia" value={formatMoney(cost)} />
      <InternalRow label="Precio de venta" value={formatMoney(unitPrice ?? null)} />
      <InternalRow
        label="Utilidad"
        value={unitPrice === null ? '—' : formatMoney(unitPrice - cost)}
        strong
      />
      <div className="flex flex-wrap gap-sm">
        <Button aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
          {expanded
            ? 'Ocultar líneas'
            : lines.length === 1
              ? 'Ver 1 línea de costo'
              : `Ver ${lines.length} líneas de costo`}
        </Button>
        <Button
          onClick={() =>
            setValue(`${itemPath}.unitPrice`, cost, { shouldDirty: true, shouldValidate: true })
          }
        >
          Usar el costo como precio
        </Button>
      </div>
      <CostSuggestions
        itemPath={itemPath}
        existingLines={lines}
        onAccept={(accepted) => {
          append(accepted);
          setOpen(true);
        }}
      />
      {expanded ? (
        <div className="flex flex-col gap-md">
          {fields.map((field, index) => (
            <CostLineEditor
              key={field.fieldKey}
              path={`${linesPath}.${index}`}
              onReplace={(line) => update(index, line)}
              onRemove={() => remove(index)}
            />
          ))}
          <Button onClick={() => append(createCostLine(createId()))}>
            <Icon name="plus" />
            Agregar línea
          </Button>
          <LinesField
            name={`${itemPath}.internalNotes`}
            label="Notas internas"
            hint="Una nota por línea."
          />
        </div>
      ) : null}
    </InternalPanel>
  );
}
