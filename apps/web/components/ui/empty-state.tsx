import Link from 'next/link';
import type { ReactNode } from 'react';

export type EmptyStateReason = 'unconfigured' | 'quiet' | 'filter-no-results';

type EmptyStateProps = {
  icon: ReactNode;
  heading: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  iconTone?: 'teal' | 'gray' | 'amber';
  /**
   * Why is this state empty? Drives tone defaults so the user can tell apart
   * "you haven't configured this yet" from "today is just quiet" from
   * "your filters return nothing".
   *   - `unconfigured` (default): action expected, keep the CTA strong
   *   - `quiet`: soft tone, no CTA (overrides any cta props)
   *   - `filter-no-results`: defaults icon to gray + cta copy to "Clear filters"
   */
  reason?: EmptyStateReason;
};

const ICON_TONE_BG: Record<NonNullable<EmptyStateProps['iconTone']>, string> = {
  teal: 'rgba(29,168,136,0.10)',
  gray: 'rgba(158,174,172,0.10)',
  amber: 'rgba(233,196,106,0.10)',
};

const ICON_TONE_FG: Record<NonNullable<EmptyStateProps['iconTone']>, string> = {
  teal: '#1DA888',
  gray: '#9EAEAC',
  amber: '#C49A10',
};

export function EmptyState({
  icon,
  heading,
  body,
  ctaLabel,
  ctaHref,
  onCtaClick,
  iconTone,
  reason = 'unconfigured',
}: EmptyStateProps) {
  const resolvedIconTone: NonNullable<EmptyStateProps['iconTone']> =
    iconTone ?? (reason === 'filter-no-results' || reason === 'quiet' ? 'gray' : 'teal');

  const showCta = reason !== 'quiet';
  const resolvedCtaLabel = showCta
    ? ctaLabel ?? (reason === 'filter-no-results' ? 'Clear filters' : undefined)
    : undefined;

  const cta = resolvedCtaLabel
    ? ctaHref
      ? (
        <Link
          href={ctaHref}
          style={{
            marginTop: 4,
            padding: '9px 20px',
            borderRadius: 8,
            background: '#1DA888',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          {resolvedCtaLabel}
        </Link>
        )
      : (
        <button
          type="button"
          onClick={onCtaClick}
          style={{
            marginTop: 4,
            padding: '9px 20px',
            borderRadius: 8,
            background: '#1DA888',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {resolvedCtaLabel}
        </button>
        )
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: ICON_TONE_BG[resolvedIconTone],
          color: ICON_TONE_FG[resolvedIconTone],
        }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A2B2E', margin: 0 }}>{heading}</h2>
      {body ? (
        <p style={{ fontSize: 13, color: '#9EAEAC', lineHeight: 1.6, maxWidth: 260, margin: 0 }}>{body}</p>
      ) : null}
      {cta}
    </div>
  );
}
