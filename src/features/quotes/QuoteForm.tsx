import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, type FormEvent, type ReactNode } from 'react';
import {
  FormProvider,
  useController,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { useBlocker } from 'react-router';
import {
  createEmptyItem,
  quoteCost,
  quoteProfit,
  quoteTotals,
  type QuoteDraft,
  type QuoteItem,
} from '@/domain/quote';
import { formatMoney, formatPercent } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { NumberField } from '@/shared/ui/NumberField';
import { useToast } from '@/shared/ui/Toast';
import { InternalPanel, InternalRow } from '../costing/InternalPanel';
import { LinesField, SelectField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { ItemEditor } from './ItemEditor';
import { quoteFormSchema } from './quoteSchema';
import { STATUS_OPTIONS } from './statusLabels';

function VatField() {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ control, name: 'vatRate' });
  const percent = field.value === null ? null : Math.round((field.value as number) * 1e6) / 1e4;
  return (
    <FormField label="IVA (%)" error={fieldState.error?.message}>
      {(fieldControl) => (
        <NumberField
          {...fieldControl}
          value={percent}
          onChange={(value) => field.onChange(value === null ? null : value / 100)}
        />
      )}
    </FormField>
  );
}

function ItemsSection() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' });
  const addButton = (
    <Button onClick={() => append(createEmptyItem(createId()))}>
      <Icon name="plus" />
      Agregar ítem
    </Button>
  );

  return (
    <section className="flex flex-col gap-md" aria-labelledby="items-heading">
      <h2 id="items-heading" className="text-title">
        Ítems
      </h2>
      {fields.length === 0 ? (
        <EmptyState
          title="Sin ítems"
          description="Agrega el producto que vas a cotizar."
          action={addButton}
        />
      ) : (
        <>
          {fields.map((field, index) => (
            <ItemEditor key={field.fieldKey} index={index} onRemove={() => remove(index)} />
          ))}
          <div>{addButton}</div>
        </>
      )}
    </section>
  );
}

function useLiveTotals() {
  const items = (useWatch({ name: 'items' }) ?? []) as QuoteItem[];
  const vatRate = (useWatch({ name: 'vatRate' }) ?? 0) as number;
  return { items, ...quoteTotals({ items, vatRate }), vatRate };
}

function Summary({ submit }: { submit: ReactNode }) {
  const { items, subtotal, vat, total, vatRate } = useLiveTotals();
  return (
    <Card className="flex flex-col gap-md lg:sticky lg:top-0" aria-label="Resumen">
      <h2 className="text-title">Resumen</h2>
      <dl className="flex flex-col gap-sm">
        <div className="flex items-baseline justify-between gap-md">
          <dt className="text-label">Subtotal</dt>
          <dd className="tabular text-money">{formatMoney(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-md">
          <dt className="text-label">IVA {formatPercent(vatRate)}</dt>
          <dd className="tabular text-money">{formatMoney(vat)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-md border-t border-border pt-sm">
          <dt className="text-subtitle">Total</dt>
          <dd className="tabular text-money-total">{formatMoney(total)}</dd>
        </div>
      </dl>
      <InternalPanel>
        <InternalRow label="Costo total" value={formatMoney(quoteCost({ items }))} />
        <InternalRow label="Utilidad" value={formatMoney(quoteProfit({ items }))} strong />
      </InternalPanel>
      <div className="hidden lg:flex lg:flex-col">{submit}</div>
    </Card>
  );
}

function MobileBar({ submit }: { submit: ReactNode }) {
  const { total } = useLiveTotals();
  return (
    <div className="pb-safe sticky bottom-0 z-10 -mx-md border-t border-border bg-surface md:-mx-lg lg:hidden">
      <div className="flex items-center justify-between gap-md p-sm px-md md:px-lg">
        <p className="flex min-w-0 flex-col">
          <span className="text-caption text-text-muted">Total</span>
          <span className="tabular text-money font-bold">{formatMoney(total)}</span>
        </p>
        {submit}
      </div>
    </div>
  );
}

interface QuoteFormProps {
  initial: QuoteDraft;
  submitLabel: string;
  /** Debe rechazar si no se pudo guardar. Al resolver, la pantalla decide a dónde ir. */
  onSubmit: (draft: QuoteDraft) => Promise<void>;
  /** Vista previa de una importación: siempre es borrador y salir pierde el trabajo. */
  isImportPreview?: boolean;
}

export function QuoteForm({ initial, submitLabel, onSubmit, isImportPreview }: QuoteFormProps) {
  const form = useForm<QuoteDraft>({
    resolver: zodResolver(quoteFormSchema) as never,
    defaultValues: initial,
  });
  const toast = useToast();
  const skipGuard = useRef(false);
  const { isDirty, isSubmitting } = form.formState;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipGuard.current) return false;
    return (
      (isDirty || Boolean(isImportPreview)) && currentLocation.pathname !== nextLocation.pathname
    );
  });

  const submit = (event: FormEvent) =>
    form.handleSubmit(
      async (draft) => {
        try {
          skipGuard.current = true;
          await onSubmit(draft);
          form.reset(draft);
        } catch (error) {
          toast({ tone: 'danger', text: errorMessage(error) });
        } finally {
          skipGuard.current = false;
        }
      },
      () => toast({ tone: 'danger', text: 'Revisa los campos marcados antes de guardar.' }),
    )(event);

  const submitButton = (
    <Button type="submit" variant="primary" disabled={isSubmitting}>
      {isSubmitting ? 'Guardando…' : submitLabel}
    </Button>
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-lg">
        <div className="flex flex-col gap-lg lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-lg">
            <Card className="flex flex-col gap-md" aria-labelledby="data-heading">
              <h2 id="data-heading" className="text-title">
                Datos de la cotización
              </h2>
              <div className="grid gap-md sm:grid-cols-2">
                <TextField name="client" label="Cliente" />
                <TextField name="contact" label="Contacto" />
                <TextField name="project" label="Proyecto" />
                <TextField name="date" label="Fecha" type="date" />
                <TextField name="managerName" label="Gestora" />
                <TextField name="managerRole" label="Cargo" />
                {isImportPreview ? null : (
                  <SelectField name="status" label="Estado" options={STATUS_OPTIONS} />
                )}
                <VatField />
              </div>
            </Card>
            <ItemsSection />
            <Card className="flex flex-col gap-md" aria-labelledby="terms-heading">
              <h2 id="terms-heading" className="text-title">
                Condiciones
              </h2>
              <LinesField name="conditions" label="Condiciones comerciales" hint="Una por línea." />
              <div className="grid gap-md sm:grid-cols-3">
                <TextField name="paymentTerms" label="Forma de pago" />
                <TextField name="validity" label="Validez de la oferta" />
                <TextField name="deliveryTime" label="Tiempo de entrega" />
              </div>
            </Card>
          </div>
          <aside className="flex flex-col lg:sticky lg:top-0 lg:w-summary lg:shrink-0">
            <Summary submit={submitButton} />
          </aside>
        </div>
        <MobileBar submit={submitButton} />
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="¿Salir sin guardar?"
        description="Perderás los cambios que no has guardado."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  );
}
