'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@gojo/types';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Cog,
  FileText,
  Home,
  LayoutDashboard,
  Link2,
  Receipt,
  Settings2,
  Shield,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type PillVariant = 'soon' | 'phase3' | 'roadmap';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  pill?: PillVariant;
  disabled?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

function buildSections(role?: Role): NavSection[] {
  return [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Front Desk', href: '/front-desk', icon: Home },
        { label: 'CRS Calendar', href: '/crs', icon: CalendarDays, disabled: false },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Bookings', href: '/reservations', icon: BookOpen },
        ...(role === 'OWNER'
          ? [{ label: 'Rate Management', href: '/settings/rates', icon: Sparkles } satisfies NavItem]
          : []),
        { label: 'Housekeeping', href: '/housekeeping', icon: Settings2 },
        { label: 'GST Invoices', href: '/invoices', icon: FileText },
      ],
    },
    {
      label: 'Insights',
      items: [
        { label: 'Revenue', href: '/reports/revenue', icon: TrendingUp },
        { label: 'Occupancy', href: '/reports/occupancy', icon: BarChart3 },
        ...(role === 'OWNER'
          ? [{ label: 'Break-even Setup', href: '/settings/break-even', icon: Receipt } satisfies NavItem]
          : []),
        { label: 'Reservations', href: '/reports/reservations', icon: BookOpen },
        { label: 'Folios', href: '/reports/folios', icon: Receipt },
        { label: 'Audit Trail', href: '/audit', icon: Shield },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Channels', href: '/channels', icon: Link2, pill: 'phase3', disabled: true },
        { label: 'AI Pricing', href: '/ai-pricing', icon: Sparkles, pill: 'roadmap', disabled: true },
      ],
    },
  ];
}

function Pill({ variant }: { variant: PillVariant }) {
  const labels: Record<PillVariant, string> = { soon: 'Soon', phase3: 'Phase 3', roadmap: 'Roadmap' };
  const baseStyle: React.CSSProperties = {
    fontSize: variant === 'soon' ? 9 : 10,
    fontWeight: 500,
    letterSpacing: '0.02em',
    padding: '2px 6px',
    borderRadius: 4,
    marginLeft: 'auto',
  };
  const variantStyle: Record<PillVariant, React.CSSProperties> = {
    soon: { background: 'rgba(158,174,172,0.08)', color: 'rgba(158,174,172,0.4)' },
    phase3: { background: 'rgba(233,196,106,0.12)', color: '#E9C46A' },
    roadmap: { background: 'rgba(29,168,136,0.1)', color: 'rgba(29,168,136,0.6)' },
  };
  return <span style={{ ...baseStyle, ...variantStyle[variant] }}>{labels[variant]}</span>;
}

const NAV_ROW_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '5px 20px',
  fontSize: 12,
  fontWeight: 440,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  position: 'relative',
  transition: 'color 0.12s, background 0.12s',
};

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const inner = (
    <>
      <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
      {item.pill ? <Pill variant={item.pill} /> : null}
    </>
  );

  if (item.disabled) {
    return (
      <span
        aria-label={`${item.label} coming soon`}
        style={{ ...NAV_ROW_BASE, color: 'rgba(255,255,255,0.22)', cursor: 'default' }}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className="gojo-nav-item"
      data-active={active ? 'true' : undefined}
      style={
        active
          ? { ...NAV_ROW_BASE, color: '#1DA888', fontWeight: 600, background: 'rgba(29,168,136,0.14)' }
          : { ...NAV_ROW_BASE, color: 'rgba(255,255,255,0.55)' }
      }
    >
      {active ? (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#1DA888', borderRadius: '0 2px 2px 0' }}
        />
      ) : null}
      {inner}
    </Link>
  );
}

function SidebarNav({ role }: { role?: Role }) {
  const pathname = usePathname();
  const sections = buildSections(role);

  return (
    <nav className="flex-1 overflow-y-auto pt-4 pb-1">
      {sections.map((section, sectionIdx) => (
        <div key={section.label}>
          {sectionIdx > 0 ? <div className="mx-4 my-1 h-px bg-white/[0.05]" /> : null}
          <div className="pb-1 pt-3 first:pt-0">
            <p className="mb-[2px] px-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(158,174,172,0.6)]">
              {section.label}
            </p>
            <div className="flex flex-col">
              {section.items.map((item) => (
                <NavRow key={item.label} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </nav>
  );
}

export type SidebarUser = {
  name: string;
  role: Role;
};

export type SidebarProperty = {
  name: string;
  location?: string | null;
};

export function Sidebar({
  role,
  user,
  property,
}: {
  role?: Role;
  user?: SidebarUser;
  property?: SidebarProperty;
}) {
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? 'U';
  return (
    <aside className="hidden h-screen w-[240px] shrink-0 flex-col bg-[var(--color-charcoal)] text-white xl:fixed xl:inset-y-0 xl:left-0 xl:z-20 xl:flex">
      {/* Logo block */}
      <div className="border-b border-white/[0.07] px-6 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-[10px]">
          <Image src="/assets/gojo-logo.png" alt="Gojo" width={38} height={38} priority className="shrink-0" />
          <div>
            <div className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[var(--color-teal)]">gojo</div>
            <div className="mt-[2px] text-[11px] font-normal tracking-[0.02em] text-[var(--color-mid-gray)]">
              Property Management
            </div>
          </div>
        </Link>
      </div>

      {/* Property selector */}
      {property ? (
        <button
          type="button"
          className="mx-3 mb-1 mt-3 flex items-center justify-between rounded-[8px] border border-white/[0.04] bg-white/[0.06] px-3 py-[10px] text-left transition-colors hover:bg-white/[0.08]"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">{property.name}</div>
            {property.location ? (
              <div className="mt-[1px] truncate text-[11px] text-[var(--color-mid-gray)]">{property.location}</div>
            ) : null}
          </div>
          <ChevronDown className="size-[10px] shrink-0 text-[var(--color-mid-gray)]" strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}

      <SidebarNav {...(role ? { role } : {})} />

      {/* Footer: user + settings */}
      <div className="mt-auto border-t border-white/[0.07] p-4">
        <div className="flex items-center gap-[10px] px-1 py-[6px]">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(29,168,136,0.18)] text-[13px] font-bold text-[var(--color-teal)]">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-white/80">{user?.name ?? 'User'}</div>
            <div className="text-[11px] capitalize text-[var(--color-mid-gray)]">{(user?.role ?? role ?? '').toLowerCase()}</div>
          </div>
        </div>
        <Link
          href="/settings"
          className="mt-1 flex items-center gap-[10px] px-1 py-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 400 }}
        >
          <Cog size={13} strokeWidth={2} aria-hidden="true" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

export { SidebarNav };
