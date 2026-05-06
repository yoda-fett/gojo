import { formatPercentValue } from '@/lib/format';

export function WeekdayPatternBars({ data }: { data: { weekday: string; avgOccupancyPct: number }[] }) {
  return (
    <div className="flex h-[140px] items-end gap-2 px-6 pb-6 pt-5">
      {data.map((item) => {
        const opacity = item.avgOccupancyPct >= 80 ? 1 : item.avgOccupancyPct >= 60 ? 0.8 : item.avgOccupancyPct >= 40 ? 0.55 : item.avgOccupancyPct >= 20 ? 0.3 : 0.12;
        return (
          <div key={item.weekday} className="flex flex-1 flex-col items-center gap-1.5">
            <p className="text-[10px] font-bold text-[var(--color-charcoal)]">{formatPercentValue(item.avgOccupancyPct, 0)}</p>
            <div className="flex h-20 w-full items-end overflow-hidden rounded-t-[6px] bg-[#F0F5F4]">
              <div className="w-full rounded-t-[6px] bg-[var(--color-teal)]" style={{ height: `${Math.max(16, item.avgOccupancyPct)}%`, opacity }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">{item.weekday}</p>
          </div>
        );
      })}
    </div>
  );
}
