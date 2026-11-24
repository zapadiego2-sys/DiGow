import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { latestVersion, type ConditionsTemplate } from '@/domain/conditions';
import { DEFAULT_CONDITIONS } from '@/domain/quote';
import { formatDateTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { useSession } from '../auth/useSession';
import { useConditionsCommand, useConditionsTemplates } from '../catalog/useCatalog';
import { CheckboxField, LinesField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { useUsers } from './useAccess';

const nonEmptyLines = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.'),
  active: z.boolean(),
  conditions: z.array(z.string()).transform(nonEmptyLines),
  paymentTerms: z.string().trim(),
  validity: z.string().trim(),
  deliveryTime: z.string().trim(),
});

type ConditionsForm = z.input<typeof schema>;

function ConditionsDialog({
  template,
  onClose,
}: {
  template: ConditionsTemplate | null;
  onClose: () => void;
}) {
  const session = useSession();
  const command = useConditionsCommand();
  const toast = useToast();
  const latest = template ? latestVersion(template) : null;
  const form = useForm<ConditionsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template?.name ?? '',
      active: template?.active ?? true,
      conditions: latest?.conditions ?? [...DEFAULT_CONDITIONS],
      paymentTerms: latest?.paymentTerms ?? 'A convenir',
      validity: latest?.validity ?? '30 días',
      deliveryTime: latest?.deliveryTime ?? 'A convenir',
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const { name, active, ...rest } = schema.parse(values);
    try {
      if (!template) {
        await command.mutateAsync({
          kind: 'create',
          template: { name, ...rest },
          actorId: session.user.id,
        });
        toast({ tone: 'success', text: 'Plantilla de condiciones creada.' });
      } else {
        if (name !== template.name || active !== template.active) {
          await command.mutateAsync({ kind: 'rename', id: template.id, name, active });
        }
        const updated = await command.mutateAsync({
          kind: 'publish',
          id: template.id,
          content: rest,
          actorId: session.user.id,
        });
        const version = latestVersion(updated).version;
        toast({
          tone: 'success',
          text:
            version > (latest?.version ?? 0)
              ? `Se publicó la versión ${version}. Las cotizaciones anteriores conservan la suya.`
              : 'Plantilla guardada. El contenido no cambió, así que sigue en la misma versión.',
        });
      }
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={template ? `Editar ${template.name}` : 'Nuevas condiciones comerciales'}
      description={
        template
          ? `Si cambias el contenido se publica la versión ${(latest?.version ?? 0) + 1}.`
          : undefined
      }
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <LinesField name="conditions" label="Condiciones comerciales" hint="Una por línea." />
          <TextField name="paymentTerms" label="Forma de pago" />
          <TextField name="validity" label="Validez de la oferta" />
          <TextField name="deliveryTime" label="Tiempo de entrega" />
          {template ? (
            <CheckboxField
              name="active"
              label="Activa"
              hint="Una plantilla inactiva no se ofrece en las cotizaciones."
            />
          ) : null}
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={command.isPending}>
              {template ? 'Guardar y publicar' : 'Crear condiciones'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </Dialog>
  );
}

function Versions({ template }: { template: ConditionsTemplate }) {
  const users = useUsers();
  const [open, setOpen] = useState(false);
  const versions = [...template.versions].reverse();
  return (
    <div className="flex flex-col gap-sm">
      <div>
        <Button aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="clock" />
          {open ? 'Ocultar versiones' : `Ver versiones (${versions.length})`}
        </Button>
      </div>
      {open ? (
        <ol
          aria-label={`Versiones de ${template.name}`}
          className="flex flex-col gap-sm border-l border-border pl-md"
        >
          {versions.map((version) => (
            <li key={version.version} className="flex flex-col gap-xs text-body-sm">
              <span className="text-label">
                Versión {version.version} · {formatDateTime(version.createdAt)}
                {version.createdBy
                  ? ` · ${users.data?.find((u) => u.id === version.createdBy)?.name ?? ''}`
                  : ''}
              </span>
              <span className="text-text-muted">
                {version.conditions.length} condiciones · Pago: {version.paymentTerms || '—'} ·
                Validez: {version.validity || '—'} · Entrega: {version.deliveryTime || '—'}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function ConditionsScreen() {
  const templates = useConditionsTemplates();
  const [editing, setEditing] = useState<{ template: ConditionsTemplate | null } | null>(null);

  return (
    <section aria-labelledby="conditions-heading" className="flex flex-col gap-md">
      <title>Condiciones comerciales · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="conditions-heading" className="text-title">
            Condiciones comerciales
          </h2>
          <p className="text-body-sm text-text-muted">
            Cada cambio publica una versión nueva. Las cotizaciones conservan la versión con la que
            se crearon.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ template: null })}>
          <Icon name="plus" />
          Nuevas condiciones
        </Button>
      </header>
      {templates.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : templates.isError ? (
        <QueryError error={templates.error} onRetry={() => void templates.refetch()} />
      ) : (
        <ul className="grid gap-md md:grid-cols-2">
          {templates.data.map((template) => {
            const latest = latestVersion(template);
            return (
              <li key={template.id}>
                <Card className="flex h-full flex-col gap-sm" aria-label={template.name}>
                  <div className="flex flex-wrap items-center justify-between gap-sm">
                    <h3 className="text-subtitle">{template.name}</h3>
                    <span className="flex gap-xs">
                      <Badge tone="info">Versión {latest.version}</Badge>
                      {template.active ? null : <Badge tone="neutral">Inactiva</Badge>}
                    </span>
                  </div>
                  <ul className="flex list-disc flex-col gap-xs pl-lg text-body-sm">
                    {latest.conditions.slice(0, 3).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {latest.conditions.length > 3 ? (
                      <li className="text-text-muted">y {latest.conditions.length - 3} más</li>
                    ) : null}
                  </ul>
                  <p className="text-caption text-text-muted">
                    Pago: {latest.paymentTerms || '—'} · Validez: {latest.validity || '—'} ·
                    Entrega: {latest.deliveryTime || '—'}
                  </p>
                  <Versions template={template} />
                  <div className="mt-auto pt-sm">
                    <Button
                      aria-label={`Editar ${template.name}`}
                      onClick={() => setEditing({ template })}
                    >
                      <Icon name="edit" />
                      Editar
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <ConditionsDialog
          key={editing.template?.id ?? 'nueva'}
          template={editing.template}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
