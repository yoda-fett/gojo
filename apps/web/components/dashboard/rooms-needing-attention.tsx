'use client';

import { useQuery } from '@tanstack/react-query';

import { ComposedStatus } from '@/components/housekeeping/composed-status';
import { BaseCard } from '@/components/ui/base-card';

// RNA only ever shows rooms that are DIRTY or under an active block. We derive
// the composed `display` token locally from (housekeepingState, blockType)
// instead of extending the API — same shape as `deriveRoomStatus` would
// produce for these rows. Per hotfix-5 §3 contract.
type RnaRoom = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  blockType?: string | null;
};

function composedFor(room: RnaRoom) {
  if (room.blockType === 'MAINTENANCE') {
    return { display: 'MAINTENANCE', outOfService: true } as const;
  }
  if (room.blockType === 'OUT_OF_ORDER' || room.blockType) {
    return { display: 'OUT_OF_ORDER', outOfService: true } as const;
  }
  return { display: 'DIRTY', outOfService: false } as const;
}

export function RoomsNeedingAttention({ propertyId }: { propertyId: string }) {
  const query = useQuery({
    queryKey: ['rooms-needing-attention', propertyId],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/rooms-needing-attention');
      if (!response.ok) throw new Error('Unable to load rooms needing attention');
      return (await response.json()) as { count: number; rooms: RnaRoom[] };
    },
    refetchInterval: 30_000,
  });

  const count = query.data?.count ?? 0;

  return (
    <BaseCard title="Rooms Needing Attention" subtitle={count ? `${count} rooms` : 'Everything is ready'}>
      {count === 0 ? (
        <p className="text-[13px] font-medium text-[var(--color-teal)]">All rooms ready</p>
      ) : (
        <div className="space-y-3">
          {query.data?.rooms.map((room) => {
            const composed = composedFor(room);
            return (
              <div key={room.roomId} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#edf3f1] p-3">
                <div>
                  <p className="text-[13.5px] font-medium text-[var(--color-charcoal)]">Room {room.roomNumber}</p>
                  <p className="text-[12px] text-[var(--color-mid-gray)]">{room.roomType}</p>
                </div>
                <ComposedStatus
                  display={composed.display}
                  housekeeping="DIRTY"
                  outOfService={composed.outOfService}
                />
              </div>
            );
          })}
        </div>
      )}
    </BaseCard>
  );
}
