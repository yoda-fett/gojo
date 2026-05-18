// Themed demo seed — seven anime-flavoured properties across three franchises.
// Idempotent: re-running upserts records by stable string IDs (no drops).
//
// Mapping:
//   One Piece    — Thousand Sunny Resort     · GROWTH  (Darjeeling)
//                — Going Merry Lodge          · STARTER (Gangtok)
//                — Baratie Floating Stay      · TRIAL   (Kalimpong)
//   Demon Slayer — Butterfly Mansion Inn      · STARTER (Gangtok)
//                — Wisteria Estate            · GROWTH  (Darjeeling)
//   Naruto       — Konoha Leaf Lodge          · TRIAL   (Kalimpong)
//                — Sand Village Inn           · STARTER (Darjeeling)
//
// Owners hold multiple properties (Luffy → all OP, Tanjiro → both DS, Naruto →
// both NA). Manager Nico Robin is cross-property (Sunny + Going Merry).
// Generates ~1 year of reservations plus fill-up pass to guarantee ≥4 arrivals
// and ≥4 departures per ISO week across May + June 2026 per property. Adds GST
// invoices, audit logs, and housekeeping action items.

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
  key: string;
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
      key: 'one-piece-merry',
      property: {
        id: 'anime-prop-op-going-merry',
        slug: 'going-merry-lodge',
        name: 'Going Merry Lodge',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '12 MG Marg, Gangtok',
      },
      tier: 'STARTER',
      owner: { id: 'anime-user-luffy', name: 'Monkey D. Luffy', phone: '+919000110001' },
      // Robin pulls double duty — she also manages Thousand Sunny.
      manager: { id: 'anime-user-robin', name: 'Nico Robin', phone: '+919000110002' },
      housekeepers: [
        { id: 'anime-user-merry-hk1', name: 'Carrot Mink', phone: '+919000140003' },
        { id: 'anime-user-merry-hk2', name: 'Pedro Jaguar', phone: '+919000140004' },
      ],
      guests: [
        ['MR-G01', 'Bartolomeo Cannibal', '+919000149001'],
        ['MR-G02', 'Cavendish White Horse', '+919000149002'],
        ['MR-G03', 'Ideo Boxer', '+919000149003'],
        ['MR-G04', 'Leo Tontatta', '+919000149004'],
        ['MR-G05', 'Hajrudin Giant', '+919000149005'],
        ['MR-G06', 'Sai Happo', '+919000149006'],
        ['MR-G07', 'Orlumbus Yonta', '+919000149007'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 50,
      roomTypes: [
        { id: 'anime-rt-merry-std', name: 'Galley Room', maxOccupancy: 2, baseRate: '3600.00', floorRate: '3100.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-merry-dlx', name: 'Helmsman Deluxe', maxOccupancy: 3, baseRate: '6400.00', floorRate: '5600.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View'] },
        { id: 'anime-rt-merry-suite', name: 'Figurehead Suite', maxOccupancy: 4, baseRate: '11800.00', floorRate: '10500.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View', 'Lounge'] },
      ],
      rooms: [
        { id: 'anime-room-merry-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-merry-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-merry-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-merry-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-merry-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-merry-301', number: '301', floor: 3, roomTypeKey: 'suite' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0.3, WALK_IN: 0.15 },
    },
    {
      key: 'one-piece-baratie',
      property: {
        id: 'anime-prop-op-baratie',
        slug: 'baratie-floating-stay',
        name: 'Baratie Floating Stay',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734301',
        address: '9 Rishi Road, Kalimpong',
      },
      tier: 'TRIAL',
      owner: { id: 'anime-user-luffy', name: 'Monkey D. Luffy', phone: '+919000110001' },
      manager: { id: 'anime-user-sanji', name: 'Vinsmoke Sanji', phone: '+919000150002' },
      housekeepers: [
        { id: 'anime-user-baratie-hk1', name: 'Patty Pastry', phone: '+919000150003' },
        { id: 'anime-user-baratie-hk2', name: 'Carne Cleaver', phone: '+919000150004' },
      ],
      guests: [
        ['BR-G01', 'Zeff Red Leg', '+919000159001'],
        ['BR-G02', 'Gin Iron Mace', '+919000159002'],
        ['BR-G03', 'Krieg Don', '+919000159003'],
        ['BR-G04', 'Pearl Iron Wall', '+919000159004'],
        ['BR-G05', 'Mihawk Hawkeye', '+919000159005'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 30,
      roomTypes: [
        { id: 'anime-rt-baratie-std', name: 'Galley Cabin', maxOccupancy: 2, baseRate: '2900.00', floorRate: '2500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-baratie-dlx', name: 'Sous Chef Room', maxOccupancy: 3, baseRate: '5200.00', floorRate: '4600.00', gstSlab: '18%', amenities: ['WiFi', 'River View'] },
      ],
      rooms: [
        { id: 'anime-room-baratie-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-baratie-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-baratie-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-baratie-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-baratie-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.6, OTA: 0, WALK_IN: 0.4 },
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
      key: 'demon-slayer-wisteria',
      property: {
        id: 'anime-prop-ds-wisteria',
        slug: 'wisteria-estate',
        name: 'Wisteria Estate',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734101',
        address: '22 Mall Road, Darjeeling',
      },
      tier: 'GROWTH',
      owner: { id: 'anime-user-tanjiro', name: 'Tanjiro Kamado', phone: '+919000220001' },
      manager: { id: 'anime-user-giyu', name: 'Giyu Tomioka', phone: '+919000240002' },
      housekeepers: [
        { id: 'anime-user-wisteria-hk1', name: 'Aoi Kanzaki', phone: '+919000240003' },
        { id: 'anime-user-wisteria-hk2', name: 'Kiyo Terauchi', phone: '+919000240004' },
      ],
      guests: [
        ['WS-G01', 'Genya Shinazugawa', '+919000249001'],
        ['WS-G02', 'Kanao Tsuyuri', '+919000249002'],
        ['WS-G03', 'Yushiro Vampire', '+919000249003'],
        ['WS-G04', 'Tamayo Healer', '+919000249004'],
        ['WS-G05', 'Murata Slayer', '+919000249005'],
        ['WS-G06', 'Goto Kakushi', '+919000249006'],
        ['WS-G07', 'Sumi Nakahara', '+919000249007'],
        ['WS-G08', 'Naho Takada', '+919000249008'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 90,
      roomTypes: [
        { id: 'anime-rt-wisteria-std', name: 'Pillar Room', maxOccupancy: 2, baseRate: '4800.00', floorRate: '4200.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-wisteria-dlx', name: 'Garden Suite', maxOccupancy: 3, baseRate: '8400.00', floorRate: '7500.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View'] },
        { id: 'anime-rt-wisteria-suite', name: 'Hashira Penthouse', maxOccupancy: 4, baseRate: '14500.00', floorRate: '13000.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View', 'Lounge'] },
      ],
      rooms: [
        { id: 'anime-room-wisteria-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-wisteria-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-wisteria-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-wisteria-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-wisteria-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-wisteria-203', number: '203', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-wisteria-301', number: '301', floor: 3, roomTypeKey: 'suite' },
        { id: 'anime-room-wisteria-302', number: '302', floor: 3, roomTypeKey: 'suite' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.4, OTA: 0.45, WALK_IN: 0.15 },
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
    {
      key: 'naruto-sand',
      property: {
        id: 'anime-prop-na-sand-village',
        slug: 'sand-village-inn',
        name: 'Sand Village Inn',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734101',
        address: '5 Mall Road, Darjeeling',
      },
      tier: 'STARTER',
      owner: { id: 'anime-user-naruto', name: 'Naruto Uzumaki', phone: '+919000330001' },
      manager: { id: 'anime-user-gaara', name: 'Gaara of the Sand', phone: '+919000340002' },
      housekeepers: [
        { id: 'anime-user-sand-hk1', name: 'Temari Whirlwind', phone: '+919000340003' },
        { id: 'anime-user-sand-hk2', name: 'Kankuro Puppet', phone: '+919000340004' },
      ],
      guests: [
        ['SV-G01', 'Baki Sand', '+919000349001'],
        ['SV-G02', 'Ebizo Elder', '+919000349002'],
        ['SV-G03', 'Chiyo Granny', '+919000349003'],
        ['SV-G04', 'Yashamaru Uncle', '+919000349004'],
        ['SV-G05', 'Pakura Scorch', '+919000349005'],
        ['SV-G06', 'Maki Wind', '+919000349006'],
      ].map((g) => ({ code: g[0]!, name: g[1]!, phone: g[2]! })),
      reservationCount: 55,
      roomTypes: [
        { id: 'anime-rt-sand-std', name: 'Genin Room', maxOccupancy: 2, baseRate: '3200.00', floorRate: '2800.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-sand-dlx', name: 'Jonin Deluxe', maxOccupancy: 3, baseRate: '5800.00', floorRate: '5100.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View'] },
      ],
      rooms: [
        { id: 'anime-room-sand-101', number: '101', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-sand-102', number: '102', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-sand-103', number: '103', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-sand-104', number: '104', floor: 1, roomTypeKey: 'std' },
        { id: 'anime-room-sand-201', number: '201', floor: 2, roomTypeKey: 'dlx' },
        { id: 'anime-room-sand-202', number: '202', floor: 2, roomTypeKey: 'dlx' },
      ],
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0.3, WALK_IN: 0.15 },
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
        // ID must be property-scoped so multi-property users (e.g. Luffy
        // across all 3 One Piece properties, Robin across Sunny + Going
        // Merry) don't collide on the global `id` unique constraint.
        id: `${propertyId}-${user.id}-access`,
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

// ─── Density fill-up pass ──────────────────────────────────────────────────
// Guarantees ≥4 arrivals and ≥4 departures per ISO week (Mon–Sun) per property
// for May 2026 and June 2026. We compute the week index from a Monday epoch,
// count existing arrivals/departures keyed by week, then synthesise extra
// reservations until the floor is met. New reservations follow the same shape
// as the random pass — Reservation + Folio + FolioLines (for CHECKED_OUT).

function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sun
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() + offsetToMonday);
  return m;
}

function weekKey(d: Date): string {
  const m = mondayOf(d);
  return m.toISOString().slice(0, 10);
}

// Returns the list of ISO-week-Monday keys that fall (start of week) inside
// May 1 → June 30 2026, plus surrounding weeks whose Mon-Sun overlaps that
// range. We use simple Mon-Sun calendar weeks starting on Mondays whose date
// is within May/June or whose Sunday is within May/June.
function targetWeekStarts(): Date[] {
  const out: Date[] = [];
  // Walk from late-April Monday through end of June.
  const start = mondayOf(new Date(Date.UTC(2026, 4, 1))); // May = month 4
  const endLimit = new Date(Date.UTC(2026, 6, 1)); // exclusive: July 1
  for (let t = start.getTime(); t < endLimit.getTime(); t += 7 * DAY_MS) {
    out.push(new Date(t));
  }
  return out;
}

async function fillUpDensity(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const r = rng(`${propertyId}-fillup`);
  const guestIds = theme.guests.map((g) => `${theme.key}-${g.code}`);
  const rooms = theme.rooms;

  // Per-room-type id lookup. Read from DB to handle existing rows.
  const dbRoomTypes = await prisma.roomType.findMany({
    where: { propertyId, deletedAt: null },
  });
  const rtKeyToId: Record<'std' | 'dlx' | 'suite', string> = { std: '', dlx: '', suite: '' };
  for (const [idx, rt] of theme.roomTypes.entries()) {
    const match = dbRoomTypes.find((d) => d.name === rt.name);
    const key = (['std', 'dlx', 'suite'] as const)[idx];
    if (key && match) rtKeyToId[key] = match.id;
  }

  // Count arrivals / departures per week using all existing reservations.
  const existing = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ['CHECKED_IN', 'CHECKED_OUT', 'CONFIRMED'] } },
    select: { id: true, checkIn: true, checkOut: true },
  });
  const arrivalsByWeek = new Map<string, number>();
  const departuresByWeek = new Map<string, number>();
  for (const r1 of existing) {
    const aKey = weekKey(r1.checkIn);
    const dKey = weekKey(r1.checkOut);
    arrivalsByWeek.set(aKey, (arrivalsByWeek.get(aKey) ?? 0) + 1);
    departuresByWeek.set(dKey, (departuresByWeek.get(dKey) ?? 0) + 1);
  }

  const FLOOR = 4;
  let counter = 0;
  // We need a deterministic suffix for ids; the theme key + sequence works.
  const cancelPolicyId = `${theme.key}-policy-flex`;

  for (const weekStart of targetWeekStarts()) {
    const wKey = weekKey(weekStart);
    let arrivals = arrivalsByWeek.get(wKey) ?? 0;
    let departures = departuresByWeek.get(wKey) ?? 0;
    // We may need both arrivals and departures within this week. Each new
    // reservation we place to add an arrival will land its departure either in
    // the same week or next week (1–3 nights). So we top up arrivals first,
    // tracking spill into departures, then top up departures if still short.
    let safety = 0;
    while ((arrivals < FLOOR || departures < FLOOR) && safety < 20) {
      safety += 1;
      // Pick a day within this week (Mon..Sun). If we still need arrivals,
      // anchor on an arrival inside the week. Otherwise we anchor checkOut
      // inside the week by placing the reservation 1-3 nights earlier.
      const needArrival = arrivals < FLOOR;
      let checkInDate: Date;
      let nights: number;
      if (needArrival) {
        const dayOffset = Math.floor(r() * 7); // Mon..Sun
        checkInDate = new Date(weekStart.getTime() + dayOffset * DAY_MS);
        nights = 1 + Math.floor(r() * 3); // 1-3 nights
      } else {
        // Need a departure landing in this week.
        nights = 1 + Math.floor(r() * 3);
        const dayOffset = Math.floor(r() * 7);
        const desiredCheckOut = new Date(weekStart.getTime() + dayOffset * DAY_MS);
        checkInDate = new Date(desiredCheckOut.getTime() - nights * DAY_MS);
      }
      const checkOutDate = new Date(checkInDate.getTime() + nights * DAY_MS);
      const room = rooms[Math.floor(r() * rooms.length)]!;
      const roomTypeId = rtKeyToId[room.roomTypeKey];
      if (!roomTypeId) break;
      const guestId = guestIds[Math.floor(r() * guestIds.length)]!;
      const source = pickSource(r, theme.sourceMix);

      let status: 'CHECKED_OUT' | 'CHECKED_IN' | 'CONFIRMED';
      if (checkOutDate.getTime() < NOW.getTime()) status = 'CHECKED_OUT';
      else if (checkInDate.getTime() <= NOW.getTime()) status = 'CHECKED_IN';
      else status = 'CONFIRMED';

      const baseRate = room.roomTypeKey === 'std' ? 4200 : room.roomTypeKey === 'dlx' ? 7400 : 13800;
      const nightlyRate = Math.round(baseRate * (0.9 + r() * 0.25));

      counter += 1;
      const seq = String(counter).padStart(3, '0');
      const reservationId = `${theme.key}-fill-${wKey}-${seq}`;
      const bookingRef = `${theme.key.toUpperCase().slice(0, 2)}-F-${wKey.replace(/-/g, '')}-${seq}`;

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
          selectedCancellationPolicyId: cancelPolicyId,
        },
      });

      if (status === 'CHECKED_OUT' || status === 'CHECKED_IN') {
        const folioId = `${theme.key}-fill-folio-${wKey}-${seq}`;
        const invoiceNumber = `${theme.key.toUpperCase().slice(0, 2)}-FINV-${wKey.replace(/-/g, '')}-${seq}`;
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
        const taxPct = room.roomTypeKey === 'std' ? 0.12 : 0.18;
        const gstSlab = room.roomTypeKey === 'std' ? '12%' : '18%';
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
      }

      // Update local counters.
      const aKey = weekKey(checkInDate);
      const dKey = weekKey(checkOutDate);
      arrivalsByWeek.set(aKey, (arrivalsByWeek.get(aKey) ?? 0) + 1);
      departuresByWeek.set(dKey, (departuresByWeek.get(dKey) ?? 0) + 1);
      arrivals = arrivalsByWeek.get(wKey) ?? 0;
      departures = departuresByWeek.get(wKey) ?? 0;
    }
  }
}

