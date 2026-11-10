import { useState } from 'react';
import { permissionsOf, SUPER_ADMIN_ROLE_ID, type Permission, type Role } from '@/domain/access';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Dialog } from '@/shared/ui/Dialog';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { Input, Textarea } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { errorMessage } from '../services/errorMessages';
import { QueryError } from '../services/QueryError';
import { PERMISSION_GROUPS } from './permissionLabels';
import { useRemoveRole, useRoles, useSaveRole, useUsers } from './useAccess';

interface RoleDialogProps {
  role: Role | null;
  onClose: () => void;
}

/** Se monta al abrirse: el estado inicial sale del rol que se edita. */
function RoleDialog({ role, onClose }: RoleDialogProps) {
  const save = useSaveRole();
  const toast = useToast();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [granted, setGranted] = useState<Set<Permission>>(() => new Set(role?.permissions ?? []));
  const [nameError, setNameError] = useState<string | null>(null);

  const toggle = (permission: Permission, checked: boolean) =>
    setGranted((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });

  const submit = async () => {
    if (!name.trim()) {
      setNameError('Escribe el nombre del rol.');
      return;
    }
    try {
      await save.mutateAsync({
        role,
        draft: { name: name.trim(), description: description.trim(), permissions: [...granted] },
      });
      toast({ tone: 'success', text: role ? 'Rol guardado.' : 'Rol creado.' });
      onClose();
    } catch (error) {
      toast({ tone: 'danger', text: errorMessage(error) });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={role ? `Editar ${role.name}` : 'Nuevo rol'}
    >
      <form
        noValidate
        className="flex flex-col gap-md"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormField label="Nombre" error={nameError ?? undefined}>
          {(control) => (
            <Input
              {...control}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
            />
          )}
        </FormField>
        <FormField label="Descripción (opcional)">
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </FormField>
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.title} className="flex flex-col">
            <legend className="text-subtitle">{group.title}</legend>
            {group.permissions.map((permission) => (
              <Checkbox
                key={permission.value}
                label={permission.label}
                description={permission.description}
                checked={granted.has(permission.value)}
                onChange={(event) => toggle(permission.value, event.target.checked)}
              />
            ))}
          </fieldset>
        ))}
        <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {role ? 'Guardar rol' : 'Crear rol'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const PERMISSION_LABELS = new Map(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => [p.value, p.label] as const)),
);

export function RolesScreen() {
  const roles = useRoles();
  const users = useUsers();
  const remove = useRemoveRole();
  const toast = useToast();
  const [editing, setEditing] = useState<{ role: Role | null } | null>(null);
  const [removing, setRemoving] = useState<Role | null>(null);
  const usersWith = (id: string) => (users.data ?? []).filter((u) => u.roleId === id).length;

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-md">
      <title>Roles y permisos · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex min-w-0 flex-col">
          <h2 id="roles-heading" className="text-title">
            Roles y permisos
          </h2>
          <p className="text-body-sm text-text-muted">
            Un rol agrupa permisos. El super admin siempre los tiene todos.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ role: null })}>
          <Icon name="plus" />
          Nuevo rol
        </Button>
      </header>
      {roles.isPending ? (
        <Skeleton className="h-photo w-full" />
      ) : roles.isError ? (
        <QueryError error={roles.error} onRetry={() => void roles.refetch()} />
      ) : (
        <ul className="grid gap-md md:grid-cols-2 xl:grid-cols-3">
          {roles.data.map((role) => {
            const locked = role.id === SUPER_ADMIN_ROLE_ID;
            const count = usersWith(role.id);
            return (
              <li key={role.id}>
                <Card className="flex h-full flex-col gap-sm" aria-label={role.name}>
                  <div className="flex flex-wrap items-center justify-between gap-sm">
                    <h3 className="text-subtitle">{role.name}</h3>
                    <span className="flex gap-xs">
                      {role.system ? <Badge tone="neutral">Del sistema</Badge> : null}
                      <Badge tone="info">{count === 1 ? '1 usuario' : `${count} usuarios`}</Badge>
                    </span>
                  </div>
                  {role.description ? (
                    <p className="text-body-sm text-text-muted">{role.description}</p>
                  ) : null}
                  <ul className="flex flex-wrap gap-xs">
                    {permissionsOf(role).map((permission) => (
                      <li key={permission}>
                        <Badge tone="neutral">{PERMISSION_LABELS.get(permission)}</Badge>
                      </li>
                    ))}
                  </ul>
                  {locked ? (
                    <p className="mt-auto pt-sm text-caption text-text-muted">
                      Este rol no se puede editar.
                    </p>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-sm pt-sm">
                      <Button
                        aria-label={`Editar ${role.name}`}
                        onClick={() => setEditing({ role })}
                      >
                        <Icon name="edit" />
                        Editar
                      </Button>
                      {role.system ? null : (
                        <Button
                          aria-label={`Borrar ${role.name}`}
                          onClick={() => setRemoving(role)}
                        >
                          <Icon name="trash" />
                          Borrar
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <RoleDialog
          key={editing.role?.id ?? 'nuevo'}
          role={editing.role}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title="¿Borrar este rol?"
        description={`Se borrará "${removing?.name ?? ''}". Solo es posible si ningún usuario ni paso de flujo lo usa.`}
        confirmLabel="Borrar rol"
        cancelLabel="Cancelar"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const role = removing;
          setRemoving(null);
          if (!role) return;
          remove.mutate(role.id, {
            onSuccess: () => toast({ tone: 'success', text: 'Rol borrado.' }),
            onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
          });
        }}
      />
    </section>
  );
}
