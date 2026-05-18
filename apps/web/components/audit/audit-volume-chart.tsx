import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

type Point = {
  date: string;
  total: number;
  flagged: number;
  BOOKINGS: number;
  BILLING: number;
  SETTINGS: number;
  OTHER: number;
};

const W = 680;
const H = 220;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

const COLOR_NORMAL = '#3DAE92';
const COLOR_FLAGGED = '#E8763F';

function niceMax(value: number) {
  if (value <= 0) return 5;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / exp;
  const niceM = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return niceM * exp;
}

function dayOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return String(d.getDate());
}

export function AuditVolumeChart({ data }: { data: Point[] }) {
  const hasData = data.length > 0 && data.some((p) => p.total > 0);
  if (!hasData) {
    return (
      <EmptyState
        iconTone="gray"
        icon={<BarChart3 size={22} strokeWidth={1.5} aria-hidden="true" />}
        heading="No audit events in this period"
        body="No tracked actions occurred in the selected date range. Try a different period."
      />
    );
  }

  const peak = Math.max(...data.map((p) => p.total), 1);
  const yMax = niceMax(peak);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = data.length;
  // Tune bar width relative to slot so bars are slim but readable.
  const slotW = innerW / n;
  const barW = Math.max(6, Math.min(28, slotW * 0.55));
  const yScale = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const flaggedCap = Math.max(4, Math.min(8, slotW * 0.18));

  return (
    <div className="px-6 pb-6 pt-2">
      <div className="mb-3 flex items-center justify-end gap-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
          <span className="inline-block size-2 rounded-full" style={{ background: COLOR_NORMAL }} />
          Normal
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
          <span className="inline-block size-2 rounded-full" style={{ background: COLOR_FLAGGED }} />
          Flagged
        </span>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {gridSteps.map((f) => {
          const y = PAD_T + innerH - f * innerH;
          const value = Math.round(yMax * f);
          return (
            <g key={f}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#F0F5F4" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 3} fontSize="10" fill="#9EAEAC" textAnchor="end">
                {value}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = PAD_L + slotW * (i + 0.5);
          const x = cx - barW / 2;
          const normalCount = Math.max(0, d.total - d.flagged);
          const yNormalTop = yScale(normalCount);
          const normalH = PAD_T + innerH - yNormalTop;
          const flaggedTop = yScale(d.total);
          return (
            <g key={d.date}>
              {normalCount > 0 ? (
                <rect
                  x={x}
                  y={yNormalTop}
                  width={barW}
                  height={normalH}
                  rx={2}
                  fill={COLOR_NORMAL}
                />
              ) : null}
              {d.flagged > 0 ? (
                <rect
                  x={x}
                  y={flaggedTop}
                  width={barW}
                  height={flaggedCap}
                  rx={2}
                  fill={COLOR_FLAGGED}
                />
              ) : null}
              <text x={cx} y={H - 8} fontSize="10" fill="#9EAEAC" textAnchor="middle">
                {dayOfMonth(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
