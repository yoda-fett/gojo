import Link from 'next/link';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon: ReactNode;
  heading: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  iconTone?: 'teal' | 'gray' | 'amber';
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

export function EmptyState({ icon, heading, body, ctaLabel, ctaHref, onCtaClick, iconTone = 'teal' }: EmptyStateProps) {
  const cta = ctaLabel
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
          {ctaLabel}
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
          {ctaLabel}
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
          background: ICON_TONE_BG[iconTone],
          color: ICON_TONE_FG[iconTone],
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
