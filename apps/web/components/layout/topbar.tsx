import type { ReactNode } from 'react';
import type { Role } from '@gojo/types';
import { Bell } from 'lucide-react';

import { MobileDrawer } from '@/components/layout/mobile-drawer';
import { typography } from '@/lib/typography';
import { formatIST } from '@/lib/tz';
import { cn } from '@/lib/utils';

export function Topbar({ title, subtitle, controls, role }: { title: string; subtitle?: string; controls?: ReactNode; role?: Role }) {
  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-[#e8efee] bg-white px-4 shadow-[0_1px_2px_rgba(26,43,46,0.04)] sm:px-8">
      <div className="flex items-center gap-3">
        <MobileDrawer {...(role ? { role } : {})} />
        <div>
          <h1 className={typography.screenHeading}>{title}</h1>
          <p className={cn('mt-0.5', typography.supporting)}>{subtitle ?? formatIST(new Date())}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {controls}
        <button type="button" aria-label="Notifications" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] border border-[#e8efee] bg-white text-[var(--color-charcoal)]">
          <Bell className="size-4" />
          <span className="absolute right-3 top-3 size-2 rounded-full bg-[var(--color-coral)]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
