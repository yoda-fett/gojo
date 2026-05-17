export type QueuedMutation = {
  idempotencyKey: string;
  label: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

const STORAGE_KEY = 'hk-offline-queue';

function readStore(): QueuedMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: QueuedMutation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function enqueueMutation(mutation: QueuedMutation) {
  const queue = readStore();
  queue.push(mutation);
  writeStore(queue);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hk-queue-changed'));
  }
}

export function queuedMutations(): QueuedMutation[] {
  return readStore();
}

export function clearQueuedMutation(idempotencyKey: string) {
  writeStore(readStore().filter((item) => item.idempotencyKey !== idempotencyKey));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hk-queue-changed'));
  }
}

export async function replayQueuedMutations() {
  const queue = readStore();
  for (const item of queue) {
    const init: RequestInit = { method: item.method, credentials: 'include' };
    if (item.headers) init.headers = item.headers;
    if (item.body) init.body = item.body;
    const response = await fetch(item.url, init);
    if (!response.ok && response.status !== 409) {
      throw new Error(`Replay failed: ${response.status}`);
    }
    clearQueuedMutation(item.idempotencyKey);
  }
}
