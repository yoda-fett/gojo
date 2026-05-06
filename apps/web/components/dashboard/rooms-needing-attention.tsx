'use client';

import { useQuery } from '@tanstack/react-query';

import { BaseCard } from '@/components/ui/base-card';
import { Chip } from '@/components/ui/chip';

function variant(state: string) {
  if (state === 'DIRTY') return 'caution' as const;
  if (state === 'OUT_OF_ORDER' || state === 'MAINTENANCE') return 'negative' as const;
  return 'neutral' as const;
}

export function RoomsNeedingAttention({ propertyId }: { propertyId: string }) {
  const query = useQuery({
    queryKey: ['rooms-needing-attention', propertyId],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/rooms-needing-attention');
      if (!response.ok) throw new Error('Unable to load rooms needing attention');
      return (await response.json()) as { count: number; rooms: { roomId: string; roomNumber: string; roomType: string; housekeepingState: string }[] };
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
          {query.data?.rooms.map((room) => (
            <div key={room.roomId} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#edf3f1] p-3">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--color-charcoal)]">Room {room.roomNumber}</p>
                <p className="text-[12px] text-[var(--color-mid-gray)]">{room.roomType}</p>
              </div>
              <Chip variant={variant(room.housekeepingState)}>{room.housekeepingState.replaceAll('_', ' ')}</Chip>
            </div>
          ))}
        </div>
      )}
    </BaseCard>
  );
}
