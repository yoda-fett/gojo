import { LineChart } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

type Point = {
  date: string;
  total: number;
  BOOKINGS: number;
  BILLING: number;
  SETTINGS: number;
  OTHER: number;
};

const W = 680;
const H = 200;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 30;

function pickXLabels(dates: string[]) {
  if (dates.length === 0) return [];
  const idxs = [0, Math.floor(dates.length / 4), Math.floor(dates.length / 2), Math.floor((dates.length * 3) / 4), dates.length - 1];
  const seen = new Set<number>();
  return idxs.filter((i) => {
    if (seen.has(i) || i < 0 || i >= dates.length) return false;
    seen.add(i);
    return true;
  });
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short' });
}

function niceMax(value: number) {
  if (value <= 0) return 5;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / exp;
  const niceM = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return niceM * exp;
}

function buildPath(values: number[], xs: number[], yScale: (v: number) => number) {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${yScale(v)}`).join(' ');
}

const SERIES = [
  { key: 'BOOKINGS' as const, color: '#1DA888', label: 'Bookings' },
  { key: 'BILLING' as const, color: '#E8763F', label: 'Billing' },
  { key: 'SETTINGS' as const, color: '#0A6B58', label: 'Settings' },
  { key: 'OTHER' as const, color: '#9EAEAC', label: 'Other' },
];

export function AuditVolumeChart({ data }: { data: Point[] }) {
  const hasData = data.length > 0 && data.some((p) => p.total > 0);
  if (!hasData) {
    return (
      <EmptyState
        iconTone="gray"
        icon={<LineChart size={22} strokeWidth={1.5} aria-hidden="true" />}
        heading="No audit events in this period"
        body="No tracked actions occurred in the selected date range. Try a different period."
      />
    );
  }

  const dates = data.map((p) => p.date);
  const peak = Math.max(...data.map((p) => p.total), 1);
  const yMax = niceMax(peak);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xs = data.map((_, i) => PAD_L + (i / Math.max(data.length - 1, 1)) * innerW);
  const yScale = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
  const xLabels = pickXLabels(dates);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: PAD_T + innerH - f * innerH, value: yMax * f }));

  return (
    <div className="px-6 pb-6 pt-2">
      <div className="mb-3 flex flex-wrap items-center gap-5">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
            <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {gridLines.map((line) => (
          <g key={line.y}>
            <line x1={PAD_L} y1={line.y} x2={W - PAD_R} y2={line.y} stroke="#F0F5F4" strokeWidth="1" />
            <text x={PAD_L - 4} y={line.y + 3} fontSize="10" fill="#9EAEAC" textAnchor="end">
              {Math.round(line.value)}
            </text>
          </g>
        ))}

        {SERIES.map((s) => (
          <path
            key={s.key}
            d={buildPath(data.map((d) => d[s.key]), xs, yScale)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {xLabels.map((idx) => {
          const isLast = idx === dates.length - 1;
          return (
            <text key={idx} x={xs[idx]} y={H - 8} fontSize="9" fill={isLast ? '#1DA888' : '#9EAEAC'} fontWeight={isLast ? 600 : 400} textAnchor="middle">
              {isLast ? 'Today' : shortDate(dates[idx] ?? '')}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
