import { RepositoryError } from '@/domain/errors';

export interface MockBehavior {
  wait(): Promise<void>;
  forceErrors: boolean;
}

const MIN_LATENCY_MS = 200;
const MAX_LATENCY_MS = 500;

export function pickLatency(random: () => number = Math.random): number {
  return MIN_LATENCY_MS + random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
}

export function simulatedBehavior(forceErrors: boolean): MockBehavior {
  return {
    forceErrors,
    wait: () => new Promise((resolve) => setTimeout(resolve, pickLatency())),
  };
}

export async function simulate<T>(behavior: MockBehavior, operation: () => T): Promise<T> {
  await behavior.wait();
  if (behavior.forceErrors) throw new RepositoryError('unavailable');
  return operation();
}
