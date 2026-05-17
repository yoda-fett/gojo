'use client';

export function ReassignmentBanner({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="hk-banner">
      <div className="hk-banner-icon">!</div>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#5C7170', marginTop: 2, lineHeight: 1.4 }}>{message}</div>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 8, right: 10, border: 0, background: 'transparent', color: '#9EAEAC', fontSize: 18 }}>
        ×
      </button>
    </div>
  );
}
