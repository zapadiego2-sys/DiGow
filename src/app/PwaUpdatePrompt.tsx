import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '@/shared/ui/Toast';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const toast = useToast();

  useEffect(() => {
    if (!needRefresh) return;
    toast({
      tone: 'success',
      text: 'Hay una nueva versión disponible.',
      persistent: true,
      action: { label: 'Actualizar', onSelect: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}
