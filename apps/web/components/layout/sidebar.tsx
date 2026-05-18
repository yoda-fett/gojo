'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@gojo/types';
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Cog,
  FileText,
  Home,
  LayoutDashboard,
  Link2,
  Package,
  Receipt,
  Settings2,
  Shield,
  Shirt,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { LogoutButton } from './logout-button';

type PillVariant = 'soon' | 'phase3' | 'roadmap';

type NavLeaf = {
  label: string;
  href: string;
  icon: LucideIcon;
  pill?: PillVariant;
  disabled?: boolean;
  /** Match the pathname exactly — used when a sibling href is a prefix of this one. */
  exact?: boolean;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

type NavSection = { label: string; items: NavEntry[] };

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

export function buildSections(role?: Role): NavSection[] {
  const isOwnerOrManager = role === 'OWNER' || role === 'MANAGER';

  // Settings rail — 12-7a AC1 order + Direct Booking retained (user decision
  // 2026-05-15). Entries whose screens are not built yet are disabled "Soon"
  // (Property Profile/Room Types/Rooms/Users & Roles → 12.7b–e; Rate Plans → 12.7f).
  const settingsItems: NavLeaf[] = [
    { label: 'Switch Board', href: '/settings', icon: Cog, exact: true },
    { label: 'Property Profile', href: '/settings/property-profile', icon: Home },
    { label: 'Room Types', href: '/settings/room-types', icon: LayoutDashboard },
    { label: 'Rooms', href: '/settings/rooms', icon: ClipboardList },
    { label: 'Rate Plans', href: '/settings/rate-plans', icon: Sparkles },
    { label: 'Users & Roles', href: '/settings/users-roles', icon: Users },
    { label: 'Housekeeping Catalog', href: '/settings/housekeeping/catalog', icon: Boxes },
    { label: 'Direct Booking', href: '/settings/direct-booking', icon: Link2 },
  ];

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        { label: 'Front Desk', href: '/front-desk', icon: Home },
        { label: 'CRS Calendar', href: '/crs', icon: CalendarDays },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Bookings', href: '/reservations', icon: BookOpen },
        {
          label: 'Housekeeping',
          icon: Settings2,
          children: [
            { label: 'Board', href: '/housekeeping', icon: LayoutDashboard, exact: true },
            ...(isOwnerOrManager
              ? [{ label: 'Assignments', href: '/housekeeping/assignments', icon: ClipboardList } satisfies NavLeaf]
              : []),
            { label: 'Room Stock', href: '/housekeeping/room-stock', icon: Package },
            { label: 'Laundry', href: '/housekeeping/laundry', icon: Shirt },
            { label: 'Inventory', href: '/housekeeping/inventory', icon: Boxes },
          ],
        },
        { label: 'GST Invoices', href: '/invoices', icon: FileText },
      ],
    },
    {
      label: 'Insights',
      items: [
        { label: 'Revenue', href: '/reports/revenue', icon: TrendingUp },
        { label: 'Occupancy', href: '/reports/occupancy', icon: BarChart3 },
        { label: 'Consumption', href: '/reports/consumption', icon: Package },
        { label: 'Reservations', href: '/reports/reservations', icon: BookOpen },
        { label: 'Folios', href: '/reports/folios', icon: Receipt },
        { label: 'Audit Trail', href: '/audit', icon: Shield },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Channels', href: '/channels', icon: Link2 },
        { label: 'AI Pricing', href: '/ai-pricing', icon: Sparkles, pill: 'roadmap', disabled: true },
      ],
    },
    {
      label: 'Settings',
      items: isOwnerOrManager ? settingsItems : [],
    },
  ];

  return sections.filter((section) => section.items.length > 0);
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
  padding: '7px 20px',
  fontSize: 13.5,
  fontWeight: 400,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  position: 'relative',
  transition: 'color 0.12s, background 0.12s',
  width: '100%',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function leafIsActive(pathname: string, item: NavLeaf): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavRow({ item, active, indent = false }: { item: NavLeaf; active: boolean; indent?: boolean }) {
  const Icon = item.icon;
  const pad = indent ? { paddingLeft: 38 } : null;
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
        style={{ ...NAV_ROW_BASE, ...pad, color: 'rgba(255,255,255,0.22)', cursor: 'default' }}
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
          ? { ...NAV_ROW_BASE, ...pad, color: '#1DA888', fontWeight: 600, background: 'rgba(29,168,136,0.14)' }
          : { ...NAV_ROW_BASE, ...pad, color: 'rgba(255,255,255,0.55)' }
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

function NavGroupRow({
  group,
  pathname,
  open,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  const childActive = group.children.some((child) => !child.disabled && leafIsActive(pathname, child));

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="gojo-nav-item"
        style={
          childActive
            ? { ...NAV_ROW_BASE, color: '#1DA888', fontWeight: 600 }
            : { ...NAV_ROW_BASE, color: 'rgba(255,255,255,0.55)' }
        }
      >
        <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={12} strokeWidth={2} aria-hidden="true" />
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.label}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          aria-hidden="true"
          style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        />
      </button>
      {open
        ? group.children.map((child) => (
            <NavRow key={child.label} item={child} active={leafIsActive(pathname, child)} indent />
          ))
        : null}
    </>
  );
}