// ─── GST Invoices ──────────────────────────────────────────────────────────
// One Invoice per CLOSED folio. Most are PAID (B2C, no recipient GSTIN).
// ~10% are B2B with a synthetic recipient GSTIN. CGST + SGST split 50/50.

function gstinForState(state: string, seed: number): string {
  // Real GSTIN format: SS + 10-char PAN + 1 entity + Z + 1 checksum.
  // We don't validate — just pick state-code prefix + filler.
  const stateCode = state === 'Sikkim' ? '11' : '19'; // West Bengal = 19
  const filler = ['ABCDE1234F', 'PQRST5678G', 'XYZAB9012H', 'LMNOP3456J'][seed % 4]!;
  return `${stateCode}${filler}1Z5`;
}

async function seedInvoices(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const r = rng(`${propertyId}-invoices`);
  const supplierGstin = gstinForState(theme.property.state, theme.property.name.length);

  const closedFolios = await prisma.folio.findMany({
    where: { propertyId, status: 'CLOSED' },
  });

  let idx = 0;
  for (const folio of closedFolios) {
    const [reservation, guest, lines] = await Promise.all([
      prisma.reservation.findUnique({ where: { id: folio.reservationId } }),
      prisma.guest.findUnique({ where: { id: folio.guestId } }),
      prisma.folioLine.findMany({ where: { folioId: folio.id } }),
    ]);
    if (!reservation || !guest) continue;
    idx += 1;
    const checkIn = reservation.checkIn;
    const checkOut = reservation.checkOut;
    const nights = Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS),
    );
    const taxableValue = lines.reduce((acc, l) => acc + Number(l.amount), 0);
    const taxTotal = lines.reduce((acc, l) => acc + Number(l.taxAmount), 0);
    const cgst = +(taxTotal / 2).toFixed(2);
    const sgst = +(taxTotal - cgst).toFixed(2);
    const total = +(taxableValue + taxTotal).toFixed(2);
    const status = r() < 0.8 ? 'PAID' : 'ISSUED';
    const isB2B = r() < 0.1;
    const recipientGstin = isB2B ? gstinForState(theme.property.state, idx) : null;
    const rate =
      (reservation.rateSnapshot as { nightlyRate?: number } | null)?.nightlyRate ?? 0;
    const invoiceId = `${theme.key}-inv-${String(idx).padStart(4, '0')}`;

    await prisma.invoice.upsert({
      where: { id: invoiceId },
      update: {
        status,
        totalAmount: total.toFixed(2),
        taxableValue: taxableValue.toFixed(2),
        cgstAmount: cgst.toFixed(2),
        sgstAmount: sgst.toFixed(2),
        recipientGstin,
      },
      create: {
        id: invoiceId,
        propertyId,
        folioId: folio.id,
        guestId: folio.guestId,
        invoiceNumber: folio.invoiceNumber ?? `${theme.key.toUpperCase().slice(0, 2)}-INV-${String(idx).padStart(4, '0')}`,
        type: 'INVOICE',
        status,
        supplierGstin,
        supplierName: theme.property.name,
        supplierAddress: theme.property.address,
        recipientName: guest.fullName,
        recipientGstin,
        hsnCode: '9963',
        checkIn,
        checkOut,
        totalNights: nights,
        taxableValue: taxableValue.toFixed(2),
        cgstAmount: cgst.toFixed(2),
        sgstAmount: sgst.toFixed(2),
        totalAmount: total.toFixed(2),
        invoiceRateSnapshot: { nightlyRate: rate },
        invoiceDate: checkOut,
      },
    });
  }
}

