// @ts-nocheck
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { formatInr } from '@/lib/utils/currency';

export function BreakEvenInline({
  roomTypeId,
  currentFloorRate,
}: {
  roomTypeId: string;
  currentFloorRate?: number;
}) {
  const query = useQuery({
    queryKey: ['break-even', roomTypeId],
    queryFn: async () => {
      const response = await fetch(`/api/room-types/${roomTypeId}/break-even`);
      if (!response.ok) {
        throw new Error('Unable to load break-even rate');
      }
      return response.json();
    },
  });

  if (query.isLoading) {
    return <div className="min-h-[68px] animate-pulse rounded-[10px] bg-[var(--color-off-white)]" />;
  }

  const data = query.data;

  if (data?.reason === 'NO_COST_CONFIG' || data?.breakEvenRate == null) {
    return (
      <p className="rounded-[10px] bg-[var(--color-off-white)] px-3 py-3 text-[12px] text-[var(--color-mid-gray)]">
        Add your cost inputs to see your break-even rate.{' '}
        <Link href="/settings/break-even" className="font-semibold text-[var(--color-teal)] underline">
          Set up costs →
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-[10px] bg-[var(--color-off-white)] px-3 py-3">
      <p className="text-[13px] font-semibold text-[var(--color-charcoal)]">
        Your break-even at {data.occupancyAssumption}% occupancy is {formatInr(data.breakEvenRate)}/night
      </p>
      {data.calculationNote ? <p className="text-[11px] text-[var(--color-mid-gray)]">{data.calculationNote}</p> : null}
      {typeof currentFloorRate === 'number' && data.breakEvenRate > currentFloorRate ? (
        <p className="text-[11px] font-medium text-[#a05f13]">
          Your floor rate of {formatInr(currentFloorRate)} is below your break-even. Consider raising it.
        </p>
      ) : null}
    </div>
  );
}
