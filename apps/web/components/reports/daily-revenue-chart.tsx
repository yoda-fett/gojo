import { LineChart } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

type DailyPoint = {
  date: string;
  roomRevenue: number;
  fbRevenue: number;
  priorRevenue?: number;
};

type Props = {
  data: DailyPoint[];
  changeRangeHref?: string;
};

const W = 680;
const H = 190;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 30;

function pickXLabels(dates: string[]) {
  if (dates.length === 0) return [];
  const idxs = [0, Math.floor(dates.length / 5), Math.floor((dates.length * 2) / 5), Math.floor((dates.length * 3) / 5), Math.floor((dates.length * 4) / 5), dates.length - 1];
  const seen = new Set<number>();
  return idxs.filter((i) => {
    if (seen.has(i)) return false;
    seen.add(i);
    return i >= 0 && i < dates.length;
  });
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short' });
}

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / exp;
  const niceM = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return niceM * exp;
}

function formatY(value: number) {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${Math.round(value)}`;
}

function buildPath(values: number[], xs: number[], yScale: (v: number) => number) {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${yScale(v)}`).join(' ');
}

function buildAreaPath(values: number[], xs: number[], yScale: (v: number) => number, baseY: number) {
  const top = buildPath(values, xs, yScale);
  return `${top} L${xs[xs.length - 1]},${baseY} L${xs[0]},${baseY} Z`;
}

export function DailyRevenueChart({ data, changeRangeHref = '/reports/revenue' }: Props) {
  const hasData = data.length > 0 && data.some((p) => p.roomRevenue + p.fbRevenue > 0);

  if (!hasData) {
    return (
      <EmptyState
        iconTone="gray"
        icon={<LineChart size={22} strokeWidth={1.5} aria-hidden="true" />}
        heading="No data for this period"
        body="The property had no recorded activity in the selected date range. Try a different period."
        ctaLabel="Change Date Range"
        ctaHref={changeRangeHref}
      />
    );
  }

  const dates = data.map((p) => p.date);
  const room = data.map((p) => p.roomRevenue);
  const fb = data.map((p) => p.fbRevenue);
  const prior = data.map((p) => p.priorRevenue ?? 0);
  const hasPrior = prior.some((v) => v > 0);

  const peak = Math.max(...room, ...fb, ...prior, 1);
  const yMax = niceMax(peak);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xs = data.map((_, i) => PAD_L + (i / Math.max(data.length - 1, 1)) * innerW);
  const yScale = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
  const baseY = PAD_T + innerH;

  const xLabels = pickXLabels(dates);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: PAD_T + innerH - f * innerH, value: yMax * f }));

  return (
    <div className="px-6 pb-6 pt-2">
      <div className="mb-3 flex flex-wrap items-center gap-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
          <span className="inline-block size-2 rounded-full bg-[#1DA888]" />
          Room Revenue
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
          <span className="inline-block size-2 rounded-full bg-[#E8763F]" />
          F&amp;B / Other
        </span>
        {hasPrior ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
            <span className="inline-block h-[2px] w-4 rounded-[1px] bg-[#E9C46A]" />
            Prior period
          </span>
        ) : null}
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dailyRevRoom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1DA888" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1DA888" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="dailyRevFb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8763F" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#E8763F" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {gridLines.map((line, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={line.y} x2={W - PAD_R} y2={line.y} stroke="#F0F5F4" strokeWidth="1" />
            <text x={PAD_L - 4} y={line.y + 3} fontSize="10" fill="#9EAEAC" textAnchor="end">
              {formatY(line.value)}
            </text>
          </g>
        ))}

        {hasPrior ? (
          <path d={buildPath(prior, xs, yScale)} fill="none" stroke="#E9C46A" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
        ) : null}

        <path d={buildAreaPath(room, xs, yScale, baseY)} fill="url(#dailyRevRoom)" />
        <path d={buildPath(room, xs, yScale)} fill="none" stroke="#1DA888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <path d={buildAreaPath(fb, xs, yScale, baseY)} fill="url(#dailyRevFb)" />
        <path d={buildPath(fb, xs, yScale)} fill="none" stroke="#E8763F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />

        {xLabels.map((idx, i) => {
          const isLast = idx === dates.length - 1;
          return (
            <text key={i} x={xs[idx]} y={H - 8} fontSize="9" fill={isLast ? '#1DA888' : '#9EAEAC'} fontWeight={isLast ? 600 : 400} textAnchor="middle">
              {isLast ? 'Today' : shortDate(dates[idx] ?? '')}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
