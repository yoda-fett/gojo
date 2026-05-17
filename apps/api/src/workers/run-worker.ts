import * as Sentry from '@sentry/node';
import { Worker, type Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

import { env } from '../env.js';
import { dispatch } from './registry.js';

export const SUBSCRIPTION_QUEUE_NAME = 'subscription';

let worker: Worker | null = null;
let connection: Redis | null = null;

/**
 * Start the BullMQ worker against the `subscription` queue.
 *
 * Returns `null` if `REDIS_URL` is unset (local dev without Redis).
 * Otherwise returns the running Worker so callers can `await worker.close()`
 * on shutdown.
 */
export function runWorker(): Worker | null {
  if (worker) return worker;
  if (!env.REDIS_URL) {
    console.warn('[worker] REDIS_URL is unset — worker not started.');
    return null;
  }

  connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  worker = new Worker(
    SUBSCRIPTION_QUEUE_NAME,
    async (job: Job) => dispatch(job),
    { connection },
  );

  worker.on('failed', (job, err) => {
    Sentry.captureException(err, {
      extra: {
        jobId: job?.id,
        jobName: job?.name,
        queueName: SUBSCRIPTION_QUEUE_NAME,
      },
    });
  });

  worker.on('ready', () => {
    console.info(`[worker] listening on queue '${SUBSCRIPTION_QUEUE_NAME}'`);
  });

  return worker;
}

export async function shutdownWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

export function registerShutdownHandlers(): void {
  const handler = (signal: NodeJS.Signals) => {
    console.info(`[worker] received ${signal}, closing gracefully…`);
    shutdownWorker()
      .catch((err) => {
        console.error('[worker] shutdown error', err);
      })
      .finally(() => {
        process.exit(0);
      });
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}
