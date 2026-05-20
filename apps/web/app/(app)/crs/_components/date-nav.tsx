'use client';

import { addDays, subDays } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { formatISTDateKey, todayIST } from '@/lib/tz';

function toDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+05:30`);
}

const NAV_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #E8EFEE',
  background: '#fff',
  color: '#1A2B2E',
  cursor: 'pointer',
};

export function DateNav({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = Math.max(1, Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1);

  function pushWindow(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', nextFrom);
    params.set('to', nextTo);
    router.replace(`/crs?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        style={NAV_BTN_STYLE}
        className="hover:!border-[#1DA888] hover:!text-[#1DA888]"
        onClick={() => pushWindow(formatISTDateKey(subDays(toDate(from), days - 7)), formatISTDateKey(subDays(toDate(to), days - 7)))}
      >
        ← Prev
      </button>
      <button
        type="button"
        style={NAV_BTN_STYLE}
        className="hover:!border-[#1DA888] hover:!text-[#1DA888]"
        onClick={() => pushWindow(todayIST(), formatISTDateKey(addDays(toDate(todayIST()), days - 1)))}
      >
        Today
      </button>
      <button
        type="button"
        style={NAV_BTN_STYLE}
        className="hover:!border-[#1DA888] hover:!text-[#1DA888]"
        onClick={() => pushWindow(formatISTDateKey(addDays(toDate(from), days - 7)), formatISTDateKey(addDays(toDate(to), days - 7)))}
      >
        Next →
      </button>
      <Link
        href="/reservations?new=1"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          background: '#1DA888',
          color: '#fff',
          textDecoration: 'none',
          border: '1px solid #1DA888',
        }}
        className="hover:!bg-[#0A6B58] hover:!border-[#0A6B58]"
      >
        + Booking
      </Link>
    </div>
  );
}
