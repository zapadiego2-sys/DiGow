import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { assignmentModes, type AssignmentMode, type WorkflowDraft } from '@/domain/workflow';
import { createId } from '@/shared/lib/id';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonClass, IconButton } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Notice } from '@/shared/ui/Notice';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { useSaveWorkflow, useWorkflows } from '../workflow/useWorkflow';
import { useRoles } from './useAccess';

export const ASSIGNMENT_LABELS: Record<AssignmentMode, string> = {
  workload: 'Automática: quien tenga menos tareas del rol',
  requester: 'Quien creó la cotización',
};

const ASSIGNMENT_OPTIONS = assignmentModes.map((value) => ({
  value,
  label: ASSIGNMENT_LABELS[value],
}));

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del flujo.'),
  description: z.string().trim(),
  active: z.boolean(),
  isDefault: z.boolean(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, 'Escribe el nombre del paso.'),
        roleId: z.string().min(1, 'Elige el rol responsable.'),
        assignment: z.enum(assignmentModes),
        instructions: z.string().trim(),
      }),
    )
    .min(1, 'Agrega al menos un paso.'),
});

const NEW_ID = 'nuevo';

function emptyStep() {
  return {
    id: createId(),
    name: '',
    roleId: '',
    assignment: 'workload' as const,
    instructions: '',
  };
}

