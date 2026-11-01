import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { errorMessage } from './errorMessages';

export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Notice tone="danger" title="No se pudo cargar">
      <p>{errorMessage(error)}</p>
      <div className="mt-sm">
        <Button onClick={onRetry}>Reintentar</Button>
      </div>
    </Notice>
  );
}
