import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();
const SEED_EPOCH = new Date('2026-01-01T00:00:00.000Z');

async function upsertById<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  update: () => Promise<T>,
) {
  const existing = await find();
  return existing ? update() : create();
}

async function main() {
  const propertyId = 'seed-property-1';
  const ownerId = 'seed-user-1';
  const managerId = 'seed-user-2';
  const standardRoomTypeId = 'seed-room-type-standard';
  const deluxeRoomTypeId = 'seed-room-type-deluxe';
  const flexRoomTypeId = 'seed-room-type-family';

  await prisma.property.upsert({
    where: { slug: 'test-hotel' },
    update: {},
    create: {
      id: propertyId,
      name: 'Test Hotel',
      slug: 'test-hotel',
      address: '123 Demo Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    },
  });

  for (const roomType of [
    {
      id: standardRoomTypeId,
      name: 'Standard',
      maxOccupancy: 2,
      baseRate: '4500.00',
      floorRate: '4000.00',
      ceilingRate: '6500.00',
      gstSlab: '12%',
      amenities: ['WiFi'],
    },
    {
      id: deluxeRoomTypeId,
      name: 'Deluxe',
      maxOccupancy: 3,
      baseRate: '8000.00',
      floorRate: '7600.00',
      ceilingRate: '9800.00',
      gstSlab: '18%',
      amenities: ['WiFi', 'Balcony'],
    },
    {
      id: flexRoomTypeId,
      name: 'Family Suite',
      maxOccupancy: 4,
      baseRate: '10500.00',
      floorRate: '9500.00',
      ceilingRate: '13500.00',
      gstSlab: '18%',
      amenities: ['WiFi', 'Balcony', 'Breakfast'],
    },
  ] as const) {
    await prisma.roomType.upsert({
      where: { propertyId_name: { propertyId, name: roomType.name } },
      update: roomType,
      create: {
        propertyId,
        ...roomType,
      },
    });
  }

  for (const room of [
    ['room-101', standardRoomTypeId, '101', 'AVAILABLE'],
    ['room-102', standardRoomTypeId, '102', 'DIRTY'],
    ['room-201', deluxeRoomTypeId, '201', 'MAINTENANCE'],
    ['room-202', deluxeRoomTypeId, '202', 'AVAILABLE'],
    ['room-301', flexRoomTypeId, '301', 'AVAILABLE'],
  ] as const) {
    await prisma.room.upsert({
      where: { propertyId_number: { propertyId, number: room[2] } },
      update: { roomTypeId: room[1], state: room[3] },
      create: {
        id: room[0],
        propertyId,
        roomTypeId: room[1],
        number: room[2],
        state: room[3],
      },
    });
  }

  for (const user of [
    { id: ownerId, phone: '+911234567890', name: 'Seed Owner' },
    { id: managerId, phone: '+919999888877', name: 'Priya Manager' },
  ] as const) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: { name: user.name },
      create: user,
    });
  }

  await prisma.propertyAccess.upsert({
    where: { propertyId_userId: { propertyId, userId: ownerId } },
    update: { role: 'OWNER', status: 'ACTIVE', revokedAt: null, deletedAt: null },
    create: {
      id: 'seed-access-1',
      propertyId,
      userId: ownerId,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.propertyAccess.upsert({
    where: { propertyId_userId: { propertyId, userId: managerId } },
    update: { role: 'MANAGER', status: 'ACTIVE', revokedAt: null, deletedAt: null },
    create: {
      id: 'seed-access-2',
      propertyId,
      userId: managerId,
      role: 'MANAGER',
      status: 'ACTIVE',
      invitedAt: new Date('2026-04-10T00:00:00.000Z'),
      invitedBy: ownerId,
    },
  });

  await prisma.subscription.upsert({
    where: { propertyId },
    update: {},
    create: {
      id: 'seed-subscription-1',
      propertyId,
      planKey: 'TRIAL',
      status: 'TRIAL',
      trialStartedAt: SEED_EPOCH,
      trialEndsAt: new Date(SEED_EPOCH.getTime() + 120 * 24 * 60 * 60 * 1000),
    },
  });

  for (const guest of [
    ['guest-1', 'GOJ001', 'Aarav Sharma', '+919810000001'],
    ['guest-2', 'GOJ002', 'Meera Nair', '+919810000002'],
    ['guest-3', 'GOJ003', 'Dev Patel', '+919810000003'],
    ['guest-4', 'GOJ004', 'Ananya Rao', '+919810000004'],
    ['guest-5', 'GOJ005', 'Kabir Khan', '+919810000005'],
  ] as const) {
    await upsertById(
      () => prisma.guest.findUnique({ where: { id: guest[0] } }),
      () =>
        prisma.guest.create({
          data: {
            id: guest[0],
            propertyId,
            guestCode: guest[1],
            fullName: guest[2],
            phone: guest[3],
            consentGivenAt: new Date('2026-04-01T00:00:00.000Z'),
          },
        }),
      () =>
        prisma.guest.update({
          where: { id: guest[0] },
          data: { fullName: guest[2], phone: guest[3] },
        }),
    );
  }

  await prisma.cancellationPolicy.upsert({
    where: { propertyId_name: { propertyId, name: '24 Hour Flex' } },
    update: { isDefault: true, deletedAt: null },
    create: {
      id: 'policy-flex-24h',
      propertyId,
      name: '24 Hour Flex',
      windowHours: 24,
      penaltyType: 'FIRST_NIGHT',
      penaltyValue: '100.00',
      isDefault: true,
    },
  });

  await prisma.ratePlan.upsert({
    where: { propertyId_roomTypeId_name: { propertyId, roomTypeId: standardRoomTypeId, name: 'Weekend Boost' } },
    update: { modifierType: 'PERCENTAGE', modifierValue: '12.00', deletedAt: null },
    create: {
      id: 'rate-plan-weekend-boost',
      propertyId,
      roomTypeId: standardRoomTypeId,
      name: 'Weekend Boost',
      modifierType: 'PERCENTAGE',
      modifierValue: '12.00',
    },
  });

  const reservations = [
    {
      id: 'reservation-1',
      bookingReference: 'GJ-20260425-A1B2',
      roomId: 'room-101',
      roomTypeId: standardRoomTypeId,
      guestId: 'guest-1',
      checkIn: new Date('2026-04-25T09:00:00+05:30'),
      checkOut: new Date('2026-04-27T11:00:00+05:30'),
      status: 'CHECKED_IN',
      source: 'DIRECT_BOOKING',
      policyId: 'policy-flex-24h',
    },
    {
      id: 'reservation-2',
      bookingReference: 'GJ-20260425-C3D4',
      roomId: 'room-102',
      roomTypeId: standardRoomTypeId,
      guestId: 'guest-2',
      checkIn: new Date('2026-04-25T13:00:00+05:30'),
      checkOut: new Date('2026-04-26T11:00:00+05:30'),
      status: 'CONFIRMED',
      source: 'OTA',
      policyId: 'policy-flex-24h',
    },
    {
      id: 'reservation-3',
      bookingReference: 'GJ-20260424-E5F6',
      roomId: 'room-201',
      roomTypeId: deluxeRoomTypeId,
      guestId: 'guest-3',
      checkIn: new Date('2026-04-24T14:00:00+05:30'),
      checkOut: new Date('2026-04-25T10:30:00+05:30'),
      status: 'CHECKED_IN',
      source: 'DIRECT_BOOKING',
      policyId: 'policy-flex-24h',
    },
    {
      id: 'reservation-4',
      bookingReference: 'GJ-20260419-G7H8',
      roomId: 'room-202',
      roomTypeId: deluxeRoomTypeId,
      guestId: 'guest-4',
      checkIn: new Date('2026-04-19T14:00:00+05:30'),
      checkOut: new Date('2026-04-22T11:00:00+05:30'),
      status: 'CHECKED_OUT',
      source: 'WALK_IN',
      policyId: 'policy-flex-24h',
    },
    {
      id: 'reservation-5',
      bookingReference: 'GJ-20260425-J9K0',
      roomId: 'room-102',
      roomTypeId: standardRoomTypeId,
      guestId: 'guest-5',
      checkIn: new Date('2026-04-25T15:00:00+05:30'),
      checkOut: new Date('2026-04-27T11:00:00+05:30'),
      status: 'CONFIRMED',
      source: 'WALK_IN',
      policyId: 'policy-flex-24h',
    },
  ] as const;

  for (const reservation of reservations) {
    await upsertById(
      () => prisma.reservation.findUnique({ where: { id: reservation.id } }),
      () =>
        prisma.reservation.create({
          data: {
            id: reservation.id,
            propertyId,
            roomId: reservation.roomId,
            roomTypeId: reservation.roomTypeId,
            guestId: reservation.guestId,
            bookingReference: reservation.bookingReference,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
            status: reservation.status,
            source: reservation.source,
            rateSnapshot: { nightlyRate: reservation.roomTypeId === standardRoomTypeId ? 4800 : 8600 },
            selectedCancellationPolicyId: reservation.policyId,
          },
        }),
      () =>
        prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            roomId: reservation.roomId,
            roomTypeId: reservation.roomTypeId,
            guestId: reservation.guestId,
            bookingReference: reservation.bookingReference,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
            status: reservation.status,
            source: reservation.source,
            selectedCancellationPolicyId: reservation.policyId,
          },
        }),
    );
  }

  const folios = [
    ['folio-1', 'reservation-1', 'guest-1', 'INV-2026-001', 'OPEN'],
    ['folio-2', 'reservation-3', 'guest-3', 'INV-2026-002', 'OPEN'],
    ['folio-3', 'reservation-4', 'guest-4', 'INV-2026-003', 'CLOSED'],
  ] as const;

  for (const folio of folios) {
    await upsertById(
      () => prisma.folio.findUnique({ where: { id: folio[0] } }),
      () =>
        prisma.folio.create({
          data: {
            id: folio[0],
            propertyId,
            reservationId: folio[1],
            guestId: folio[2],
            invoiceNumber: folio[3],
            status: folio[4],
          },
        }),
      () =>
        prisma.folio.update({
          where: { id: folio[0] },
          data: { status: folio[4] },
        }),
    );
  }

  for (const line of [
    ['line-1', 'folio-1', 'ROOM_CHARGE', 'Room charge', '4800.00', '576.00', '12%', '2026-04-25T06:00:00.000Z'],
    ['line-2', 'folio-1', 'ROOM_CHARGE', 'Room charge', '4800.00', '576.00', '12%', '2026-04-26T06:00:00.000Z'],
    ['line-3', 'folio-1', 'EXTRA_CHARGE', 'Breakfast', '900.00', '108.00', '12%', '2026-04-25T08:00:00.000Z'],
    ['line-4', 'folio-2', 'ROOM_CHARGE', 'Corporate room charge', '8600.00', '1548.00', '18%', '2026-04-24T06:00:00.000Z'],
    ['line-5', 'folio-2', 'EXTRA_CHARGE', 'Airport pickup', '650.00', '78.00', '12%', '2026-04-24T08:00:00.000Z'],
    ['line-6', 'folio-3', 'ROOM_CHARGE', 'Weekend room charge', '16800.00', '3024.00', '18%', '2026-04-20T06:00:00.000Z'],
    ['line-7', 'folio-3', 'EXTRA_CHARGE', 'Dinner', '1200.00', '144.00', '12%', '2026-04-20T10:00:00.000Z'],
  ] as const) {
    await upsertById(
      () => prisma.folioLine.findUnique({ where: { id: line[0] } }),
      () =>
        prisma.folioLine.create({
          data: {
            id: line[0],
            propertyId,
            folioId: line[1],
            chargeType: line[2],
            description: line[3],
            amount: line[4],
            taxAmount: line[5],
            gstSlab: line[6],
            postedAt: new Date(line[7]),
          },
        }),
      () =>
        prisma.folioLine.update({
          where: { id: line[0] },
          data: {
            chargeType: line[2],
            description: line[3],
            amount: line[4],
            taxAmount: line[5],
            gstSlab: line[6],
            postedAt: new Date(line[7]),
          },
        }),
    );
  }

  if ('alert' in prisma) {
    // no-op placeholder for type narrowing in generated client
  }

  await upsertById(
    () => (prisma as unknown as { alert: { findUnique(args: { where: { id: string } }): Promise<{ id: string } | null> } }).alert.findUnique({ where: { id: 'seed-alert-1' } }),
    () =>
      (prisma as unknown as { alert: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> } }).alert.create({
        data: {
          id: 'seed-alert-1',
          propertyId,
          alertType: 'RESERVATION_CONFLICT',
          severity: 'HIGH',
          status: 'ACTIVE',
          message: 'Room conflict: reservations reservation-2 and reservation-5 overlap',
          entityId: 'reservation-2',
          entityType: 'RESERVATION',
        },
      }),
    () =>
      (prisma as unknown as { alert: { update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }> } }).alert.update({
        where: { id: 'seed-alert-1' },
        data: {
          propertyId,
          alertType: 'RESERVATION_CONFLICT',
          severity: 'HIGH',
          status: 'ACTIVE',
          message: 'Room conflict: reservations reservation-2 and reservation-5 overlap',
          entityId: 'reservation-2',
          entityType: 'RESERVATION',
          dismissedAt: null,
          resolvedAt: null,
        },
      }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
