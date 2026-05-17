# Worker Conventions

Story 10-2a stood up a shared BullMQ worker process that dispatches by `job.name`
via the registry pattern. New async work should plug in here rather than spinning
up a separate Worker.

## Adding a handler

1. **Write the handler** anywhere under `src/workers/` or `src/services/`:

   ```ts
   import type { Job } from 'bullmq';

   export async function handleTrialNudge(job: Job) {
     const { propertyId, type } = job.data;
     // …do the work
   }
   ```

2. **Register it** during worker bootstrap (extend `src/workers/index.ts` once it
   exists, or import-for-side-effect from `src/index.ts`):

   ```ts
   import { registerHandler } from './workers/registry.js';
   import { handleTrialNudge } from './workers/trial-nudge.handler.js';

   registerHandler('TRIAL_NUDGE', handleTrialNudge);
   ```

3. **Sentry on failure is automatic.** `run-worker.ts` wires
   `worker.on('failed', …)` once for every handler. Don't duplicate.

## Enqueuing from the web app

Use `enqueueSubscriptionJob` from `@gojo/db` — it shares the queue connection
discipline (lazy Redis, BullMQ-compatible options) and enforces a deterministic
`jobId` for idempotency.

```ts
import { enqueueSubscriptionJob } from '@gojo/db';

await enqueueSubscriptionJob(
  'TRIAL_NUDGE',
  { propertyId: 'prop-1', type: 'EMAIL_NUDGE', dayOffset: 107 },
  { jobId: 'prop-1:TRIAL_NUDGE:107', delay: msUntilFire },
);
```

When `REDIS_URL` is unset (local dev / tests), the helper returns
`{ ok: false, reason: 'queue_unavailable' }` and the worker process logs a
warning instead of crashing.

## Idempotency

Every job MUST be enqueued with a deterministic `jobId`. BullMQ deduplicates
on `jobId`, so replaying the same enqueue is safe. The convention:

```
<entity>:<event>:<discriminator>
prop-1:TRIAL_NUDGE:107
res-abc:BOOKING_CONFIRMATION:initial
```

## Graceful shutdown

`run-worker.ts` registers `SIGTERM` and `SIGINT` handlers that call
`worker.close()` before exit. In-flight jobs complete; nothing is lost.
