'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChevronLeft, ClipboardList, PackageCheck, Shirt, UserRound } from 'lucide-react';

import { SyncIndicator } from './sync-indicator';

const tabs = [
  { href: '/', label: 'My Day', icon: ClipboardList },
  { href: '/storage', label: 'Storage', icon: PackageCheck },
  { href: '/laundry-in', label: 'Laundry In', icon: Shirt },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

export function PwaShell({
  dateLabel,
  title,
  eyebrow,
  subtitle,
  back,
  userInitial,
  headerExtra,
  headerVariant,
  children,
  nav = true,
}: {
  dateLabel?: string;
  title: string;
  // Small uppercase label above the title on inner pages (e.g. "Room").
  // Ignored on root-tab layout (when `back` is not set).
  eyebrow?: string;
  // Context line below the title on inner pages (e.g. "Deluxe King — standard set").
  subtitle?: string;
  // Inner-page mode: when set, the header renders a back-button on the left
  // instead of the date/title block. Pass the href to navigate back to.
  back?: string;
  userInitial?: string;
  headerExtra?: ReactNode;
  // Visual variant for the header chrome. `periodic` adds the orange accent
  // stripe at the top + burnt-orange eyebrow text per wireframe 07.
  headerVariant?: 'periodic';
  children: ReactNode;
  nav?: boolean;
}) {
  const pathname = usePathname();
  const isInner = Boolean(back);

  return (
    <main className="hk-screen">
      <header className={`hk-app-header${headerVariant === 'periodic' ? ' hk-app-header--periodic' : ''}`}>
        {isInner ? (
          <div className="hk-header-inner">
            <Link href={back!} className="hk-back-btn" aria-label="Back">
              <ChevronLeft size={20} strokeWidth={2.4} />
            </Link>
            <div className="hk-header-text">
              {eyebrow ? <div className="hk-header-eyebrow">{eyebrow}</div> : null}
              <h1 className="hk-header-title">{title}</h1>
              {subtitle ? <div className="hk-header-sub">{subtitle}</div> : null}
            </div>
            <div className="hk-header-right">
              <SyncIndicator />
              {userInitial ? <span className="hk-avatar-sm">{userInitial}</span> : null}
            </div>
          </div>
        ) : (
          <div className="hk-header-top">
            <div>
              {dateLabel ? <div className="hk-header-date">{dateLabel}</div> : null}
              <h1 className="hk-header-title">{title}</h1>
            </div>
            <div className="hk-header-right">
              <SyncIndicator />
              {userInitial ? <span className="hk-avatar-sm">{userInitial}</span> : null}
            </div>
          </div>
        )}
        {headerExtra}
      </header>
      {children}
      {nav ? (
        <nav className="hk-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href} className={active ? 'active' : undefined}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </main>
  );
}
