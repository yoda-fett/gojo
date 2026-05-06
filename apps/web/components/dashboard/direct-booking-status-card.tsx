'use client';
// @ts-nocheck
import Link from 'next/link';
import { formatIST } from '@/lib/tz';

interface RecentBooking {
  id: string;
  bookingReference: string | null;
  guestName: string;
  checkIn: Date | string;
}

export function DirectBookingStatusCard({
  enabled,
  bookingSlug,
  publicUrl,
  recent,
  directBookingCount,
  estimatedCommissionSaved,
  averageOtaCommissionRate,
}: {
  enabled: boolean;
  bookingSlug: string | null;
  publicUrl: string | null;
  recent: RecentBooking[];
  directBookingCount: number;
  estimatedCommissionSaved: number;
  averageOtaCommissionRate: number;
}) {
  if (!enabled || !bookingSlug || !publicUrl) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-3 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-slate-100 text-2xl">🔌</div>
        <h3 className="text-base font-semibold text-slate-900">Direct booking not connected</h3>
        <p className="mt-1 text-sm text-slate-600">
          Enable direct booking to take reservations without OTA commissions.
        </p>
        <Link
          href="/settings/direct-booking"
          className="mt-3 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Enable direct booking →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Direct booking</h3>
          <span className="mt-1 inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
            Enabled
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Saved</p>
          <p className="text-lg font-semibold text-slate-900">
            ₹{Math.round(estimatedCommissionSaved).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500">in OTA commissions ({Math.round(averageOtaCommissionRate * 100)}%)</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Public booking URL</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <code className="truncate text-sm text-slate-700">{publicUrl}</code>
          <CopyButton value={publicUrl} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-500">Recent direct bookings</p>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No direct bookings yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {r.bookingReference ?? r.id.slice(-6).toUpperCase()} · {r.guestName}
                </span>
                <span className="text-slate-500">{formatIST(r.checkIn, 'dd MMM')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/reports/reservations?source=DIRECT_BOOKING"
        className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
      >
        Manage direct booking →
      </Link>
      <p className="mt-2 text-xs text-slate-400">{directBookingCount} bookings in selected range</p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      data-copy={value}
      onClick={(e) => {
        const v = (e.currentTarget as HTMLButtonElement).dataset.copy ?? '';
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(v).catch(() => undefined);
        }
      }}
      className="rounded-md bg-white px-2 py-1 text-xs font-medium text-teal-700 shadow-sm hover:bg-teal-50"
    >
      Copy
    </button>
  );
}
