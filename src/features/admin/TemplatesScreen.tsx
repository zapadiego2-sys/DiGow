import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { DEFAULT_CONDITIONS, DEFAULT_VAT_RATE } from '@/domain/quote';
import {
  ALL_MEASURES,
  templateFieldTypes,
  type QuoteTemplateDraft,
  type TemplateField,
  type TemplateFieldType,
} from '@/domain/template';
import { formatPercent } from '@/shared/lib/format';
import { createId } from '@/shared/lib/id';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonClass, IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Notice } from '@/shared/ui/Notice';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import {
  CheckboxField,
  LinesField,
  PercentField,
  SelectField,
  TextAreaField,
  TextField,
} from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { useSaveTemplate, useTemplates } from '../templates/useTemplates';
import { useWorkflows } from '../workflow/useWorkflow';

const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: 'Texto corto',
  longText: 'Texto largo',
  number: 'Número',
  date: 'Fecha',
  select: 'Lista de opciones',
  checkbox: 'Sí o no',
};

const FIELD_TYPE_OPTIONS = templateFieldTypes.map((value) => ({
  value,
  label: FIELD_TYPE_LABELS[value],
}));

/** En el formulario, "default" representa el flujo por defecto (null en la plantilla). */
const DEFAULT_WORKFLOW = 'default';
const NEW_ID = 'nueva';

const nonEmptyLines = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la plantilla.'),
  description: z.string().trim(),
  active: z.boolean(),
  workflowId: z.string(),
  measures: z.object({ width: z.boolean(), height: z.boolean(), depth: z.boolean() }),
  fields: z.array(
    z
      .object({
        id: z.string(),
        label: z.string().trim().min(1, 'Escribe el nombre del campo.'),
        type: z.enum(templateFieldTypes),
        required: z.boolean(),
        options: z.array(z.string()).transform(nonEmptyLines),
        hint: z.string().trim(),
        showToClient: z.boolean(),
      })
      .superRefine((field, context) => {
        if (field.type === 'select' && field.options.length < 2) {
          context.addIssue({
            code: 'custom',
            path: ['options'],
            message: 'Escribe al menos dos opciones, una por línea.',
          });
        }
      }),
  ),
  conditions: z.array(z.string()).transform(nonEmptyLines),
  paymentTerms: z.string().trim(),
  validity: z.string().trim(),
  deliveryTime: z.string().trim(),
  vatRate: z.number('Escribe un número.').nonnegative('No puede ser negativo.'),
});

type TemplateForm = Omit<QuoteTemplateDraft, 'workflowId'> & { workflowId: string };

function toForm(draft: QuoteTemplateDraft): TemplateForm {
  return { ...draft, workflowId: draft.workflowId ?? DEFAULT_WORKFLOW };
}

function emptyField(): TemplateField {
  return {
    id: createId(),
    label: '',
    type: 'text',
    required: false,
    options: [],
    hint: '',
    showToClient: false,
  };
}

const EMPTY_TEMPLATE: QuoteTemplateDraft = {
  name: '',
  description: '',
  active: true,
  workflowId: null,
  fields: [],
  measures: { ...ALL_MEASURES },
  conditions: [...DEFAULT_CONDITIONS],
  paymentTerms: 'A convenir',
  validity: '30 días',
  deliveryTime: 'A convenir',
  vatRate: DEFAULT_VAT_RATE,
};

