import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';

export function SettingsScreen() {
  const { demoData } = useServices();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

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
      <Card className="flex flex-col items-start gap-md" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="text-title">
          Datos de prueba
        </h2>
        <p className="text-body-sm text-text-muted">
          Todos los datos se guardan solo en este dispositivo. Restablecer borra tus cotizaciones y
          materiales, y vuelve a cargar los de ejemplo.
        </p>
        <Button variant="danger" disabled={reset.isPending} onClick={() => setConfirming(true)}>
          Restablecer datos de prueba
        </Button>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="¿Restablecer los datos de prueba?"
        description="Se borrarán las cotizaciones y los materiales de este dispositivo. Esta acción no se puede deshacer."
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