function SidebarNav({ role }: { role?: Role }) {
  const pathname = usePathname();
  const sections = buildSections(role);

  // Only Overview is expanded on first load; Manage / Insights / Tools / Settings
  // start collapsed. Nested groups (e.g. Housekeeping) still default open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    'section:Manage': true,
    'section:Insights': true,
    'section:Tools': true,
    'section:Settings': true,
  }));
  const isOpen = (key: string) => !collapsed[key];
  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <nav className="flex-1 overflow-y-auto pt-4 pb-1">
      {sections.map((section, sectionIdx) => {
        const sectionKey = `section:${section.label}`;
        const sectionOpen = isOpen(sectionKey);
        return (
          <div key={section.label}>
            {sectionIdx > 0 ? <div className="mx-4 my-1 h-px bg-white/[0.05]" /> : null}
            <div className="pb-1 pt-3 first:pt-1">
              <button
                type="button"
                onClick={() => toggle(sectionKey)}
                aria-expanded={sectionOpen}
                className="mb-[2px] flex w-full items-center gap-[6px] px-5 text-[10px] font-medium uppercase tracking-[0.12em] text-[rgba(158,174,172,0.6)] transition-colors hover:text-[rgba(158,174,172,0.9)]"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <ChevronDown
                  size={10}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  style={{ transform: sectionOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                />
                {section.label}
              </button>
              {sectionOpen ? (
                <div className="flex flex-col">
                  {section.items.map((entry) =>
                    isGroup(entry) ? (
                      <NavGroupRow
                        key={entry.label}
                        group={entry}
                        pathname={pathname}
                        open={isOpen(`group:${entry.label}`)}
                        onToggle={() => toggle(`group:${entry.label}`)}
                      />
                    ) : (
                      <NavRow key={entry.label} item={entry} active={leafIsActive(pathname, entry)} />
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
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
          <Image src="/assets/logo-old.png" alt="goJo" width={38} height={38} priority className="shrink-0" />
          <div> 
            <div className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[var(--color-teal)]">gojo</div>
            <div className="mt-[2px] text-[11px] font-normal tracking-[0.02em] text-[var(--color-mid-gray)]">
              Hospitality Simplified
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
        <Link
          href="/account/profile"
          className="flex items-center gap-[10px] rounded-md px-1 py-[6px] hover:bg-white/[0.04]"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(29,168,136,0.18)] text-[13px] font-bold text-[var(--color-teal)]">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-white/80">{user?.name ?? 'User'}</div>
            <div className="text-[11px] capitalize text-[var(--color-mid-gray)]">{(user?.role ?? role ?? '').toLowerCase()}</div>
          </div>
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}

export { SidebarNav };
