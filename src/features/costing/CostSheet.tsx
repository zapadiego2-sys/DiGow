import { useMemo, useState, type ComponentType } from 'react';
import {
  useController,
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import {
  itemFormulaValues,
  pendingRecalculations,
  type ItemMeasureContext,
} from '@/domain/autoQuantities';
import {
  applyMaterialCost,
  changeLineKind,
  createCostLine,
  lineCost,
  linesCost,
  type CostLine,
  type CostLineKind,
  type FormulaCostLine,
} from '@/domain/cost';
import { FORMULA_VARIABLES } from '@/domain/formula';
import { costUnit, materialCost, materialCostPerCm2 } from '@/domain/material';
import { parseMeasureTerms } from '@/domain/measure';
import { createEmptySubItem, itemCost, type QuoteItem, type QuoteSubItem } from '@/domain/quote';
import type { LengthUnit } from '@/domain/units';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { Badge } from '@/shared/ui/Badge';
import { Button, IconButton } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { useFormulas } from '../catalog/useCatalog';
import { CurrencyField, LinesField, NumericField, TextField } from '../forms/fields';
import { UNIT_LABELS } from '../materials/materialLabels';
import { useMaterials } from '../materials/useMaterials';
import { CostSuggestions } from './CostSuggestions';
import { InternalPanel, InternalRow } from './InternalPanel';

const KIND_LABELS: Record<CostLineKind, string> = {
  unit: 'Por unidad',
  area: 'Por área',
  labor: 'Mano de obra',
  fixed: 'Valor directo',
  formula: 'Fórmula',
};

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as CostLineKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

const NO_MATERIAL = 'none';
const NO_FORMULA = 'none';

/** Medidas del ítem que se está costeando, en su unidad. Los sub-ítems usan las de su ítem. */
function useItemContext(itemPath: string): ItemMeasureContext {
  const item = useWatch({ name: itemPath }) as QuoteItem;
  const measureUnit = (useWatch({ name: 'measureUnit' }) ?? 'cm') as LengthUnit;
  return {
    width: item.width,
    height: item.height,
    depth: item.depth,
    quantity: item.quantity,
    measureUnit,
  };
}

function AreasField({ name }: { name: string }) {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ control, name });
  const areas = (field.value ?? []) as number[];
  const [text, setText] = useState(areas.join(' + '));
  const [lastAreas, setLastAreas] = useState(areas);
  // Un cálculo automático cambia las áreas desde afuera: el texto se actualiza con ellas.
  if (lastAreas !== areas && !areas.some(Number.isNaN)) {
    setLastAreas(areas);
    setText(areas.join(' + '));
  }
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
            const parsed = next.trim() ? (parseMeasureTerms(next) ?? [Number.NaN]) : [];
            setLastAreas(parsed);
            field.onChange(parsed);
          }}
        />
      )}
    </FormField>
  );
}

interface KindFieldsProps {
  path: string;
  itemPath: string;
  onReplace: (line: CostLine) => void;
}