// ─── Audit logs ────────────────────────────────────────────────────────────

type ActionDef = {
  action: string;
  weight: number;
  entityType: 'RESERVATION' | 'FOLIO' | 'INVOICE' | 'CHANNEL' | 'AUTH' | 'GUEST';
  actorPool: 'OWNER' | 'MANAGER' | 'ANY_STAFF';
};

const AUDIT_ACTIONS: ActionDef[] = [
  { action: 'CHECK_IN', weight: 25, entityType: 'RESERVATION', actorPool: 'MANAGER' },
  { action: 'CHECK_OUT', weight: 20, entityType: 'RESERVATION', actorPool: 'MANAGER' },
  { action: 'RESERVATION_CANCELLED', weight: 10, entityType: 'RESERVATION', actorPool: 'MANAGER' },
  { action: 'RESERVATION_AMENDED', weight: 8, entityType: 'RESERVATION', actorPool: 'MANAGER' },
  { action: 'FOLIO_LINE_REFUNDED', weight: 8, entityType: 'FOLIO', actorPool: 'MANAGER' },
  { action: 'FOLIO_LINE_VOIDED', weight: 5, entityType: 'FOLIO', actorPool: 'MANAGER' },
  { action: 'RATE_OVERRIDE_BELOW_FLOOR', weight: 4, entityType: 'RESERVATION', actorPool: 'OWNER' },
  { action: 'DISCOUNT_APPLIED', weight: 5, entityType: 'RESERVATION', actorPool: 'OWNER' },
  { action: 'GUEST_ID_REVEALED', weight: 3, entityType: 'GUEST', actorPool: 'MANAGER' },
  { action: 'AUTH_LOGIN_FAILED', weight: 5, entityType: 'AUTH', actorPool: 'ANY_STAFF' },
  { action: 'INVOICE_ISSUED', weight: 5, entityType: 'INVOICE', actorPool: 'MANAGER' },
  { action: 'CHANNEL_CONNECTED', weight: 1, entityType: 'CHANNEL', actorPool: 'OWNER' },
  { action: 'CHANNEL_DISCONNECTED', weight: 1, entityType: 'CHANNEL', actorPool: 'OWNER' },
];

