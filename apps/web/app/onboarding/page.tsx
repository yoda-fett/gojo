// @ts-nocheck
import { getOnboardingState, prisma } from '@gojo/db';
import { redirect } from 'next/navigation';

import {
  PropertyProfileForm,
  RoomTypesForm,
  RoomsForm,
  UsersRolesForm,
  RateManagementForm,
  HousekeepingCatalogForm,
  DirectBookingSettingsForm,
} from '@/components/settings-forms';
import { getServerActor } from '@/lib/auth/server-actor';
import { getBreakEvenForRoomType } from '@/lib/services/break-even-service';
import { maskPhone } from '@/lib/utils/mask-phone';

import { FinalReview, type FinalReviewData } from './_components/final-review';
import { WizardShell } from './_components/wizard-shell';
import { computeStepGates } from './_gates';

// Story 12.3 + 12.4 — wizard step integration for all seven steps. The RSC
// fetches per-step data + counts in one pass, then hands the shell:
//   - stepContent[1..7]: the embedded Settings forms (shared via the
//     `settings-forms` barrel; both /settings/* pages and these wizard slots
//     import from one place).
//   - stepGates[1..7]:   { canContinue, gateMessage } per per-step ACs.
//   - postAdvanceHrefByStep[6]: redirect to /onboarding/linen-distribution
//     when step 6 has unseeded linens that haven't been deferred (12.4 AC3).
// The Settings forms persist on each mutation via their existing endpoints;
// the shell's Save & Continue just advances `lastCompletedStep`.
export default async function OnboardingPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  const state = await getOnboardingState(actor, prisma);
  if (state.completed) redirect('/dashboard');

  // ── Step 1 — Property profile ──────────────────────────────────────────
  const [property, policies] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        contactPhone: true,
        contactEmail: true,
        gstin: true,
        pan: true,
        stateCode: true,
        currency: true,
        timezone: true,
        numberOfFloors: true,
        defaultCheckInTime: true,
        defaultCheckOutTime: true,
        costConfig: true,
      },
    }),
    prisma.cancellationPolicy.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  // Serialize for the client form — Prisma Decimal cannot cross the
  // Server → Client Component boundary.
  const policiesForForm = policies.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    windowHours: p.windowHours,
    penaltyType: p.penaltyType,
    penaltyValue: p.penaltyValue == null ? null : Number(p.penaltyValue),
    isDefault: p.isDefault,
  }));

  // ── Step 2 — Room types ────────────────────────────────────────────────
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      maxOccupancy: true,
      baseRate: true,
      floorRate: true,
      gstSlab: true,
      amenities: true,
      stateVersion: true,
    },
  });
  const roomTypesForForm = roomTypes.map((rt) => ({
    ...rt,
    baseRate: rt.baseRate.toString(),
    floorRate: rt.floorRate.toString(),
  }));
  const roomTypeRefs = roomTypes.map((rt) => ({ id: rt.id, name: rt.name }));

  // ── Step 3 — Rooms ─────────────────────────────────────────────────────
  const rooms = await prisma.room.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    select: {
      id: true,
      number: true,
      roomTypeId: true,
      floor: true,
      notes: true,
      accessible: true,
      connectingRoomId: true,
      stateVersion: true,
    },
  });

  // ── Step 4 — Users & Roles ─────────────────────────────────────────────
  const [accessList, currentProperty, ownAccess] = await Promise.all([
    prisma.propertyAccess.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: {
        name: true,
        city: true,
        state: true,
        directBookingEnabled: true,
        bookingSlug: true,
        averageOtaCommissionRate: true,
        laundryVendorName: true,
        laundryVendorContact: true,
        coldStartLinenDeferred: true,
      },
    }),
    prisma.propertyAccess.findMany({
      where: { userId: actor.userId, deletedAt: null, revokedAt: null },
    }),
  ]);

  const ownProperties = await prisma.property.findMany({
    where: { id: { in: ownAccess.map((a) => a.propertyId) } },
    select: { id: true, name: true, city: true, state: true },
  });
  const propById = new Map(ownProperties.map((p) => [p.id, p]));
  const users = await prisma.user.findMany({
    where: { id: { in: accessList.map((a) => a.userId) } },
    select: { id: true, name: true, phone: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const teamRows = accessList.map((a) => {
    const u = userById.get(a.userId);
    return {
      userId: a.userId,
      displayName: u?.name ?? null,
      phoneMasked: maskPhone(u?.phone ?? ''),
      role: a.role,
      status: a.status,
      isSelf: a.userId === actor.userId,
    };
  });
  const teamProperties = ownAccess
    .map((a) => {
      const p = propById.get(a.propertyId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        location: [p.city, p.state].filter(Boolean).join(', '),
        role: a.role,
        isCurrent: p.id === actor.propertyId,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // ── Step 5 — Rate management ──────────────────────────────────────────
  const [ratePlans, multipliers] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.rateMultiplier.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Per-room-type break-even (same RSC pattern as /settings/rate-plans).
  const breakEvens = await Promise.all(
    roomTypes.map(async (rt) => {
      try {
        const data = await getBreakEvenForRoomType(actor, rt.id);
        return { roomTypeId: rt.id, breakEvenRate: data?.breakEvenRate ?? null };
      } catch {
        return { roomTypeId: rt.id, breakEvenRate: null };
      }
    }),
  );
  const beById = new Map(breakEvens.map((b) => [b.roomTypeId, b.breakEvenRate]));

  const floorRows = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    description: rt.description ?? '',
    baseRate: Number(rt.baseRate),
    floorRate: Number(rt.floorRate),
    stateVersion: rt.stateVersion,
    breakEvenRate: beById.get(rt.id) ?? null,
  }));
  const ratePlanRows = ratePlans.map((rp) => ({
    id: rp.id, name: rp.name, roomTypeId: rp.roomTypeId,
    modifierType: rp.modifierType, modifierValue: Number(rp.modifierValue),
  }));
  const multiplierRows = multipliers.map((m) => ({
    id: m.id, name: m.name, type: m.type, multiplier: Number(m.multiplier),
    startDate: m.startDate ? m.startDate.toISOString() : null,
    endDate: m.endDate ? m.endDate.toISOString() : null,
    channel: m.channel, roomTypeIds: m.roomTypeIds,
  }));

  // ── Step 6 — Housekeeping Catalog ─────────────────────────────────────
  const catalogItems = await prisma.catalogItem.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: [{ itemType: 'asc' }, { name: 'asc' }],
  });
  const amenityCount = catalogItems.filter((i) => i.itemType === 'AMENITY').length;
  const linenCount = catalogItems.filter((i) => i.itemType === 'LINEN').length;

  // ── Step 6 → linen sub-route trigger (12.4 AC3) ───────────────────────
  // Route to /onboarding/linen-distribution iff:
  //   - at least one linen catalog item exists (something to seed),
  //   - the owner hasn't already deferred,
  //   - no COLD_START seed rows exist yet for this property.
  const colSeedExists = await prisma.roomLinenState.count({
    where: { propertyId: actor.propertyId, seedSource: 'COLD_START', deletedAt: null },
  });
  const needsLinenSubRoute =
    linenCount >= 1 && !(currentProperty?.coldStartLinenDeferred) && colSeedExists === 0;

  // ── Gates (12.3 ACs 2/3/4 + 12.4 ACs 1/2) ──────────────────────────────
  // Counts read from rows we already fetched — no extra round-trip.
  const roomTypesMissingRatePlans = roomTypes.filter(
    (rt) => !ratePlans.some((rp) => rp.roomTypeId === rt.id),
  ).length;

  const stepGates = computeStepGates({
    roomTypes: roomTypes.length,
    rooms: rooms.length,
    housekeepingMembers: accessList.filter((a) => a.role === 'HOUSEKEEPING').length,
    roomTypesMissingRatePlans,
    amenityItems: amenityCount,
    linenItems: linenCount,
  });

  if (!property) return null;
  const archetype =
    property.costConfig && typeof property.costConfig === 'object'
      ? ((property.costConfig as { archetype?: string }).archetype ?? null)
      : null;

  const stepContent = {
    1: (
      <PropertyProfileForm
        propertyId={property.id}
        property={property}
        archetype={archetype}
        initialPolicies={policiesForForm}
      />
    ),
    2: <RoomTypesForm initial={roomTypesForForm} />,
    3: <RoomsForm initialRooms={rooms} roomTypes={roomTypeRefs} />,
    4: (
      <UsersRolesForm
        propertyId={actor.propertyId}
        propertyName={currentProperty?.name ?? 'this property'}
        initialRows={teamRows}
        properties={teamProperties}
      />
    ),
    5: (
      <RateManagementForm
        roomTypes={roomTypeRefs}
        floorRows={floorRows}
        ratePlans={ratePlanRows}
        multipliers={multiplierRows}
      />
    ),
    6: (
      <HousekeepingCatalogForm
        initialItems={catalogItems as never}
        roomTypes={roomTypeRefs}
        initialType="amenity"
        vendor={{
          propertyId: actor.propertyId,
          laundryVendorName: currentProperty?.laundryVendorName ?? null,
          laundryVendorContact: currentProperty?.laundryVendorContact ?? null,
        }}
      />
    ),
    7: (
      <DirectBookingSettingsForm
        propertyId={actor.propertyId}
        initialEnabled={currentProperty?.directBookingEnabled ?? false}
        initialRate={currentProperty?.averageOtaCommissionRate ?? 0.18}
        publicUrl={currentProperty?.bookingSlug ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/book/${currentProperty.bookingSlug}` : null}
      />
    ),
    8: <FinalReview data={buildFinalReviewData()} />,
  };

  function buildFinalReviewData(): FinalReviewData {
    // Rooms grouped by floor
    const floorMap = new Map<number | null, number>();
    for (const r of rooms) {
      const key = (r.floor ?? null) as number | null;
      floorMap.set(key, (floorMap.get(key) ?? 0) + 1);
    }
    const byFloor = Array.from(floorMap.entries())
      .map(([floor, count]) => ({ floor, count }))
      .sort((a, b) => (a.floor ?? -1) - (b.floor ?? -1));

    // Rooms per room type
    const roomCountByType = new Map<string, number>();
    for (const r of rooms) {
      roomCountByType.set(r.roomTypeId, (roomCountByType.get(r.roomTypeId) ?? 0) + 1);
    }
    const roomTypeSummary = roomTypes.map((rt) => ({
      name: rt.name,
      baseRate: Number(rt.baseRate),
      roomCount: roomCountByType.get(rt.id) ?? 0,
    }));

    // Team by role
    const byRole: Record<string, number> = {};
    for (const row of teamRows) {
      byRole[row.role] = (byRole[row.role] ?? 0) + 1;
    }

    const skippedDirectBooking = Boolean(state.progress.drafts?.['directBookingSkipped']);

    return {
      property: {
        name: property.name,
        city: property.city,
        state: property.state,
        pincode: property.pincode,
        gstin: property.gstin,
        contactPhone: property.contactPhone,
        contactEmail: property.contactEmail,
        defaultCheckInTime: property.defaultCheckInTime,
        defaultCheckOutTime: property.defaultCheckOutTime,
        numberOfFloors: property.numberOfFloors,
      },
      roomTypes: roomTypeSummary,
      rooms: { total: rooms.length, byFloor },
      team: { total: teamRows.length, byRole },
      rates: {
        ratePlanCount: ratePlans.length,
        multiplierCount: multipliers.length,
        multiplierNames: multipliers.map((m) => m.name).filter((n): n is string => Boolean(n)),
      },
      catalog: {
        amenityCount,
        linenCount,
        laundryVendor: currentProperty?.laundryVendorName ?? null,
        linenDistributionDeclared: linenCount === 0 || colSeedExists > 0 || Boolean(currentProperty?.coldStartLinenDeferred),
      },
      directBooking: {
        enabled: currentProperty?.directBookingEnabled ?? false,
        skipped: skippedDirectBooking,
      },
    };
  }

  const postAdvanceHrefByStep = needsLinenSubRoute ? { 6: '/onboarding/linen-distribution' } : {};

  return (
    <WizardShell
      initialProgress={state.progress}
      stepContent={stepContent}
      stepGates={stepGates}
      postAdvanceHrefByStep={postAdvanceHrefByStep}
    />
  );
}