export function WorkflowsScreen() {
  const workflows = useWorkflows();
  const roles = useRoles();
  const roleName = (id: string) => roles.data?.find((role) => role.id === id)?.name ?? 'Sin rol';

  return (
    <section aria-labelledby="workflows-heading" className="flex flex-col gap-md">
      <title>Flujos y pasos · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="workflows-heading" className="text-title">
            Flujos y pasos
          </h2>
          <p className="text-body-sm text-text-muted">
            Cada cotización recorre los pasos de su flujo. Cada paso tiene un rol responsable y una
            forma de asignarse.
          </p>
        </div>
        <Link to={`/admin/flujos/${NEW_ID}`} className={buttonClass('primary')}>
          <Icon name="plus" />
          Nuevo flujo
        </Link>
      </header>
      {workflows.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : workflows.isError ? (
        <QueryError error={workflows.error} onRetry={() => void workflows.refetch()} />
      ) : (
        <ul className="flex flex-col gap-md">
          {workflows.data.map((workflow) => (
            <li key={workflow.id}>
              <Card className="flex flex-col gap-md" aria-label={workflow.name}>
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <div className="flex flex-wrap items-center gap-sm">
                    <h3 className="text-subtitle">{workflow.name}</h3>
                    {workflow.isDefault ? <Badge tone="info">Por defecto</Badge> : null}
                    {workflow.active ? null : <Badge tone="neutral">Inactivo</Badge>}
                  </div>
                  <Link
                    to={`/admin/flujos/${workflow.id}`}
                    aria-label={`Editar ${workflow.name}`}
                    className={buttonClass('secondary')}
                  >
                    <Icon name="edit" />
                    Editar
                  </Link>
                </div>
                {workflow.description ? (
                  <p className="text-body-sm text-text-muted">{workflow.description}</p>
                ) : null}
                <ol className="flex flex-col gap-sm md:flex-row md:flex-wrap md:items-center">
                  {workflow.steps.map((step, index) => (
                    <li key={step.id} className="flex items-center gap-sm">
                      <span className="flex flex-col rounded-md border border-border px-sm py-xs">
                        <span className="text-label">
                          {index + 1}. {step.name}
                        </span>
                        <span className="text-caption text-text-muted">
                          {roleName(step.roleId)} ·{' '}
                          {step.assignment === 'workload' ? 'menor carga' : 'quien la creó'}
                        </span>
                      </span>
                      {index < workflow.steps.length - 1 ? (
                        <span className="hidden text-text-muted md:inline-flex">
                          <Icon name="arrowRight" />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StepsEditor() {
  const { control, formState } = useFormContext<WorkflowDraft>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'steps',
    keyName: 'key',
  });
  const roles = useRoles();
  const roleOptions = (roles.data ?? []).map((role) => ({ value: role.id, label: role.name }));
  const stepsError = formState.errors.steps?.root?.message ?? formState.errors.steps?.message;

  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-md">
      <h3 id="steps-heading" className="text-title">
        Pasos
      </h3>
      {stepsError ? <p className="text-body-sm text-danger">{stepsError}</p> : null}
      <ol className="flex flex-col gap-md">
        {fields.map((field, index) => (
          <li key={field.key}>
            <Card className="flex flex-col gap-md" aria-label={`Paso ${index + 1}`}>
              <div className="flex items-center justify-between gap-sm">
                <h4 className="text-subtitle">Paso {index + 1}</h4>
                <div className="flex gap-xs">
                  <IconButton
                    label={`Subir paso ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <Icon name="arrowUp" />
                  </IconButton>
                  <IconButton
                    label={`Bajar paso ${index + 1}`}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <Icon name="arrowDown" />
                  </IconButton>
                  <IconButton
                    label={`Quitar paso ${index + 1}`}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Icon name="trash" />
                  </IconButton>
                </div>
              </div>
              <div className="grid gap-md sm:grid-cols-2">
                <TextField name={`steps.${index}.name`} label="Nombre del paso" />
                <SelectField
                  name={`steps.${index}.roleId`}
                  label="Rol responsable"
                  placeholder="Elige un rol"
                  options={roleOptions}
                />
                <div className="sm:col-span-2">
                  <SelectField
                    name={`steps.${index}.assignment`}
                    label="Asignación"
                    options={ASSIGNMENT_OPTIONS}
                    hint="Si quien creó la cotización ya no está activo, se asigna por carga dentro del rol."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextAreaField
                    name={`steps.${index}.instructions`}
                    label="Instrucciones para el responsable (opcional)"
                  />
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <div>
        <Button onClick={() => append(emptyStep())}>
          <Icon name="plus" />
          Agregar paso
        </Button>
      </div>
    </section>
  );
}

export function WorkflowEditorScreen() {
  const { id = NEW_ID } = useParams();
  const workflows = useWorkflows();
  const existing = workflows.data?.find((w) => w.id === id) ?? null;
  const isNew = id === NEW_ID;

  if (workflows.isPending) return <Skeleton className="h-photo w-full" />;
  if (workflows.isError) {
    return <QueryError error={workflows.error} onRetry={() => void workflows.refetch()} />;
  }
  if (!isNew && !existing) {
    return (
      <EmptyState
        title="No encontramos este flujo"
        description="Puede que se haya restablecido. Vuelve al listado de flujos."
        action={
          <Link to="/admin/flujos" className={buttonClass('secondary')}>
            Ver flujos
          </Link>
        }
      />
    );
  }
  return <WorkflowForm key={id} id={isNew ? null : id} initial={existing} />;
}

function WorkflowForm({ id, initial }: { id: string | null; initial: WorkflowDraft | null }) {
  const save = useSaveWorkflow();
  const navigate = useNavigate();
  const toast = useToast();
  const defaults = useMemo<WorkflowDraft>(
    () =>
      initial ?? {
        name: '',
        description: '',
        active: true,
        isDefault: false,
        steps: [emptyStep()],
      },
    [initial],
  );
  const form = useForm<WorkflowDraft>({ resolver: zodResolver(schema), defaultValues: defaults });

  const submit = form.handleSubmit(
    async (draft) => {
      try {
        await save.mutateAsync({ id, draft });
        toast({ tone: 'success', text: id ? 'Flujo guardado.' : 'Flujo creado.' });
        await navigate('/admin/flujos');
      } catch (error) {
        toast({ tone: 'danger', text: errorMessage(error) });
      }
    },
    () => toast({ tone: 'danger', text: 'Revisa los campos marcados antes de guardar.' }),
  );

  return (
    <FormProvider {...form}>
      <title>{`${id ? 'Editar flujo' : 'Nuevo flujo'} · Cotizador`}</title>
      <form onSubmit={submit} noValidate className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">{id ? `Editar ${initial?.name}` : 'Nuevo flujo'}</h2>
          <Link to="/admin/flujos" className={buttonClass('secondary')}>
            <Icon name="arrowLeft" />
            Volver a flujos
          </Link>
        </div>
        {id ? (
          <Notice tone="warning" title="Los cambios aplican a las cotizaciones nuevas">
            <p>Las que ya están en este flujo siguen con los pasos que tenían al iniciarlo.</p>
          </Notice>
        ) : null}
        <Card className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextAreaField name="description" label="Descripción (opcional)" />
          <div className="grid gap-sm sm:grid-cols-2">
            <CheckboxField
              name="active"
              label="Activo"
              hint="Un flujo inactivo no se ofrece al crear cotizaciones."
            />
            <CheckboxField
              name="isDefault"
              label="Flujo por defecto"
              hint="Se usa cuando la plantilla no indica otro. Solo puede haber uno."
            />
          </div>
        </Card>
        <StepsEditor />
        <div className="flex flex-wrap justify-end gap-sm">
          <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
            {id ? 'Guardar flujo' : 'Crear flujo'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
