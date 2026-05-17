'use client';

import { useEffect } from 'react';

import { SyncProvider } from './sync-provider';

export function PwaBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return <SyncProvider>{children}</SyncProvider>;
}