export function TemplatesScreen() {
  const templates = useTemplates();
  const workflows = useWorkflows();
  const workflowName = (id: string | null) =>
    workflows.data?.find((w) => (id ? w.id === id : w.isDefault))?.name ?? '—';

  return (
    <section aria-labelledby="templates-heading" className="flex flex-col gap-md">
      <title>Plantillas · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="templates-heading" className="text-title">
            Plantillas de cotización
          </h2>
          <p className="text-body-sm text-text-muted">
            Una plantilla define los campos del proyecto, las medidas de cada ítem, las condiciones
            y el flujo de cada tipo de cotización.
          </p>
        </div>
        <Link to={`/admin/plantillas/${NEW_ID}`} className={buttonClass('primary')}>
          <Icon name="plus" />
          Nueva plantilla
        </Link>
      </header>
      {templates.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : templates.isError ? (
        <QueryError error={templates.error} onRetry={() => void templates.refetch()} />
      ) : (
        <ul className="grid gap-md md:grid-cols-2 xl:grid-cols-3">
          {templates.data.map((template) => (
            <li key={template.id}>
              <Card className="flex h-full flex-col gap-sm" aria-label={template.name}>
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <h3 className="text-subtitle">{template.name}</h3>
                  {template.active ? null : <Badge tone="neutral">Inactiva</Badge>}
                </div>
                <p className="text-body-sm text-text-muted">{template.description}</p>
                <dl className="grid grid-cols-2 gap-sm text-body-sm">
                  <div>
                    <dt className="text-caption text-text-muted">Campos propios</dt>
                    <dd>{template.fields.length}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-muted">Flujo</dt>
                    <dd>{workflowName(template.workflowId)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-muted">IVA</dt>
                    <dd>{formatPercent(template.vatRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-muted">Validez</dt>
                    <dd>{template.validity || '—'}</dd>
                  </div>
                </dl>
                {template.fields.length > 0 ? (
                  <ul className="flex flex-wrap gap-xs">
                    {template.fields.map((field) => (
                      <li key={field.id}>
                        <Badge tone="neutral">{field.label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto pt-sm">
                  <Link
                    to={`/admin/plantillas/${template.id}`}
                    aria-label={`Editar ${template.name}`}
                    className={buttonClass('secondary')}
                  >
                    <Icon name="edit" />
                    Editar
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FieldEditor({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const path = `fields.${index}`;
  const type = useWatch({ name: `${path}.type` }) as TemplateFieldType;
  const label = (useWatch({ name: `${path}.label` }) as string) || `Campo ${index + 1}`;

  return (
    <Card className="flex flex-col gap-md" aria-label={label}>
      <div className="flex items-center justify-between gap-sm">
        <h4 className="min-w-0 truncate text-subtitle">{label}</h4>
        <div className="flex gap-xs">
          <IconButton
            label={`Subir ${label}`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <Icon name="arrowUp" />
          </IconButton>
          <IconButton
            label={`Bajar ${label}`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <Icon name="arrowDown" />
          </IconButton>
          <IconButton label={`Quitar ${label}`} onClick={onRemove}>
            <Icon name="trash" />
          </IconButton>
        </div>
      </div>
      <div className="grid gap-md sm:grid-cols-2">
        <TextField name={`${path}.label`} label="Nombre del campo" />
        <SelectField name={`${path}.type`} label="Tipo" options={FIELD_TYPE_OPTIONS} />
        {type === 'select' ? (
          <div className="sm:col-span-2">
            <LinesField name={`${path}.options`} label="Opciones" hint="Una por línea." />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <TextField name={`${path}.hint`} label="Ayuda para quien llena el campo (opcional)" />
        </div>
        {type === 'checkbox' ? null : (
          <CheckboxField name={`${path}.required`} label="Obligatorio" />
        )}
        <CheckboxField
          name={`${path}.showToClient`}
          label="Visible para el cliente"
          hint="Aparece en la vista para el cliente y en la impresión."
        />
      </div>
    </Card>
  );
}

function FieldsEditor() {
  const { control } = useFormContext<TemplateForm>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields',
    keyName: 'key',
  });
  return (
    <section aria-labelledby="fields-heading" className="flex flex-col gap-md">
      <div className="flex flex-col">
        <h3 id="fields-heading" className="text-title">
          Campos del proyecto
        </h3>
        <p className="text-body-sm text-text-muted">
          Aparecen en la sección «Datos del proyecto» del formulario, en este orden.
        </p>
      </div>
      {fields.length === 0 ? (
        <p className="text-body-sm text-text-muted">Esta plantilla no agrega campos.</p>
      ) : null}
      {fields.map((field, index) => (
        <FieldEditor
          key={field.key}
          index={index}
          count={fields.length}
          onMove={(to) => move(index, to)}
          onRemove={() => remove(index)}
        />
      ))}
      <div>
        <Button onClick={() => append(emptyField())}>
          <Icon name="plus" />
          Agregar campo
        </Button>
      </div>
    </section>
  );
}

export function TemplateEditorScreen() {
  const { id = NEW_ID } = useParams();
  const templates = useTemplates();
  const existing = templates.data?.find((t) => t.id === id) ?? null;
  const isNew = id === NEW_ID;

  if (templates.isPending) return <Skeleton className="h-photo w-full" />;
  if (templates.isError) {
    return <QueryError error={templates.error} onRetry={() => void templates.refetch()} />;
  }
  if (!isNew && !existing) {
    return (
      <EmptyState
        title="No encontramos esta plantilla"
        description="Puede que se haya restablecido. Vuelve al listado de plantillas."
        action={
          <Link to="/admin/plantillas" className={buttonClass('secondary')}>
            Ver plantillas
          </Link>
        }
      />
    );
  }
  return <TemplateFormView key={id} id={isNew ? null : id} initial={existing ?? EMPTY_TEMPLATE} />;
}

function TemplateFormView({ id, initial }: { id: string | null; initial: QuoteTemplateDraft }) {
  const save = useSaveTemplate();
  const workflows = useWorkflows();
  const navigate = useNavigate();
  const toast = useToast();
  const defaults = useMemo(() => toForm(initial), [initial]);
  const form = useForm<TemplateForm>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaults,
  });
  const workflowOptions = [
    { value: DEFAULT_WORKFLOW, label: 'El flujo por defecto' },
    ...(workflows.data ?? []).filter((w) => w.active).map((w) => ({ value: w.id, label: w.name })),
  ];

  const submit = form.handleSubmit(
    async ({ workflowId, ...values }) => {
      const draft: QuoteTemplateDraft = {
        ...values,
        workflowId: workflowId === DEFAULT_WORKFLOW ? null : workflowId,
      };
      try {
        await save.mutateAsync({ id, draft });
        toast({ tone: 'success', text: id ? 'Plantilla guardada.' : 'Plantilla creada.' });
        await navigate('/admin/plantillas');
      } catch (error) {
        toast({ tone: 'danger', text: errorMessage(error) });
      }
    },
    () => toast({ tone: 'danger', text: 'Revisa los campos marcados antes de guardar.' }),
  );

  return (
    <FormProvider {...form}>
      <title>{`${id ? 'Editar plantilla' : 'Nueva plantilla'} · Cotizador`}</title>
      <form onSubmit={submit} noValidate className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">{id ? `Editar ${initial.name}` : 'Nueva plantilla'}</h2>
          <Link to="/admin/plantillas" className={buttonClass('secondary')}>
            <Icon name="arrowLeft" />
            Volver a plantillas
          </Link>
        </div>
        {id ? (
          <Notice tone="warning" title="Los cambios aplican a las cotizaciones nuevas">
            <p>Las cotizaciones creadas con esta plantilla conservan sus campos.</p>
          </Notice>
        ) : null}
        <Card className="flex flex-col gap-md" aria-label="Datos de la plantilla">
          <TextField name="name" label="Nombre" />
          <TextAreaField
            name="description"
            label="Descripción"
            hint="Ayuda a elegir la plantilla al crear una cotización."
          />
          <div className="grid gap-md sm:grid-cols-2">
            <SelectField name="workflowId" label="Flujo" options={workflowOptions} />
            <CheckboxField
              name="active"
              label="Activa"
              hint="Una plantilla inactiva no se ofrece al crear."
            />
          </div>
          <fieldset className="flex flex-col">
            <legend className="text-label">Medidas de cada ítem</legend>
            <div className="grid sm:grid-cols-3">
              <CheckboxField name="measures.width" label="Ancho" />
              <CheckboxField name="measures.height" label="Alto" />
              <CheckboxField name="measures.depth" label="Profundidad" />
            </div>
          </fieldset>
        </Card>
        <FieldsEditor />
        <Card className="flex flex-col gap-md" aria-labelledby="terms-defaults-heading">
          <h3 id="terms-defaults-heading" className="text-title">
            Condiciones por defecto
          </h3>
          <LinesField name="conditions" label="Condiciones comerciales" hint="Una por línea." />
          <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
            <TextField name="paymentTerms" label="Forma de pago" />
            <TextField name="validity" label="Validez de la oferta" />
            <TextField name="deliveryTime" label="Tiempo de entrega" />
            <PercentField name="vatRate" label="IVA (%)" />
          </div>
        </Card>
        <div className="flex flex-wrap justify-end gap-sm">
          <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
            {id ? 'Guardar plantilla' : 'Crear plantilla'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
