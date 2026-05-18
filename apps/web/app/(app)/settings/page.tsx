// @ts-nocheck
import { prisma } from '@gojo/db';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { getServerActor } from '@/lib/auth/server-actor';

// Settings home (Story 12.7a) — index surface for every configuration section,
// with a setup-status strip and per-section status derived from real DB state.
// The /settings RBAC guard lives in the route-group layout.

type CardStatus = { label: string; tone: 'ok' | 'warn' | 'neutral' };

export default async function SettingsHomePage() {
  const actor = await getServerActor();
  if (!actor) {
    return null;
  }
  const propertyId = actor.propertyId;

  const [roomTypes, rooms, cancellationPolicies, teamMembers, ratePlans, catalogItems, property, subscription] =
    await Promise.all([
      prisma.roomType.count({ where: { propertyId, deletedAt: null } }),
      prisma.room.count({ where: { propertyId, deletedAt: null } }),
      prisma.cancellationPolicy.count({ where: { propertyId, deletedAt: null } }),
      prisma.propertyAccess.count({
        where: { propertyId, deletedAt: null, revokedAt: null, status: 'ACTIVE', role: { not: 'OWNER' } },
      }),
      prisma.ratePlan.count({ where: { propertyId, deletedAt: null } }),
      prisma.catalogItem.count({ where: { propertyId, deletedAt: null } }),
      prisma.property.findUnique({ where: { id: propertyId }, select: { directBookingEnabled: true } }),
      prisma.subscription.findUnique({
        where: { propertyId },
        select: { status: true, tier: true, pendingDowngradeTier: true },
      }),
    ]);

  // Mirrors GET /api/properties/:id/setup-status (Story 2.4).
  const roomTypesConfigured = roomTypes > 0;
  const cancellationPoliciesConfigured = cancellationPolicies > 0;
  const minimumSetupComplete = roomTypesConfigured && cancellationPoliciesConfigured;

  const setupPills: { label: string; done: boolean }[] = [
    { label: 'Room types configured', done: roomTypesConfigured },
    { label: 'Cancellation policies configured', done: cancellationPoliciesConfigured },
    { label: 'Minimum setup complete', done: minimumSetupComplete },
  ];

  const countStatus = (n: number, noun: string): CardStatus =>
    n > 0
      ? { label: `${n} ${noun}${n === 1 ? '' : 's'} configured`, tone: 'ok' }
      : { label: 'Not started', tone: 'warn' };

  const cards: {
    title: string;
    description: string;
    icon: string;
    href?: string;
    status: CardStatus;
  }[] = [
    {
      title: 'Property Profile',
      description: 'Identity, address & contact, legal & tax, operations, cancellation policies.',
      icon: '🏨',
      href: '/settings/property-profile',
      status: cancellationPoliciesConfigured
        ? { label: `${cancellationPolicies} cancellation polic${cancellationPolicies === 1 ? 'y' : 'ies'}`, tone: 'ok' }
        : { label: 'Not started', tone: 'warn' },
    },
    {
      title: 'Room Types',
      description: 'Occupancy, base & floor rate, GST slab and amenities per room type.',
      icon: '🛏️',
      href: '/settings/room-types',
      status: countStatus(roomTypes, 'room type'),
    },
    {
      title: 'Rooms',
      description: 'Physical room units, each assigned to a room type and a floor.',
      icon: '🚪',
      href: '/settings/rooms',
      status: countStatus(rooms, 'room'),
    },
    {
      title: 'Users & Roles',
      description: 'Invite Managers, Front Desk and Housekeeping staff and assign roles.',
      icon: '👥',
      href: '/settings/users-roles',
      status:
        teamMembers > 0
          ? { label: `${teamMembers} team member${teamMembers === 1 ? '' : 's'}`, tone: 'ok' }
          : { label: 'Owner only', tone: 'neutral' },
    },
    {
      title: 'Rate Plans',
      description: 'Floor rates, named rate plans and seasonal / channel multipliers.',
      icon: '💰',
      status: countStatus(ratePlans, 'rate plan'),
    },
    {
      title: 'Housekeeping Catalog',
      description: 'Amenities stocked per room type and the property-wide linen pool.',
      icon: '🧺',
      href: '/settings/housekeeping/catalog',
      status:
        catalogItems > 0
          ? { label: `${catalogItems} catalog item${catalogItems === 1 ? '' : 's'}`, tone: 'ok' }
          : { label: 'Optional · not started', tone: 'neutral' },
    },
    {
      title: 'Direct Booking',
      description: 'Your direct booking widget — room browse, availability and UPI payment.',
      icon: '🔗',
      href: '/settings/direct-booking',
      status: property?.directBookingEnabled
        ? { label: 'Enabled', tone: 'ok' }
        : { label: 'Not enabled', tone: 'neutral' },
    },
    {
      title: 'Plan Management',
      description: 'View your current plan, schedule a downgrade, or cancel a pending change.',
      icon: '💳',
      href: '/settings/plan',
      status: subscription?.tier
        ? { label: `${subscription.tier}${subscription.pendingDowngradeTier ? ' · downgrade pending' : ''}`, tone: subscription.pendingDowngradeTier ? 'warn' : 'ok' }
        : { label: 'No subscription', tone: 'neutral' },
    },
    {
      title: 'Trial Reminders',
      description: 'Adjust when each trial-conversion reminder fires (in-app, email, WhatsApp).',
      icon: '🔔',
      href: '/settings/trial-reminders',
      status:
        subscription?.status === 'TRIAL'
          ? { label: 'Active trial', tone: 'ok' }
          : subscription?.status
            ? { label: subscription.status, tone: 'neutral' }
            : { label: 'No subscription', tone: 'neutral' },
    },
  ];

  const toneColor: Record<CardStatus['tone'], string> = {
    ok: '#1DA888',
    warn: '#B5572A',
    neutral: '#9EAEAC',
  };

  return (
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          title="Settings"
          subtitle="Configure your property. Each section below feeds the same data the cold-start wizard walks through."
        />
      }
    >
      {/* Setup-status strip */}
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          background: '#fff',
          border: '1px solid #E8EFEE',
          borderRadius: 10,
          padding: '12px 14px',
        }}
      >
        {setupPills.map((pill) => (
          <span
            key={pill.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              background: pill.done ? 'rgba(29,168,136,0.12)' : '#F4F9F8',
              color: pill.done ? '#0F7A5E' : '#9EAEAC',
            }}
          >
            <span aria-hidden="true">{pill.done ? '✓' : '○'}</span>
            {pill.label}
          </span>
        ))}
      </div>

      {/* Section card grid */}
      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {cards.map((card) => {
          const inner = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  {card.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2B2E' }}>{card.title}</span>
              </div>
              <p style={{ fontSize: 12.5, color: '#5C7170', lineHeight: 1.5, margin: '8px 0 0' }}>
                {card.description}
              </p>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: toneColor[card.status.tone],
                }}
              >
                {card.status.label}
                {!card.href ? (
                  <span style={{ color: '#9EAEAC', fontWeight: 400 }}> · setup screen coming soon</span>
                ) : null}
              </div>
            </>
          );

          const baseStyle: React.CSSProperties = {
            display: 'block',
            background: '#fff',
            border: '1px solid #E8EFEE',
            borderRadius: 12,
            padding: '16px 18px',
            textDecoration: 'none',
          };

          return card.href ? (
            <Link key={card.title} href={card.href} style={baseStyle}>
              {inner}
            </Link>
          ) : (
            <div key={card.title} style={{ ...baseStyle, opacity: 0.75 }}>
              {inner}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
