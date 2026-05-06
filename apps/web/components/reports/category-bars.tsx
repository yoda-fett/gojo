import { formatInr } from '@/lib/format';

type Row = { category: string; label: string; grossPosted: number };

const COLORS: Record<string, string> = {
  ROOM_CHARGE: '#1DA888',
  EXTRA_CHARGE: '#0A6B58',
  PAYMENT: '#1DA888',
  DISCOUNT: '#E9C46A',
  REFUND: '#E8763F',
  TAX_ADJUSTMENT: '#9EAEAC',
};

export function CategoryBars({ data }: { data: Row[] }) {
  const sorted = [...data].sort((a, b) => b.grossPosted - a.grossPosted);
  const max = Math.max(...sorted.map((row) => row.grossPosted), 1);

  if (sorted.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
        No charges posted in this period.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 px-6 pb-6 pt-2">
      {sorted.map((row) => {
        const widthPct = max > 0 ? (row.grossPosted / max) * 100 : 0;
        const color = COLORS[row.category] ?? '#9EAEAC';
        return (
          <div key={row.category} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-right text-[12px] text-[var(--color-charcoal)]">{row.label}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-[4px] bg-[#F0F5F4]">
              <div className="h-full rounded-[4px]" style={{ width: `${Math.max(widthPct, 4)}%`, backgroundColor: color }} />
            </div>
            <span className="w-24 shrink-0 text-right text-[12px] font-semibold text-[var(--color-charcoal)]">
              {formatInr(row.grossPosted)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
