import { cn } from '../lib/cn';
import { Icon } from './Icon';

export type StepState = 'done' | 'current' | 'pending';

export interface StepItem {
  key: string;
  label: string;
  detail?: string;
  state: StepState;
}

const MARKERS: Record<StepState, string> = {
  done: 'bg-success text-on-primary',
  current: 'bg-primary text-on-primary',
  pending: 'border border-border-strong bg-surface text-text-muted',
};

/** Avance por pasos: vertical en móvil y horizontal desde md. */
export function Steps({ label, steps }: { label: string; steps: readonly StepItem[] }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-sm md:flex-row md:gap-md">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex min-w-0 flex-1 items-start gap-sm"
        >
          <span
            className={cn(
              'inline-flex size-lg shrink-0 items-center justify-center rounded-full text-caption',
              MARKERS[step.state],
            )}
          >
            {step.state === 'done' ? <Icon name="check" /> : index + 1}
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                'text-label',
                step.state === 'pending' ? 'text-text-muted' : 'text-text',
              )}
            >
              {step.label}
            </span>
            {step.detail ? (
              <span className="text-caption text-text-muted">{step.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
