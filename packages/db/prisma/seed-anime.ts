// Themed demo seed — three anime-flavoured properties at different tiers.
// Idempotent: re-running upserts records by stable string IDs (no drops).
//
// Mapping (per koko's spec):
//   One Piece   — Thousand Sunny Resort   · 3 housekeepers · GROWTH (ACTIVE)
//   Demon Slayer — Butterfly Mansion Inn  · 2 housekeepers · STARTER (ACTIVE)
//   Naruto      — Konoha Leaf Lodge       · 1 housekeeper  · TRIAL  (TRIAL)
//
// Generates ~1 year of reservations per property with deterministic
// per-property randomness so dashboards have differentiated data.

import type { PrismaClient } from '../src/generated/client/index.js';

// Deterministic PRNG (mulberry32). Same propertyId → same numbers across runs.
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-05-17T00:00:00.000Z');
// Reservation window: 1 year back, 2 months forward.
const PAST_DAYS = 365;
const FUTURE_DAYS = 60;
// Future bookings — keep some weeks empty at random by skipping placements.
const FUTURE_SKIP_PROBABILITY = 0.4;

type CharacterDef = { id: string; name: string; phone: string };

interface ThemeDef {
  key: 'one-piece' | 'demon-slayer' | 'naruto';
  property: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string;
    pincode: string;
    address: string;
  };
  tier: 'TRIAL' | 'STARTER' | 'GROWTH';
  owner: CharacterDef;
  manager: CharacterDef;
  housekeepers: CharacterDef[];
  guests: { code: string; name: string; phone: string }[];
  reservationCount: number;
  roomTypes: {
    id: string;
    name: string;
    maxOccupancy: number;
    baseRate: string;
    floorRate: string;
    gstSlab: string;
    amenities: string[];
  }[];
  rooms: { id: string; number: string; floor: number; roomTypeKey: 'std' | 'dlx' | 'suite' }[];
  // Source mix as cumulative weights summing to 1.
  sourceMix: { DIRECT_BOOKING: number; OTA: number; WALK_IN: number };
}

