import { useId, useRef, useState } from 'react';
import { useController, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { availableSubItems, linkedSubItems, type CatalogSubItem } from '@/domain/catalog';
import {
  createEmptySubItem,
  itemLineTotal,
  type QuoteItem,
  type QuoteSubItem,
} from '@/domain/quote';
import type { ItemMeasures, StandardSize } from '@/domain/template';
import type { LengthUnit } from '@/domain/units';
import { createId } from '@/shared/lib/id';
import { Badge } from '@/shared/ui/Badge';
import { FormField } from '@/shared/ui/FormField';
import { Select } from '@/shared/ui/Select';
import { PRODUCT_KIND_OPTIONS, productKindLabel } from '../catalog/productLabels';
import { useCatalogItems, useCatalogSubItems } from '../catalog/useCatalog';
import { formatMoney } from '@/shared/lib/format';
import { imageFileToDataUrl } from '@/shared/lib/image';
import { Button, IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import { CostSheet } from '../costing/CostSheet';
import {
  CheckboxField,
  CurrencyField,
  NumericField,
  SelectField,
  TextAreaField,
  TextField,
} from '../forms/fields';

function PhotoField({ name, alt }: { name: string; alt: string }) {
  const { control } = useFormContext();
  const { field } = useController({ control, name });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const toast = useToast();

  return (
    <div className="flex flex-col gap-sm">
      <span className="text-label">Foto</span>
      {field.value ? (
        <img
          src={field.value as string}
          alt={alt}
          className="h-photo w-full rounded-md border border-border object-photo"
        />
      ) : (
        <p className="text-body-sm text-text-muted">Sin foto.</p>
      )}
      <div className="flex flex-wrap gap-sm">
        <label htmlFor={inputId} className="sr-only">
          Elegir foto de {alt}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          tabIndex={-1}
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              field.onChange(await imageFileToDataUrl(file));
            } catch {
              toast({ tone: 'danger', text: 'No pudimos leer esa imagen. Prueba con otra.' });
            }
          }}
        />
        <Button onClick={() => inputRef.current?.click()}>
          <Icon name="upload" />
          {field.value ? 'Cambiar foto' : 'Agregar foto'}
        </Button>
        {field.value ? <Button onClick={() => field.onChange(null)}>Quitar foto</Button> : null}
      </div>
    </div>
  );
}

const MANUAL = 'manual';

function subItemFrom(catalog: CatalogSubItem): QuoteSubItem {
  return {
    ...createEmptySubItem(createId()),
    catalogSubItemId: catalog.id,
    name: catalog.name,
    description: catalog.description,
    quantity: catalog.defaultQuantity,
    predictive: catalog.predictive,
  };
}

/** Producto del catálogo: trae nombre, tipo, marca predictiva y sus sub-ítems ligados. */
function CatalogProductField({ path }: { path: string }) {
  const { getValues, setValue } = useFormContext();
  const item = useWatch({ name: path }) as QuoteItem;
  const items = useCatalogItems();
  const subItems = useCatalogSubItems();
  const options = [
    { value: MANUAL, label: 'Escribirlo a mano' },
    ...(items.data ?? [])
      .filter((product) => product.active || product.id === item.catalogItemId)
      .map((product) => ({ value: product.id, label: product.name })),
  ];

  const choose = (id: string) => {
    const set = (name: string, value: unknown) =>
      setValue(`${path}.${name}`, value, { shouldDirty: true, shouldValidate: true });
    if (id === MANUAL) {
      set('catalogItemId', null);
      return;
    }
    const product = items.data?.find((candidate) => candidate.id === id);
    if (!product) return;
    const current = getValues(path) as QuoteItem;
    set('catalogItemId', product.id);
    set('kind', product.kind);
    set('predictive', product.predictive);
    if (!current.product.trim()) set('product', product.name);
    if (!current.description.trim()) set('description', product.description);
    const missing = linkedSubItems(subItems.data ?? [], product.id).filter(
      (sub) => !current.subItems.some((existing) => existing.catalogSubItemId === sub.id),
    );
    if (missing.length > 0) set('subItems', [...current.subItems, ...missing.map(subItemFrom)]);
  };

  return (
    <FormField
      label="Producto del catálogo"
      hint="Trae el tipo de producto y los sub-ítems ligados. Puedes editarlo después."
    >
      {(control) => (
        <Select
          {...control}
          value={item.catalogItemId ?? MANUAL}
          options={options}
          onValueChange={choose}
        />
      )}
    </FormField>
  );
}

