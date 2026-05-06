const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  CONFIRMED: { bg: '#FEF8E2', color: '#7A6200' },
  ARRIVING_TODAY: { bg: '#FEF8E2', color: '#7A6200' },
  CHECKED_IN: { bg: '#E8F9F5', color: '#0A6B58' },
  CHECKING_OUT_TODAY: { bg: '#FEF8E2', color: '#7A6200' },
  CHECKED_OUT: { bg: '#F4F9F8', color: '#9EAEAC' },
  CANCELLED: { bg: '#FEF0EB', color: '#A03A10' },
  NO_SHOW: { bg: '#FEF0EB', color: '#A03A10' },
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  ARRIVING_TODAY: 'Arriving Today',
  CHECKED_IN: 'Checked In',
  CHECKING_OUT_TODAY: 'Checking Out',
  CHECKED_OUT: 'Checked Out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.CONFIRMED;
  const label = STATUS_LABELS[status] ?? status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        background: style.bg,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}
