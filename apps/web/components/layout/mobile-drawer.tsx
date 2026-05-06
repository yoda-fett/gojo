'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { Role } from '@gojo/types';

import { Button } from '@/components/ui/button';
import { SidebarNav } from '@/components/layout/sidebar';

export function MobileDrawer({ role }: { role?: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] border border-[#d7e3e0] bg-white text-[var(--color-charcoal)]"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-[rgba(26,43,46,0.48)]" onClick={() => setOpen(false)}>
          <div className="h-full w-[min(320px,88vw)] bg-[var(--color-charcoal)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 text-white">
              <p className="text-[18px] font-semibold">Navigation</p>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <SidebarNav {...(role ? { role } : {})} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