function FormulaFields({ path, itemPath, onReplace }: KindFieldsProps) {
  const line = useWatch({ name: path }) as FormulaCostLine;
  const formulas = useFormulas();
  const materials = useMaterials();
  const item = useItemContext(itemPath);
  const active = (formulas.data ?? []).filter((f) => f.active || f.id === line.formula?.id);
  const current = formulas.data?.find((f) => f.id === line.formula?.id);
  const material = materials.data?.find((m) => m.id === line.materialId);

  const choose = (id: string) => {
    const formula = formulas.data?.find((f) => f.id === id);
    if (!formula) {
      onReplace({ ...line, formula: null });
      return;
    }
    const params = Object.fromEntries(formula.params.map((p) => [p.name, p.defaultValue]));
    onReplace({
      ...line,
      label: line.label || formula.name,
      formula: {
        id: formula.id,
        name: formula.name,
        expression: formula.expression,
        version: formula.version,
      },
      values: {
        ...params,
        ...itemFormulaValues(item),
        costo: material ? materialCost(material) : (line.values.costo ?? 0),
      },
    });
  };

  return (
    <div className="flex flex-col gap-md sm:col-span-2">
      <FormField label="Fórmula">
        {(control) => (
          <Select
            {...control}
            value={line.formula?.id ?? NO_FORMULA}
            options={[
              { value: NO_FORMULA, label: 'Elige una fórmula' },
              ...active.map((f) => ({ value: f.id, label: f.name })),
            ]}
            onValueChange={choose}
          />
        )}
      </FormField>
      {line.formula ? (
        <div className="flex flex-col gap-xs rounded-md bg-surface p-sm text-body-sm">
          <code className="break-all">{line.formula.expression}</code>
          <span className="text-caption">
            Versión {line.formula.version}
            {current && current.version !== line.formula.version
              ? ` · hay una versión ${current.version}; vuelve a elegir la fórmula para usarla`
              : ''}
          </span>
        </div>
      ) : null}
      {current?.params.length ? (
        <div className="grid gap-md sm:grid-cols-2">
          {current.params.map((param) => (
            <NumericField
              key={param.name}
              name={`${path}.values.${param.name}`}
              label={param.label}
            />
          ))}
        </div>
      ) : null}
      <NumericField
        name={`${path}.values.costo`}
        label="Costo del material (costo)"
        hint={material ? 'Se toma del material elegido.' : 'Elige un material o escríbelo.'}
      />
      {line.formula ? (
        <dl className="grid grid-cols-2 gap-xs text-caption sm:grid-cols-3">
          {FORMULA_VARIABLES.filter((v) => v.name !== 'costo').map((variable) => (
            <div key={variable.name} className="flex flex-col">
              <dt>{variable.name}</dt>
              <dd className="tabular">{formatNumber(line.values[variable.name] ?? null)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Campos propios de cada tipo. Un tipo nuevo solo agrega una entrada aquí. */
const KIND_FIELDS: Record<CostLineKind, ComponentType<KindFieldsProps>> = {
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
  formula: FormulaFields,
};

interface CostLineEditorProps {
  path: string;
  itemPath: string;
  onReplace: (line: CostLine) => void;
  onRemove: () => void;
}

function CostLineEditor({ path, itemPath, onReplace, onRemove }: CostLineEditorProps) {
  const line = useWatch({ name: path }) as CostLine;
  const materials = useMaterials();
  const [confirming, setConfirming] = useState(false);
  const Fields = KIND_FIELDS[line.kind];

  const materialOptions = useMemo(
    () => [
      { value: NO_MATERIAL, label: 'Sin material' },
      ...(materials.data ?? []).map((m) => ({
        value: m.id,
        label: `${m.name} (${UNIT_LABELS[costUnit(m)]})`,
      })),
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
    const cost = line.kind === 'area' ? materialCostPerCm2(material) : materialCost(material);
    const updated = applyMaterialCost(line, material.id, cost);
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
        <Fields key={line.kind} path={path} itemPath={itemPath} onReplace={onReplace} />
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

/**
 * Cantidades que las reglas de los materiales y las fórmulas desprenden de las medidas.
 * El analista las ve antes de aplicarlas: nada cambia en la hoja sin su confirmación.
 */
function AutoQuantities({ linesPath, itemPath }: { linesPath: string; itemPath: string }) {
  const { setValue } = useFormContext();
  const lines = (useWatch({ name: linesPath }) ?? []) as CostLine[];
  const materials = useMaterials();
  const item = useItemContext(itemPath);
  const pending = pendingRecalculations(lines, materials.data ?? [], item);
  if (pending.length === 0) return null;

  const apply = (changes: typeof pending) =>
    setValue(
      linesPath,
      lines.map((line, index) => changes.find((c) => c.index === index)?.after ?? line),
      { shouldDirty: true, shouldValidate: true },
    );

  return (
    <section
      aria-label="Cantidades calculadas"
      className="flex flex-col gap-sm rounded-md border border-internal p-sm"
    >
      <p className="text-label">Cantidades calculadas desde las medidas</p>
      <ul className="flex flex-col gap-xs text-body-sm">
        {pending.map((change) => (
          <li key={change.index} className="flex flex-wrap items-center justify-between gap-sm">
            <span className="min-w-0">
              {change.after.label || 'Línea sin nombre'}:{' '}
              <span className="tabular">
                {formatMoney(lineCost(change.before))} → {formatMoney(lineCost(change.after))}
              </span>
            </span>
            <Button
              aria-label={`Aplicar cantidad a ${change.after.label}`}
              onClick={() => apply([change])}
            >
              Aplicar
            </Button>
          </li>
        ))}
      </ul>
      {pending.length > 1 ? (
        <div>
          <Button onClick={() => apply(pending)}>
            <Icon name="check" />
            Aplicar todas ({pending.length})
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Lista editable de líneas de costo. La usan el ítem y cada sub-ítem. */
function CostLinesEditor({ linesPath, itemPath }: { linesPath: string; itemPath: string }) {
  const { control } = useFormContext();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: linesPath,
    keyName: 'fieldKey',
  });
  return (
    <div className="flex flex-col gap-md">
      {fields.map((field, index) => (
        <CostLineEditor
          key={field.fieldKey}
          path={`${linesPath}.${index}`}
          itemPath={itemPath}
          onReplace={(line) => update(index, line)}
          onRemove={() => remove(index)}
        />
      ))}
      <div>
        <Button onClick={() => append(createCostLine(createId()))}>
          <Icon name="plus" />
          Agregar línea
        </Button>
      </div>
    </div>
  );
}

function SubItemCosts({ itemPath, index }: { itemPath: string; index: number }) {
  const path = `${itemPath}.subItems.${index}`;
  const sub = useWatch({ name: path }) as QuoteSubItem;
  const [open, setOpen] = useState(sub.costLines.length === 0);
  const unitCost = linesCost(sub.costLines);
  return (
    <div className="flex flex-col gap-sm rounded-md border border-internal p-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <span className="text-label">{sub.name || `Sub-ítem ${index + 1}`}</span>
        <span className="tabular text-money">
          {formatMoney(unitCost)} × {formatNumber(sub.quantity)}
        </span>
      </div>
      <AutoQuantities linesPath={`${path}.costLines`} itemPath={itemPath} />
      <div>
        <Button aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? `Ocultar costos de ${sub.name}` : `Ver costos de ${sub.name}`}
        </Button>
      </div>
      {open ? <CostLinesEditor linesPath={`${path}.costLines`} itemPath={itemPath} /> : null}
    </div>
  );
}

export function CostSheet({ itemPath }: { itemPath: string }) {
  const { control, setValue, getValues } = useFormContext();
  const linesPath = `${itemPath}.costLines`;
  const item = useWatch({ name: itemPath }) as QuoteItem;
  const { errors } = useFormState({ control, name: linesPath });
  const [open, setOpen] = useState(false);

  const cost = itemCost(item);
  const unitPrice = item.unitPrice;
  const hasErrors = linesPath
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], errors);
  const expanded = open || Boolean(hasErrors);
  const formulas = item.costLines.filter(
    (line): line is FormulaCostLine => line.kind === 'formula' && line.formula !== null,
  );

  return (
    <InternalPanel title="Hoja de costos">
      <InternalRow label="Costo de referencia" value={formatMoney(cost)} />
      {item.subItems.length > 0 ? (
        <InternalRow
          label="De los sub-ítems"
          value={formatMoney(cost - linesCost(item.costLines))}
        />
      ) : null}
      <InternalRow label="Precio de venta" value={formatMoney(unitPrice ?? null)} />
      <InternalRow
        label="Utilidad"
        value={unitPrice === null ? '—' : formatMoney(unitPrice - cost)}
        strong
      />
      {formulas.length > 0 ? (
        <div className="flex flex-wrap gap-xs">
          {formulas.map((line) => (
            <Badge key={line.id} tone="neutral">
              Fórmula: {line.formula?.name} v{line.formula?.version}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-sm">
        <Button aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
          {expanded
            ? 'Ocultar líneas'
            : item.costLines.length === 1
              ? 'Ver 1 línea de costo'
              : `Ver ${item.costLines.length} líneas de costo`}
        </Button>
        <Button
          onClick={() =>
            setValue(`${itemPath}.unitPrice`, cost, { shouldDirty: true, shouldValidate: true })
          }
        >
          Usar el costo como precio
        </Button>
      </div>
      <AutoQuantities linesPath={linesPath} itemPath={itemPath} />
      <CostSuggestions
        itemPath={itemPath}
        existingLines={item.costLines}
        onAccept={(accepted) => {
          const current = getValues(linesPath) as CostLine[];
          setValue(linesPath, [...current, ...accepted], { shouldDirty: true });
          setOpen(true);
        }}
        onAcceptSubItem={(suggested) => {
          const current = getValues(`${itemPath}.subItems`) as QuoteSubItem[];
          setValue(
            `${itemPath}.subItems`,
            [
              ...current,
              {
                ...createEmptySubItem(createId()),
                catalogSubItemId: suggested.catalogSubItemId,
                name: suggested.name,
                quantity: suggested.quantity,
                costLines: suggested.lines,
              },
            ],
            { shouldDirty: true, shouldValidate: true },
          );
        }}
      />
      {expanded ? (
        <div className="flex flex-col gap-md">
          <CostLinesEditor linesPath={linesPath} itemPath={itemPath} />
          <LinesField
            name={`${itemPath}.internalNotes`}
            label="Notas internas"
            hint="Una nota por línea."
          />
        </div>
      ) : null}
      {item.subItems.length > 0 ? (
        <section aria-label="Costos de los sub-ítems" className="flex flex-col gap-sm">
          <h4 className="text-label">Costos de los sub-ítems</h4>
          {item.subItems.map((sub, index) => (
            <SubItemCosts key={sub.id} itemPath={itemPath} index={index} />
          ))}
        </section>
      ) : null}
    </InternalPanel>
  );
}
