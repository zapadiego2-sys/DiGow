import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { materialCost, type Material, type MaterialDraft } from '@/domain/material';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { useToast } from '@/shared/ui/Toast';
import { InternalPanel, InternalRow } from '../costing/InternalPanel';
import { CurrencyField, NumericField, SelectField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { useSaveMaterial } from './useMaterials';

const NUMBER_REQUIRED = 'Escribe un número.';

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.'),
  supplier: z.string().trim(),
  pricing: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('factor'),
      purchasePrice: z.number(NUMBER_REQUIRED).nonnegative('No puede ser negativo.'),
      factor: z.number(NUMBER_REQUIRED).positive('El factor debe ser mayor que 0.'),
      sheetAreaCm2: z.number(NUMBER_REQUIRED).positive('El área debe ser mayor que 0.').nullable(),
    }),
    z.object({
      mode: z.literal('direct'),
      unitCost: z.number(NUMBER_REQUIRED).nonnegative('No puede ser negativo.'),
    }),
  ]),
});

const MODE_OPTIONS = [
  { value: 'factor', label: 'Precio de compra y factor' },
  { value: 'direct', label: 'Costo directo' },
] as const;

const EMPTY: MaterialDraft = {
  name: '',
  supplier: '',
  pricing: { mode: 'factor', purchasePrice: 0, factor: 0.6, sheetAreaCm2: null },
};

function toDraft(material: Material | null): MaterialDraft {
  if (!material) return EMPTY;
  return { name: material.name, supplier: material.supplier, pricing: material.pricing };
}

function safeCost(pricing: MaterialDraft['pricing']): number | null {
  try {
    const cost = materialCost({ pricing });
    return Number.isFinite(cost) ? cost : null;
  } catch {
    return null;
  }
}

interface MaterialDialogProps {
  open: boolean;
  material: Material | null;
  onClose: () => void;
}

export function MaterialDialog({ open, material, onClose }: MaterialDialogProps) {
  const form = useForm<MaterialDraft>({
    resolver: zodResolver(schema) as never,
    defaultValues: toDraft(material),
  });
  const save = useSaveMaterial();
  const toast = useToast();
  const pricing = useWatch({ control: form.control, name: 'pricing' });

  useEffect(() => {
    if (open) form.reset(toDraft(material));
  }, [open, material, form]);

  const submit = form.handleSubmit(async (draft) => {
    try {
      await save.mutateAsync({ id: material?.id ?? null, draft });
      toast({ tone: 'success', text: 'Material guardado.' });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={material ? 'Editar material' : 'Nuevo material'}
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextField name="supplier" label="Proveedor (opcional)" />
          <InternalPanel>
            <SelectField name="pricing.mode" label="Forma de costeo" options={MODE_OPTIONS} />
            {pricing.mode === 'factor' ? (
              <>
                <CurrencyField name="pricing.purchasePrice" label="Precio de compra" />
                <NumericField name="pricing.factor" label="Factor" />
                <NumericField
                  name="pricing.sheetAreaCm2"
                  label="Área de la lámina en cm² (opcional)"
                  hint="Si la escribes, el costo queda expresado por cm²."
                />
              </>
            ) : (
              <NumericField name="pricing.unitCost" label="Costo" />
            )}
            <InternalRow label="Costo" value={formatNumber(safeCost(pricing))} strong />
          </InternalPanel>
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              Guardar material
            </Button>
          </div>
        </form>
      </FormProvider>
    </Dialog>
  );
}
