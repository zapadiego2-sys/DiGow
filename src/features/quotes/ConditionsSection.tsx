import { useFormContext, useWatch } from 'react-hook-form';
import {
  conditionsFrom,
  latestVersion,
  sameContent,
  type ConditionsContent,
  type ConditionsRef,
} from '@/domain/conditions';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormField } from '@/shared/ui/FormField';
import { Select } from '@/shared/ui/Select';
import { useConditionsTemplates } from '../catalog/useCatalog';
import { LinesField, TextField } from '../forms/fields';

const MANUAL = 'manual';

/**
 * Condiciones comerciales desde una plantilla con versiones. La cotización guarda la versión
 * aplicada: si la plantilla cambia después, esta cotización conserva la suya.
 */
export function ConditionsSection() {
  const { setValue } = useFormContext();
  const templates = useConditionsTemplates();
  const ref = (useWatch({ name: 'conditionsRef' }) ?? null) as ConditionsRef | null;
  const content: ConditionsContent = {
    conditions: (useWatch({ name: 'conditions' }) ?? []) as string[],
    paymentTerms: (useWatch({ name: 'paymentTerms' }) ?? '') as string,
    validity: (useWatch({ name: 'validity' }) ?? '') as string,
    deliveryTime: (useWatch({ name: 'deliveryTime' }) ?? '') as string,
  };
  const applied = templates.data?.find((t) => t.id === ref?.templateId);
  const appliedVersion = applied?.versions.find((v) => v.version === ref?.version);
  const latest = applied ? latestVersion(applied) : null;
  const edited =
    appliedVersion !== undefined &&
    !sameContent(appliedVersion, {
      ...content,
      conditions: content.conditions.map((line) => line.trim()).filter(Boolean),
    });

  const apply = (id: string) => {
    const template = templates.data?.find((t) => t.id === id);
    const options = { shouldDirty: true, shouldValidate: true };
    if (!template) {
      setValue('conditionsRef', null, options);
      return;
    }
    const next = conditionsFrom(template);
    setValue('conditions', next.conditions, options);
    setValue('paymentTerms', next.paymentTerms, options);
    setValue('validity', next.validity, options);
    setValue('deliveryTime', next.deliveryTime, options);
    setValue('conditionsRef', next.conditionsRef, options);
  };

  return (
    <Card className="flex flex-col gap-md" aria-labelledby="terms-heading">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 id="terms-heading" className="text-title">
          Condiciones
        </h2>
        {ref ? (
          <Badge tone="info">
            {ref.name} · versión {ref.version}
            {edited ? ' · modificada' : ''}
          </Badge>
        ) : null}
      </div>
      <FormField label="Plantilla de condiciones">
        {(control) => (
          <Select
            {...control}
            value={ref?.templateId ?? MANUAL}
            options={[
              { value: MANUAL, label: 'Escribirlas a mano' },
              ...(templates.data ?? [])
                .filter((t) => t.active || t.id === ref?.templateId)
                .map((t) => ({
                  value: t.id,
                  label: `${t.name} (versión ${latestVersion(t).version})`,
                })),
            ]}
            onValueChange={apply}
          />
        )}
      </FormField>
      {applied && latest && ref && latest.version > ref.version ? (
        <div className="flex flex-col gap-sm rounded-md bg-surface-muted p-md text-body-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hay una versión más reciente de “{applied.name}” (versión {latest.version}). Esta
            cotización conserva la versión {ref.version}.
          </p>
          <Button onClick={() => apply(applied.id)}>Usar la versión {latest.version}</Button>
        </div>
      ) : null}
      <LinesField name="conditions" label="Condiciones comerciales" hint="Una por línea." />
      <div className="grid gap-md sm:grid-cols-3">
        <TextField name="paymentTerms" label="Forma de pago" />
        <TextField name="validity" label="Validez de la oferta" />
        <TextField name="deliveryTime" label="Tiempo de entrega" />
      </div>
    </Card>
  );
}
