'use client';

import { useMemo, useState } from 'react';

import { formatInr, formatPercentValue } from '@/lib/format';

export type OccupancyRevenuePoint = {
  date: string;
  occupancyRate: number;
  revenue: number;
};

type Props = {
  data: OccupancyRevenuePoint[];
  /** Step size between X-axis date labels. 7→1 (label every point), 30→5, 90→15. Default: auto. */
  xLabelStep?: number;
  /** Optional cap on the number of X-axis labels (e.g., 6). */
  xLabelCount?: number;
  /** Hide revenue series and right axis (occupancy-only chart). */
  occupancyOnly?: boolean;
};

const VIEW_W = 620;
const VIEW_H = 220;
const PAD_L = 44;
const PAD_R = 44;
const PAD_T = 12;
const PAD_B = 30;
const INNER_W = VIEW_W - PAD_L - PAD_R;
const INNER_H = VIEW_H - PAD_T - PAD_B;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const m = value / exp;
  const niceM = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return niceM * exp;
}

function formatRevAxis(value: number) {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${Math.round(value)}`;
}

function formatXLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short' });
}

function pickXIndices(length: number, step?: number, count?: number): number[] {
  if (length === 0) return [];
  if (length === 1) return [0];
  if (step && step > 0) {
    const idxs: number[] = [];
    for (let i = 0; i < length; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== length - 1) idxs.push(length - 1);
    return idxs;
  }
  const target = Math.max(2, Math.min(count ?? 6, length));
  const idxs: number[] = [];
  for (let i = 0; i < target; i++) {
    idxs.push(Math.round((i * (length - 1)) / (target - 1)));
  }
  return Array.from(new Set(idxs));
}

export function OccupancyRevenueChart({ data, xLabelStep, xLabelCount, occupancyOnly = false }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { xs, occY, revY, occMax, revMax, gridLines, xLabelIdxs } = useMemo(() => {
    if (data.length === 0) {
      return { xs: [] as number[], occY: [] as number[], revY: [] as number[], occMax: 100, revMax: 1, gridLines: [] as number[], xLabelIdxs: [] as number[] };
    }
    const occMax = 100;
    const revPeak = Math.max(...data.map((d) => d.revenue), 1);
    const revMax = niceMax(revPeak);
    const xs = data.map((_, i) => PAD_L + (i / Math.max(data.length - 1, 1)) * INNER_W);
    const occY = data.map((d) => PAD_T + INNER_H - (d.occupancyRate / occMax) * INNER_H);
    const revY = data.map((d) => PAD_T + INNER_H - (d.revenue / revMax) * INNER_H);
    const gridLines = [0, 0.25, 0.5, 0.75, 1];
    const xLabelIdxs = pickXIndices(data.length, xLabelStep, xLabelCount);
    return { xs, occY, revY, occMax, revMax, gridLines, xLabelIdxs };
  }, [data, xLabelStep, xLabelCount]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center px-6 text-[13px] text-[var(--color-mid-gray)]">
        No data for this period.
      </div>
    );
  }

  function handleMouseMove(event: React.MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const xRatio = (xPx - (PAD_L / VIEW_W) * rect.width) / ((INNER_W / VIEW_W) * rect.width);
    const i = Math.round(xRatio * (data.length - 1));
    if (i >= 0 && i < data.length) setHoverIdx(i);
  }

  function handleMouseLeave() {
    setHoverIdx(null);
  }

  const occPath = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${(xs[i] ?? 0).toFixed(2)},${(occY[i] ?? 0).toFixed(2)}`).join(' ');
  const revPath = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${(xs[i] ?? 0).toFixed(2)},${(revY[i] ?? 0).toFixed(2)}`).join(' ');

  const hoverPoint = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? xs[hoverIdx] : null;
  const tooltipFlipsLeft = hoverX != null && hoverX > VIEW_W - 120;

  return (
    <div className="px-6 pb-6 pt-2">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
          <span className="inline-block h-[2px] w-4 rounded-[1px] bg-[#1DA888]" />
          Occupancy %
        </span>
        {occupancyOnly ? null : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-mid-gray)]">
            <span className="inline-block h-[2px] w-4 rounded-[1px] bg-[#1A2B2E]" />
            Revenue ₹
          </span>
        )}
      </div>

      <svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
        {/* Grid + Y labels */}
        {gridLines.map((f, i) => {
          const y = PAD_T + INNER_H - f * INNER_H;
          const occLabel = `${Math.round(f * occMax)}%`;
          const revLabel = formatRevAxis(f * revMax);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={VIEW_W - PAD_R} y2={y} stroke="#F0F5F4" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 3} fontSize="10" fill="#9EAEAC" textAnchor="end">{occLabel}</text>
              {occupancyOnly ? null : <text x={VIEW_W - PAD_R + 6} y={y + 3} fontSize="10" fill="#9EAEAC" textAnchor="start">{revLabel}</text>}
            </g>
          );
        })}

        {/* Lines */}
        <path d={occPath} fill="none" stroke="#1DA888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {occupancyOnly ? null : <path d={revPath} fill="none" stroke="#1A2B2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

        {/* X labels */}
        {xLabelIdxs.map((idx) => (
          <text key={idx} x={xs[idx]} y={VIEW_H - 10} fontSize="10" fill="#9EAEAC" textAnchor="middle">
            {data[idx] ? formatXLabel(data[idx]!.date) : ''}
          </text>
        ))}

        {/* Crosshair */}
        {hoverPoint && hoverX != null ? (
          <g>
            <line x1={hoverX} y1={PAD_T} x2={hoverX} y2={PAD_T + INNER_H} stroke="#9EAEAC" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hoverX} cy={occY[hoverIdx as number]} r="4" fill="#1DA888" stroke="#fff" strokeWidth="1.5" />
            {occupancyOnly ? null : <circle cx={hoverX} cy={revY[hoverIdx as number]} r="4" fill="#1A2B2E" stroke="#fff" strokeWidth="1.5" />}

            {/* Tooltip */}
            <g transform={`translate(${tooltipFlipsLeft ? hoverX - 116 : hoverX + 8}, ${PAD_T + 6})`}>
              <rect x="0" y="0" width="108" height={occupancyOnly ? 42 : 58} rx="6" fill="#1A2B2E" />
              <text x="10" y="16" fontSize="10" fill="#9EAEAC">{formatXLabel(hoverPoint.date)}</text>
              <text x="10" y="33" fontSize="11" fontWeight="600" fill="#1DA888">{formatPercentValue(hoverPoint.occupancyRate, 0)}</text>
              <text x="40" y="33" fontSize="10" fill="#9EAEAC">Occ.</text>
              {occupancyOnly ? null : (
                <>
                  <text x="10" y="49" fontSize="11" fontWeight="600" fill="#fff">{formatInr(hoverPoint.revenue)}</text>
                  <text x="60" y="49" fontSize="10" fill="#9EAEAC">Rev.</text>
                </>
              )}
            </g>
          </g>
        ) : null}

        {/* Hover capture */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={INNER_W}
          height={INNER_H}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'crosshair' }}
        />
      </svg>
    </div>
  );
}
