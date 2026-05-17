import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type PageShellContainer = 'fluid' | 'narrow';

export type PageShellProps = {
  children: ReactNode;
  header: ReactNode;
  container?: PageShellContainer;
};

export function PageShell({ children, header, container = 'fluid' }: PageShellProps) {
  return (
    <div>
      {header}
      <main
        className={cn(
          'px-4 py-6 sm:px-8 sm:py-8',
          container === 'narrow' ? 'mx-auto w-full max-w-[1100px]' : '',
        )}
      >
        {children}
      </main>
    </div>
  );
}
