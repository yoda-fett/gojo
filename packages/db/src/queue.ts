import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

export const SUBSCRIPTION_QUEUE_NAME = 'subscription';

let cachedConnection: Redis | null = null;

function getQueueConnection(): Redis | null {
  if (cachedConnection) return cachedConnection;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  // BullMQ requires maxRetriesPerRequest = null on the connection.
  cachedConnection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  return cachedConnection;
}

let cachedQueue: Queue | null = null;

export function getSubscriptionQueue(): Queue | null {
  if (cachedQueue) return cachedQueue;
  const connection = getQueueConnection();
  if (!connection) return null;
  cachedQueue = new Queue(SUBSCRIPTION_QUEUE_NAME, { connection });
  return cachedQueue;
}

export interface EnqueueOptions {
  /**
   * REQUIRED. Deterministic job identifier for idempotency.
   * Format convention: "<entity>:<event>:<discriminator>"
   * e.g. "property-123:TRIAL_NUDGE:107"
   */
  jobId: string;
  /** Delay in ms before the job becomes runnable. Defaults to 0. */
  delay?: number;
  /** Override retry policy. Defaults to BullMQ defaults. */
  attempts?: number;
}

/**
 * Enqueue a job on the `subscription` queue.
 *
 * Returns `{ ok: false, reason: 'queue_unavailable' }` when `REDIS_URL`
 * is unset (local dev, tests). Callers should treat this as a soft failure
 * and continue.
 */
export async function enqueueSubscriptionJob(
  jobName: string,
  data: Record<string, unknown>,
  options: EnqueueOptions,
): Promise<{ ok: true; jobId: string } | { ok: false; reason: 'queue_unavailable' }> {
  const queue = getSubscriptionQueue();
  if (!queue) return { ok: false, reason: 'queue_unavailable' };

  const jobOpts: JobsOptions = {
    jobId: options.jobId,
    ...(typeof options.delay === 'number' ? { delay: options.delay } : {}),
    ...(typeof options.attempts === 'number' ? { attempts: options.attempts } : {}),
  };

  await queue.add(jobName, data, jobOpts);
  return { ok: true, jobId: options.jobId };
}

/** Test-only hook: reset cached connection + queue. */
export async function resetSubscriptionQueueForTests(): Promise<void> {
  if (cachedQueue) {
    await cachedQueue.close();
    cachedQueue = null;
  }
  if (cachedConnection) {
    cachedConnection.disconnect();
    cachedConnection = null;
  }
}
