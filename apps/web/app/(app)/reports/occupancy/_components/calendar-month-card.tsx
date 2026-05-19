'use client';

import { useEffect, useMemo, useState } from 'react';

import { CalendarHeatmap } from '@/components/reports/calendar-heatmap';
import { ReportCard } from '@/components/reports/report-card';

type ByDay = { date: string; occupancyPct: number };
type MonthChoice = 'this' | 'last';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Compute first + last day of a calendar month in IST. Returns YYYY-MM-DD keys.
function monthRange(choice: MonthChoice): { from: string; to: string; label: string } {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const baseYear = istNow.getFullYear();
  const baseMonth = istNow.getMonth(); // 0-indexed
  const targetMonth = choice === 'this' ? baseMonth : baseMonth - 1;
  const first = new Date(baseYear, targetMonth, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const from = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`;
  const to = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
  const label = first.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

export function CalendarMonthCard() {
  const [choice, setChoice] = useState<MonthChoice>('this');
  const [data, setData] = useState<ByDay[] | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to, label } = useMemo(() => monthRange(choice), [choice]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/occupancy?startDate=${from}&endDate=${to}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload) => {
        if (cancelled) return;
        setData(payload.byDay ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const switcher = (
    <div className="inline-flex rounded-[8px] border border-[#E8EFEE] bg-white p-0.5">
      {(['this', 'last'] as const).map((value) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setChoice(value)}
            className={
              'rounded-[3px] px-1 py-1 text-[9px] font-semibold transition-colors ' +
              (active
                ? 'bg-[var(--color-teal)] text-white'
                : 'text-[var(--color-mid-gray)] hover:text-[var(--color-charcoal)]')
            }
          >
            {value === 'this' ? 'Current' : 'Last'}
          </button>
        );
      })}
    </div>
  );

  return (
    <ReportCard
      title="Calendar View"
      subtitle={`Daily occupancy % — ${label}`}
      bodyPadding={false}
      controls={switcher}
    >
      {loading ? (
        <div className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
          Loading…
        </div>
      ) : (
        <CalendarHeatmap data={data ?? []} />
      )}
    </ReportCard>
  );
}
