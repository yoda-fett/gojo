import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

export function BaseCard({
  title,
  subtitle,
  controls,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[12px] bg-white p-6 shadow-[0_1px_3px_rgba(26,43,46,0.05),0_1px_2px_rgba(26,43,46,0.03)]',
        className,
      )}
    >
      {title ? (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className={typography.cardTitle}>{title}</h2>
            {subtitle ? <p className={cn('mt-1', typography.supporting)}>{subtitle}</p> : null}
          </div>
          {controls ? <div className="shrink-0">{controls}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