/** Medida estándar de la plantilla: se copia al ítem y luego se puede editar. */
function StandardSizeField({ path, sizes }: { path: string; sizes: readonly StandardSize[] }) {
  const { setValue } = useFormContext();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  if (sizes.length === 0) return null;
  return (
    <FormField label="Medida estándar" hint="Copia las medidas al ítem; puedes ajustarlas.">
      {(control) => (
        <Select
          {...control}
          value={chosen}
          placeholder="Elige una medida"
          options={sizes.map((size) => ({ value: size.id, label: size.name }))}
          onValueChange={(id) => {
            const size = sizes.find((candidate) => candidate.id === id);
            if (!size) return;
            setChosen(id);
            for (const key of ['width', 'height', 'depth'] as const) {
              setValue(`${path}.${key}`, size[key], { shouldDirty: true, shouldValidate: true });
            }
          }}
        />
      )}
    </FormField>
  );
}

function SubItemsSection({ path, showCosts }: { path: string; showCosts: boolean }) {
  const { control } = useFormContext();
  const item = useWatch({ name: path }) as QuoteItem;
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${path}.subItems`,
    keyName: 'fieldKey',
  });
  const catalog = useCatalogSubItems();
  const available = availableSubItems(catalog.data ?? [], item.catalogItemId).filter(
    (sub) => !item.subItems.some((existing) => existing.catalogSubItemId === sub.id),
  );
  const [adding, setAdding] = useState<string | undefined>(undefined);

  return (
    <section
      aria-label={`Sub-ítems de ${item.product || 'este ítem'}`}
      className="flex flex-col gap-sm"
    >
      <h4 className="text-subtitle">Sub-ítems</h4>
      {fields.length === 0 ? (
        <p className="text-body-sm text-text-muted">
          Partes del ítem con su propio costo, como un cabezote o la instalación. Son internas.
        </p>
      ) : null}
      {fields.map((field, index) => {
        const subPath = `${path}.subItems.${index}`;
        const name = item.subItems[index]?.name || `Sub-ítem ${index + 1}`;
        return (
          <div
            key={field.fieldKey}
            className="flex flex-col gap-sm rounded-md border border-border p-sm"
          >
            <div className="flex items-start gap-sm">
              <div className="grid min-w-0 flex-1 gap-sm sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <TextField name={`${subPath}.name`} label="Sub-ítem" />
                </div>
                <NumericField name={`${subPath}.quantity`} label="Cantidad por unidad" />
              </div>
              <IconButton label={`Quitar ${name}`} onClick={() => remove(index)} className="mt-lg">
                <Icon name="trash" />
              </IconButton>
            </div>
            <TextField name={`${subPath}.description`} label="Descripción (opcional)" />
            {showCosts ? (
              <CheckboxField
                name={`${subPath}.predictive`}
                label="Aplica para el modelo predictivo"
              />
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
        {available.length > 0 ? (
          <div className="min-w-0 flex-1">
            <FormField label="Del catálogo">
              {(control) => (
                <Select
                  {...control}
                  value={adding}
                  placeholder="Elige un sub-ítem"
                  options={available.map((sub) => ({ value: sub.id, label: sub.name }))}
                  onValueChange={(id) => {
                    const sub = available.find((candidate) => candidate.id === id);
                    if (sub) append(subItemFrom(sub));
                    setAdding(undefined);
                  }}
                />
              )}
            </FormField>
          </div>
        ) : null}
        <Button onClick={() => append(createEmptySubItem(createId()))}>
          <Icon name="plus" />
          Agregar sub-ítem
        </Button>
      </div>
    </section>
  );
}

interface ItemEditorProps {
  index: number;
  /** Medidas que pide la plantilla de la cotización. */
  measures: ItemMeasures;
  standardSizes: readonly StandardSize[];
  measureUnit: LengthUnit;
  /** Sin el permiso de costos no se ven ni se escriben precios. */
  showCosts: boolean;
  onRemove: () => void;
}

export function ItemEditor({
  index,
  measures,
  standardSizes,
  measureUnit,
  showCosts,
  onRemove,
}: ItemEditorProps) {
  const path = `items.${index}`;
  const item = useWatch({ name: path }) as QuoteItem;
  const [confirming, setConfirming] = useState(false);
  const title = item.product || `Ítem ${index + 1}`;

  return (
    <Card className="flex flex-col gap-md" aria-label={title}>
      <div className="flex items-center justify-between gap-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-sm">
          <h3 className="min-w-0 truncate text-subtitle">{title}</h3>
          <Badge tone={item.kind ? 'neutral' : 'warning'}>{productKindLabel(item.kind)}</Badge>
        </div>
        <IconButton label={`Quitar ${title}`} onClick={() => setConfirming(true)}>
          <Icon name="trash" />
        </IconButton>
      </div>
      <div className="grid gap-md sm:grid-cols-2">
        <CatalogProductField path={path} />
        <SelectField
          name={`${path}.kind`}
          label="Tipo de producto"
          placeholder="Sin clasificar"
          options={PRODUCT_KIND_OPTIONS}
        />
      </div>
      <TextField name={`${path}.product`} label="Producto" />
      <TextAreaField name={`${path}.description`} label="Descripción" />
      <PhotoField name={`${path}.photoUrl`} alt={title} />
      <StandardSizeField path={path} sizes={standardSizes} />
      <div className="grid grid-cols-2 gap-md sm:grid-cols-3">
        {measures.width ? (
          <NumericField name={`${path}.width`} label={`Ancho (${measureUnit})`} />
        ) : null}
        {measures.height ? (
          <NumericField name={`${path}.height`} label={`Alto (${measureUnit})`} />
        ) : null}
        {measures.depth ? (
          <NumericField name={`${path}.depth`} label={`Profundidad (${measureUnit})`} />
        ) : null}
        <NumericField name={`${path}.quantity`} label="Cantidad" />
        {showCosts ? (
          <div className="col-span-2 sm:col-span-1">
            <CurrencyField name={`${path}.unitPrice`} label="Valor unitario" />
          </div>
        ) : null}
      </div>
      {showCosts ? (
        <>
          <CheckboxField
            name={`${path}.predictive`}
            label="Aplica para el modelo predictivo"
            hint="Sin la marca, este ítem no se usa como referencia ni recibe sugerencias del historial."
          />
          <p className="flex items-baseline justify-between gap-md text-label">
            Valor total
            <span className="tabular text-money">{formatMoney(itemLineTotal(item))}</span>
          </p>
        </>
      ) : (
        <p className="text-body-sm text-text-muted">
          {item.unitPrice === null
            ? 'El precio lo define el analista de costos.'
            : `Valor unitario aprobado: ${formatMoney(item.unitPrice)}.`}
        </p>
      )}
      <SubItemsSection path={path} showCosts={showCosts} />
      {showCosts ? <CostSheet itemPath={path} /> : null}
      <ConfirmDialog
        open={confirming}
        title="¿Quitar este ítem?"
        description={`Se quitará "${title}", sus sub-ítems y su hoja de costos al guardar.`}
        confirmLabel="Quitar ítem"
        cancelLabel="Cancelar"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    </Card>
  );
}
