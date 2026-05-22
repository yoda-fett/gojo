// Themed demo seed — fourteen film/anime-flavoured properties across five
// franchises. Idempotent: re-running upserts records by stable string IDs
// (no drops).
//
// Layout (14 properties · 5 franchises · 3 tiers · 3 cities):
//   One Piece    — Thousand Sunny Resort   · GROWTH  · Darjeeling · co-owned
//                — Going Merry Lodge        · STARTER · Gangtok
//                — Baratie Floating Stay    · TRIAL   · Kalimpong  · coldStart {}
//   Demon Slayer — Butterfly Mansion Inn    · STARTER · Gangtok
//                — Wisteria Estate          · GROWTH  · Darjeeling · co-owned
//                — Mugen Train Inn          · TRIAL   · Kalimpong  · coldStart {}
//   Naruto       — Konoha Leaf Lodge        · TRIAL   · Kalimpong  · coldStart {}
//                — Sand Village Inn         · STARTER · Darjeeling
//                — Hokage Tower Hotel       · GROWTH  · Gangtok    · co-owned
//   John Wick    — The Continental Darjeeling · GROWTH  · Darjeeling · co-owned
//                — The Continental Gangtok    · STARTER · Gangtok    · coldStart {}
//                — The Continental Kalimpong  · TRIAL   · Kalimpong  · co-owned · coldStart {}
//   The Matrix   — Zion Sanctuary             · GROWTH  · Gangtok    · co-owned
//                — Nebuchadnezzar Lodge       · TRIAL   · Kalimpong  · coldStart {}
//
// Rules honoured:
//   · 6 multi-property owners — Luffy / Tanjiro / Naruto each own 3 anime
//     properties; Winston owns 3 Continentals, Marquis owns 2, Morpheus owns 2.
//   · 6 co-owned properties — Thousand Sunny (+Shanks), Wisteria (+Rengoku),
//     Hokage Tower (+Kakashi), Continental Darjeeling (+Marquis), Continental
//     Kalimpong (+Winston), Zion Sanctuary (+Niobe) — two OWNER rows each.
//   · 1 MANAGER per property; Nico Robin manages two of Luffy's properties
//     (Thousand Sunny + Going Merry); Charon manages two of Winston's
//     Continentals (Darjeeling + Gangtok).
//   · Every property: ~1 year of reservations + a fill-up pass guaranteeing
//     ≥4 arrivals AND ≥4 departures per ISO week across May + June 2026
//     (current + coming month), GST invoices, audit logs, housekeeping tasks.
//   · No PINs seeded — OTP login only.
//   · 3 properties carry `coldStartProgress = {}`; all property data is still
//     fully populated. `coldStartCompletedAt` on every property predates the
//     first guest entry.

import type { Prisma, PrismaClient } from '../src/generated/client/index.js';

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
// "Now" for the seed — aligned with the demo's current calendar month.
//const NOW = new Date('2026-05-21T00:00:00.000Z');
const NOW = new Date();
NOW.setHours(0, 0, 0, 0); // sets time to midnight
// Reservation window: 1 year back, 2 months forward (covers May + June 2026).
const PAST_DAYS = 365;
const FUTURE_DAYS = 60;
// Future bookings — keep some weeks empty at random by skipping placements.
const FUTURE_SKIP_PROBABILITY = 0.4;
// Onboarding completed well before the first guest entry (rule 18).
const COLD_START_COMPLETED_AT = new Date(NOW.getTime() - 400 * DAY_MS);
// Guests consented after onboarding but before the booking window opens.
const GUEST_CONSENT_AT = new Date(NOW.getTime() - 370 * DAY_MS);

type CharacterDef = { id: string; name: string; phone: string };

// ─── Cast ──────────────────────────────────────────────────────────────────
// Three multi-property owners — one per franchise.
const LUFFY: CharacterDef = { id: 'anime-user-luffy', name: 'Monkey D. Luffy', phone: '+919000010001' };
const TANJIRO: CharacterDef = { id: 'anime-user-tanjiro', name: 'Tanjiro Kamado', phone: '+919000010002' };
const NARUTO: CharacterDef = { id: 'anime-user-naruto', name: 'Naruto Uzumaki', phone: '+919000010003' };

// Co-owners — each shares ownership of exactly one property.
const SHANKS: CharacterDef = { id: 'anime-user-shanks', name: 'Shanks', phone: '+919000020001' };
const RENGOKU: CharacterDef = { id: 'anime-user-rengoku', name: 'Kyojuro Rengoku', phone: '+919000020002' };
const KAKASHI: CharacterDef = { id: 'anime-user-kakashi', name: 'Kakashi Hatake', phone: '+919000020003' };

// Managers — one per property. Robin covers two of Luffy's properties.
const ROBIN: CharacterDef = { id: 'anime-user-robin', name: 'Nico Robin', phone: '+919000030001' };
const SANJI: CharacterDef = { id: 'anime-user-sanji', name: 'Vinsmoke Sanji', phone: '+919000030002' };
const SHINOBU: CharacterDef = { id: 'anime-user-shinobu', name: 'Shinobu Kocho', phone: '+919000030003' };
const GIYU: CharacterDef = { id: 'anime-user-giyu', name: 'Giyu Tomioka', phone: '+919000030004' };
const TENGEN: CharacterDef = { id: 'anime-user-tengen', name: 'Tengen Uzui', phone: '+919000030005' };
const SAKURA: CharacterDef = { id: 'anime-user-sakura', name: 'Sakura Haruno', phone: '+919000030006' };
const GAARA: CharacterDef = { id: 'anime-user-gaara', name: 'Gaara', phone: '+919000030007' };
const SHIKAMARU: CharacterDef = { id: 'anime-user-shikamaru', name: 'Shikamaru Nara', phone: '+919000030008' };

// John Wick / The Matrix cast — three more multi-property owners.
//   Winston   — owns the Continental Darjeeling + Gangtok, co-owns Kalimpong.
//   Marquis   — owns the Continental Kalimpong, co-owns Darjeeling.
//   Morpheus  — owns Zion Sanctuary + Nebuchadnezzar Lodge.
const WINSTON: CharacterDef = { id: 'anime-user-winston', name: 'Winston Scott', phone: '+919000010004' };
const MARQUIS: CharacterDef = { id: 'anime-user-marquis', name: 'Marquis de Gramont', phone: '+919000010005' };
const MORPHEUS: CharacterDef = { id: 'anime-user-morpheus', name: 'Morpheus', phone: '+919000010006' };
// Co-owner — shares ownership of Zion Sanctuary.
const NIOBE: CharacterDef = { id: 'anime-user-niobe', name: 'Captain Niobe', phone: '+919000020004' };
// Managers — Charon covers two of Winston's Continentals (rule 7).
const CHARON: CharacterDef = { id: 'anime-user-charon', name: 'Charon', phone: '+919000030009' };
const CASSIAN: CharacterDef = { id: 'anime-user-cassian', name: 'Cassian', phone: '+919000030010' };
const TANK: CharacterDef = { id: 'anime-user-tank', name: 'Tank', phone: '+919000030011' };
const LINK: CharacterDef = { id: 'anime-user-link', name: 'Link', phone: '+919000030012' };

type RoomTypeKey = 'std' | 'dlx' | 'suite';

interface ThemeDef {
  key: string;
  index: number; // 1-based property index — used for phone derivation
  franchise: 'One Piece' | 'Demon Slayer' | 'Naruto' | 'John Wick' | 'The Matrix';
  refPrefix: string; // booking-ref / invoice-number prefix
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
  coOwners: CharacterDef[];
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
  rooms: { id: string; number: string; floor: number; roomTypeKey: RoomTypeKey }[];
  // Source mix as weights summing to 1.
  sourceMix: { DIRECT_BOOKING: number; OTA: number; WALK_IN: number };
  // Rule 17 — these properties carry `coldStartProgress = {}`.
  coldStartProgressEmpty: boolean;
}

// Guest phone: +91 9700 PP GG 00  (PP = property index, GG = guest index).
function guestPhone(propIdx: number, gIdx: number): string {
  return `+919700${String(propIdx).padStart(2, '0')}${String(gIdx).padStart(2, '0')}00`;
}

// Housekeeper phone: +91 900004 PP NN.
function hkPhone(propIdx: number, hkIdx: number): string {
  return `+91900004${String(propIdx).padStart(2, '0')}${String(hkIdx).padStart(2, '0')}`;
}

function mkGuests(prefix: string, propIdx: number, names: string[]) {
  return names.map((name, i) => ({
    code: `${prefix}-G${String(i + 1).padStart(2, '0')}`,
    name,
    phone: guestPhone(propIdx, i + 1),
  }));
}

