'use client';

import { formatInr, formatPercentValue } from '@/lib/format';
import { formatIST } from '@/lib/tz';

export type DualAxisPoint = {
  date: string;
  occupancyRate: number;
  revenue: number;
  roomsOccupied: number;
};

function buildPath(values: number[], width: number, height: number, min: number, max: number) {
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 16) - 8;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function DualAxisChart({ data, todayDate, variant = 'dual' }: { data: DualAxisPoint[]; todayDate?: string; variant?: 'dual' | 'occupancy-only' }) {
  const width = Math.max(data.length * 32, 560);
  const height = 280;
  const occPath = buildPath(data.map((point) => point.occupancyRate), width - 48, height - 32, 0, 100);
  const revenueValues = data.map((point) => point.revenue);
  const revenuePath = buildPath(revenueValues, width - 48, height - 32, 0, Math.max(...revenueValues, 1));
  const todayIndex = todayDate ? data.findIndex((point) => point.date === todayDate) : -1;
  const todayX = todayIndex >= 0 ? (todayIndex / Math.max(data.length - 1, 1)) * (width - 48) : null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full" role="img" aria-label="Occupancy and revenue chart">
          <rect x="0" y="0" width={width} height={height} rx="12" fill="transparent" />
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = height - (tick / 100) * (height - 48) - 20;
            return (
              <g key={tick}>
                <line x1="0" x2={width - 24} y1={y} y2={y} stroke="#e8efee" strokeDasharray="4 4" />
                <text x={width - 18} y={y + 4} fontSize="11" fill="#9EAEAC" textAnchor="end">
                  {tick}%
                </text>
              </g>
            );
          })}
          {todayX != null ? (
            <g>
              <line x1={todayX} x2={todayX} y1="8" y2={height - 12} stroke="#1A2B2E" strokeDasharray="4 4" />
              <text x={todayX + 6} y="18" fontSize="11" fill="#9EAEAC">Today</text>
            </g>
          ) : null}
          <path d={occPath} transform="translate(8 4)" fill="none" stroke="#1DA888" strokeWidth="3" />
          {variant === 'dual' ? <path d={revenuePath} transform="translate(8 4)" fill="none" stroke="#1A2B2E" strokeWidth="3" /> : null}
          {variant === 'occupancy-only' ? <line x1="8" x2={width - 24} y1={height - ((80 / 100) * (height - 48)) - 20} y2={height - ((80 / 100) * (height - 48)) - 20} stroke="#E9C46A" strokeDasharray="5 5" /> : null}
          {data.map((point, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * (width - 48) + 8;
            const y = height - (point.occupancyRate / 100) * (height - 48) - 20;
            return (
              <g key={point.date}>
                <circle cx={x} cy={y} r="4" fill="#1DA888" />
                <title>{`${formatIST(point.date, 'dd MMM yyyy')}: ${formatPercentValue(point.occupancyRate)} occupied, ${formatInr(point.revenue)}, ${point.roomsOccupied} rooms`}</title>
              </g>
            );
          })}
          {data.map((point, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * (width - 48) + 8;
            return (
              <text key={`${point.date}-label`} x={x} y={height - 2} fontSize="10" fill="#9EAEAC" textAnchor="middle">
                {formatIST(point.date, 'dd MMM')}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
