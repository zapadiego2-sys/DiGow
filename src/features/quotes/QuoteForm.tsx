import { zodResolver } from '@hookform/resolvers/zod';
import { createContext, useContext, useRef, type FormEvent, type ReactNode } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useBlocker } from 'react-router';
import {
  createEmptyItem,
  quoteCost,
  quoteProfit,
  quoteTotals,
  type QuoteDraft,
  type QuoteItem,
} from '@/domain/quote';
import { ALL_MEASURES, type QuoteTemplateRef } from '@/domain/template';
import { formatMoney, formatPercent } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import { InternalPanel, InternalRow } from '../costing/InternalPanel';
import { LinesField, PercentField, SelectField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { CustomFieldsSection } from './CustomFieldsSection';
import { ItemEditor } from './ItemEditor';
import { quoteFormSchema } from './quoteSchema';
import { STATUS_OPTIONS } from './statusLabels';

function ItemsSection({ showCosts }: { showCosts: boolean }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' });
  const template = useWatch({ name: 'template' }) as QuoteTemplateRef | null;
  const measures = template?.measures ?? ALL_MEASURES;
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
            <ItemEditor
              key={field.fieldKey}
              index={index}
              measures={measures}
              showCosts={showCosts}
              onRemove={() => remove(index)}
            />
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

function Summary({ submit, showCosts }: { submit: ReactNode; showCosts: boolean }) {
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
      {showCosts ? (
        <InternalPanel>
          <InternalRow label="Costo total" value={formatMoney(quoteCost({ items }))} />
          <InternalRow label="Utilidad" value={formatMoney(quoteProfit({ items }))} strong />
        </InternalPanel>
      ) : null}
      {submit ? <div className="hidden lg:flex lg:flex-col">{submit}</div> : null}
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

export interface QuoteFormControls {
  isDirty: boolean;
  /** Guarda el formulario; resuelve false si no pasó la validación o falló. */
  save: () => Promise<boolean>;
}

const QuoteFormControlsContext = createContext<QuoteFormControls | null>(null);

/** Para el contenido de `header`, como el panel del flujo, que necesita guardar antes de avanzar. */
export function useQuoteFormControls(): QuoteFormControls {
  const controls = useContext(QuoteFormControlsContext);
  if (!controls) throw new Error('useQuoteFormControls requiere QuoteForm.');
  return controls;
}

interface QuoteFormProps {
  initial: QuoteDraft;
  submitLabel: string;
  /** Debe rechazar si no se pudo guardar. Al resolver, la pantalla decide a dónde ir. */
  onSubmit: (draft: QuoteDraft) => Promise<void>;
  /** Vista previa de una importación: siempre es borrador y salir pierde el trabajo. */
  isImportPreview?: boolean;
  /** Sin el permiso de costeo no se muestran hoja de costos, costo ni utilidad. */
  showCosts?: boolean;
  /** Quien no es responsable del paso solo consulta. */
  readOnly?: boolean;
  /** Contenido sobre el formulario. Puede guardar con useQuoteFormControls. */
  header?: ReactNode;
}

export function QuoteForm({
  initial,
  submitLabel,
  onSubmit,
  isImportPreview,
  showCosts = true,
  readOnly = false,
  header,
}: QuoteFormProps) {
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

  const save = (event?: FormEvent) =>
    new Promise<boolean>((resolve) => {
      void form.handleSubmit(
        async (draft) => {
          try {
            skipGuard.current = true;
            await onSubmit(draft);
            form.reset(draft);
            resolve(true);
          } catch (error) {
            toast({ tone: 'danger', text: errorMessage(error) });
            resolve(false);
          } finally {
            skipGuard.current = false;
          }
        },
        () => {
          toast({ tone: 'danger', text: 'Revisa los campos marcados antes de guardar.' });
          resolve(false);
        },
      )(event);
    });

  const submitButton = readOnly ? null : (
    <Button type="submit" variant="primary" disabled={isSubmitting}>
      {isSubmitting ? 'Guardando…' : submitLabel}
    </Button>
  );
  const template = initial.template;

  return (
    <FormProvider {...form}>
      <QuoteFormControlsContext.Provider value={{ isDirty, save: () => save() }}>
        {header}
      </QuoteFormControlsContext.Provider>
      <form onSubmit={(event) => void save(event)} noValidate className="flex flex-col gap-lg">
        {readOnly ? (
          <p role="status" className="rounded-md bg-surface-muted p-md text-body-sm">
            Solo puedes consultar esta cotización: la edita el responsable del paso actual.
          </p>
        ) : null}
        <fieldset
          disabled={readOnly}
          className="flex min-w-0 flex-col gap-lg lg:flex-row lg:items-start"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-lg">
            <Card className="flex flex-col gap-md" aria-labelledby="data-heading">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <h2 id="data-heading" className="text-title">
                  Datos de la cotización
                </h2>
                {template ? <Badge tone="info">Plantilla: {template.name}</Badge> : null}
              </div>
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
                <PercentField name="vatRate" label="IVA (%)" />
              </div>
            </Card>
            <CustomFieldsSection />
            <ItemsSection showCosts={showCosts} />
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
            <Summary submit={submitButton} showCosts={showCosts} />
          </aside>
        </fieldset>
        {submitButton ? <MobileBar submit={submitButton} /> : null}
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
