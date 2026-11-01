import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ServicesProvider, type Services } from '@/features/services/ServicesContext';
import { ToastProvider } from '@/shared/ui/Toast';

// networkMode 'always': los mocks son locales, así que las consultas no se pausan sin conexión.
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', retry: false, refetchOnWindowFocus: false },
      mutations: { networkMode: 'always' },
    },
  });
}

export function Providers({ services, children }: { services: Services; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <ToastProvider closeLabel="Cerrar" regionLabel="Notificaciones">
          {children}
        </ToastProvider>
      </ServicesProvider>
    </QueryClientProvider>
  );
}
