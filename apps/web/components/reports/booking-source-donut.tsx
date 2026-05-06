import { formatInr, formatPercentValue } from '@/lib/format';

export function BookingSourceDonut({
  data,
  valueKey,
  totalLabel,
  centerValue,
  variant = 'revenue',
}: {
  data: { source: string; sharePct: number; [key: string]: number | string }[];
  valueKey: string;
  totalLabel: string;
  centerValue: string;
  variant?: 'revenue' | 'occupancy';
}) {
  const colors = ['#1DA888', '#1A2B2E', '#E9C46A', '#9EAEAC'];
  let start = 0;

  return (
    <div className={`flex items-center ${variant === 'occupancy' ? 'gap-2' : 'gap-3'}`}>
      <div className={`relative shrink-0 ${variant === 'occupancy' ? 'h-[140px] w-[140px]' : 'h-[130px] w-[130px]'}`}>
      <svg viewBox="0 0 180 180" className={variant === 'occupancy' ? 'h-[140px] w-[140px]' : 'h-[130px] w-[130px]'}>
        <circle cx="90" cy="90" r="68" fill="none" stroke="#edf3f1" strokeWidth="24" />
        {data.map((item, index) => {
          const circumference = 2 * Math.PI * 68;
          const length = (Number(item.sharePct) / 100) * circumference;
          const dash = `${length} ${circumference - length}`;
          const rotation = start;
          start += (Number(item.sharePct) / 100) * 360;
          return (
            <circle
              key={item.source}
              cx="90"
              cy="90"
              r="68"
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="24"
              strokeDasharray={dash}
              transform={`rotate(${rotation - 90} 90 90)`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={variant === 'occupancy' ? 'text-[22px] font-bold text-[var(--color-charcoal)]' : 'text-[18px] font-bold text-[var(--color-charcoal)]'}>{centerValue}</p>
        <p className="text-[10px] uppercase tracking-[0.05em] text-[var(--color-mid-gray)]">{totalLabel}</p>
      </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {data.map((item, index) => (
          <div key={item.source} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colors[index % colors.length] }} />
            <p className="flex-1 text-[12px] text-[var(--color-charcoal)]">{item.source}</p>
            {variant === 'occupancy' ? (
              <>
                <div className="h-1 w-8 overflow-hidden rounded-[2px] bg-[#F0F5F4]">
                  <div className="h-full rounded-[2px]" style={{ width: `${item.sharePct}%`, backgroundColor: colors[index % colors.length] }} />
                </div>
                <p className="w-[12px] text-right text-[10px] font-semibold text-[var(--color-charcoal)]">{formatPercentValue(Number(item.sharePct), 0)}</p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-semibold text-[var(--color-charcoal)]">
                  {typeof item[valueKey] === 'number' ? formatInr(Number(item[valueKey])) : item[valueKey]}
                </p>
                <p className="w-[44px] text-right text-[11px] text-[var(--color-mid-gray)]">{formatPercentValue(Number(item.sharePct), 0)}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
