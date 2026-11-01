import { quoteStatuses, type QuoteStatus } from '@/domain/quote';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const STATUS_TONES: Record<QuoteStatus, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  approved: 'success',
  rejected: 'danger',
};

export const STATUS_OPTIONS = quoteStatuses.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
