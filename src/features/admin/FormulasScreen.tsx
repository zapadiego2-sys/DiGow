import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  allowedVariables,
  analyzeFormula,
  evaluateFormula,
  FORMULA_FUNCTIONS,
  FORMULA_VARIABLES,
  FormulaError,
  PARAM_NAME,
  type CostFormula,
  type CostFormulaDraft,
} from '@/domain/formula';
import { formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button, IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { useFormulas, useSaveFormula } from '../catalog/useCatalog';
import { CheckboxField, NumericField, TextAreaField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';

const RESERVED = new Set(FORMULA_VARIABLES.map((v) => v.name));

const schema = z
  .object({
    name: z.string().trim().min(1, 'Escribe el nombre.'),
    description: z.string().trim(),
    expression: z.string().trim().min(1, 'Escribe la fórmula.'),
    active: z.boolean(),
    params: z.array(
      z.object({
        name: z
          .string()
          .trim()
          .toLowerCase()
          .regex(PARAM_NAME, 'Usa minúsculas, números y guion bajo, sin espacios.')
          .refine((name) => !RESERVED.has(name), 'Ese nombre ya es una variable del sistema.'),
        label: z.string().trim().min(1, 'Escribe la etiqueta.'),
        defaultValue: z.number('Escribe un número.'),
      }),
    ),
  })
  .superRefine((formula, context) => {
    try {
      analyzeFormula(formula.expression, allowedVariables(formula.params));
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      context.addIssue({ code: 'custom', path: ['expression'], message: error.message });
    }
  });

/** Valores de ejemplo: un ítem de 120 × 190 × 70 cm, 1 unidad y un costo de 1.000. */
const SAMPLE: Record<string, number> = {
  ancho: 120,
  alto: 190,
  profundidad: 70,
  area_m2: 2.28,
  perimetro_m: 6.2,
  volumen_m3: 1.596,
  cantidad: 1,
  costo: 1000,
};

function Preview() {
  const expression = (useWatch({ name: 'expression' }) ?? '') as string;
  const params = (useWatch({ name: 'params' }) ?? []) as CostFormulaDraft['params'];
  let text: string;
  try {
    const values = {
      ...SAMPLE,
      ...Object.fromEntries(params.map((p) => [p.name, p.defaultValue])),
    };
    text = expression.trim() ? formatNumber(evaluateFormula(expression, values)) : '—';
  } catch (error) {
    text = error instanceof FormulaError ? error.message : '—';
  }
  return (
    <p className="rounded-md bg-surface-muted p-sm text-body-sm" role="status">
      Con un ítem de 120 × 190 × 70 cm y un costo de 1.000, da: <strong>{text}</strong>
    </p>
  );
}

function ParamsEditor() {
  const { control } = useFormContext<CostFormulaDraft>();
  const { fields, append, remove } = useFieldArray({ control, name: 'params', keyName: 'key' });
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="text-label">Parámetros</legend>
      <p className="text-caption text-text-muted">
        Valores que el analista puede ajustar en cada línea, como un porcentaje de desperdicio.
      </p>
      {fields.map((field, index) => (
        <div key={field.key} className="flex items-start gap-sm">
          <div className="grid min-w-0 flex-1 gap-sm sm:grid-cols-3">
            <TextField name={`params.${index}.name`} label="Nombre en la fórmula" />
            <TextField name={`params.${index}.label`} label="Etiqueta" />
            <NumericField name={`params.${index}.defaultValue`} label="Valor por defecto" />
          </div>
          <IconButton
            label={`Quitar parámetro ${index + 1}`}
            onClick={() => remove(index)}
            className="mt-lg"
          >
            <Icon name="trash" />
          </IconButton>
        </div>
      ))}
      <div>
        <Button onClick={() => append({ name: '', label: '', defaultValue: 0 })}>
          <Icon name="plus" />
          Agregar parámetro
        </Button>
      </div>
    </fieldset>
  );
}

function FormulaDialog({ formula, onClose }: { formula: CostFormula | null; onClose: () => void }) {
  const save = useSaveFormula();
  const toast = useToast();
  const form = useForm<CostFormulaDraft>({
    resolver: zodResolver(schema) as never,
    defaultValues: formula
      ? {
          name: formula.name,
          description: formula.description,
          expression: formula.expression,
          active: formula.active,
          params: formula.params,
        }
      : { name: '', description: '', expression: '', active: true, params: [] },
  });

  const submit = form.handleSubmit(async (draft) => {
    try {
      await save.mutateAsync({ formula, draft });
      toast({ tone: 'success', text: formula ? 'Fórmula guardada.' : 'Fórmula creada.' });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={formula ? `Editar ${formula.name}` : 'Nueva fórmula'}
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextAreaField name="description" label="Descripción (opcional)" />
          <TextAreaField
            name="expression"
            label="Fórmula"
            hint={`Variables: ${FORMULA_VARIABLES.map((v) => v.name).join(', ')}. Funciones: ${FORMULA_FUNCTIONS.join(', ')}; los valores se separan con punto y coma.`}
          />
          <ParamsEditor />
          <Preview />
          <CheckboxField
            name="active"
            label="Activa"
            hint="Una fórmula inactiva no se ofrece al costear."
          />
          {formula ? (
            <p className="text-caption text-text-muted">
              Si cambias la fórmula o sus parámetros, sube a la versión {formula.version + 1}. Las
              líneas que ya la usan conservan su versión.
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {formula ? 'Guardar fórmula' : 'Crear fórmula'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </Dialog>
  );
}

export function FormulasScreen() {
  const formulas = useFormulas();
  const [editing, setEditing] = useState<{ formula: CostFormula | null } | null>(null);

  return (
    <section aria-labelledby="formulas-heading" className="flex flex-col gap-md">
      <title>Fórmulas de costo · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="formulas-heading" className="text-title">
            Fórmulas de costo
          </h2>
          <p className="text-body-sm text-text-muted">
            El analista las aplica en la hoja de costos. Cada línea guarda la versión de la fórmula
            que usó.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ formula: null })}>
          <Icon name="plus" />
          Nueva fórmula
        </Button>
      </header>
      <Card className="flex flex-col gap-xs text-body-sm" aria-label="Variables disponibles">
        <h3 className="text-subtitle">Variables disponibles</h3>
        <dl className="grid gap-xs sm:grid-cols-2">
          {FORMULA_VARIABLES.map((variable) => (
            <div key={variable.name} className="flex gap-sm">
              <dt>
                <code>{variable.name}</code>
              </dt>
              <dd className="text-text-muted">{variable.label}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {formulas.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : formulas.isError ? (
        <QueryError error={formulas.error} onRetry={() => void formulas.refetch()} />
      ) : (
        <ul className="grid gap-md md:grid-cols-2">
          {formulas.data.map((formula) => (
            <li key={formula.id}>
              <Card className="flex h-full flex-col gap-sm" aria-label={formula.name}>
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <h3 className="text-subtitle">{formula.name}</h3>
                  <span className="flex gap-xs">
                    <Badge tone="info">Versión {formula.version}</Badge>
                    {formula.active ? null : <Badge tone="neutral">Inactiva</Badge>}
                  </span>
                </div>
                {formula.description ? (
                  <p className="text-body-sm text-text-muted">{formula.description}</p>
                ) : null}
                <code className="rounded-md bg-surface-muted p-sm text-body-sm break-all">
                  {formula.expression}
                </code>
                {formula.params.length > 0 ? (
                  <p className="text-caption text-text-muted">
                    Parámetros:{' '}
                    {formula.params
                      .map((p) => `${p.name} = ${formatNumber(p.defaultValue)}`)
                      .join(', ')}
                  </p>
                ) : null}
                <div className="mt-auto pt-sm">
                  <Button
                    aria-label={`Editar ${formula.name}`}
                    onClick={() => setEditing({ formula })}
                  >
                    <Icon name="edit" />
                    Editar
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <FormulaDialog
          key={editing.formula?.id ?? 'nueva'}
          formula={editing.formula}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
