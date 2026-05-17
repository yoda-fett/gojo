import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env files before instantiating PrismaClient. The repo-root .env wins
// over the package-local one; existing process.env values still take priority,
// so `DATABASE_URL=… pnpm db:seed` overrides whatever is in the file.
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const seedDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(seedDir, '..', '.env'));
loadEnv(path.join(seedDir, '..', '..', '..', '.env'));

import { hash } from 'bcryptjs';

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

function maskUrl(url: string | undefined) {
  if (!url) return '<unset>';
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
}

async function main() {
  console.log(`[seed] DATABASE_URL=${maskUrl(process.env.DATABASE_URL)}`);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — refusing to run seed against an unknown DB');
  }
  const propertyId = 'seed-property-1';
  const ownerId = 'seed-user-1';
  const managerId = 'seed-user-2';
  const housekeeperId = 'seed-user-3';
  const standardRoomTypeId = 'seed-room-type-standard';
  const deluxeRoomTypeId = 'seed-room-type-deluxe';
  const flexRoomTypeId = 'seed-room-type-family';

  const propertyProfile = {
    numberOfFloors: 3,
    defaultCheckInTime: '14:00',
    defaultCheckOutTime: '11:00',
    laundryVendorName: 'CleanPress Laundry',
    laundryVendorContact: '+919845012345',
  };
  await prisma.property.upsert({
    where: { slug: 'test-hotel' },
    update: propertyProfile,
    create: {
      id: propertyId,
      name: 'Test Hotel',
      slug: 'test-hotel',
      address: '123 Demo Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      ...propertyProfile,
    },
  });

  for (const roomType of [
    {
      id: standardRoomTypeId,
      name: 'Standard',
      maxOccupancy: 2,
      baseRate: '4500.00',
      floorRate: '4000.00',
      gstSlab: '12%',
      amenities: ['WiFi'],
    },
    {
      id: deluxeRoomTypeId,
      name: 'Deluxe',
      maxOccupancy: 3,
      baseRate: '8000.00',
      floorRate: '7600.00',
      gstSlab: '18%',
      amenities: ['WiFi', 'Balcony'],
    },
    {
      id: flexRoomTypeId,
      name: 'Family Suite',
      maxOccupancy: 4,
      baseRate: '10500.00',
      floorRate: '9500.00',
      gstSlab: '18%',
      amenities: ['WiFi', 'Balcony', 'Breakfast'],
    },
  ]) {
    await prisma.roomType.upsert({
      where: { propertyId_name: { propertyId, name: roomType.name } },
      update: roomType,
      create: {
        propertyId,
        ...roomType,
      },
    });
  }

  // 18 rooms across 3 room types matching the housekeeping wireframe.
  // States seeded to exercise every UI state: AVAILABLE, OCCUPIED, DIRTY,
  // CLEAN, OUT_OF_ORDER, MAINTENANCE.
  const ROOMS = [
    // Standard Single (rooms 101-105)
    ['room-101', standardRoomTypeId, '101', 'OCCUPIED'],
    ['room-102', standardRoomTypeId, '102', 'DIRTY'],
    ['room-103', standardRoomTypeId, '103', 'DIRTY'],
    ['room-104', standardRoomTypeId, '104', 'AVAILABLE'],
    ['room-105', standardRoomTypeId, '105', 'CLEAN'],
    // Deluxe Double (rooms 201-206)
    ['room-201', deluxeRoomTypeId, '201', 'CLEAN'],
    ['room-202', deluxeRoomTypeId, '202', 'AVAILABLE'],
    ['room-203', deluxeRoomTypeId, '203', 'OCCUPIED'],
    ['room-204', deluxeRoomTypeId, '204', 'DIRTY'],
    ['room-205', deluxeRoomTypeId, '205', 'AVAILABLE'],
    ['room-206', deluxeRoomTypeId, '206', 'AVAILABLE'],
    // Superior / Family (rooms 301-307)
    ['room-301', flexRoomTypeId, '301', 'OCCUPIED'],
    ['room-302', flexRoomTypeId, '302', 'DIRTY'],
    ['room-303', flexRoomTypeId, '303', 'CLEAN'],
    ['room-304', flexRoomTypeId, '304', 'OUT_OF_ORDER'],
    ['room-305', flexRoomTypeId, '305', 'DIRTY'],
    ['room-306', flexRoomTypeId, '306', 'AVAILABLE'],
    ['room-307', flexRoomTypeId, '307', 'MAINTENANCE'],
  ] as const;

  for (const room of ROOMS) {
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

  // Active room blocks driving the OUT_OF_ORDER / MAINTENANCE rooms above.
  // Idempotent via deterministic ids.
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const fourDaysAgo = new Date(todayDate);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const fourDaysAhead = new Date(todayDate);
  fourDaysAhead.setDate(fourDaysAhead.getDate() + 4);
  const tenDaysAhead = new Date(todayDate);
  tenDaysAhead.setDate(tenDaysAhead.getDate() + 10);

  for (const block of [
    {
      id: 'seed-block-304-plumbing',
      roomId: 'room-304',
      blockType: 'OUT_OF_ORDER',
      startDate: fourDaysAgo,
      endDate: fourDaysAhead,
      reason: 'Plumbing issue — geyser leak',
    },
    {
      id: 'seed-block-307-paint',
      roomId: 'room-307',
      blockType: 'MAINTENANCE',
      startDate: todayDate,
      endDate: tenDaysAhead,
      reason: 'Scheduled repaint and deep clean',
    },
  ] as const) {
    await prisma.roomBlock.upsert({
      where: { id: block.id },
      update: {
        roomId: block.roomId,
        blockType: block.blockType,
        startDate: block.startDate,
        endDate: block.endDate,
        reason: block.reason,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        id: block.id,
        propertyId,
        roomId: block.roomId,
        blockType: block.blockType,
        startDate: block.startDate,
        endDate: block.endDate,
        reason: block.reason,
        createdBy: ownerId,
      },
    });
  }

  // PIN for the housekeeping companion app (phone + 4-digit PIN auth).
  const hkPinHash = await hash('1234', 10);
  for (const user of [
    { id: ownerId, phone: '+911234567890', name: 'Seed Owner', pinHash: null as string | null },
    { id: managerId, phone: '+919999888877', name: 'Priya Manager', pinHash: null as string | null },
    { id: housekeeperId, phone: '+919800000001', name: 'Reema Housekeeper', pinHash: hkPinHash },
  ]) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: { name: user.name, pinHash: user.pinHash },
      create: { id: user.id, phone: user.phone, name: user.name, pinHash: user.pinHash },
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

  // ─── Housekeeping staff access (housekeeping companion app) ───
  await prisma.propertyAccess.upsert({
    where: { propertyId_userId: { propertyId, userId: housekeeperId } },
    update: { role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
    create: {
      id: 'seed-access-3',
      propertyId,
      userId: housekeeperId,
      role: 'HOUSEKEEPING',
      status: 'ACTIVE',
      invitedAt: new Date('2026-04-10T00:00:00.000Z'),
      invitedBy: ownerId,
    },
  });

  // Housekeeping catalog — amenities (per room type) + linens (property-wide).
  const AMENITY_ITEMS = [
    { id: 'cat-water-std', roomTypeId: standardRoomTypeId, name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 2, restockThreshold: 10 },
    { id: 'cat-toiletry-std', roomTypeId: standardRoomTypeId, name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 1, restockThreshold: 8 },
    { id: 'cat-water-dlx', roomTypeId: deluxeRoomTypeId, name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 3, restockThreshold: 10 },
    { id: 'cat-toiletry-dlx', roomTypeId: deluxeRoomTypeId, name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 2, restockThreshold: 8 },
    { id: 'cat-water-fam', roomTypeId: flexRoomTypeId, name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 4, restockThreshold: 10 },
    { id: 'cat-toiletry-fam', roomTypeId: flexRoomTypeId, name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 2, restockThreshold: 8 },
  ];
  for (const item of AMENITY_ITEMS) {
    await prisma.catalogItem.upsert({
      where: { id: item.id },
      update: { name: item.name, unit: item.unit, roomTypeId: item.roomTypeId, expectedQtyPerStay: item.expectedQtyPerStay, restockThreshold: item.restockThreshold, deletedAt: null },
      create: { id: item.id, propertyId, itemType: 'AMENITY', roomTypeId: item.roomTypeId, name: item.name, unit: item.unit, expectedQtyPerStay: item.expectedQtyPerStay, restockThreshold: item.restockThreshold },
    });
  }

  const LINEN_ITEMS = [
    { id: 'cat-bath-towel', name: 'Bath Towel', unit: 'piece', totalOwned: 120, minPoolSize: 30 },
    { id: 'cat-bed-sheet', name: 'Bed Sheet', unit: 'piece', totalOwned: 90, minPoolSize: 24 },
    { id: 'cat-pillow-cover', name: 'Pillow Cover', unit: 'piece', totalOwned: 160, minPoolSize: 40 },
  ];
  for (const item of LINEN_ITEMS) {
    await prisma.catalogItem.upsert({
      where: { id: item.id },
      update: { name: item.name, unit: item.unit, totalOwned: item.totalOwned, minPoolSize: item.minPoolSize, linenCategory: 'ROUTINE', deletedAt: null },
      create: { id: item.id, propertyId, itemType: 'LINEN', name: item.name, unit: item.unit, totalOwned: item.totalOwned, minPoolSize: item.minPoolSize, linenCategory: 'ROUTINE' },
    });
  }

  // Today's room assignments for the housekeeping staff — the DIRTY rooms,
  // plus per-room consumable + linen state so refill / linen-swap tasks have content.
  const HK_ASSIGNMENTS = [
    { id: 'seed-assign-102', roomId: 'room-102', roomTypeId: standardRoomTypeId },
    { id: 'seed-assign-103', roomId: 'room-103', roomTypeId: standardRoomTypeId },
    { id: 'seed-assign-204', roomId: 'room-204', roomTypeId: deluxeRoomTypeId },
    { id: 'seed-assign-302', roomId: 'room-302', roomTypeId: flexRoomTypeId },
    { id: 'seed-assign-305', roomId: 'room-305', roomTypeId: flexRoomTypeId },
  ];
  for (const a of HK_ASSIGNMENTS) {
    await prisma.roomAssignment.upsert({
      where: { id: a.id },
      update: { staffUserId: housekeeperId, assignedDate: todayDate, taskTypes: ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'], deletedAt: null },
      create: { id: a.id, propertyId, roomId: a.roomId, staffUserId: housekeeperId, assignedDate: todayDate, assignedBy: managerId, taskTypes: ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'] },
    });
    for (const item of AMENITY_ITEMS.filter((i) => i.roomTypeId === a.roomTypeId)) {
      await prisma.roomConsumableState.upsert({
        where: { propertyId_roomId_catalogItemId: { propertyId, roomId: a.roomId, catalogItemId: item.id } },
        update: { currentQty: 1 },
        create: { propertyId, roomId: a.roomId, catalogItemId: item.id, currentQty: 1, lastRefillAt: SEED_EPOCH },
      });
    }
    for (const item of LINEN_ITEMS) {
      await prisma.roomLinenState.upsert({
        where: { propertyId_roomId_catalogItemId: { propertyId, roomId: a.roomId, catalogItemId: item.id } },
        update: { qty: 2 },
        create: { propertyId, roomId: a.roomId, catalogItemId: item.id, qty: 2, lastObservedAt: SEED_EPOCH },
      });
    }
  }

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
  .then(async () => {
    const [rooms, accesses, blocks, assignments, catalog] = await Promise.all([
      prisma.room.count({ where: { propertyId: 'seed-property-1' } }),
      prisma.propertyAccess.count({ where: { propertyId: 'seed-property-1' } }),
      prisma.roomBlock.count({ where: { propertyId: 'seed-property-1', deletedAt: null } }),
      prisma.roomAssignment.count({ where: { propertyId: 'seed-property-1', deletedAt: null } }),
      prisma.catalogItem.count({ where: { propertyId: 'seed-property-1', deletedAt: null } }),
    ]);
    console.log(
      `[seed] done — rooms=${rooms} propertyAccess=${accesses} activeBlocks=${blocks} roomAssignments=${assignments} catalogItems=${catalog}`,
    );
  })
  .catch((error) => {
    console.error('[seed] FAILED');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
