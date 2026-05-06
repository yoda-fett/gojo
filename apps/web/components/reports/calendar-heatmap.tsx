import { formatPercentValue } from '@/lib/format';
import { todayIST } from '@/lib/tz';
import { cn } from '@/lib/utils';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseKey(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function getCellColor(pct: number, isFuture: boolean) {
  if (isFuture) return '#F8FCFB';
  if (pct === 0) return '#F0F5F4';
  if (pct < 25) return 'rgba(29, 168, 136, 0.12)';
  if (pct < 50) return 'rgba(29, 168, 136, 0.28)';
  if (pct < 75) return 'rgba(29, 168, 136, 0.50)';
  if (pct < 90) return 'rgba(29, 168, 136, 0.72)';
  return '#1DA888';
}

function isLightBg(pct: number, isFuture: boolean) {
  if (isFuture) return true;
  // White text once the teal background is dense enough.
  return pct < 75;
}

export function CalendarHeatmap({ data }: { data: { date: string; occupancyPct: number }[] }) {
  const today = todayIST();
  if (data.length === 0) {
    return <div className="px-6 py-6 text-[13px] text-[var(--color-mid-gray)]">No data.</div>;
  }

  const firstWeekday = parseKey(data[0]!.date).getDay();
  const leadingPad = Array.from({ length: firstWeekday });

  return (
    <div className="space-y-4 px-6 pb-6 pt-5">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={`hdr-${i}`} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">
            {letter}
          </div>
        ))}
        {leadingPad.map((_, i) => (
          <div key={`pad-${i}`} aria-hidden="true" />
        ))}
        {data.map((day) => {
          const isFuture = day.date > today;
          const isToday = day.date === today;
          const lightBg = isLightBg(day.occupancyPct, isFuture);
          const fg = lightBg ? (isFuture ? '#C8D8D6' : '#1A2B2E') : '#fff';
          return (
            <div key={day.date}>
              <div
                className={cn(
                  'mx-auto flex aspect-square w-full max-w-[44px] flex-col items-center justify-between rounded-[5px] px-0.5 py-1',
                  isToday && 'outline outline-2 outline-[var(--color-teal)]',
                )}
                style={{ backgroundColor: getCellColor(day.occupancyPct, isFuture), color: fg }}
                title={isFuture ? day.date : `${day.date}: ${formatPercentValue(day.occupancyPct)} occupancy`}
              >
                <span className="text-[18px] font-semibold leading-none">{parseKey(day.date).getDate()}</span>
                {isFuture ? (
                  <span className="text-[8px] leading-none opacity-0">—</span>
                ) : (
                  <span className="text-[8px] leading-none">{formatPercentValue(day.occupancyPct, 0)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-mid-gray)]">
        {[0, 50, 75, 100].map((value) => (
          <span key={value} className="inline-flex items-center gap-2">
            <span className="inline-flex size-3 rounded-[3px]" style={{ backgroundColor: getCellColor(value, false) }} />
            {`${value}%`}
          </span>
        ))}
        <span className="ml-2 inline-flex items-center gap-2">
          <span className="inline-flex size-3 rounded-[3px] outline outline-2 outline-[var(--color-teal)]" />
          Today
        </span>
      </div>
    </div>
  );
}
