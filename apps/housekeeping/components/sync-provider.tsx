'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { queuedMutations, replayQueuedMutations, type QueuedMutation } from '@/lib/pwa/offline-queue';
import type { SyncState } from './sync-indicator';

type SyncContextValue = {
  state: SyncState['state'];
  pendingCount: number;
  queued: string[];
  refresh: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);

  const refresh = useCallback(() => {
    setQueue(queuedMutations());
  }, []);

  useEffect(() => {
    refresh();
    const onQueue = () => refresh();
    const onOnline = () => {
      setOnline(true);
      void replayQueuedMutations()
        .catch(() => undefined)
        .finally(refresh);
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('hk-queue-changed', onQueue);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setOnline(window.navigator.onLine);

    return () => {
      window.removeEventListener('hk-queue-changed', onQueue);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  const pendingCount = queue.length;
  const state: SyncState['state'] = !online ? 'offline' : pendingCount > 0 ? 'pending' : 'synced';

  const value = useMemo(
    () => ({
      state,
      pendingCount,
      queued: queue.map((item) => item.label),
      refresh,
    }),
    [state, pendingCount, queue, refresh],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncState() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    return { state: 'synced' as const, pendingCount: 0, queued: [] as string[], refresh: () => undefined };
  }
  return ctx;
}
