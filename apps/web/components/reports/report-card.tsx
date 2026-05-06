import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyPadding?: boolean;
};

export function ReportCard({
  title,
  subtitle,
  controls,
  children,
  className,
  bodyClassName,
  bodyPadding = true,
}: Props) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[12px] border border-[#F0F5F4] bg-white shadow-[0_1px_3px_rgba(26,43,46,0.05),0_1px_2px_rgba(26,43,46,0.03)]',
        className,
      )}
    >
      <header
        className="flex items-start justify-between gap-4 border-b border-[#F0F5F4]"
        style={{ padding: '20px 24px 16px' }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2B2E' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: '#9EAEAC', marginTop: 2 }}>{subtitle}</div> : null}
        </div>
        {controls ? <div className="shrink-0">{controls}</div> : null}
      </header>
      <div
        className={bodyClassName}
        style={bodyPadding ? { padding: '20px 24px 24px' } : undefined}
      >
        {children}
      </div>
    </section>
  );
}
