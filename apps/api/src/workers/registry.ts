import type { Job } from 'bullmq';

export type JobHandler = (job: Job) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a given BullMQ job name. The worker dispatches by
 * `job.name`, so each handler maps to one logical event (e.g. 'TRIAL_NUDGE').
 *
 * Re-registering a name throws — handlers are unique per name. Use
 * `unregisterHandlerForTests` if you need to swap in a stub.
 */
export function registerHandler(name: string, handler: JobHandler): void {
  if (handlers.has(name)) {
    throw new Error(`Handler for job '${name}' is already registered.`);
  }
  handlers.set(name, handler);
}

export function getHandler(name: string): JobHandler | undefined {
  return handlers.get(name);
}

export async function dispatch(job: Job): Promise<unknown> {
  const handler = handlers.get(job.name);
  if (!handler) {
    throw new Error(`No handler registered for job '${job.name}'.`);
  }
  return handler(job);
}

/** Test-only: clear all registered handlers. */
export function clearHandlersForTests(): void {
  handlers.clear();
}
