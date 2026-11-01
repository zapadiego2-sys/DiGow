import { useId, useRef, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { itemLineTotal, type QuoteItem } from '@/domain/quote';
import { formatMoney } from '@/shared/lib/format';
import { imageFileToDataUrl } from '@/shared/lib/image';
import { Button, IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import { CostSheet } from '../costing/CostSheet';
import { CurrencyField, NumericField, TextAreaField, TextField } from '../forms/fields';

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

interface ItemEditorProps {
  index: number;
  onRemove: () => void;
}

export function ItemEditor({ index, onRemove }: ItemEditorProps) {
  const path = `items.${index}`;
  const item = useWatch({ name: path }) as QuoteItem;
  const [confirming, setConfirming] = useState(false);
  const title = item.product || `Ítem ${index + 1}`;

  return (
    <Card className="flex flex-col gap-md" aria-label={title}>
      <div className="flex items-center justify-between gap-sm">
        <h3 className="min-w-0 truncate text-subtitle">{title}</h3>
        <IconButton label={`Quitar ${title}`} onClick={() => setConfirming(true)}>
          <Icon name="trash" />
        </IconButton>
      </div>
      <TextField name={`${path}.product`} label="Producto" />
      <TextAreaField name={`${path}.description`} label="Descripción" />
      <PhotoField name={`${path}.photoUrl`} alt={title} />
      <div className="grid grid-cols-2 gap-md sm:grid-cols-3">
        <NumericField name={`${path}.width`} label="Ancho" />
        <NumericField name={`${path}.height`} label="Alto" />
        <NumericField name={`${path}.depth`} label="Profundidad" />
        <NumericField name={`${path}.quantity`} label="Cantidad" />
        <div className="col-span-2 sm:col-span-1">
          <CurrencyField name={`${path}.unitPrice`} label="Valor unitario" />
        </div>
      </div>
      <p className="flex items-baseline justify-between gap-md text-label">
        Valor total
        <span className="tabular text-money">{formatMoney(itemLineTotal(item))}</span>
      </p>
      <CostSheet itemPath={path} />
      <ConfirmDialog
        open={confirming}
        title="¿Quitar este ítem?"
        description={`Se quitará "${title}" y su hoja de costos al guardar.`}
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