function mkRooms(key: string, std: number, dlx: number, suite: number) {
  const rooms: ThemeDef['rooms'] = [];
  const push = (floor: number, count: number, roomTypeKey: RoomTypeKey) => {
    for (let i = 1; i <= count; i++) {
      const number = `${floor}${String(i).padStart(2, '0')}`;
      rooms.push({ id: `anime-room-${key}-${number}`, number, floor, roomTypeKey });
    }
  };
  push(1, std, 'std');
  push(2, dlx, 'dlx');
  if (suite > 0) push(3, suite, 'suite');
  return rooms;
}

// 24-name guest pools — sliced 8/property across each franchise's 3 properties.
const OP_GUESTS = [
  'Roronoa Zoro', 'Nefertari Vivi', 'Portgas D. Ace', 'Trafalgar Law', 'Boa Hancock', 'Dracule Mihawk', 'Jinbei', 'Brook',
  'Bartolomeo', 'Cavendish', 'Koby', 'Smoker', 'Tashigi', 'Marco', 'Charlotte Katakuri', 'Eustass Kid',
  'Killer', 'Capone Bege', 'Jewelry Bonney', 'Basil Hawkins', 'X Drake', 'Vinsmoke Reiju', 'Rob Lucci', 'Kuzan Aokiji',
];
const DS_GUESTS = [
  'Nezuko Kamado', 'Kanao Tsuyuri', 'Genya Shinazugawa', 'Mitsuri Kanroji', 'Muichiro Tokito', 'Sanemi Shinazugawa', 'Obanai Iguro', 'Gyomei Himejima',
  'Tamayo Healer', 'Yushiro', 'Kagaya Ubuyashiki', 'Kanae Kocho', 'Sakonji Urokodaki', 'Sabito', 'Makomo', 'Hotaru Haganezuka',
  'Kaigaku', 'Suma', 'Makio', 'Hinatsuru', 'Murata', 'Amane Ubuyashiki', 'Kanata Ubuyashiki', 'Toko Agatsuma',
];
const NA_GUESTS = [
  'Sasuke Uchiha', 'Hinata Hyuga', 'Neji Hyuga', 'Tenten', 'Kiba Inuzuka', 'Shino Aburame', 'Jiraiya', 'Tsunade',
  'Itachi Uchiha', 'Minato Namikaze', 'Kushina Uzumaki', 'Asuma Sarutobi', 'Kurenai Yuhi', 'Might Guy', 'Iruka Umino', 'Hashirama Senju',
  'Tobirama Senju', 'Hiruzen Sarutobi', 'Obito Uchiha', 'Rin Nohara', 'Killer Bee', 'Yamato Tenzo', 'Sai Yamanaka', 'Anko Mitarashi',
];
const JW_GUESTS = [
  'Aurelio', 'Berrada', "Santino D'Antonio", "Gianna D'Antonio", 'Ares', 'Ms. Perkins', 'Helen Wick', 'Iosef Tarasov',
  'Viggo Tarasov', 'Abram Tarasov', 'Sofia Al-Azwar', 'Killa Harkan', 'Caine', 'Akira Shimazu', 'The Harbinger', 'The Adjudicator',
  'Zero', 'Earl', 'The Elder', 'Julius', 'The Director', 'Mr. Nobody', 'Tick Tock Man', 'Charlie Cleaner',
];
const MX_GUESTS = [
  'Neo', 'Trinity', 'Dozer', 'Switch', 'Apoc', 'Mouse', 'Cypher', 'Agent Smith',
  'The Oracle', 'The Architect', 'Seraph', 'Sati', 'The Merovingian', 'Persephone', 'The Keymaker', 'Commander Lock',
];

