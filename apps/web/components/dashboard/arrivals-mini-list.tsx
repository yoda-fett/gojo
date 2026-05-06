import Link from 'next/link';

import { BaseCard } from '@/components/ui/base-card';
import { Chip } from '@/components/ui/chip';
import { formatISTTime } from '@/lib/tz';

export type ArrivalRow = {
  bookingRef: string;
  guestName: string;
  roomType: string;
  checkInTime: string;
  status: string;
};

export function ArrivalsMiniList({ rows, emptyState }: { rows: ArrivalRow[]; emptyState?: React.ReactNode }) {
  return (
    <BaseCard title="Arrivals Today" subtitle={rows.length ? `${rows.length} bookings to watch` : 'No check-ins due today'}>
      {rows.length === 0 ? (
        emptyState ?? <p className="text-[13px] text-[var(--color-mid-gray)]">No arrivals today.</p>
      ) : (
        <div className="space-y-4">
          {rows.slice(0, 5).map((row) => (
            <div key={row.bookingRef} className="grid gap-2 rounded-[10px] border border-[#edf3f1] p-3 md:grid-cols-[120px_1fr_auto_auto] md:items-center">
              <p className="font-mono text-[12px] text-[var(--color-mid-gray)]">{row.bookingRef}</p>
              <div>
                <p className="text-[13.5px] font-medium text-[var(--color-charcoal)]">{row.guestName}</p>
                <p className="text-[12px] text-[var(--color-mid-gray)]">{row.roomType}</p>
              </div>
              <p className="text-[13px] text-[var(--color-charcoal)]">{formatISTTime(row.checkInTime)}</p>
              <Chip variant={row.status === 'CHECKED_IN' ? 'positive' : 'neutral'}>{row.status === 'CHECKED_IN' ? 'Checked In' : 'Arriving Today'}</Chip>
            </div>
          ))}
          <Link href="/reservations" className="inline-flex text-[13px] font-semibold text-[var(--color-teal-dark)]">
            View full bookings →
          </Link>
        </div>
      )}
    </BaseCard>
  );
}
