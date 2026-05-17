'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/security', label: 'Security' },
  { href: '/account/app', label: 'App' },
];

export function AccountSubnav() {
  const pathname = usePathname();
  return (
    <nav className="w-[200px] shrink-0">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">Account</div>
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-[rgba(29,168,136,0.12)] font-medium text-[var(--color-teal)]' : 'text-[var(--color-dark-gray)] hover:bg-black/[0.04]'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