function buildThemes(): ThemeDef[] {
  return [
    // ── One Piece ──────────────────────────────────────────────────────────
    {
      key: 'op-sunny',
      index: 1,
      franchise: 'One Piece',
      refPrefix: 'TSR',
      property: {
        id: 'anime-prop-op-sunny',
        slug: 'thousand-sunny-resort',
        name: 'Thousand Sunny Resort',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734101',
        address: '1 Grand Line Avenue, Chowrasta',
      },
      tier: 'GROWTH',
      owner: LUFFY,
      coOwners: [SHANKS],
      manager: ROBIN,
      housekeepers: [
        { id: 'anime-user-nami', name: 'Nami', phone: hkPhone(1, 1) },
        { id: 'anime-user-usopp', name: 'Usopp', phone: hkPhone(1, 2) },
        { id: 'anime-user-chopper', name: 'Tony Tony Chopper', phone: hkPhone(1, 3) },
      ],
      guests: mkGuests('TSR', 1, OP_GUESTS.slice(0, 8)),
      reservationCount: 70,
      roomTypes: [
        { id: 'anime-rt-op-sunny-std', name: 'Crew Cabin', maxOccupancy: 2, baseRate: '5200.00', floorRate: '4500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-op-sunny-dlx', name: 'Captain Suite', maxOccupancy: 3, baseRate: '9800.00', floorRate: '8600.00', gstSlab: '18%', amenities: ['WiFi', 'Valley View'] },
        { id: 'anime-rt-op-sunny-suite', name: 'Mast Penthouse', maxOccupancy: 4, baseRate: '15500.00', floorRate: '13800.00', gstSlab: '18%', amenities: ['WiFi', 'Valley View', 'Lounge'] },
      ],
      rooms: mkRooms('op-sunny', 4, 3, 2),
      sourceMix: { DIRECT_BOOKING: 0.35, OTA: 0.5, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'op-merry',
      index: 2,
      franchise: 'One Piece',
      refPrefix: 'GML',
      property: {
        id: 'anime-prop-op-merry',
        slug: 'going-merry-lodge',
        name: 'Going Merry Lodge',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '12 MG Marg, Gangtok',
      },
      tier: 'STARTER',
      owner: LUFFY,
      coOwners: [],
      manager: ROBIN, // Rule 7 — Robin also manages Thousand Sunny (same owner).
      housekeepers: [
        { id: 'anime-user-carrot', name: 'Carrot Mink', phone: hkPhone(2, 1) },
        { id: 'anime-user-pedro', name: 'Pedro Jaguar', phone: hkPhone(2, 2) },
      ],
      guests: mkGuests('GML', 2, OP_GUESTS.slice(8, 16)),
      reservationCount: 45,
      roomTypes: [
        { id: 'anime-rt-op-merry-std', name: 'Galley Room', maxOccupancy: 2, baseRate: '3600.00', floorRate: '3100.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-op-merry-dlx', name: 'Helmsman Deluxe', maxOccupancy: 3, baseRate: '6400.00', floorRate: '5600.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View'] },
      ],
      rooms: mkRooms('op-merry', 4, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0.3, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'op-baratie',
      index: 3,
      franchise: 'One Piece',
      refPrefix: 'BFS',
      property: {
        id: 'anime-prop-op-baratie',
        slug: 'baratie-floating-stay',
        name: 'Baratie Floating Stay',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734311',
        address: '9 Rishi Road, Kalimpong',
      },
      tier: 'TRIAL',
      owner: LUFFY,
      coOwners: [],
      manager: SANJI,
      housekeepers: [
        { id: 'anime-user-patty', name: 'Patty Pastry', phone: hkPhone(3, 1) },
        { id: 'anime-user-carne', name: 'Carne Cleaver', phone: hkPhone(3, 2) },
      ],
      guests: mkGuests('BFS', 3, OP_GUESTS.slice(16, 24)),
      reservationCount: 28,
      roomTypes: [
        { id: 'anime-rt-op-baratie-std', name: 'Galley Cabin', maxOccupancy: 2, baseRate: '2900.00', floorRate: '2500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-op-baratie-dlx', name: 'Sous Chef Room', maxOccupancy: 3, baseRate: '5200.00', floorRate: '4600.00', gstSlab: '18%', amenities: ['WiFi', 'River View'] },
      ],
      rooms: mkRooms('op-baratie', 3, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.6, OTA: 0, WALK_IN: 0.4 },
      coldStartProgressEmpty: true,
    },
    // ── Demon Slayer ───────────────────────────────────────────────────────
    {
      key: 'ds-butterfly',
      index: 4,
      franchise: 'Demon Slayer',
      refPrefix: 'BMI',
      property: {
        id: 'anime-prop-ds-butterfly',
        slug: 'butterfly-mansion-inn',
        name: 'Butterfly Mansion Inn',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '7 Wisteria Lane, MG Marg',
      },
      tier: 'STARTER',
      owner: TANJIRO,
      coOwners: [],
      manager: SHINOBU,
      housekeepers: [
        { id: 'anime-user-zenitsu', name: 'Zenitsu Agatsuma', phone: hkPhone(4, 1) },
        { id: 'anime-user-inosuke', name: 'Inosuke Hashibira', phone: hkPhone(4, 2) },
      ],
      guests: mkGuests('BMI', 4, DS_GUESTS.slice(0, 8)),
      reservationCount: 45,
      roomTypes: [
        { id: 'anime-rt-ds-butterfly-std', name: 'Standard Room', maxOccupancy: 2, baseRate: '3800.00', floorRate: '3200.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-ds-butterfly-dlx', name: 'Garden View', maxOccupancy: 3, baseRate: '6800.00', floorRate: '6000.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View'] },
      ],
      rooms: mkRooms('ds-butterfly', 4, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.6, OTA: 0.25, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'ds-wisteria',
      index: 5,
      franchise: 'Demon Slayer',
      refPrefix: 'WSE',
      property: {
        id: 'anime-prop-ds-wisteria',
        slug: 'wisteria-estate',
        name: 'Wisteria Estate',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734102',
        address: '22 Mall Road, Darjeeling',
      },
      tier: 'GROWTH',
      owner: TANJIRO,
      coOwners: [RENGOKU],
      manager: GIYU,
      housekeepers: [
        { id: 'anime-user-aoi', name: 'Aoi Kanzaki', phone: hkPhone(5, 1) },
        { id: 'anime-user-kiyo', name: 'Kiyo Terauchi', phone: hkPhone(5, 2) },
      ],
      guests: mkGuests('WSE', 5, DS_GUESTS.slice(8, 16)),
      reservationCount: 70,
      roomTypes: [
        { id: 'anime-rt-ds-wisteria-std', name: 'Pillar Room', maxOccupancy: 2, baseRate: '4800.00', floorRate: '4200.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-ds-wisteria-dlx', name: 'Garden Suite', maxOccupancy: 3, baseRate: '8400.00', floorRate: '7400.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View'] },
        { id: 'anime-rt-ds-wisteria-suite', name: 'Hashira Penthouse', maxOccupancy: 4, baseRate: '14500.00', floorRate: '12800.00', gstSlab: '18%', amenities: ['WiFi', 'Garden View', 'Lounge'] },
      ],
      rooms: mkRooms('ds-wisteria', 3, 3, 2),
      sourceMix: { DIRECT_BOOKING: 0.4, OTA: 0.45, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'ds-mugen',
      index: 6,
      franchise: 'Demon Slayer',
      refPrefix: 'MTI',
      property: {
        id: 'anime-prop-ds-mugen',
        slug: 'mugen-train-inn',
        name: 'Mugen Train Inn',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734309',
        address: '3 Deolo Hill Road, Kalimpong',
      },
      tier: 'TRIAL',
      owner: TANJIRO,
      coOwners: [],
      manager: TENGEN,
      housekeepers: [
        { id: 'anime-user-senjuro', name: 'Senjuro Rengoku', phone: hkPhone(6, 1) },
        { id: 'anime-user-goto', name: 'Goto Kakushi', phone: hkPhone(6, 2) },
      ],
      guests: mkGuests('MTI', 6, DS_GUESTS.slice(16, 24)),
      reservationCount: 28,
      roomTypes: [
        { id: 'anime-rt-ds-mugen-std', name: 'Sleeper Cabin', maxOccupancy: 2, baseRate: '3100.00', floorRate: '2700.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-ds-mugen-dlx', name: 'First Class Berth', maxOccupancy: 3, baseRate: '5600.00', floorRate: '4900.00', gstSlab: '18%', amenities: ['WiFi', 'Forest View'] },
      ],
      rooms: mkRooms('ds-mugen', 3, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.65, OTA: 0, WALK_IN: 0.35 },
      coldStartProgressEmpty: true,
    },
    // ── Naruto ─────────────────────────────────────────────────────────────
    {
      key: 'na-konoha',
      index: 7,
      franchise: 'Naruto',
      refPrefix: 'KLL',
      property: {
        id: 'anime-prop-na-konoha',
        slug: 'konoha-leaf-lodge',
        name: 'Konoha Leaf Lodge',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734301',
        address: '4 Hokage Rock Trail, Deolo Hill',
      },
      tier: 'TRIAL',
      owner: NARUTO,
      coOwners: [],
      manager: SAKURA,
      housekeepers: [
        { id: 'anime-user-rocklee', name: 'Rock Lee', phone: hkPhone(7, 1) },
        { id: 'anime-user-konohamaru', name: 'Konohamaru Sarutobi', phone: hkPhone(7, 2) },
      ],
      guests: mkGuests('KLL', 7, NA_GUESTS.slice(0, 8)),
      reservationCount: 28,
      roomTypes: [
        { id: 'anime-rt-na-konoha-std', name: 'Genin Room', maxOccupancy: 2, baseRate: '2800.00', floorRate: '2400.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-na-konoha-dlx', name: 'Chunin Suite', maxOccupancy: 3, baseRate: '4800.00', floorRate: '4200.00', gstSlab: '18%', amenities: ['WiFi', 'Forest View'] },
      ],
      rooms: mkRooms('na-konoha', 3, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0, WALK_IN: 0.45 },
      coldStartProgressEmpty: true,
    },
    {
      key: 'na-sand',
      index: 8,
      franchise: 'Naruto',
      refPrefix: 'SVI',
      property: {
        id: 'anime-prop-na-sand',
        slug: 'sand-village-inn',
        name: 'Sand Village Inn',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734102',
        address: '5 Mall Road, Darjeeling',
      },
      tier: 'STARTER',
      owner: NARUTO,
      coOwners: [],
      manager: GAARA,
      housekeepers: [
        { id: 'anime-user-temari', name: 'Temari Whirlwind', phone: hkPhone(8, 1) },
        { id: 'anime-user-kankuro', name: 'Kankuro Puppet', phone: hkPhone(8, 2) },
      ],
      guests: mkGuests('SVI', 8, NA_GUESTS.slice(8, 16)),
      reservationCount: 45,
      roomTypes: [
        { id: 'anime-rt-na-sand-std', name: 'Genin Room', maxOccupancy: 2, baseRate: '3200.00', floorRate: '2800.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-na-sand-dlx', name: 'Jonin Deluxe', maxOccupancy: 3, baseRate: '5800.00', floorRate: '5100.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View'] },
      ],
      rooms: mkRooms('na-sand', 4, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0.3, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'na-hokage',
      index: 9,
      franchise: 'Naruto',
      refPrefix: 'HTH',
      property: {
        id: 'anime-prop-na-hokage',
        slug: 'hokage-tower-hotel',
        name: 'Hokage Tower Hotel',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '1 Hokage Square, MG Marg',
      },
      tier: 'GROWTH',
      owner: NARUTO,
      coOwners: [KAKASHI],
      manager: SHIKAMARU,
      housekeepers: [
        { id: 'anime-user-choji', name: 'Choji Akimichi', phone: hkPhone(9, 1) },
        { id: 'anime-user-ino', name: 'Ino Yamanaka', phone: hkPhone(9, 2) },
      ],
      guests: mkGuests('HTH', 9, NA_GUESTS.slice(16, 24)),
      reservationCount: 70,
      roomTypes: [
        { id: 'anime-rt-na-hokage-std', name: 'Academy Room', maxOccupancy: 2, baseRate: '5000.00', floorRate: '4400.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-na-hokage-dlx', name: 'Jonin Suite', maxOccupancy: 3, baseRate: '9000.00', floorRate: '8000.00', gstSlab: '18%', amenities: ['WiFi', 'City View'] },
        { id: 'anime-rt-na-hokage-suite', name: 'Hokage Penthouse', maxOccupancy: 4, baseRate: '16000.00', floorRate: '14200.00', gstSlab: '18%', amenities: ['WiFi', 'City View', 'Lounge'] },
      ],
      rooms: mkRooms('na-hokage', 4, 3, 2),
      sourceMix: { DIRECT_BOOKING: 0.4, OTA: 0.45, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    // ── John Wick ──────────────────────────────────────────────────────────
    {
      key: 'jw-cont-dar',
      index: 10,
      franchise: 'John Wick',
      refPrefix: 'TCD',
      property: {
        id: 'anime-prop-jw-cont-dar',
        slug: 'continental-darjeeling',
        name: 'The Continental Darjeeling',
        city: 'Darjeeling',
        state: 'West Bengal',
        pincode: '734103',
        address: '1 High Table Row, Chowrasta',
      },
      tier: 'GROWTH',
      owner: WINSTON,
      coOwners: [MARQUIS], // Rule 8 — co-owned.
      manager: CHARON,
      housekeepers: [
        { id: 'anime-user-francis', name: 'Francis Doorman', phone: hkPhone(10, 1) },
        { id: 'anime-user-continental-tailor', name: 'The Continental Tailor', phone: hkPhone(10, 2) },
      ],
      guests: mkGuests('TCD', 10, JW_GUESTS.slice(0, 8)),
      reservationCount: 70,
      roomTypes: [
        { id: 'anime-rt-jw-cont-dar-std', name: 'Continental King', maxOccupancy: 2, baseRate: '5400.00', floorRate: '4700.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-jw-cont-dar-dlx', name: 'High Table Suite', maxOccupancy: 3, baseRate: '9900.00', floorRate: '8700.00', gstSlab: '18%', amenities: ['WiFi', 'Valley View'] },
        { id: 'anime-rt-jw-cont-dar-suite', name: "Manager's Penthouse", maxOccupancy: 4, baseRate: '16000.00', floorRate: '14200.00', gstSlab: '18%', amenities: ['WiFi', 'Valley View', 'Lounge'] },
      ],
      rooms: mkRooms('jw-cont-dar', 4, 3, 2),
      sourceMix: { DIRECT_BOOKING: 0.4, OTA: 0.45, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'jw-cont-gng',
      index: 11,
      franchise: 'John Wick',
      refPrefix: 'TCG',
      property: {
        id: 'anime-prop-jw-cont-gng',
        slug: 'continental-gangtok',
        name: 'The Continental Gangtok',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '8 Gold Coin Lane, MG Marg',
      },
      tier: 'STARTER',
      owner: WINSTON,
      coOwners: [],
      manager: CHARON, // Rule 7 — Charon also manages Continental Darjeeling (same owner).
      housekeepers: [
        { id: 'anime-user-continental-doctor', name: 'The Continental Doctor', phone: hkPhone(11, 1) },
        { id: 'anime-user-continental-sommelier', name: 'The Continental Sommelier', phone: hkPhone(11, 2) },
      ],
      guests: mkGuests('TCG', 11, JW_GUESTS.slice(8, 16)),
      reservationCount: 45,
      roomTypes: [
        { id: 'anime-rt-jw-cont-gng-std', name: 'Continental Room', maxOccupancy: 2, baseRate: '3700.00', floorRate: '3200.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-jw-cont-gng-dlx', name: 'Gold Coin Deluxe', maxOccupancy: 3, baseRate: '6600.00', floorRate: '5800.00', gstSlab: '18%', amenities: ['WiFi', 'Mountain View'] },
      ],
      rooms: mkRooms('jw-cont-gng', 4, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.55, OTA: 0.3, WALK_IN: 0.15 },
      coldStartProgressEmpty: true,
    },
    {
      key: 'jw-cont-kal',
      index: 12,
      franchise: 'John Wick',
      refPrefix: 'TCK',
      property: {
        id: 'anime-prop-jw-cont-kal',
        slug: 'continental-kalimpong',
        name: 'The Continental Kalimpong',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734305',
        address: '6 Blood Oath Road, Kalimpong',
      },
      tier: 'TRIAL',
      owner: MARQUIS,
      coOwners: [WINSTON], // Rule 8 — co-owned; Winston co-owns all three Continentals.
      manager: CASSIAN,
      housekeepers: [
        { id: 'anime-user-continental-bellhop', name: 'Continental Bellhop', phone: hkPhone(12, 1) },
        { id: 'anime-user-continental-valet', name: 'Continental Valet', phone: hkPhone(12, 2) },
      ],
      guests: mkGuests('TCK', 12, JW_GUESTS.slice(16, 24)),
      reservationCount: 28,
      roomTypes: [
        { id: 'anime-rt-jw-cont-kal-std', name: 'Marker Room', maxOccupancy: 2, baseRate: '3000.00', floorRate: '2600.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-jw-cont-kal-dlx', name: 'Blood Oath Suite', maxOccupancy: 3, baseRate: '5400.00', floorRate: '4800.00', gstSlab: '18%', amenities: ['WiFi', 'River View'] },
      ],
      rooms: mkRooms('jw-cont-kal', 3, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.6, OTA: 0, WALK_IN: 0.4 },
      coldStartProgressEmpty: true,
    },
    // ── The Matrix ─────────────────────────────────────────────────────────
    {
      key: 'mx-zion',
      index: 13,
      franchise: 'The Matrix',
      refPrefix: 'ZNS',
      property: {
        id: 'anime-prop-mx-zion',
        slug: 'zion-sanctuary',
        name: 'Zion Sanctuary',
        city: 'Gangtok',
        state: 'Sikkim',
        pincode: '737101',
        address: '101 Temple Deck, MG Marg',
      },
      tier: 'GROWTH',
      owner: MORPHEUS,
      coOwners: [NIOBE], // Rule 8 — co-owned.
      manager: TANK,
      housekeepers: [
        { id: 'anime-user-zee', name: 'Zee', phone: hkPhone(13, 1) },
        { id: 'anime-user-charra', name: 'Charra', phone: hkPhone(13, 2) },
      ],
      guests: mkGuests('ZNS', 13, MX_GUESTS.slice(0, 8)),
      reservationCount: 70,
      roomTypes: [
        { id: 'anime-rt-mx-zion-std', name: 'Operator Room', maxOccupancy: 2, baseRate: '5100.00', floorRate: '4500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-mx-zion-dlx', name: 'Zion Deck Suite', maxOccupancy: 3, baseRate: '9200.00', floorRate: '8100.00', gstSlab: '18%', amenities: ['WiFi', 'City View'] },
        { id: 'anime-rt-mx-zion-suite', name: 'Temple Penthouse', maxOccupancy: 4, baseRate: '15500.00', floorRate: '13700.00', gstSlab: '18%', amenities: ['WiFi', 'City View', 'Lounge'] },
      ],
      rooms: mkRooms('mx-zion', 4, 3, 2),
      sourceMix: { DIRECT_BOOKING: 0.4, OTA: 0.45, WALK_IN: 0.15 },
      coldStartProgressEmpty: false,
    },
    {
      key: 'mx-neb',
      index: 14,
      franchise: 'The Matrix',
      refPrefix: 'NEB',
      property: {
        id: 'anime-prop-mx-neb',
        slug: 'nebuchadnezzar-lodge',
        name: 'Nebuchadnezzar Lodge',
        city: 'Kalimpong',
        state: 'West Bengal',
        pincode: '734306',
        address: '2 Broadcast Depth, Deolo Hill',
      },
      tier: 'TRIAL',
      owner: MORPHEUS,
      coOwners: [],
      manager: LINK,
      housekeepers: [
        { id: 'anime-user-ghost', name: 'Ghost', phone: hkPhone(14, 1) },
        { id: 'anime-user-sparks', name: 'Sparks', phone: hkPhone(14, 2) },
      ],
      guests: mkGuests('NEB', 14, MX_GUESTS.slice(8, 16)),
      reservationCount: 28,
      roomTypes: [
        { id: 'anime-rt-mx-neb-std', name: 'Crew Berth', maxOccupancy: 2, baseRate: '2900.00', floorRate: '2500.00', gstSlab: '12%', amenities: ['WiFi'] },
        { id: 'anime-rt-mx-neb-dlx', name: 'Construct Cabin', maxOccupancy: 3, baseRate: '5200.00', floorRate: '4600.00', gstSlab: '18%', amenities: ['WiFi', 'Forest View'] },
      ],
      rooms: mkRooms('mx-neb', 3, 2, 0),
      sourceMix: { DIRECT_BOOKING: 0.65, OTA: 0, WALK_IN: 0.35 },
      coldStartProgressEmpty: true,
    },
  ];
}

// ─── Property field helpers ────────────────────────────────────────────────

function gstinForState(state: string, seed: number): string {
  // Real GSTIN format: SS + 10-char PAN + 1 entity + Z + 1 checksum.
  const stateCode = state === 'Sikkim' ? '11' : '19'; // West Bengal = 19
  const filler = ['ABCDE1234F', 'PQRST5678G', 'XYZAB9012H', 'LMNOP3456J'][seed % 4]!;
  return `${stateCode}${filler}1Z5`;
}

function stateCodeFor(state: string): string {
  return state === 'Sikkim' ? '11' : '19';
}

function panFor(idx: number): string {
  // 5 letters + 4 digits + 1 letter.
  return `AAACT${String(1000 + idx)}F`;
}

function laundryVendorFor(city: string): string {
  if (city === 'Darjeeling') return 'Himalayan Fresh Laundry';
  if (city === 'Gangtok') return 'MG Marg Linen Co';
  return 'Deolo Hill Washhouse';
}

function costConfigFor(theme: ThemeDef): object {
  const archetype =
    theme.tier === 'TRIAL'
      ? 'BUDGET_GUESTHOUSE'
      : theme.tier === 'STARTER'
        ? 'MID_MARKET_HOTEL'
        : 'BOUTIQUE_PROPERTY';
  const scale = theme.tier === 'TRIAL' ? 1 : theme.tier === 'STARTER' ? 1.6 : 2.6;
  return {
    version: '1',
    archetype,
    fixedCosts: {
      rentOrMortgage: Math.round(80000 * scale),
      staffSalaries: Math.round(120000 * scale),
      insurance: Math.round(8000 * scale),
      utilitiesBase: Math.round(15000 * scale),
      other: Math.round(10000 * scale),
    },
    variableCosts: {
      housekeepingSupplies: Math.round(180 * scale),
      laundry: Math.round(120 * scale),
      amenities: Math.round(90 * scale),
      utilitiesVariable: Math.round(70 * scale),
      other: Math.round(40 * scale),
    },
    totalRooms: theme.rooms.length,
    updatedAt: COLD_START_COMPLETED_AT.toISOString(),
  };
}

// ─── Housekeeping setup ────────────────────────────────────────────────────
// Each property gets enough catalog + room state to exercise every
// housekeeping use case 5 times: 5 DIRTY rooms with mixed task types, ≥5
// amenities + ≥5 linens, daily room assignments distributed across the
// property's housekeepers.

interface AmenityDef {
  id: string;
  roomTypeKey: RoomTypeKey;
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
  rtKeyToId: Record<RoomTypeKey, string>,
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

  // Take the first 5 rooms as the dirty cohort, flip the housekeeping axis.
  const dirtyRooms = theme.rooms.slice(0, 5);
  for (const room of dirtyRooms) {
    await prisma.room.update({
      where: { id: room.id },
      data: { housekeepingStatus: 'DIRTY' },
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

// ─── Reservation room allocation ───────────────────────────────────────────
// A live reservation physically occupies its room for the half-open interval
// [checkIn, checkOut) — same-day turnover (one guest out, the next in on the
// same date) is NOT a conflict. Rooms are picked at random, so without a guard
// the seed can place two live stays on one room. These helpers track booked
// intervals per room and pick a room free for a given window, keeping seeded
// occupancy physically realistic — there is no stored occupancy axis to
// reconcile after the fact (Epic 15).

type RoomBookings = Map<string, Array<{ in: number; out: number }>>;

function bookRoom(booked: RoomBookings, roomId: string, inMs: number, outMs: number): void {
  const ranges = booked.get(roomId);
  if (ranges) ranges.push({ in: inMs, out: outMs });
  else booked.set(roomId, [{ in: inMs, out: outMs }]);
}

function roomIsFree(booked: RoomBookings, roomId: string, inMs: number, outMs: number): boolean {
  const ranges = booked.get(roomId);
  if (!ranges) return true;
  // Half-open overlap: [inMs,outMs) vs [rg.in,rg.out).
  return !ranges.some((rg) => inMs < rg.out && rg.in < outMs);
}

/**
 * Pick a room with no live reservation overlapping [inMs, outMs). Samples the
 * seeded RNG so room distribution stays varied; if every sample is busy it
 * falls back to a deterministic scan for any free room. Only a genuine full
 * house (no free room for the window) lets an overlapping pick stand.
 */
function pickFreeRoom<T extends { id: string }>(
  r: () => number,
  rooms: T[],
  booked: RoomBookings,
  inMs: number,
  outMs: number,
  attempts = 24,
): T {
  let room = rooms[Math.floor(r() * rooms.length)]!;
  for (let a = 1; a < attempts; a++) {
    if (roomIsFree(booked, room.id, inMs, outMs)) return room;
    room = rooms[Math.floor(r() * rooms.length)]!;
  }
  if (roomIsFree(booked, room.id, inMs, outMs)) return room;
  return rooms.find((rm) => roomIsFree(booked, rm.id, inMs, outMs)) ?? room;
}

async function seedTheme(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;

  // Property — every profile field populated (rule 17: data fully filled even
  // for the `coldStartProgress = {}` properties).
  const propertyFields = {
    name: theme.property.name,
    address: theme.property.address,
    city: theme.property.city,
    state: theme.property.state,
    pincode: theme.property.pincode,
    gstin: gstinForState(theme.property.state, theme.property.name.length),
    pan: panFor(theme.index),
    stateCode: stateCodeFor(theme.property.state),
    contactPhone: `+91354${2200000 + theme.index}`,
    contactEmail: `hello@${theme.property.slug}.example.in`,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    numberOfFloors: theme.tier === 'GROWTH' ? 3 : 2,
    defaultCheckInTime: '14:00',
    defaultCheckOutTime: '11:00',
    directBookingEnabled: true,
    bookingSlug: theme.property.slug,
    averageOtaCommissionRate: theme.tier === 'GROWTH' ? 0.15 : 0.18,
    laundryVendorName: laundryVendorFor(theme.property.city),
    laundryVendorContact: `+91900005${String(theme.index).padStart(4, '0')}`,
    costConfig: costConfigFor(theme),
    // Rule 17 — 3 properties carry an empty progress object; the rest a
    // completed wizard state.
    coldStartProgress: theme.coldStartProgressEmpty ? {} : { lastCompletedStep: 7 },
    // Rule 18 — onboarding completed before the first guest entry.
    coldStartCompletedAt: COLD_START_COMPLETED_AT,
    coldStartLinenDeferred: false,
    active: true,
  };
  await prisma.property.upsert({
    where: { slug: theme.property.slug },
    update: propertyFields,
    create: {
      id: propertyId,
      slug: theme.property.slug,
      ...propertyFields,
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
    theme.tier === 'TRIAL' ? trialEndsAt : new Date(currentPeriodStart.getTime() + 30 * DAY_MS);

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

  // Users + access. owner + co-owners → OWNER; manager → MANAGER; the rest →
  // HOUSEKEEPING. User.phone is globally unique.
  const allUsers: Array<{ user: CharacterDef; role: 'OWNER' | 'MANAGER' | 'HOUSEKEEPING' }> = [
    { user: theme.owner, role: 'OWNER' },
    ...theme.coOwners.map((co) => ({ user: co, role: 'OWNER' as const })),
    { user: theme.manager, role: 'MANAGER' },
    ...theme.housekeepers.map((hk) => ({ user: hk, role: 'HOUSEKEEPING' as const })),
  ];
  for (const { user, role } of allUsers) {
    // No PIN initialised (rule 14) — every user goes through the PIN-creation
    // flow on first login.
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
  const rtKeyToId: Record<RoomTypeKey, string> = { std: '', dlx: '', suite: '' };
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
      update: { roomTypeId, floor: room.floor, housekeepingStatus: 'CLEAN' },
      create: {
        id: room.id,
        propertyId,
        roomTypeId,
        number: room.number,
        floor: room.floor,
        housekeepingStatus: 'CLEAN',
      },
    });
  }

  // Guests — consent recorded before the booking window opens.
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
        consentGivenAt: GUEST_CONSENT_AT,
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
  const futureWeeks = Math.ceil(FUTURE_DAYS / 7);
  const offWeeks = new Set<number>();
  for (let w = 0; w < futureWeeks; w++) {
    if (r() < FUTURE_SKIP_PROBABILITY) offWeeks.add(w);
  }

  // Per-room live-reservation intervals — keeps the loop below from
  // double-booking a room. See pickFreeRoom.
  const booked: RoomBookings = new Map();
  let folioCounter = 1;
  for (let i = 0; i < theme.reservationCount; i++) {
    let checkInTs: number;
    if (r() < futureShare) {
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

    let status: 'CHECKED_OUT' | 'CHECKED_IN' | 'CONFIRMED' | 'CANCELLED';
    if (checkOutDate.getTime() < NOW.getTime()) {
      status = r() < 0.06 ? 'CANCELLED' : 'CHECKED_OUT';
    } else if (checkInDate.getTime() <= NOW.getTime()) {
      status = 'CHECKED_IN';
    } else {
      status = r() < 0.08 ? 'CANCELLED' : 'CONFIRMED';
    }

    // Live stays must not overlap on a room. Cancelled bookings never occupied
    // the room, so they may fall anywhere and are not registered.
    const room =
      status === 'CANCELLED'
        ? rooms[Math.floor(r() * rooms.length)]!
        : pickFreeRoom(r, rooms, booked, checkInDate.getTime(), checkOutDate.getTime());
    if (status !== 'CANCELLED') {
      bookRoom(booked, room.id, checkInDate.getTime(), checkOutDate.getTime());
    }
    const roomTypeId = rtKeyToId[room.roomTypeKey];
    const guestId = guestIds[Math.floor(r() * guestIds.length)]!;
    const source = pickSource(r, theme.sourceMix);

    const baseRate = room.roomTypeKey === 'std' ? 4200 : room.roomTypeKey === 'dlx' ? 7400 : 13800;
    const rateJitter = 0.9 + r() * 0.25; // 0.9 – 1.15
    const nightlyRate = Math.round(baseRate * rateJitter);

    const reservationId = `${theme.key}-resv-${String(i + 1).padStart(3, '0')}`;
    const bookingRef = `${theme.refPrefix}-${checkInDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;

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
      const invoiceNumber = `${theme.refPrefix}-INV-${String(folioCounter).padStart(4, '0')}`;
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
  // room state.
  await seedHousekeeping(prisma, theme, rtKeyToId);
}

// ─── Density fill-up pass ──────────────────────────────────────────────────
// Guarantees ≥4 arrivals and ≥4 departures per ISO week (Mon–Sun) per property
// for May 2026 and June 2026 — the current and coming calendar months.

function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sun
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() + offsetToMonday);
  return m;
}

function weekKey(d: Date): string {
  return mondayOf(d).toISOString().slice(0, 10);
}

function targetWeekStarts(): Date[] {
  const out: Date[] = [];
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

  const dbRoomTypes = await prisma.roomType.findMany({
    where: { propertyId, deletedAt: null },
  });
  const rtKeyToId: Record<RoomTypeKey, string> = { std: '', dlx: '', suite: '' };
  for (const [idx, rt] of theme.roomTypes.entries()) {
    const match = dbRoomTypes.find((d) => d.name === rt.name);
    const key = (['std', 'dlx', 'suite'] as const)[idx];
    if (key && match) rtKeyToId[key] = match.id;
  }

  const existing = await prisma.reservation.findMany({
    where: { propertyId, status: { in: ['CHECKED_IN', 'CHECKED_OUT', 'CONFIRMED'] } },
    select: { id: true, roomId: true, checkIn: true, checkOut: true },
  });
  // Seed the per-room interval map with everything seedTheme already created,
  // so the fill-up reservations below stack onto rooms without double-booking.
  const booked: RoomBookings = new Map();
  const arrivalsByWeek = new Map<string, number>();
  const departuresByWeek = new Map<string, number>();
  for (const r1 of existing) {
    bookRoom(booked, r1.roomId, r1.checkIn.getTime(), r1.checkOut.getTime());
    const aKey = weekKey(r1.checkIn);
    const dKey = weekKey(r1.checkOut);
    arrivalsByWeek.set(aKey, (arrivalsByWeek.get(aKey) ?? 0) + 1);
    departuresByWeek.set(dKey, (departuresByWeek.get(dKey) ?? 0) + 1);
  }

  const FLOOR = 4;
  let counter = 0;
  const cancelPolicyId = `${theme.key}-policy-flex`;

  for (const weekStart of targetWeekStarts()) {
    const wKey = weekKey(weekStart);
    let arrivals = arrivalsByWeek.get(wKey) ?? 0;
    let departures = departuresByWeek.get(wKey) ?? 0;
    let safety = 0;
    while ((arrivals < FLOOR || departures < FLOOR) && safety < 20) {
      safety += 1;
      const needArrival = arrivals < FLOOR;
      let checkInDate: Date;
      let nights: number;
      if (needArrival) {
        const dayOffset = Math.floor(r() * 7); // Mon..Sun
        checkInDate = new Date(weekStart.getTime() + dayOffset * DAY_MS);
        nights = 1 + Math.floor(r() * 3); // 1-3 nights
      } else {
        nights = 1 + Math.floor(r() * 3);
        const dayOffset = Math.floor(r() * 7);
        const desiredCheckOut = new Date(weekStart.getTime() + dayOffset * DAY_MS);
        checkInDate = new Date(desiredCheckOut.getTime() - nights * DAY_MS);
      }
      const checkOutDate = new Date(checkInDate.getTime() + nights * DAY_MS);
      const room = pickFreeRoom(r, rooms, booked, checkInDate.getTime(), checkOutDate.getTime());
      const roomTypeId = rtKeyToId[room.roomTypeKey];
      if (!roomTypeId) break;
      bookRoom(booked, room.id, checkInDate.getTime(), checkOutDate.getTime());
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
      const bookingRef = `${theme.refPrefix}-F-${wKey.replace(/-/g, '')}-${seq}`;

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
        const invoiceNumber = `${theme.refPrefix}-FINV-${wKey.replace(/-/g, '')}-${seq}`;
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
// One Invoice per CLOSED folio, each carrying InvoiceLine rows that mirror the
// folio lines (one line per room-night plus any extra charge). Most invoices
// are PAID (B2C, no recipient GSTIN); ~10% are B2B with a synthetic recipient
// GSTIN. Tax on every line splits CGST + SGST 50/50, and the invoice header
// totals are the sum of the lines so the two always reconcile.

async function seedInvoices(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const r = rng(`${propertyId}-invoices`);
  const supplierGstin = gstinForState(theme.property.state, theme.property.name.length);

  // Deterministic folio order → stable `idx` → stable invoice/line IDs.
  const closedFolios = await prisma.folio.findMany({
    where: { propertyId, status: 'CLOSED' },
    orderBy: { id: 'asc' },
  });

  let idx = 0;
  for (const folio of closedFolios) {
    const [reservation, guest, folioLines] = await Promise.all([
      prisma.reservation.findUnique({ where: { id: folio.reservationId } }),
      prisma.guest.findUnique({ where: { id: folio.guestId } }),
      prisma.folioLine.findMany({ where: { folioId: folio.id } }),
    ]);
    if (!reservation || !guest || folioLines.length === 0) continue;
    idx += 1;
    const checkIn = reservation.checkIn;
    const checkOut = reservation.checkOut;
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS));

    // One InvoiceLine per folio line. Sort by the stable folio-line ID so the
    // line index — and therefore the InvoiceLine ID — is the same on re-runs.
    const sortedLines = [...folioLines].sort((a, b) => a.id.localeCompare(b.id));
    const invoiceLines = sortedLines.map((line) => {
      const amount = Number(line.amount);
      const taxAmount = Number(line.taxAmount);
      const cgst = +(taxAmount / 2).toFixed(2);
      const sgst = +(taxAmount - cgst).toFixed(2);
      return {
        description: line.description,
        ratePerNight: amount,
        gstSlab: line.gstSlab,
        cgstAmount: cgst,
        sgstAmount: sgst,
        lineTotal: +(amount + taxAmount).toFixed(2),
      };
    });

    // Header totals = sum of the lines.
    const taxableValue = +invoiceLines.reduce((a, l) => a + l.ratePerNight, 0).toFixed(2);
    const cgst = +invoiceLines.reduce((a, l) => a + l.cgstAmount, 0).toFixed(2);
    const sgst = +invoiceLines.reduce((a, l) => a + l.sgstAmount, 0).toFixed(2);
    const total = +invoiceLines.reduce((a, l) => a + l.lineTotal, 0).toFixed(2);

    const status = r() < 0.8 ? 'PAID' : 'ISSUED';
    const isB2B = r() < 0.1;
    const recipientGstin = isB2B ? gstinForState(theme.property.state, idx) : null;
    const rate = (reservation.rateSnapshot as { nightlyRate?: number } | null)?.nightlyRate ?? 0;
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
        invoiceNumber: folio.invoiceNumber ?? `${theme.refPrefix}-INV-${String(idx).padStart(4, '0')}`,
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

    // InvoiceLine rows — stable IDs keyed off the invoice so re-runs upsert in
    // place. No discounts modelled: postDiscountAmount === ratePerNight.
    for (const [n, line] of invoiceLines.entries()) {
      const lineId = `${invoiceId}-line-${String(n + 1).padStart(2, '0')}`;
      await prisma.invoiceLine.upsert({
        where: { id: lineId },
        update: {
          description: line.description,
          ratePerNight: line.ratePerNight.toFixed(2),
          postDiscountAmount: line.ratePerNight.toFixed(2),
          gstSlab: line.gstSlab,
          cgstAmount: line.cgstAmount.toFixed(2),
          sgstAmount: line.sgstAmount.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
        },
        create: {
          id: lineId,
          invoiceId,
          propertyId,
          description: line.description,
          ratePerNight: line.ratePerNight.toFixed(2),
          discountAmount: '0.00',
          postDiscountAmount: line.ratePerNight.toFixed(2),
          gstSlab: line.gstSlab,
          cgstAmount: line.cgstAmount.toFixed(2),
          sgstAmount: line.sgstAmount.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
        },
      });
    }
  }
}

// ─── Room blocks ───────────────────────────────────────────────────────────
// One active block per property, alternating by theme index: MAINTENANCE is a
// fixed five-day window; OUT_OF_ORDER is open-ended (endDate null) — the Epic 15
// capability. Both start yesterday so they show as live in the room grid.
// Epic 15: the RoomBlock row is the sole record of out-of-service — the room's
// display status is derived from the block, so no room row is written.

async function seedRoomBlocks(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  // Last room of the property — deterministic, and on larger properties it
  // sits outside the 5-room housekeeping "dirty" cohort.
  const room = theme.rooms[theme.rooms.length - 1];
  if (!room) return;

  const blockType = theme.index % 2 === 0 ? 'MAINTENANCE' : 'OUT_OF_ORDER';
  const reason =
    blockType === 'MAINTENANCE'
      ? 'Bathroom plumbing repair'
      : 'Water damage — awaiting restoration';

  // Started yesterday. A MAINTENANCE job is scheduled and has a known end
  // (five more days); OUT_OF_ORDER restoration has no known end — an
  // open-ended block (endDate null), exercising the Epic 15 capability.
  const startDate = dateOnly(new Date(NOW.getTime() - 1 * DAY_MS));
  const endDate =
    blockType === 'MAINTENANCE' ? dateOnly(new Date(NOW.getTime() + 5 * DAY_MS)) : null;
  const blockId = `${theme.key}-block-01`;

  await prisma.roomBlock.upsert({
    where: { id: blockId },
    update: { blockType, startDate, endDate, reason, deletedAt: null, deletedBy: null },
    create: {
      id: blockId,
      propertyId,
      roomId: room.id,
      blockType,
      startDate,
      endDate,
      reason,
      createdBy: theme.manager.id,
    },
  });

  // Epic 15: the RoomBlock row is the sole record of out-of-service — the
  // room itself is not written (display status is derived from the block).

  // Matching audit-trail entry, as createRoomBlock() would write.
  const blockAuditId = `${theme.key}-block-audit-01`;
  await prisma.auditLog.upsert({
    where: { id: blockAuditId },
    update: {},
    create: {
      id: blockAuditId,
      propertyId,
      entityType: 'ROOM',
      entityId: room.id,
      action: 'ROOM_BLOCKED',
      toState: blockType,
      actorId: theme.manager.id,
      actorRole: 'MANAGER',
      metadata: {
        blockId,
        blockType,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        reason,
      },
      createdAt: new Date(NOW.getTime() - 1 * DAY_MS),
    },
  });
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
  const reservations = reservationsRaw.map((res) => ({
    ...res,
    guest: guestById.get(res.guestId) ?? null,
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
        const rate = (res.rateSnapshot as { nightlyRate?: number } | null)?.nightlyRate ?? 0;
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
        metadata = { amount: 200 + Math.floor(r() * 1500), reason: 'Goodwill refund' };
        break;
      }
      case 'FOLIO_LINE_VOIDED': {
        const f = folios[Math.floor(r() * folios.length)];
        if (!f) continue;
        entityId = f.id;
        metadata = { amount: 100 + Math.floor(r() * 1000), reason: 'Posted in error' };
        break;
      }
      case 'RATE_OVERRIDE_BELOW_FLOOR': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        const floor = 3000 + Math.floor(r() * 2000);
        metadata = { amount: floor - 200, floor, reason: 'Long-stay corporate rate' };
        break;
      }
      case 'DISCOUNT_APPLIED': {
        const res = reservations[Math.floor(r() * reservations.length)];
        if (!res) continue;
        entityId = res.id;
        metadata = { amount: 200 + Math.floor(r() * 800), reason: 'Loyalty discount' };
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
        metadata = { invoiceNumber: inv.invoiceNumber, amount: Number(inv.totalAmount) };
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
      update: { metadata: metadata as Prisma.InputJsonValue, fromState, toState, createdAt },
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
        metadata: metadata as Prisma.InputJsonValue,
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

  // 5–10 ConsumptionLog rows.
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

  // 3–5 LaundryLog rows — rotate through ITEMS_OUT | ITEMS_IN | CLOSED.
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

  // 1–2 IssueReport rows — enum values pinned by DB check constraints.
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

// ─── Rate plans & multipliers ──────────────────────────────────────────────
// Every property gets two rate plans (one FLAT, one PERCENTAGE — both modifier
// types) seeded per room type, plus two property-level rate multipliers (one
// SEASONAL, one CHANNEL). Display names are flavoured to each property's theme.

// Per-property pricing names — true to each property's franchise.
const THEMED_PRICING: Record<
  string,
  { planFlat: string; planPct: string; multSeasonal: string; multChannel: string }
> = {
  // One Piece
  'op-sunny': { planFlat: "Sanji's Feast Package", planPct: 'Straw Hat Flexi Rate', multSeasonal: 'Grand Line Peak Season', multChannel: 'Log Pose OTA Rate' },
  'op-merry': { planFlat: "Merry's Galley Breakfast", planPct: 'Caravel Flexi Rate', multSeasonal: 'Set Sail Peak Season', multChannel: 'Going Merry OTA Rate' },
  'op-baratie': { planFlat: "Baratie Chef's Table", planPct: 'Sea Cook Flexi Rate', multSeasonal: 'All Blue Peak Season', multChannel: 'Ocean Diner OTA Rate' },
  // Demon Slayer
  'ds-butterfly': { planFlat: 'Butterfly Estate Breakfast', planPct: 'Insect Pillar Flexi Rate', multSeasonal: 'Final Selection Peak Season', multChannel: 'Butterfly Mansion OTA Rate' },
  'ds-wisteria': { planFlat: 'Wisteria Garden Breakfast', planPct: 'Hashira Flexi Rate', multSeasonal: 'Wisteria Bloom Season', multChannel: 'Slayer Corps OTA Rate' },
  'ds-mugen': { planFlat: 'Dining Car Breakfast', planPct: 'First Class Berth Flexi Rate', multSeasonal: 'Night Express Peak Season', multChannel: 'Mugen Line OTA Rate' },
  // Naruto
  'na-konoha': { planFlat: 'Ichiraku Ramen Breakfast', planPct: 'Genin Flexi Rate', multSeasonal: 'Chunin Exam Peak Season', multChannel: 'Hidden Leaf OTA Rate' },
  'na-sand': { planFlat: 'Desert Oasis Breakfast', planPct: 'Kazekage Flexi Rate', multSeasonal: 'Sandstorm Peak Season', multChannel: 'Hidden Sand OTA Rate' },
  'na-hokage': { planFlat: "Hokage's Table Breakfast", planPct: 'Jonin Flexi Rate', multSeasonal: 'Festival of Leaves Peak Season', multChannel: 'Hokage Tower OTA Rate' },
  // John Wick
  'jw-cont-dar': { planFlat: 'High Table Dining Plan', planPct: 'Gold Coin Flexi Rate', multSeasonal: 'High Table Peak Season', multChannel: 'Continental Darjeeling OTA Rate' },
  'jw-cont-gng': { planFlat: 'Concierge Breakfast Plan', planPct: 'Marker Flexi Rate', multSeasonal: 'Adjudicator Peak Season', multChannel: 'Continental Gangtok OTA Rate' },
  'jw-cont-kal': { planFlat: 'Sommelier Breakfast Plan', planPct: 'Blood Oath Flexi Rate', multSeasonal: 'Excommunicado Peak Season', multChannel: 'Continental Kalimpong OTA Rate' },
  // The Matrix
  'mx-zion': { planFlat: 'Zion Mess Hall Breakfast', planPct: 'Red Pill Flexi Rate', multSeasonal: 'Temple Gathering Peak Season', multChannel: 'Mainframe OTA Rate' },
  'mx-neb': { planFlat: 'Hovercraft Galley Breakfast', planPct: 'Operator Flexi Rate', multSeasonal: 'Sentinel Surge Season', multChannel: 'Broadcast Depth OTA Rate' },
};

async function seedRatePlans(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const flavour = THEMED_PRICING[theme.key];
  if (!flavour) return; // every theme is mapped; guard is defensive only.

  // Two plans per room type — a FLAT meal-plan uplift and a PERCENTAGE
  // flexible-rate uplift — so both modifier types are exercised. modifierValue
  // is always positive; PERCENTAGE is capped at 100 (rate-plan.schema).
  const planRecipes = [
    { suffix: 'flat', name: flavour.planFlat, modifierType: 'FLAT', modifierValue: '650.00' },
    { suffix: 'pct', name: flavour.planPct, modifierType: 'PERCENTAGE', modifierValue: '12.00' },
  ];
  for (const [idx, rt] of theme.roomTypes.entries()) {
    const rtKey = (['std', 'dlx', 'suite'] as const)[idx] ?? `rt${idx}`;
    for (const recipe of planRecipes) {
      const id = `${theme.key}-plan-${rtKey}-${recipe.suffix}`;
      await prisma.ratePlan.upsert({
        where: { id },
        update: {
          name: recipe.name,
          modifierType: recipe.modifierType,
          modifierValue: recipe.modifierValue,
        },
        create: {
          id,
          propertyId,
          roomTypeId: rt.id,
          name: recipe.name,
          modifierType: recipe.modifierType,
          modifierValue: recipe.modifierValue,
        },
      });
    }
  }
}

async function seedRateMultipliers(prisma: PrismaClient, theme: ThemeDef): Promise<void> {
  const propertyId = theme.property.id;
  const flavour = THEMED_PRICING[theme.key];
  if (!flavour) return; // every theme is mapped; guard is defensive only.

  // Two property-level multipliers: a SEASONAL peak-season uplift (needs a
  // date window) and a CHANNEL OTA markup (needs a channel name). Empty
  // roomTypeIds means the multiplier applies to every room type.
  const year = NOW.getUTCFullYear();
  const otaChannel = theme.index % 2 === 0 ? 'MakeMyTrip' : 'Booking.com';
  const multiplierRecipes: Array<{
    suffix: string;
    name: string;
    type: string;
    multiplier: string;
    startDate: Date | null;
    endDate: Date | null;
    channel: string | null;
  }> = [
    {
      suffix: 'seasonal',
      name: flavour.multSeasonal,
      type: 'SEASONAL',
      multiplier: '1.3000',
      startDate: new Date(Date.UTC(year, 11, 20)),
      endDate: new Date(Date.UTC(year + 1, 0, 5)),
      channel: null,
    },
    {
      suffix: 'channel',
      name: flavour.multChannel,
      type: 'CHANNEL',
      multiplier: '1.1500',
      startDate: null,
      endDate: null,
      channel: otaChannel,
    },
  ];
  for (const recipe of multiplierRecipes) {
    const id = `${theme.key}-mult-${recipe.suffix}`;
    await prisma.rateMultiplier.upsert({
      where: { id },
      update: {
        name: recipe.name,
        type: recipe.type,
        multiplier: recipe.multiplier,
        startDate: recipe.startDate,
        endDate: recipe.endDate,
        channel: recipe.channel,
      },
      create: {
        id,
        propertyId,
        name: recipe.name,
        type: recipe.type,
        multiplier: recipe.multiplier,
        startDate: recipe.startDate,
        endDate: recipe.endDate,
        channel: recipe.channel,
        roomTypeIds: [],
      },
    });
  }
}

export async function seedAnimeProperties(prisma: PrismaClient): Promise<void> {
  const themes = buildThemes();

  for (const theme of themes) {
    const owners = [theme.owner, ...theme.coOwners].map((o) => o.name).join(' + ');
    console.log(
      `[seed:anime] ${theme.property.name} (${theme.tier}, ${theme.property.city}, owner: ${owners})`,
    );
    await seedTheme(prisma, theme);
  }

  // Post-pass: fill-up density, invoices, audit logs, housekeeping logs, room
  // blocks, and rate plans / multipliers.
  for (const theme of themes) {
    console.log(`[seed:anime] Filling up density for ${theme.property.name}`,);
    await fillUpDensity(prisma, theme);
    console.log(`[seed:anime] Seeding invoices for ${theme.property.name}`,);
    await seedInvoices(prisma, theme);
    console.log(`[seed:anime] Seeding audit logs for ${theme.property.name}`,);
    await seedAuditLogs(prisma, theme);
    console.log(`[seed:anime] Seeding housekeeping logs for ${theme.property.name}`,);
    await seedHousekeepingLogs(prisma, theme);
    console.log(`[seed:anime] Seeding room blocks for ${theme.property.name}`,);
    await seedRoomBlocks(prisma, theme);
    console.log(`[seed:anime] Seeding rate plans for ${theme.property.name}`,);
    await seedRatePlans(prisma, theme);
    console.log(`[seed:anime] Seeding rate multipliers for ${theme.property.name}`,);
    await seedRateMultipliers(prisma, theme);
  }

  // Counts summary.
  for (const theme of themes) {
    const [rooms, roomTypes, reservations, folios, invoices, invoiceLines, blocks, audits, ratePlans, rateMultipliers] =
      await Promise.all([
        prisma.room.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
        prisma.roomType.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
        prisma.reservation.count({ where: { propertyId: theme.property.id } }),
        prisma.folio.count({ where: { propertyId: theme.property.id } }),
        prisma.invoice.count({ where: { propertyId: theme.property.id } }),
        prisma.invoiceLine.count({ where: { propertyId: theme.property.id } }),
        prisma.roomBlock.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
        prisma.auditLog.count({ where: { propertyId: theme.property.id } }),
        prisma.ratePlan.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
        prisma.rateMultiplier.count({ where: { propertyId: theme.property.id, deletedAt: null } }),
      ]);
    console.log(
      `[seed:anime]   ${theme.property.slug}: rooms=${rooms} roomTypes=${roomTypes} reservations=${reservations} folios=${folios} invoices=${invoices} invoiceLines=${invoiceLines} blocks=${blocks} audits=${audits} ratePlans=${ratePlans} rateMultipliers=${rateMultipliers}`,
    );
  }

  // ── Rule 19 — login credentials table ────────────────────────────────────
  // One row per user; multi-property users collapse to a single row listing
  // every property they touch.
  type CredRow = { name: string; phone: string; role: string; properties: Set<string> };
  const byUserId = new Map<string, CredRow>();
  for (const theme of themes) {
    const propName = theme.property.name;
    const add = (user: CharacterDef, role: 'OWNER' | 'MANAGER' | 'HOUSEKEEPING') => {
      const existing = byUserId.get(user.id);
      if (existing) {
        existing.properties.add(propName);
        const priority: Record<string, number> = { OWNER: 3, MANAGER: 2, HOUSEKEEPING: 1 };
        if (priority[role]! > priority[existing.role]!) existing.role = role;
        return;
      }
      byUserId.set(user.id, { name: user.name, phone: user.phone, role, properties: new Set([propName]) });
    };
    add(theme.owner, 'OWNER');
    for (const co of theme.coOwners) add(co, 'OWNER');
    add(theme.manager, 'MANAGER');
    for (const hk of theme.housekeepers) add(hk, 'HOUSEKEEPING');
  }

  const rolePriority: Record<string, number> = { OWNER: 0, MANAGER: 1, HOUSEKEEPING: 2 };
  const credRows = Array.from(byUserId.values()).sort((a, b) => {
    const rp = rolePriority[a.role]! - rolePriority[b.role]!;
    if (rp !== 0) return rp;
    return a.name.localeCompare(b.name);
  });

  console.log(
    [
      '',
      '[seed:anime] Login credentials (OTP login — no PINs seeded):',
      '',
      '| User | Phone | Role | Properties |',
      '| --- | --- | --- | --- |',
      ...credRows.map(
        (row) => `| ${row.name} | ${row.phone} | ${row.role} | ${Array.from(row.properties).join(', ')} |`,
      ),
      '',
    ].join('\n'),
  );

  // ── Rule 20 — properties with multiple owners ────────────────────────────
  const coOwned = themes.filter((t) => t.coOwners.length > 0);
  console.log(
    [
      '[seed:anime] Properties with multiple owners:',
      '',
      '| Property | Franchise | Tier | City | Owners |',
      '| --- | --- | --- | --- | --- |',
      ...coOwned.map(
        (t) =>
          `| ${t.property.name} | ${t.franchise} | ${t.tier} | ${t.property.city} | ${[t.owner, ...t.coOwners].map((o) => o.name).join(', ')} |`,
      ),
      '',
    ].join('\n'),
  );

  // ── Properties carrying coldStartProgress = {} (rule 17) ─────────────────
  const emptyProgress = themes.filter((t) => t.coldStartProgressEmpty).map((t) => t.property.name);
  console.log(
    `[seed:anime] coldStartProgress = {} on: ${emptyProgress.join(', ')} (all property data still fully populated)`,
  );
}
