'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRefreshContext } from '@/lib/contexts/refresh-context';

export function Refresher({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const { setLastPollAt, setIsFailing } = useRefreshContext();

  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        router.refresh();
        setLastPollAt(new Date());
        setIsFailing(false);
      } catch {
        setIsFailing(true);
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, router, setIsFailing, setLastPollAt]);

  return null;
}
