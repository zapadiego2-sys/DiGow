import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { User } from '@/domain/access';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { useSession } from '../auth/useSession';
import { CheckboxField, SelectField, TextField } from '../forms/fields';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { useWorkload } from '../workflow/useWorkflow';
import { useCreateUser, useRoles, useSetPassword, useUpdateUser, useUsers } from './useAccess';

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRule = z
  .string()
  .min(MIN_PASSWORD, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.'),
  email: z.string().trim().regex(EMAIL, 'Escribe un correo válido.'),
  roleId: z.string().min(1, 'Elige un rol.'),
  active: z.boolean(),
  password: z.string(),
});

type UserForm = z.infer<typeof baseSchema>;

/** Al crear, la contraseña es obligatoria; al editar, vacía significa no cambiarla. */
function schemaFor(isNew: boolean) {
  return baseSchema.superRefine((values, context) => {
    if (!isNew && !values.password) return;
    const result = passwordRule.safeParse(values.password);
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: result.error.issues[0]!.message,
      });
    }
  });
}

function UserDialog({
  user,
  open,
  onClose,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
}) {
  const roles = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const setPassword = useSetPassword();
  const toast = useToast();
  const isNew = user === null;
  const form = useForm<UserForm>({ resolver: zodResolver(schemaFor(isNew)) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      roleId: user?.roleId ?? '',
      active: user?.active ?? true,
      password: '',
    });
  }, [open, user, form]);

  const submit = form.handleSubmit(async ({ password, ...values }) => {
    try {
      if (user) {
        await update.mutateAsync({ ...user, ...values });
        if (password) await setPassword.mutateAsync({ userId: user.id, password });
      } else {
        await create.mutateAsync({ ...values, password });
      }
      toast({ tone: 'success', text: isNew ? 'Usuario creado.' : 'Usuario guardado.' });
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
      title={isNew ? 'Nuevo usuario' : 'Editar usuario'}
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <TextField name="name" label="Nombre" />
          <TextField name="email" label="Correo" type="email" autoComplete="off" />
          <SelectField
            name="roleId"
            label="Rol"
            placeholder="Elige un rol"
            options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          />
          <TextField
            name="password"
            label={isNew ? 'Contraseña temporal' : 'Nueva contraseña (opcional)'}
            hint={
              isNew
                ? `Al menos ${MIN_PASSWORD} caracteres. Compártela por un canal seguro.`
                : 'Déjala vacía para no cambiarla.'
            }
            type="password"
            autoComplete="new-password"
          />
          <CheckboxField
            name="active"
            label="Usuario activo"
            hint="Un usuario inactivo no puede ingresar ni recibir tareas."
          />
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
              {isNew ? 'Crear usuario' : 'Guardar usuario'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </Dialog>
  );
}

export function UsersScreen() {
  const session = useSession();
  const users = useUsers();
  const roles = useRoles();
  const workload = useWorkload();
  const [editing, setEditing] = useState<{ user: User | null } | null>(null);
  const roleName = (id: string) => roles.data?.find((role) => role.id === id)?.name ?? '—';

  const columns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Nombre',
      cell: (user) => (
        <span className="flex flex-col">
          <span className="text-label">
            {user.name}
            {user.id === session.user.id ? ' (tú)' : ''}
          </span>
          <span className="text-caption text-text-muted">{user.email}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Rol', cell: (user) => roleName(user.roleId) },
    {
      key: 'status',
      header: 'Estado',
      cell: (user) =>
        user.active ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>,
    },
    {
      key: 'tasks',
      header: 'Tareas abiertas',
      numeric: true,
      cell: (user) => workload.data?.[user.id] ?? 0,
    },
    {
      key: 'actions',
      header: 'Acciones',
      cell: (user) => (
        <Button aria-label={`Editar ${user.name}`} onClick={() => setEditing({ user })}>
          <Icon name="edit" />
          Editar
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="users-heading" className="flex flex-col gap-md">
      <title>Usuarios · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="users-heading" className="text-title">
            Usuarios
          </h2>
          <p className="text-body-sm text-text-muted">
            Cada usuario tiene un rol. Las tareas automáticas solo se asignan a usuarios activos.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ user: null })}>
          <Icon name="plus" />
          Nuevo usuario
        </Button>
      </header>
      {users.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : users.isError ? (
        <QueryError error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <DataTable caption="Usuarios" columns={columns} rows={users.data} rowKey={(u) => u.id} />
      )}
      <UserDialog
        open={editing !== null}
        user={editing?.user ?? null}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
