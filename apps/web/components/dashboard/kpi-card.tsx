import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { formatPercentValue } from '@/lib/format';
import { cn } from '@/lib/utils';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 160;
  const height = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-2 h-7 w-full" role="img" aria-label="KPI sparkline">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  sparkline,
  drilldownHref,
  drilldownLabel,
  alertState,
  valueSize = 'lg',
}: {
  label: string;
  value: string | number | null | undefined;
  trend?: { direction: 'up' | 'down' | 'flat'; pct: number; label: string };
  sparkline?: number[];
  drilldownHref?: string;
  drilldownLabel?: string;
  alertState?: boolean;
  valueSize?: 'lg' | 'md';
}) {
  const displayValue = value ?? '—';
  const trendColor = trend?.direction === 'down'
    ? 'text-[var(--color-coral)]'
    : trend?.direction === 'up'
      ? 'text-[var(--color-teal)]'
      : 'text-[var(--color-mid-gray)]';
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : trend?.direction === 'up' ? ArrowUpRight : ArrowRight;
  const sparkColor = trend?.direction === 'down' ? '#E8763F' : trend?.direction === 'flat' ? '#9EAEAC' : '#1DA888';

  const dogEarGradient = alertState
    ? 'linear-gradient(225deg, #F4F9F8 45%, #F0C4AA 50%, #E8763F 55%)'
    : 'linear-gradient(225deg, #F4F9F8 45%, #B8DDD5 50%, #1DA888 55%)';

  const card = (
    <div
      className={cn(
        'group relative flex h-full min-h-[150px] flex-col gap-[6px] overflow-hidden rounded-[12px] border bg-white px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(26,43,46,0.05),0_1px_2px_rgba(26,43,46,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(26,43,46,0.10)]',
        alertState ? 'border-[#FCE9DF]' : 'border-transparent',
      )}
    >
      {/* Dog-ear fold */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 size-4 rounded-bl-[12px] rounded-tr-[12px] shadow-[-2px_2px_6px_rgba(26,43,46,0.14)]"
        style={{ background: dogEarGradient }}
      />
      <p className="text-[13px] font-normal text-[var(--color-mid-gray)]">{label}</p>
      <p
        className={cn(
          'font-bold leading-[1.05] tracking-[-0.5px] text-[var(--color-charcoal)]',
          valueSize === 'md' ? 'text-[26px]' : 'text-[34px] tracking-[-1px]',
          alertState && 'text-[var(--color-coral)]',
        )}
      >
        {displayValue}
      </p>
      {trend ? (
        <div className={cn('flex items-center gap-1 text-[12.5px] font-medium', alertState ? 'text-[var(--color-coral)]' : trendColor)}>
          <TrendIcon className="size-[13px]" strokeWidth={2.5} aria-hidden="true" />
          <span>
            {trend.direction === 'flat' ? 'Same as' : trend.direction === 'up' ? 'Up' : 'Down'}{' '}
            {trend.direction === 'flat' ? '' : `${formatPercentValue(Math.abs(trend.pct), 0)} `}
            {trend.label}
          </span>
        </div>
      ) : null}
      {sparkline?.length ? <Sparkline data={sparkline} color={sparkColor} /> : null}
      {drilldownHref && drilldownLabel ? (
        <span className="mt-1 text-[12px] font-medium text-[var(--color-coral)]">{drilldownLabel} →</span>
      ) : null}
    </div>
  );

  return drilldownHref ? (
    <Link href={drilldownHref} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
