import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import { SIGN_IN_PATH } from '../auth/RequireAuth';
import { useCan, useSession, useSignOut } from '../auth/useSession';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';

export function SettingsScreen() {
  const { demoData } = useServices();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const session = useSession();
  const canReset = useCan('settings.demoData');
  const signOut = useSignOut();
  const navigate = useNavigate();

  const reset = useMutation({
    mutationFn: () => demoData.reset(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast({ tone: 'success', text: 'Datos de prueba restablecidos.' });
    },
    onError: (error) => toast({ tone: 'danger', text: errorMessage(error) }),
  });

  return (
    <div className="flex flex-col gap-lg">
      <title>Ajustes · Cotizador</title>
      <h1 className="text-display">Ajustes</h1>
      <Card className="flex flex-col items-start gap-md" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-title">
          Tu cuenta
        </h2>
        <dl className="grid w-full gap-md sm:grid-cols-3">
          <div className="flex flex-col">
            <dt className="text-caption text-text-muted">Nombre</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="text-caption text-text-muted">Correo</dt>
            <dd className="truncate">{session.user.email}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-caption text-text-muted">Rol</dt>
            <dd>{session.role.name}</dd>
          </div>
        </dl>
        <p className="text-body-sm text-text-muted">
          El ingreso es simulado: sirve para probar los roles en este dispositivo y no protege datos
          reales.
        </p>
        <Button
          disabled={signOut.isPending}
          onClick={() =>
            signOut.mutate(undefined, {
              onSuccess: () => void navigate(SIGN_IN_PATH, { replace: true }),
            })
          }
        >
          <Icon name="logout" />
          Cerrar sesión
        </Button>
      </Card>
      {canReset ? (
        <Card className="flex flex-col items-start gap-md" aria-labelledby="reset-heading">
          <h2 id="reset-heading" className="text-title">
            Datos de prueba
          </h2>
          <p className="text-body-sm text-text-muted">
            Todos los datos se guardan solo en este dispositivo. Restablecer borra cotizaciones,
            materiales, usuarios, roles, flujos y plantillas, y vuelve a cargar los de ejemplo.
          </p>
          <Button variant="danger" disabled={reset.isPending} onClick={() => setConfirming(true)}>
            Restablecer datos de prueba
          </Button>
        </Card>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title="¿Restablecer los datos de prueba?"
        description="Se borrarán las cotizaciones, los materiales y la configuración de este dispositivo. Esta acción no se puede deshacer."
        confirmLabel="Restablecer"
        cancelLabel="Cancelar"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          reset.mutate();
        }}
      />
    </div>
  );
}
