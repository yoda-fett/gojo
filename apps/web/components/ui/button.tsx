import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)]',
  secondary: 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[#e8efee]',
  ghost: 'bg-transparent text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]',
  destructive: 'bg-[var(--color-coral)] text-white hover:opacity-90',
} as const;

// Sized to match the CRS-calendar "+ Booking" canonical brand button.
// Desktop-only app — no 44px touch-target floor needed.
const base =
  'inline-flex items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]';

export function Button({
  variant = 'primary',
  className,
  children,
  href,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; href?: string; children: ReactNode }) {
  if (href) {
    return (
      <Link href={href} className={cn(base, variants[variant], 'no-underline', className)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
