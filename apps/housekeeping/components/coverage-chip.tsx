export function CoverageChip({
  done,
  total,
  inProgress,
}: {
  done: number;
  total: number;
  inProgress: number;
}) {
  const remaining = Math.max(total - done, 0);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="hk-coverage">
      <div className="hk-coverage-ring">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#E1ECEA" strokeWidth="5" />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#1DA888"
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="hk-ring-text" style={ total === 0 ? { color: '#9EAEAC' } : undefined }>
          {done}/{total}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {total === 0 ? 'No rooms yet' : `${done} of ${total} rooms done`}
        </div>
        <div style={{ fontSize: 11.5, color: '#5C7170', marginTop: 2 }}>
          {total === 0
            ? "Your manager hasn't published today's list"
            : `${remaining} remaining · ${inProgress} in progress`}
        </div>
        <div className="hk-coverage-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