function pickWeighted<T extends { weight: number }>(arr: T[], r: () => number): T {
  const total = arr.reduce((a, b) => a + b.weight, 0);
  let x = r() * total;
  for (const item of arr) {
    if (x < item.weight) return item;
    x -= item.weight;
  }
  return arr[arr.length - 1]!;
}

async function seedAuditLogs(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const r = rng(`${propertyId}-audit`);
  const total = 40 + Math.floor(r() * 21); // 40–60 events

  const [reservationsRaw, folios, invoices, guests] = await Promise.all([
    prisma.reservation.findMany({ where: { propertyId } }),
    prisma.folio.findMany({ where: { propertyId } }),
    prisma.invoice.findMany({ where: { propertyId } }),
    prisma.guest.findMany({ where: { propertyId } }),
  ]);
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const reservations = reservationsRaw.map((r) => ({
    ...r,
    guest: guestById.get(r.guestId) ?? null,
  }));

  const checkedOut = reservations.filter((x) => x.status === 'CHECKED_OUT');
  const checkedInOrOut = reservations.filter(
    (x) => x.status === 'CHECKED_IN' || x.status === 'CHECKED_OUT',
  );

  const ownerId = theme.owner.id;
  const managerId = theme.manager.id;
  const startMs = NOW.getTime() - 30 * DAY_MS;

  for (let i = 0; i < total; i++) {
    const def = pickWeighted(AUDIT_ACTIONS, r);
    const id = `${theme.key}-audit-${String(i + 1).padStart(3, '0')}`;
    const createdAt = new Date(startMs + Math.floor(r() * (NOW.getTime() - startMs)));

    let actorId = managerId;
    let actorRole: 'OWNER' | 'MANAGER' = 'MANAGER';
    if (def.actorPool === 'OWNER') {
      actorId = ownerId;
      actorRole = 'OWNER';
    } else if (def.actorPool === 'ANY_STAFF') {
      actorId = r() < 0.5 ? ownerId : managerId;
      actorRole = actorId === ownerId ? 'OWNER' : 'MANAGER';
    }

    let entityType: string = def.entityType;
    let entityId: string | null = null;
    let metadata: Record<string, unknown> = {};
    let fromState: string | null = null;
    let toState: string | null = null;

    switch (def.action) {
      case 'CHECK_IN': {
        const res = checkedInOrOut[Math.floor(r() * checkedInOrOut.length)];
        if (!res) continue;
        entityId = res.id;
        metadata = {
          guestName: res.guest?.fullName ?? 'Guest',
          reservationCode: res.bookingReference ?? res.id,
        };
        fromState = 'CONFIRMED';
        toState = 'CHECKED_IN';
        break;
      }
      case 'CHECK_OUT': {
        const res = checkedOut[Math.floor(r() * checkedOut.length)];
        if (!res) continue;
        entityId = res.id;
        const rate =
          (res.rateSnapshot as { nightlyRate?: number } | null)?.nightlyRate ?? 0;
        metadata = {
          guestName: res.guest?.fullName ?? 'Guest',
          reservationCode: res.bookingReference ?? res.id,
          amount: rate,
        };
        fromState = 'CHECKED_IN';
        toState = 'CHECKED_OUT';
        break;
      }
      case 'RESERVATION_CANCELLED': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        metadata = {
          reservationCode: res.bookingReference ?? res.id,
          reason: r() < 0.5 ? 'Guest request' : 'Payment failed',
        };
        fromState = 'CONFIRMED';
        toState = 'CANCELLED';
        break;
      }
      case 'RESERVATION_AMENDED': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        metadata = { reservationCode: res.bookingReference ?? res.id };
        break;
      }
      case 'FOLIO_LINE_REFUNDED': {
        const f = folios[Math.floor(r() * folios.length)];
        if (!f) continue;
        entityId = f.id;
        metadata = {
          amount: 200 + Math.floor(r() * 1500),
          reason: 'Goodwill refund',
        };
        break;
      }
      case 'FOLIO_LINE_VOIDED': {
        const f = folios[Math.floor(r() * folios.length)];
        if (!f) continue;
        entityId = f.id;
        metadata = {
          amount: 100 + Math.floor(r() * 1000),
          reason: 'Posted in error',
        };
        break;
      }
      case 'RATE_OVERRIDE_BELOW_FLOOR': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        const floor = 3000 + Math.floor(r() * 2000);
        metadata = {
          amount: floor - 200,
          floor,
          reason: 'Long-stay corporate rate',
        };
        break;
      }
      case 'DISCOUNT_APPLIED': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        metadata = {
          amount: 200 + Math.floor(r() * 800),
          reason: 'Loyalty discount',
        };
        break;
      }
      case 'GUEST_ID_REVEALED': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityType = 'GUEST';
        entityId = res.guestId;
        metadata = {
          guestName: res.guest?.fullName ?? 'Guest',
          reservationCode: res.bookingReference ?? res.id,
        };
        break;
      }
      case 'AUTH_LOGIN_FAILED': {
        entityType = 'AUTH';
        entityId = actorId;
        metadata = {
          phone: actorRole === 'OWNER' ? theme.owner.phone : theme.manager.phone,
          reason: 'Invalid PIN',
        };
        break;
      }
      case 'INVOICE_ISSUED': {
        const inv = invoices[Math.floor(r() * invoices.length)];
        if (!inv) continue;
        entityId = inv.id;
        metadata = {
          invoiceNumber: inv.invoiceNumber,
          amount: Number(inv.totalAmount),
        };
        break;
      }
      case 'CHANNEL_CONNECTED':
      case 'CHANNEL_DISCONNECTED': {
        entityId = `${propertyId}-channel`;
        metadata = { channelName: r() < 0.5 ? 'Booking.com' : 'MakeMyTrip' };
        break;
      }
    }

    if (!entityId) continue;

    await prisma.auditLog.upsert({
      where: { id },
      update: { metadata: metadata as object, fromState, toState, createdAt },
      create: {
        id,
        propertyId,
        entityType,
        entityId,
        action: def.action,
        fromState,
        toState,
        actorId,
        actorRole,
        metadata: metadata as object,
        createdAt,
      },
    });
  }
}

