'use client';

import { useCallback, useEffect, useState } from 'react';
import { CoverageChip } from './coverage-chip';
import { EmptyState } from './empty-state';
import { PwaShell } from './pwa-shell';
import { ReassignmentBanner } from './reassignment-banner';
import { RoomCardMobile, type RoomCardData } from './room-card-mobile';
import { useSyncState } from './sync-provider';

type Props = {
  dateLabel: string;
  userInitial: string;
  items: RoomCardData[];
  done: number;
  inProgress: number;
  total: number;
  propertyId: string;
};

export function MyDayClient({ dateLabel, userInitial, items: initialItems, done, inProgress, total, propertyId }: Props) {
  const { state: syncState } = useSyncState();
  const [items, setItems] = useState(initialItems);
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/room-assignments/mine', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { items: RoomCardData[] };
        setItems(data.items);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_RENDER_SSE_BASE_URL;
    if (!base || !propertyId) return undefined;
    const url = `${base}/api/sse/events?propertyId=${encodeURIComponent(propertyId)}`;
    const es = new EventSource(url, { withCredentials: true });
    const onReassign = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { roomNumber?: string };
        setBanner({
          title: `Room ${payload.roomNumber ?? ''} reassigned to you`.trim(),
          message: "Owner moved this room to your list. It's now in your queue below.",
        });
        void refresh();
      } catch {
        // ignore malformed
      }
    };
    es.addEventListener('ROOM_REASSIGNED_STAFF', onReassign as EventListener);
    return () => es.close();
  }, [propertyId, refresh]);

  const offline = syncState === 'offline';

  return (
    <PwaShell
      dateLabel={dateLabel}
      title="My Day"
      userInitial={userInitial}
      headerExtra={<CoverageChip done={done} total={total} inProgress={inProgress} />}
    >
      {banner ? (
        <ReassignmentBanner title={banner.title} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}
      <div className="hk-ptr" onClick={() => void refresh()} role="button" tabIndex={0}>
        {refreshing ? null : <span className="hk-ptr-arrow" aria-hidden />}
        <span>{refreshing ? 'Refreshing…' : 'Pull down to refresh'}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState offline={offline} onRetry={() => void refresh()} />
      ) : (
        <>
          <div className="hk-section-label">
            <span>Today&apos;s rooms</span>
            <span className="hk-filter">Filter · All</span>
          </div>
          <div className="hk-room-list">
            {items.map((room) => (
              <RoomCardMobile key={room.roomId} room={room} />
            ))}
          </div>
        </>
      )}
    </PwaShell>
  );
}
