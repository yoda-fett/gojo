// @ts-nocheck
/**
 * SSE event publisher (Story 8.5).
 *
 * Phase-2 stub: the long-running SSE endpoint on apps/api is not yet
 * deployed to Render. This helper publishes to Redis pub/sub when a
 * client is configured; otherwise it's a no-op so callers can wire up
 * notifications now and switch on real-time delivery later.
 */
import Redis from 'ioredis';

let publisher: Redis | null = null;
let initialised = false;

function getPublisher(): Redis | null {
  if (initialised) return publisher;
  initialised = true;
  if (!process.env.REDIS_URL) return null;
  try {
    publisher = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    return publisher;
  } catch {
    return null;
  }
}

export interface SseEvent {
  entityType: string;
  entityId: string;
  stateVersion: number;
  state: string;
  eventType: string;
}

export async function publishSseEvent(propertyId: string, event: SseEvent): Promise<void> {
  const client = getPublisher();
  if (!client) return;
  const payload = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
  try {
    await client.publish(`sse:property:${propertyId}`, payload);
  } catch {
    // Best-effort; SSE delivery is non-authoritative
  }
}