// ─── Housekeeping action items ─────────────────────────────────────────────

async function seedHousekeepingLogs(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const r = rng(`${propertyId}-hk-logs`);
  const hkUsers = theme.housekeepers;
  if (hkUsers.length === 0) return;

  // Pull rooms + their room type so we can match amenity catalog items.
  const rooms = await prisma.room.findMany({
    where: { propertyId, deletedAt: null },
    select: { id: true, roomTypeId: true },
  });
  if (rooms.length === 0) return;

  const amenityItems = await prisma.catalogItem.findMany({
    where: { propertyId, itemType: 'AMENITY', deletedAt: null },
  });
  const linenItems = await prisma.catalogItem.findMany({
    where: { propertyId, itemType: 'LINEN', deletedAt: null },
  });

  // 5–10 ConsumptionLog rows
  const consumptionCount = 5 + Math.floor(r() * 6);
  for (let i = 0; i < consumptionCount; i++) {
    const room = rooms[Math.floor(r() * rooms.length)]!;
    const matching = amenityItems.filter((a) => a.roomTypeId === room.roomTypeId);
    if (matching.length === 0) continue;
    const item = matching[Math.floor(r() * matching.length)]!;
    const hk = hkUsers[Math.floor(r() * hkUsers.length)]!;
    const id = `${theme.key}-consumption-${String(i + 1).padStart(3, '0')}`;
    const createdAt = new Date(NOW.getTime() - Math.floor(r() * 14 * DAY_MS));
    await prisma.consumptionLog.upsert({
      where: { id },
      update: { createdAt },
      create: {
        id,
        propertyId,
        roomId: room.id,
        catalogItemId: item.id,
        qtyAddedToReachPar: 1 + Math.floor(r() * 4),
        qtyUsed: 1 + Math.floor(r() * 4),
        createdBy: hk.id,
        createdAt,
      },
    });
  }

  // 3–5 LaundryLog rows. Allowed states per DB check constraint
  // (migrations/20260514010000_epic11_consumption_laundry): ITEMS_OUT |
  // ITEMS_IN | CLOSED. Rotate through the full lifecycle.
  const states = ['ITEMS_OUT', 'ITEMS_IN', 'CLOSED'];
  const laundryCount = 3 + Math.floor(r() * 3);
  for (let i = 0; i < laundryCount; i++) {
    const hk = hkUsers[Math.floor(r() * hkUsers.length)]!;
    const id = `${theme.key}-laundry-${String(i + 1).padStart(3, '0')}`;
    const cycleDate = dateOnly(new Date(NOW.getTime() - Math.floor(r() * 14 * DAY_MS)));
    const state = states[i % states.length]!;
    await prisma.laundryLog.upsert({
      where: { id },
      update: { state, cycleDate },
      create: {
        id,
        propertyId,
        state,
        createdByRole: 'HOUSEKEEPING',
        createdByUserId: hk.id,
        cycleDate,
        linenCategory: 'ROUTINE',
      },
    });
  }

  // 1–2 IssueReport rows. Allowed enum values are pinned by DB check
  // constraints in migrations/20260514020000_epic11_issue_reports:
  //   entryContext       ∈ COLD | MISSING_FROM_ROOM | DAMAGED_ON_RETURN
  //   category           ∈ DAMAGE_IN_ROOM | MISSING_ITEM | DAMAGED_RETURN | OTHER
  //   attributionStream  ∈ ROOM_SHORTAGE | LAUNDRY_SHORTAGE | OTHER
  //   status             ∈ PENDING_REVIEW | APPROVED | REJECTED
  const issueRecipes: Array<{
    entryContext: string;
    category: string;
    attributionStream: string;
    useLinen: boolean;
  }> = [
    { entryContext: 'MISSING_FROM_ROOM', category: 'MISSING_ITEM', attributionStream: 'ROOM_SHORTAGE', useLinen: false },
    { entryContext: 'DAMAGED_ON_RETURN', category: 'DAMAGED_RETURN', attributionStream: 'LAUNDRY_SHORTAGE', useLinen: true },
    { entryContext: 'COLD', category: 'DAMAGE_IN_ROOM', attributionStream: 'ROOM_SHORTAGE', useLinen: false },
    { entryContext: 'COLD', category: 'OTHER', attributionStream: 'OTHER', useLinen: false },
  ];
  const issueCount = 1 + Math.floor(r() * 2);
  for (let i = 0; i < issueCount; i++) {
    const hk = hkUsers[Math.floor(r() * hkUsers.length)]!;
    const recipe = issueRecipes[Math.floor(r() * issueRecipes.length)]!;
    const room = rooms[Math.floor(r() * rooms.length)]!;
    const item =
      recipe.useLinen && linenItems.length > 0
        ? linenItems[Math.floor(r() * linenItems.length)]
        : amenityItems.length > 0
          ? amenityItems[Math.floor(r() * amenityItems.length)]
          : null;
    const id = `${theme.key}-issue-${String(i + 1).padStart(3, '0')}`;
    const status = issueCount > 1 && i === issueCount - 1 ? 'APPROVED' : 'PENDING_REVIEW';
    await prisma.issueReport.upsert({
      where: { id },
      update: { status },
      create: {
        id,
        propertyId,
        entryContext: recipe.entryContext,
        category: recipe.category,
        attributionStream: recipe.attributionStream,
        roomId: room.id,
        catalogItemId: item?.id ?? null,
        qty: 1,
        textNote: `Auto-seeded ${recipe.category.toLowerCase().replace(/_/g, ' ')}`,
        reportedBy: hk.id,
        status,
      },
    });
  }
}

