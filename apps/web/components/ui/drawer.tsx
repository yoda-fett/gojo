'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 520,
  footer,
  dismissOnBackdropClick = true,
  children,
  ariaLabelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  width?: number;
  footer?: ReactNode;
  dismissOnBackdropClick?: boolean;
  children: ReactNode;
  ariaLabelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = ariaLabelledBy ?? 'drawer-title';

  // Keep the latest onClose without re-running the open effect — otherwise an
  // inline onClose (new identity each render) would re-fire focus-on-open on
  // every keystroke, stealing focus back to the first focusable element.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((node) => !node.hasAttribute('data-drawer-focus-skip'));
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKey);

    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      const trigger = triggerRef.current as HTMLElement | null;
      trigger?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(16,33,28,0.42)]"
      onClick={dismissOnBackdropClick ? onClose : undefined}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute right-0 top-0 flex h-full flex-col bg-white shadow-[0_18px_48px_rgba(16,33,28,0.18)]"
        style={{ width: `min(${width}px, 92vw)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e3ece9] bg-white px-6 py-4">
          <div>
            {title ? (
              <h2 id={titleId} className="text-[18px] font-semibold text-[var(--color-charcoal)]">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              'inline-flex min-h-9 min-w-9 items-center justify-center rounded-[8px] border border-[#d7e3e0] text-[14px] text-[var(--color-charcoal)]',
              'hover:bg-[#f3f7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]',
            )}
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 border-t border-[#e3ece9] bg-white px-6 py-4">{footer}</footer>
        ) : null}
      </aside>
    </div>
  );
}
