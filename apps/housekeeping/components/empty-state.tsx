'use client';

export function EmptyState({
  offline,
  onRetry,
}: {
  offline?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="hk-empty">
      <div className="hk-empty-illus">{offline ? '☁' : '☀'}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{offline ? 'Connecting…' : 'All clear for now'}</div>
      <div style={{ fontSize: 13, color: '#5C7170', lineHeight: 1.5, maxWidth: 260 }}>
        {offline
          ? "Your rooms will appear here once you're back online — or as soon as your manager assigns them."
          : 'No rooms are assigned to you for today yet.'}
      </div>
      {offline && onRetry ? (
        <button type="button" className="hk-empty-cta" onClick={onRetry}>
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
