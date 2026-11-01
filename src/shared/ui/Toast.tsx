import * as RadixToast from '@radix-ui/react-toast';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

type ToastTone = 'success' | 'danger';

interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
  action?: { label: string; onSelect: () => void };
  persistent?: boolean;
}

type ShowToast = (toast: Omit<ToastMessage, 'id'>) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast requiere ToastProvider.');
  return show;
}

const TONES: Record<ToastTone, string> = {
  success: 'border-success text-success',
  danger: 'border-danger text-danger',
};

interface ToastProviderProps {
  closeLabel: string;
  regionLabel: string;
  children: ReactNode;
}

export function ToastProvider({ closeLabel, regionLabel, children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((toast) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  const remove = (id: number) => setToasts((current) => current.filter((t) => t.id !== id));
  const context = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={context}>
      <RadixToast.Provider label={regionLabel}>
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            // Un error o una acción no pueden desaparecer antes de que se lean.
            duration={toast.persistent || toast.tone === 'danger' ? Infinity : 5000}
            onOpenChange={(open) => {
              if (!open) remove(toast.id);
            }}
            className={cn(
              'flex items-center gap-sm rounded-md border bg-surface py-xs pr-xs pl-md shadow-floating',
              TONES[toast.tone],
            )}
          >
            <RadixToast.Description className="min-w-0 flex-1 text-body-sm">
              {toast.text}
            </RadixToast.Description>
            {toast.action ? (
              <RadixToast.Action
                altText={toast.action.label}
                onClick={toast.action.onSelect}
                className="min-h-control rounded-md px-sm text-label text-primary hover:bg-primary-subtle"
              >
                {toast.action.label}
              </RadixToast.Action>
            ) : null}
            <RadixToast.Close
              aria-label={closeLabel}
              className="inline-flex size-control shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
            >
              <Icon name="close" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="toast-viewport fixed z-50 flex flex-col gap-sm outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
