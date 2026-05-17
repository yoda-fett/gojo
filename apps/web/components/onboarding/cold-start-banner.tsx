import Link from 'next/link';

/**
 * Persistent dashboard banner shown when the Owner has dismissed the cold-start
 * wizard via "Skip for now" but has not yet completed onboarding (Story 12.2 AC1).
 * Removed automatically once `coldStartCompletedAt` is stamped (AC5).
 */
export function ColdStartBanner() {
  return (
    <Link
      href="/onboarding"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'rgba(29,168,136,0.10)',
        borderBottom: '1px solid rgba(29,168,136,0.25)',
        color: '#0F7A5E',
        padding: '10px 28px',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      <span>Finish setting up your property</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
