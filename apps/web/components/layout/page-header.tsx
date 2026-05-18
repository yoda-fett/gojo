import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, ChevronRight } from 'lucide-react';

import { typography } from '@/lib/typography';
import { cn } from '@/lib/utils';

export type Crumb = { label: string; href?: string };

export type PageHeaderVariant = 'list' | 'detail' | 'minimal';

export type PageHeaderProps = {
  variant?: PageHeaderVariant;
  eyebrow?: string | Crumb[];
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label?: string };
  controls?: ReactNode;
  primary?: ReactNode;
  notifications?: boolean;
};

const DEFAULT_NOTIFICATIONS: Record<PageHeaderVariant, boolean> = {
  list: true,
  detail: false,
  minimal: false,
};

function Eyebrow({ value }: { value: NonNullable<PageHeaderProps['eyebrow']> }) {
  if (typeof value === 'string') {
    return <div className={cn(typography.supporting, 'text-[12px] uppercase tracking-[0.08em]')}>{value}</div>;
  }
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--color-mid-gray)]">
      {value.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-[var(--color-charcoal)]">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[var(--color-charcoal)]">{crumb.label}</span>
          )}
          {i < value.length - 1 ? <ChevronRight className="size-3 text-[var(--color-mid-gray)]" aria-hidden="true" /> : null}
        </span>
      ))}
    </nav>
  );
}

function NotificationsBell() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative inline-flex size-9 items-center justify-center rounded-[8px] border border-[var(--color-line-soft)] bg-white text-[var(--color-charcoal)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
    >
      <Bell className="size-4" />
      <span className="absolute right-3 top-3 size-2 rounded-full bg-[var(--color-coral)]" aria-hidden="true" />
    </button>
  );
}

export function PageHeader({
  variant = 'list',
  eyebrow,
  title,
  subtitle,
  back,
  controls,
  primary,
  notifications,
}: PageHeaderProps) {
  const showNotifications = notifications ?? DEFAULT_NOTIFICATIONS[variant];

  if (variant === 'minimal' && primary) {
    // primary CTA is contractually not allowed on minimal — silently ignore so a misuse can't slip past types
    primary = undefined;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-line-soft)] bg-white shadow-[0_1px_2px_rgba(26,43,46,0.04)]">
      <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label ?? 'Back'}
              className="mt-0.5 inline-flex size-9 items-center justify-center rounded-[8px] border border-[var(--color-line-soft)] bg-white text-[var(--color-charcoal)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <Eyebrow value={eyebrow} /> : null}
            <h1 className={cn(typography.screenHeading, eyebrow ? 'mt-0.5' : '')}>{title}</h1>
            {subtitle ? <div className={cn('mt-0.5', typography.supporting)}>{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {controls}
          {primary}
          {showNotifications ? <NotificationsBell /> : null}
        </div>
      </div>
    </header>
  );
}