export async function seedAnimeProperties(prisma: PrismaClient): Promise<void> {
  const themes = buildThemes();

  for (const theme of themes) {
    console.log(`[seed:anime] ${theme.property.name} (${theme.tier}, ${theme.housekeepers.length} HK)`);
    await seedTheme(prisma, theme);
  }

  // Post-pass: fill-up density, invoices, audit logs, housekeeping logs.
  for (const theme of themes) {
    await fillUpDensity(prisma, theme);
    await seedInvoices(prisma, theme);
    await seedAuditLogs(prisma, theme);
    await seedHousekeepingLogs(prisma, theme);
  }

  // Counts summary.
  for (const theme of themes) {
    const [rooms, reservations, folios, invoices, audits] = await Promise.all([
      prisma.room.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
      prisma.reservation.count({ where: { propertyId: theme.property.id } }),
      prisma.folio.count({ where: { propertyId: theme.property.id } }),
      prisma.invoice.count({ where: { propertyId: theme.property.id } }),
      prisma.auditLog.count({ where: { propertyId: theme.property.id } }),
    ]);
    console.log(
      `[seed:anime]   ${theme.property.slug}: rooms=${rooms} reservations=${reservations} folios=${folios} invoices=${invoices} audits=${audits}`,
    );
  }

  // Credentials markdown table — Owner / Manager / Housekeeping per user with
  // every property they have access to (multi-property owners collapse to a
  // single row).
  type Row = { name: string; phone: string; role: string; properties: Set<string> };
  const byUserId = new Map<string, Row>();
  for (const theme of themes) {
    const propName = theme.property.name;
    const add = (user: CharacterDef, role: 'OWNER' | 'MANAGER' | 'HOUSEKEEPING') => {
      const existing = byUserId.get(user.id);
      if (existing) {
        existing.properties.add(propName);
        // Owner wins over Manager wins over Housekeeping in display priority.
        const priority: Record<string, number> = { OWNER: 3, MANAGER: 2, HOUSEKEEPING: 1 };
        if (priority[role]! > priority[existing.role]!) existing.role = role;
        return;
      }
      byUserId.set(user.id, {
        name: user.name,
        phone: user.phone,
        role,
        properties: new Set([propName]),
      });
    };
    add(theme.owner, 'OWNER');
    add(theme.manager, 'MANAGER');
    for (const hk of theme.housekeepers) add(hk, 'HOUSEKEEPING');
  }

  const rolePriority: Record<string, number> = { OWNER: 0, MANAGER: 1, HOUSEKEEPING: 2 };
  const rows = Array.from(byUserId.values()).sort((a, b) => {
    const r = rolePriority[a.role]! - rolePriority[b.role]!;
    if (r !== 0) return r;
    return a.name.localeCompare(b.name);
  });

  const lines = [
    '',
    '[seed:anime] Demo credentials (OTP login — no PINs seeded):',
    '',
    '| User | Phone | Role | Properties |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (r) => `| ${r.name} | ${r.phone} | ${r.role} | ${Array.from(r.properties).join(', ')} |`,
    ),
    '',
  ];
  console.log(lines.join('\n'));
}
