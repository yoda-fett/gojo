import { formatPercentValue } from '@/lib/format';

export function ReportKpiCard({ label, value, subLabel, delta, deltaLabel }: { label: string; value: string; subLabel: string; delta: number; deltaLabel?: string }) {
  const deltaTone =
    delta > 0
      ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]'
      : delta < 0
        ? 'bg-[rgba(232,118,63,0.1)] text-[#C45A20]'
        : 'bg-[rgba(158,174,172,0.12)] text-[#9EAEAC]';

  return (
    <div className="relative overflow-hidden rounded-[12px] bg-white px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(26,43,46,0.05),0_1px_2px_rgba(26,43,46,0.03)]">
      <div className="absolute right-0 top-0 h-4 w-4 rounded-bl-[12px] bg-[linear-gradient(225deg,#F4F9F8_45%,#B8DDD5_50%,#1DA888_55%)] shadow-[-2px_2px_6px_rgba(26,43,46,0.14)]" />
      <p className="text-[11px] font-medium uppercase tracking-[0.055em] text-[var(--color-mid-gray)]">{label}</p>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.05em] text-[var(--color-charcoal)]">{value}</p>
      <p className="mt-1.5 text-[12px] text-[var(--color-mid-gray)]">{subLabel}</p>
      <div className={`mt-3 inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${deltaTone}`}>
        <span>{delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}</span>
        <span>{formatPercentValue(Math.abs(delta))} {deltaLabel ?? 'vs prior period'}</span>
      </div>
    </div>
  );
}
