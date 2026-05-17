'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PackageCheck, Shirt, UserRound, ClipboardList } from 'lucide-react';

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
  userInitial,
  headerExtra,
  children,
  nav = true,
}: {
  dateLabel?: string;
  title: string;
  userInitial?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  nav?: boolean;
}) {
  const pathname = usePathname();

  return (
    <main className="hk-screen">
      <header className="hk-app-header">
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
