import { cn } from '@/lib/utils';

const variants = {
  positive: 'bg-[rgba(29,168,136,0.12)] text-[var(--color-teal-dark)]',
  negative: 'bg-[rgba(232,118,63,0.12)] text-[var(--color-coral)]',
  caution: 'bg-[rgba(233,196,106,0.18)] text-[#9a6a12]',
  neutral: 'bg-[rgba(158,174,172,0.18)] text-[var(--color-charcoal)]',
} as const;

export function Chip({ children, variant = 'neutral', className }: { children: React.ReactNode; variant?: keyof typeof variants; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-8 items-center rounded-[8px] px-3 text-[12px] font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