function buildThemes(): ThemeDef[] {
  return [
    {
      key: 'one-piece',
      property: {
        id: 'anime-prop-onepiece',
        slug: 'thousand-sunny-resort',
        name: 'Thousand Sunny Resort',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734101',
        address: '1 Grand Line Avenue, Chowrasta',
      },
      tier: 'GROWTH',
      owner: { id: 'anime-user-luffy', name: 'Monkey D. Luffy', phone: '+919000110001' },
      manager: { id: 'anime-user-robin', name: 'Nico Robin', phone: '+919000110002' },
      housekeepers: [
        { id: 'anime-user-nami', name: 'Nami', phone: '+919000110003' },
        { id: 'anime-user-usopp', name: 'Usopp', phone: '+919000110004' },
        { id: 'anime-user-chopper', name: 'Tony Tony Chopper', phone: '+919000110005' },
      ],
      guests: [
        ['OP-G01', 'Roronoa Zoro', '+919000119001'],
        ['OP-G02', 'Vinsmoke Sanji', '+919000119002'],
        ['OP-G03', 'Nefertari Vivi', '+919000119003'],
        ['OP-G04', 'Portgas D. Ace', '+919000119004'],
        ['OP-G05', 'Trafalgar Law', '+919000119005'],
        ['OP-G06', 'Boa Hancock', '+919000119006'],
        ['OP-G07', 'Shanks Akagami', '+919000119007'],
        ['OP-G08', 'Smoker Tashigi', '+919000119008'],
        ['OP-G09', 'Bartholomew Kuma', '+919000119009'],
        ['OP-G10', 'Dracule Mihawk', '+919000119010'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 100,
      roomTypes: [
        { id: 'anime-rt-op-std', name: 'Crew Cabin', maxOccupancy: 2, baseRate: '5200.00', floorRate: '4500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-op-dlx', name: 'Captain Suite', maxOccupancy: 3, baseRate: '9800.00', floorRate: '8800.00', gstSlab: '18%', amenities: ['WiFi', 'Sea View'] },
        { id: 'anime-rt-op-suite', name: 'Mast Penthouse', maxOccupancy: 4, baseRate: '15500.00', floorRate: '14000.00', gstSlab: '18%', amenities: ['WiFi', 'Sea View', 'Lounge'] },
      ],
      rooms: [
        { id: 'anime-room-op-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-op-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-op-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-op-104', number: '104', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-op-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-op-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-op-203', number: '203', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-op-301', number: '301', floor: 3, roomTypeKey: 'suite' },
        { id: 'anime-room-op-302', number: '302', floor: 3, roomTypeKey: 'suite' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.35, OTA: 0.5, WALK_IN: 0.15 },
    },
    {
      key: 'demon-slayer',
      property: {
        id: 'anime-prop-demonslayer',
        slug: 'butterfly-mansion-inn',
        name: 'Butterfly Mansion Inn',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '7 Wisteria Lane, MG Marg',
      },
      tier: 'STARTER',
      owner: { id: 'anime-user-tanjiro', name: 'Tanjiro Kamado', phone: '+919000220001' },
      manager: { id: 'anime-user-shinobu', name: 'Shinobu Kocho', phone: '+919000220002' },
      housekeepers: [
        { id: 'anime-user-zenitsu', name: 'Zenitsu Agatsuma', phone: '+919000220003' },
        { id: 'anime-user-inosuke', name: 'Inosuke Hashibira', phone: '+919000220004' },
      ],
      guests: [
        ['DS-G01', 'Nezuko Kamado', '+919000229001'],
        ['DS-G02', 'Giyu Tomioka', '+919000229002'],
        ['DS-G03', 'Kyojuro Rengoku', '+919000229003'],
        ['DS-G04', 'Tengen Uzui', '+919000229004'],
        ['DS-G05', 'Mitsuri Kanroji', '+919000229005'],
        ['DS-G06', 'Muichiro Tokito', '+919000229006'],
        ['DS-G07', 'Sanemi Shinazugawa', '+919000229007'],
        ['DS-G08', 'Obanai Iguro', '+919000229008'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 60,
      roomTypes: [
        { id: 'anime-rt-ds-std', name: 'Standard', maxOccupancy: 2, baseRate: '3800.00', floorRate: '3200.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-ds-dlx', name: 'Garden View', maxOccupancy: 3, baseRate: '6800.00', floorRate: '6000.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View'] },
      ],
      rooms: [
        { id: 'anime-room-ds-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-ds-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-ds-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-ds-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-ds-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
      ],
      // STARTER has no OTA channels enabled — direct + walk-in only.
      sourceMix: { DIRECT_BOOKING: 0.65, OTA: 0, WALK_IN: 0.35 },
    },
    {
      key: 'naruto',
      property: {
        id: 'anime-prop-naruto',
        slug: 'konoha-leaf-lodge',
        name: 'Konoha Leaf Lodge',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734301',
        address: '4 Hokage Rock Trail, Deolo Hill',
      },
      tier: 'TRIAL',
      owner: { id: 'anime-user-naruto', name: 'Naruto Uzumaki', phone: '+919000330001' },
      manager: { id: 'anime-user-sakura', name: 'Sakura Haruno', phone: '+919000330002' },
      housekeepers: [
        { id: 'anime-user-rocklee', name: 'Rock Lee', phone: '+919000330003' },
      ],
      guests: [
        ['NA-G01', 'Sasuke Uchiha', '+919000339001'],
        ['NA-G02', 'Kakashi Hatake', '+919000339002'],
        ['NA-G03', 'Hinata Hyuga', '+919000339003'],
        ['NA-G04', 'Shikamaru Nara', '+919000339004'],
        ['NA-G05', 'Gaara of the Sand', '+919000339005'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 25,
      roomTypes: [
        { id: 'anime-rt-na-std', name: 'Genin Room', maxOccupancy: 2, baseRate: '2800.00', floorRate: '2400.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-na-dlx', name: 'Chunin Suite', maxOccupancy: 3, baseRate: '4800.00', floorRate: '4200.00', gstSlab: '18%', amenities: ['WiFi', 'Forest View'] },
      ],
      rooms: [
        { id: 'anime-room-na-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-na-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-na-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-na-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-na-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0, WALK_IN: 0.45 },
    },
  ];
}

// ─── Housekeeping setup ────────────────────────────────────────────────────
// Each property gets enough catalog + room state to exercise every
// housekeeping use case 5 times: 5 DIRTY rooms with mixed task types, ≥5
// amenities + ≥5 linens, daily room assignments distributed across the
// property's housekeepers. NO activity logs (ConsumptionLog, LaundryLog,
// IssueReport) — properties start with a clean slate so the housekeeping
// companion's flows can be tested fresh.

interface AmenityDef {
  id: string;
  roomTypeKey: 'std' | 'dlx' | 'suite';
  name: string;
  unit: string;
  expectedQtyPerStay: number;
  restockThreshold: number;
}

interface LinenDef {
  id: string;
  name: string;
  unit: string;
  totalOwned: number;
  minPoolSize: number;
}

function amenitiesForTheme(themeKey: string): AmenityDef[] {
  const k = themeKey;
  return [
    { id: `${k}-amen-water-std`, roomTypeKey: 'std', name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 2, restockThreshold: 10 },
    { id: `${k}-amen-toiletry-std`, roomTypeKey: 'std', name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 1, restockThreshold: 8 },
    { id: `${k}-amen-soap-std`, roomTypeKey: 'std', name: 'Soap Bar', unit: 'piece', expectedQtyPerStay: 2, restockThreshold: 12 },
    { id: `${k}-amen-water-dlx`, roomTypeKey: 'dlx', name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 3, restockThreshold: 10 },
    { id: `${k}-amen-toiletry-dlx`, roomTypeKey: 'dlx', name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 2, restockThreshold: 8 },
    { id: `${k}-amen-tea-dlx`, roomTypeKey: 'dlx', name: 'Tea/Coffee Sachets', unit: 'sachet', expectedQtyPerStay: 4, restockThreshold: 15 },
    { id: `${k}-amen-slippers-dlx`, roomTypeKey: 'dlx', name: 'Slippers', unit: 'pair', expectedQtyPerStay: 2, restockThreshold: 8 },
    { id: `${k}-amen-water-suite`, roomTypeKey: 'suite', name: 'Drinking Water (1L)', unit: 'bottle', expectedQtyPerStay: 4, restockThreshold: 10 },
    { id: `${k}-amen-toiletry-suite`, roomTypeKey: 'suite', name: 'Toiletry Kit', unit: 'kit', expectedQtyPerStay: 2, restockThreshold: 8 },
    { id: `${k}-amen-fruit-suite`, roomTypeKey: 'suite', name: 'Fruit Basket', unit: 'basket', expectedQtyPerStay: 1, restockThreshold: 4 },
  ];
}

function linensForTheme(themeKey: string): LinenDef[] {
  const k = themeKey;
  return [
    { id: `${k}-linen-bath-towel`, name: 'Bath Towel', unit: 'piece', totalOwned: 120, minPoolSize: 30 },
    { id: `${k}-linen-bed-sheet`, name: 'Bed Sheet', unit: 'piece', totalOwned: 90, minPoolSize: 24 },
    { id: `${k}-linen-pillow-cover`, name: 'Pillow Cover', unit: 'piece', totalOwned: 160, minPoolSize: 40 },
    { id: `${k}-linen-hand-towel`, name: 'Hand Towel', unit: 'piece', totalOwned: 100, minPoolSize: 30 },
    { id: `${k}-linen-bath-mat`, name: 'Bath Mat', unit: 'piece', totalOwned: 60, minPoolSize: 18 },
    { id: `${k}-linen-blanket`, name: 'Blanket', unit: 'piece', totalOwned: 50, minPoolSize: 15 },
  ];
}

// Rotating task-type recipe — exercises every flow over 5 rooms.
const TASK_RECIPE: string[][] = [
  ['CLEAN', 'REFILL'],
  ['CLEAN', 'STANDARD_LAUNDRY'],
  ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'],
  ['CLEAN', 'PERIODIC_LAUNDRY'],
  ['CLEAN'],
];

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function seedHousekeeping(
  prisma: PrismaClient,
  theme: ThemeDef,
  rtKeyToId: Record<'std' | 'dlx' | 'suite', string>,
): Promise<void> {
  const propertyId = theme.property.id;
  const today = dateOnly(NOW);

  // Catalog: amenities (only those whose room type exists for this property)
  // and linens. Idempotent upserts keyed by the stable string IDs.
  const amenities = amenitiesForTheme(theme.key).filter((a) => rtKeyToId[a.roomTypeKey]);
  for (const item of amenities) {
    const roomTypeId = rtKeyToId[item.roomTypeKey];
    await prisma.catalogItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        unit: item.unit,
        roomTypeId,
        expectedQtyPerStay: item.expectedQtyPerStay,
        restockThreshold: item.restockThreshold,
        deletedAt: null,
      },
      create: {
        id: item.id,
        propertyId,
        itemType: 'AMENITY',
        roomTypeId,
        name: item.name,
        unit: item.unit,
        expectedQtyPerStay: item.expectedQtyPerStay,
        restockThreshold: item.restockThreshold,
      },
    });
  }

  const linens = linensForTheme(theme.key);
  for (const item of linens) {
    await prisma.catalogItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        unit: item.unit,
        totalOwned: item.totalOwned,
        minPoolSize: item.minPoolSize,
        linenCategory: 'ROUTINE',
        deletedAt: null,
      },
      create: {
        id: item.id,
        propertyId,
        itemType: 'LINEN',
        name: item.name,
        unit: item.unit,
        totalOwned: item.totalOwned,
        minPoolSize: item.minPoolSize,
        linenCategory: 'ROUTINE',
      },
    });
  }

  // Take the first 5 rooms as the dirty cohort, flip to DIRTY.
  const dirtyRooms = theme.rooms.slice(0, 5);
  for (const room of dirtyRooms) {
    await prisma.room.update({
      where: { id: room.id },
      data: { state: 'DIRTY' },
    });
  }

  // Today's room assignments — distribute dirty rooms across housekeepers
  // round-robin. taskTypes rotate through TASK_RECIPE so every flow is
  // exercised across the 5 rooms.
  const hkUsers = theme.housekeepers;
  for (let i = 0; i < dirtyRooms.length; i++) {
    const room = dirtyRooms[i]!;
    const hk = hkUsers[i % hkUsers.length]!;
    const taskTypes = TASK_RECIPE[i % TASK_RECIPE.length]!;
    const assignmentId = `${theme.key}-assign-${room.number}-${today.toISOString().slice(0, 10)}`;
    await prisma.roomAssignment.upsert({
      where: { id: assignmentId },
      update: {
        roomId: room.id,
        staffUserId: hk.id,
        taskTypes,
        deletedAt: null,
      },
      create: {
        id: assignmentId,
        propertyId,
        roomId: room.id,
        staffUserId: hk.id,
        assignedDate: today,
        assignedBy: theme.owner.id,
        taskTypes,
      },
    });

    // Initialise consumable state at LOW qty so refill is a meaningful action.
    const matchingAmenities = amenities.filter((a) => a.roomTypeKey === room.roomTypeKey);
    for (const amenity of matchingAmenities) {
      await prisma.roomConsumableState.upsert({
        where: { propertyId_roomId_catalogItemId: { propertyId, roomId: room.id, catalogItemId: amenity.id } },
        update: { currentQty: 0 },
        create: {
          propertyId,
          roomId: room.id,
          catalogItemId: amenity.id,
          currentQty: 0,
          lastRefillAt: new Date(NOW.getTime() - 3 * DAY_MS),
        },
      });
    }

    // Initialise linen state at typical in-room qty (2 each) so swap flows
    // have a starting count.
    for (const linen of linens) {
      await prisma.roomLinenState.upsert({
        where: { propertyId_roomId_catalogItemId: { propertyId, roomId: room.id, catalogItemId: linen.id } },
        update: { qty: 2 },
        create: {
          propertyId,
          roomId: room.id,
          catalogItemId: linen.id,
          qty: 2,
          seedSource: 'COLD_START',
          lastObservedAt: new Date(NOW.getTime() - 1 * DAY_MS),
        },
      });
    }
  }
}

function pickSource(r: () => number, mix: ThemeDef['sourceMix']): string {
  const x = r();
  if (x < mix.DIRECT_BOOKING) return 'DIRECT_BOOKING';
  if (x < mix.DIRECT_BOOKING + mix.OTA) return 'OTA';
  return 'WALK_IN';
}

async function seedTheme(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;

  // Property.
  await prisma.property.upsert({
    where: { slug: theme.property.slug },
    update: {
      name: theme.property.name,
      city: theme.property.city,
      state: theme.property.state,
      pincode: theme.property.pincode,
      address: theme.property.address,
      active: true,
    },
    create: {
      id: propertyId,
      name: theme.property.name,
      slug: theme.property.slug,
      address: theme.property.address,
      city: theme.property.city,
      state: theme.property.state,
      pincode: theme.property.pincode,
      numberOfFloors: 3,
      defaultCheckInTime: '14:00',
      defaultCheckOutTime: '11:00',
      active: true,
    },
  });

  // Subscription with correct tier + status.
  const trialStartedAt =
    theme.tier === 'TRIAL'
      ? new Date(NOW.getTime() - 30 * DAY_MS)
      : new Date(NOW.getTime() - 365 * DAY_MS);
  const trialEndsAt = new Date(trialStartedAt.getTime() + 120 * DAY_MS);
  const status = theme.tier === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
  const currentPeriodStart =
    theme.tier === 'TRIAL' ? trialStartedAt : new Date(NOW.getTime() - 25 * DAY_MS);
  const currentPeriodEnd =
    theme.tier === 'TRIAL'
      ? trialEndsAt
      : new Date(currentPeriodStart.getTime() + 30 * DAY_MS);

  await prisma.subscription.upsert({
    where: { propertyId },
    update: {
      tier: theme.tier,
      status,
      planKey: theme.tier,
      trialStartedAt,
      trialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
    },
    create: {
      propertyId,
      planKey: theme.tier,
      tier: theme.tier,
      status,
      billingCadence: 'MONTHLY',
      trialStartedAt,
      trialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  // Users (owner, manager, housekeepers). User.phone is globally unique.
  const allUsers: Array<{ user: CharacterDef; role: 'OWNER' | 'MANAGER' | 'HOUSEKEEPING' }> = [
    { user: theme.owner, role: 'OWNER' },
    { user: theme.manager, role: 'MANAGER' },
    ...theme.housekeepers.map((hk) => ({ user: hk, role: 'HOUSEKEEPING' as const })),
  ];
  for (const { user, role } of allUsers) {
    // No PIN initialised — every user goes through the PIN-creation flow on
    // first login (Hotfix 1 Phase D).
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: { name: user.name, pinHash: null },
      create: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        pinHash: null,
      },
    });
    await prisma.propertyAccess.upsert({
      where: { propertyId_userId: { propertyId, userId: user.id } },
      update: { role, status: 'ACTIVE', revokedAt: null, deletedAt: null },
      create: {
        id: `${user.id}-access`,
        propertyId,
        userId: user.id,
        role,
        status: 'ACTIVE',
        invitedAt: new Date(NOW.getTime() - 350 * DAY_MS),
        invitedBy: theme.owner.id,
      },
    });
  }

  // Room types.
  const rtKeyToId: Record<'std' | 'dlx' | 'suite', string> = { std: '', dlx: '', suite: '' };
  for (const [idx, rt] of theme.roomTypes.entries()) {
    await prisma.roomType.upsert({
      where: { propertyId_name: { propertyId, name: rt.name } },
      update: { baseRate: rt.baseRate, floorRate: rt.floorRate, gstSlab: rt.gstSlab, amenities: rt.amenities, maxOccupancy: rt.maxOccupancy },
      create: {
        id: rt.id,
        propertyId,
        name: rt.name,
        maxOccupancy: rt.maxOccupancy,
        baseRate: rt.baseRate,
        floorRate: rt.floorRate,
        gstSlab: rt.gstSlab,
        amenities: rt.amenities,
      },
    });
    const key = (['std', 'dlx', 'suite'] as const)[idx];
    if (key) rtKeyToId[key] = rt.id;
  }

  // Rooms.
  for (const room of theme.rooms) {
    const roomTypeId = rtKeyToId[room.roomTypeKey];
    await prisma.room.upsert({
      where: { propertyId_number: { propertyId, number: room.number } },
      update: { roomTypeId, floor: room.floor, state: 'AVAILABLE' },
      create: {
        id: room.id,
        propertyId,
        roomTypeId,
        number: room.number,
        floor: room.floor,
        state: 'AVAILABLE',
      },
    });
  }

  // Guests.
  for (const g of theme.guests) {
    const guestId = `${theme.key}-${g.code}`;
    await prisma.guest.upsert({
      where: { propertyId_guestCode: { propertyId, guestCode: g.code } },
      update: { fullName: g.name, phone: g.phone },
      create: {
        id: guestId,
        propertyId,
        guestCode: g.code,
        fullName: g.name,
        phone: g.phone,
        consentGivenAt: new Date(NOW.getTime() - 300 * DAY_MS),
      },
    });
  }

  // Cancellation policy.
  const policyId = `${theme.key}-policy-flex`;
  await prisma.cancellationPolicy.upsert({
    where: { propertyId_name: { propertyId, name: '24 Hour Flex' } },
    update: { isDefault: true, deletedAt: null },
    create: {
      id: policyId,
      propertyId,
      name: '24 Hour Flex',
      windowHours: 24,
      penaltyType: 'FIRST_NIGHT',
      penaltyValue: '100.00',
      isDefault: true,
    },
  });

  // Reservations + folios — one year of synthetic activity.
  const r = rng(propertyId);
  const guestIds = theme.guests.map((g) => `${theme.key}-${g.code}`);
  const rooms = theme.rooms;
  const pastStart = NOW.getTime() - PAST_DAYS * DAY_MS;
  const futureLimit = NOW.getTime() + FUTURE_DAYS * DAY_MS;
  // ~25% of reservations sit in the future 2-month window; rest spread across
  // the past year. Future reservations are further gated by a per-week skip so
  // some weeks are intentionally empty.
  const futureShare = 0.25;
  // Pre-pick a sparse set of "off-weeks" in the future window — these slots
  // refuse to host any future reservation (random idle weeks for demo polish).
  const futureWeeks = Math.ceil(FUTURE_DAYS / 7);
  const offWeeks = new Set<number>();
  for (let w = 0; w < futureWeeks; w++) {
    if (r() < FUTURE_SKIP_PROBABILITY) offWeeks.add(w);
  }

  let folioCounter = 1;
  for (let i = 0; i < theme.reservationCount; i++) {
    let checkInTs: number;
    if (r() < futureShare) {
      // Future placement, but skip any check-in falling inside an off-week.
      let attempts = 0;
      do {
        checkInTs = NOW.getTime() + Math.floor(r() * (futureLimit - NOW.getTime()));
        attempts += 1;
        const weekIdx = Math.floor((checkInTs - NOW.getTime()) / (7 * DAY_MS));
        if (!offWeeks.has(weekIdx)) break;
      } while (attempts < 6);
    } else {
      checkInTs = pastStart + Math.floor(r() * (NOW.getTime() - pastStart));
    }
    const nights = 1 + Math.floor(r() * 4); // 1-4 nights
    const checkInDate = new Date(checkInTs);
    const checkOutDate = new Date(checkInTs + nights * DAY_MS);
    const room = rooms[Math.floor(r() * rooms.length)]!;
    const roomTypeId = rtKeyToId[room.roomTypeKey];
    const guestId = guestIds[Math.floor(r() * guestIds.length)]!;
    const source = pickSource(r, theme.sourceMix);

    // Status by time-relation to NOW.
    let status: 'CHECKED_OUT' | 'CHECKED_IN' | 'CONFIRMED' | 'CANCELLED';
    if (checkOutDate.getTime() < NOW.getTime()) {
      status = r() < 0.06 ? 'CANCELLED' : 'CHECKED_OUT';
    } else if (checkInDate.getTime() <= NOW.getTime()) {
      status = 'CHECKED_IN';
    } else {
      status = r() < 0.08 ? 'CANCELLED' : 'CONFIRMED';
    }

    const baseRate = room.roomTypeKey === 'std' ? 4200 : room.roomTypeKey === 'dlx' ? 7400 : 13800;
    const rateJitter = 0.9 + r() * 0.25; // 0.9 – 1.15
    const nightlyRate = Math.round(baseRate * rateJitter);

    const reservationId = `${theme.key}-resv-${String(i + 1).padStart(3, '0')}`;
    const bookingRef = `${theme.key.toUpperCase().slice(0, 2)}-${checkInDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;

    await prisma.reservation.upsert({
      where: { id: reservationId },
      update: {
        status,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        roomId: room.id,
        roomTypeId,
        guestId,
        source,
      },
      create: {
        id: reservationId,
        propertyId,
        roomId: room.id,
        roomTypeId,
        guestId,
        bookingReference: bookingRef,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status,
        source,
        rateSnapshot: { nightlyRate },
        selectedCancellationPolicyId: policyId,
      },
    });

    // Folio for stays that actually happened.
    if (status === 'CHECKED_OUT' || status === 'CHECKED_IN') {
      const folioId = `${theme.key}-folio-${String(i + 1).padStart(3, '0')}`;
      const invoiceNumber = `${theme.key.toUpperCase().slice(0, 2)}-INV-${String(folioCounter).padStart(4, '0')}`;
      folioCounter += 1;
      await prisma.folio.upsert({
        where: { id: folioId },
        update: { status: status === 'CHECKED_OUT' ? 'CLOSED' : 'OPEN' },
        create: {
          id: folioId,
          propertyId,
          reservationId,
          guestId,
          invoiceNumber,
          status: status === 'CHECKED_OUT' ? 'CLOSED' : 'OPEN',
        },
      });

      const gstSlab = room.roomTypeKey === 'std' ? '12%' : '18%';
      const taxPct = room.roomTypeKey === 'std' ? 0.12 : 0.18;
      for (let n = 0; n < nights; n++) {
        const lineId = `${folioId}-line-room-${n + 1}`;
        const taxAmount = Math.round(nightlyRate * taxPct);
        await prisma.folioLine.upsert({
          where: { id: lineId },
          update: { amount: nightlyRate.toFixed(2), taxAmount: taxAmount.toFixed(2) },
          create: {
            id: lineId,
            propertyId,
            folioId,
            chargeType: 'ROOM_CHARGE',
            description: `Room ${room.number} — night ${n + 1}`,
            amount: nightlyRate.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            gstSlab,
            postedAt: new Date(checkInDate.getTime() + n * DAY_MS),
          },
        });
      }
      // Occasional extra.
      if (r() < 0.4) {
        const lineId = `${folioId}-line-extra`;
        const extraAmount = Math.round(400 + r() * 1200);
        const taxAmount = Math.round(extraAmount * 0.12);
        await prisma.folioLine.upsert({
          where: { id: lineId },
          update: { amount: extraAmount.toFixed(2), taxAmount: taxAmount.toFixed(2) },
          create: {
            id: lineId,
            propertyId,
            folioId,
            chargeType: 'EXTRA_CHARGE',
            description: r() < 0.5 ? 'Breakfast' : 'Laundry',
            amount: extraAmount.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            gstSlab: '12%',
            postedAt: checkInDate,
          },
        });
      }
    }
  }

  // Housekeeping setup — catalog, dirty rooms, today's assignments, baseline
  // room state. No activity logs (clean slate for testing).
  await seedHousekeeping(prisma, theme, rtKeyToId);
}

export async function seedAnimeProperties(prisma: PrismaClient): Promise<void> {
  const themes = buildThemes();
  for (const theme of themes) {
    console.log(`[seed:anime] ${theme.property.name} (${theme.tier}, ${theme.housekeepers.length} HK)`);
    await seedTheme(prisma, theme);
  }

  // Counts summary.
  for (const theme of themes) {
    const [rooms, reservations, folios] = await Promise.all([
      prisma.room.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
      prisma.reservation.count({ where: { propertyId: theme.property.id } }),
      prisma.folio.count({ where: { propertyId: theme.property.id } }),
    ]);
    console.log(
      `[seed:anime]   ${theme.property.slug}: rooms=${rooms} reservations=${reservations} folios=${folios}`,
    );
  }
}
