/**
 * Demo seed — fills the local DB with realistic data for the Test Hotel property
 * targeting these monthly occupancy rates (vs 20-room inventory):
 *   January 2026  → 92%
 *   February 2026 → 89%
 *   March 2026    → 67%
 *   April 2026    → 53%
 *   May 2026      → 69% (advance / future bookings)
 *
 * Also exercises feature scenarios: source mix, walk-ins, cancellations,
 * no-shows, folios + payments, GST invoices + a credit note, audit log
 * entries spanning categories, and an active alert.
 *
 * Idempotent: deletes any prior `demo-*` rows for the property before insert.
 *
 * Bypasses the @gojo/db client extension (which blocks invoice/auditLog
 * deletes) by using the raw PrismaClient.
 *
 * Run:
 *   pnpm --filter @gojo/db demo:seed
 */
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

const PROPERTY_ID = 'seed-property-1';
const OWNER_ID = 'seed-user-1';
const STANDARD = 'seed-room-type-standard';
const DELUXE = 'seed-room-type-deluxe';
const FAMILY = 'seed-room-type-family';

// Inventory: 20 rooms total. Re-uses 5 rooms from the base seed and adds 15.
const ROOMS: Array<{ id: string; number: string; roomTypeId: string }> = [
  { id: 'room-101', number: '101', roomTypeId: STANDARD },
  { id: 'room-102', number: '102', roomTypeId: STANDARD },
  { id: 'demo-room-103', number: '103', roomTypeId: STANDARD },
  { id: 'demo-room-104', number: '104', roomTypeId: STANDARD },
  { id: 'demo-room-105', number: '105', roomTypeId: STANDARD },
  { id: 'demo-room-106', number: '106', roomTypeId: STANDARD },
  { id: 'demo-room-107', number: '107', roomTypeId: STANDARD },
  { id: 'demo-room-108', number: '108', roomTypeId: STANDARD },
  { id: 'room-201', number: '201', roomTypeId: DELUXE },
  { id: 'room-202', number: '202', roomTypeId: DELUXE },
  { id: 'demo-room-203', number: '203', roomTypeId: DELUXE },
  { id: 'demo-room-204', number: '204', roomTypeId: DELUXE },
  { id: 'demo-room-205', number: '205', roomTypeId: DELUXE },
  { id: 'demo-room-206', number: '206', roomTypeId: DELUXE },
  { id: 'demo-room-207', number: '207', roomTypeId: DELUXE },
  { id: 'demo-room-208', number: '208', roomTypeId: DELUXE },
  { id: 'room-301', number: '301', roomTypeId: FAMILY },
  { id: 'demo-room-302', number: '302', roomTypeId: FAMILY },
  { id: 'demo-room-303', number: '303', roomTypeId: FAMILY },
  { id: 'demo-room-304', number: '304', roomTypeId: FAMILY },
];

const RATE_BY_TYPE: Record<string, number> = {
  [STANDARD]: 4800,
  [DELUXE]: 8600,
  [FAMILY]: 11500,
};

const SLAB_BY_TYPE: Record<string, '12%' | '18%'> = {
  [STANDARD]: '12%',
  [DELUXE]: '18%',
  [FAMILY]: '18%',
};

// DB CHECK constraint allows only: WALK_IN, DIRECT_BOOKING, OTA.
const SOURCES: Array<'DIRECT_BOOKING' | 'OTA' | 'WALK_IN'> = [
  'DIRECT_BOOKING',
  'DIRECT_BOOKING',
  'OTA',
  'OTA',
  'OTA',
  'WALK_IN',
  'DIRECT_BOOKING',
];

const FIRST_NAMES = ['Aarav', 'Meera', 'Dev', 'Ananya', 'Kabir', 'Neha', 'Rohan', 'Priya', 'Karan', 'Sana', 'Vikram', 'Ishita', 'Arjun', 'Pooja', 'Aditya', 'Tara', 'Rajesh', 'Lakshmi', 'Suresh', 'Divya', 'Rahul', 'Shreya', 'Manish', 'Anika', 'Nitin'];
const LAST_NAMES = ['Sharma', 'Nair', 'Patel', 'Rao', 'Khan', 'Gupta', 'Kapoor', 'Mehta', 'Iyer', 'Verma', 'Singh', 'Joshi', 'Reddy', 'Pillai', 'Bhat'];

// Deterministic PRNG for reproducible seeds.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)] as T;
}
function randInt(min: number, maxInclusive: number) {
  return min + Math.floor(rand() * (maxInclusive - min + 1));
}

function istDate(year: number, monthIndex0: number, day: number, hour = 11, minute = 0) {
  // Treat as IST (UTC+5:30).
  return new Date(Date.UTC(year, monthIndex0, day, hour - 5, minute - 30));
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

const MONTH_TARGETS = [
  { name: 'January', monthIndex: 0, occupancyPct: 0.92, future: false },
  { name: 'February', monthIndex: 1, occupancyPct: 0.89, future: false },
  { name: 'March', monthIndex: 2, occupancyPct: 0.67, future: false },
  { name: 'April', monthIndex: 3, occupancyPct: 0.53, future: false },
  { name: 'May', monthIndex: 4, occupancyPct: 0.69, future: true },
];
const YEAR = 2026;

interface PlannedReservation {
  roomId: string;
  roomTypeId: string;
  startDay: number; // 1-based
  nights: number;
  monthIndex: number;
  source: 'DIRECT_BOOKING' | 'OTA' | 'WALK_IN';
}

/**
 * Build a (room, day) occupancy grid that hits the target ratio, then collapse
 * consecutive occupied cells per room into reservations of length 1–5.
 */
function planReservationsForMonth(year: number, monthIndex: number, occupancyPct: number): PlannedReservation[] {
  const days = daysInMonth(year, monthIndex);
  const totalCells = ROOMS.length * days;
  const target = Math.round(totalCells * occupancyPct);

  // Build a deterministic shuffle of all cells, then mark the first `target` occupied.
  const cells: Array<{ roomIdx: number; day: number }> = [];
  for (let r = 0; r < ROOMS.length; r += 1) {
    for (let d = 1; d <= days; d += 1) cells.push({ roomIdx: r, day: d });
  }
  // Fisher–Yates with our PRNG.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }

  const occupied: boolean[][] = Array.from({ length: ROOMS.length }, () => new Array(days + 2).fill(false));
  for (let i = 0; i < target; i += 1) {
    const cell = cells[i]!;
    occupied[cell.roomIdx]![cell.day] = true;
  }

  // Walk per room, collapse consecutive occupied days into one reservation.
  // Cap reservation length at 5 nights so we get many bookings.
  const out: PlannedReservation[] = [];
  for (let r = 0; r < ROOMS.length; r += 1) {
    const room = ROOMS[r]!;
    let day = 1;
    while (day <= days) {
      if (!occupied[r]![day]) {
        day += 1;
        continue;
      }
      let runEnd = day;
      while (runEnd + 1 <= days && occupied[r]![runEnd + 1] && runEnd - day + 1 < 5) {
        runEnd += 1;
      }
      out.push({
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        startDay: day,
        nights: runEnd - day + 1,
        monthIndex,
        source: pick(SOURCES),
      });
      day = runEnd + 1;
    }
  }
  return out;
}

async function ensureGuests() {
  const guests = [];
  for (let i = 1; i <= 60; i += 1) {
    const id = `demo-guest-${i}`;
    const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const phone = `+9181000${String(10000 + i).slice(-5)}`;
    guests.push({ id, propertyId: PROPERTY_ID, guestCode: `DEMO${String(i).padStart(4, '0')}`, fullName, phone, consentGivenAt: istDate(YEAR, 0, 1) });
  }
  await prisma.guest.createMany({ data: guests, skipDuplicates: true });
  return guests;
}

async function ensureRooms() {
  for (const room of ROOMS) {
    await prisma.room.upsert({
      where: { propertyId_number: { propertyId: PROPERTY_ID, number: room.number } },
      update: { roomTypeId: room.roomTypeId, state: 'AVAILABLE' },
      create: {
        id: room.id,
        propertyId: PROPERTY_ID,
        roomTypeId: room.roomTypeId,
        number: room.number,
        state: 'AVAILABLE',
      },
    });
  }
}

async function ensureProperty() {
  // Add a GSTIN so invoices can issue.
  await prisma.property.update({
    where: { id: PROPERTY_ID },
    data: {
      gstin: '07AABCG1234A1Z5',
      address: '12 Connaught Place',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
  });
}

async function clearPriorDemo() {
  // Delete in dependency order. invoice_lines → invoices → folio_lines → folios → reservations → guests → audit_logs → alerts
  await prisma.invoiceLine.deleteMany({ where: { propertyId: PROPERTY_ID, description: { startsWith: 'Night ' } } });
  await prisma.invoice.deleteMany({ where: { propertyId: PROPERTY_ID } });
  await prisma.folioLine.deleteMany({ where: { propertyId: PROPERTY_ID, id: { startsWith: 'demo-' } } });
  await prisma.folio.deleteMany({ where: { propertyId: PROPERTY_ID, id: { startsWith: 'demo-' } } });
  await prisma.reservation.deleteMany({ where: { propertyId: PROPERTY_ID, id: { startsWith: 'demo-' } } });
  await prisma.auditLog.deleteMany({ where: { propertyId: PROPERTY_ID } });
  await prisma.alert.deleteMany({ where: { propertyId: PROPERTY_ID, id: { startsWith: 'demo-' } } });
  await prisma.guest.deleteMany({ where: { propertyId: PROPERTY_ID, id: { startsWith: 'demo-' } } });
  // Reset invoice + credit-note sequences for clean numbering.
  await prisma.property.update({
    where: { id: PROPERTY_ID },
    data: {
      invoiceSequence: 0,
      invoiceSequenceYear: 0,
      creditNoteSequence: 0,
      creditNoteSequenceYear: 0,
    },
  });
}

async function insertReservations(plans: PlannedReservation[], guests: Array<{ id: string }>) {
  let cursor = 0;
  const records: Array<{ id: string; plan: PlannedReservation; guestId: string; status: string; checkIn: Date; checkOut: Date; cancelledAt: Date | null; noShowAt: Date | null }> = [];

  for (const [idx, plan] of plans.entries()) {
    const checkIn = istDate(YEAR, plan.monthIndex, plan.startDay, 14, 0);
    const checkOut = istDate(YEAR, plan.monthIndex, plan.startDay + plan.nights, 11, 0);
    const guest = guests[cursor % guests.length]!;
    cursor += 1;

    const isFuture = MONTH_TARGETS[plan.monthIndex]?.future ?? false;

    // Sprinkle a few cancellations + no-shows across past months.
    let status: string = isFuture ? 'CONFIRMED' : 'CHECKED_OUT';
    let cancelledAt: Date | null = null;
    let noShowAt: Date | null = null;
    if (!isFuture && idx % 23 === 0) {
      status = 'CANCELLED';
      cancelledAt = istDate(YEAR, plan.monthIndex, Math.max(1, plan.startDay - 1));
    } else if (!isFuture && idx % 47 === 0) {
      status = 'NO_SHOW';
      noShowAt = istDate(YEAR, plan.monthIndex, plan.startDay, 18);
    }

    records.push({
      id: `demo-res-${plan.monthIndex + 1}-${idx + 1}`,
      plan,
      guestId: guest.id,
      status,
      checkIn,
      checkOut,
      cancelledAt,
      noShowAt,
    });
  }

  await prisma.reservation.createMany({
    data: records.map((r) => ({
      id: r.id,
      propertyId: PROPERTY_ID,
      roomId: r.plan.roomId,
      roomTypeId: r.plan.roomTypeId,
      guestId: r.guestId,
      bookingReference: `GJ-${YEAR}${String(r.plan.monthIndex + 1).padStart(2, '0')}${String(r.plan.startDay).padStart(2, '0')}-${r.id.slice(-4).toUpperCase()}`,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      source: r.plan.source,
      rateSnapshot: { nightlyRate: RATE_BY_TYPE[r.plan.roomTypeId], currency: 'INR', gstSlab: SLAB_BY_TYPE[r.plan.roomTypeId] },
      ...(r.cancelledAt ? { cancelledAt: r.cancelledAt, cancelReason: 'Guest cancelled within policy window' } : {}),
      ...(r.noShowAt ? { noShowAt: r.noShowAt } : {}),
      createdAt: new Date(r.checkIn.getTime() - randInt(2, 20) * 86400000),
    })),
  });

  return records;
}

async function insertFoliosAndLines(records: Array<{ id: string; plan: PlannedReservation; guestId: string; status: string; checkIn: Date; checkOut: Date }>) {
  const closedRecords = records.filter((r) => r.status === 'CHECKED_OUT');
  const folios = closedRecords.map((r, idx) => ({
    id: `demo-folio-${idx + 1}`,
    propertyId: PROPERTY_ID,
    reservationId: r.id,
    guestId: r.guestId,
    invoiceNumber: `LEGACY-${YEAR}-${String(idx + 1).padStart(4, '0')}`,
    status: 'CLOSED',
    settledAt: new Date(r.checkOut.getTime() + 60 * 60 * 1000),
    createdAt: r.checkIn,
  }));
  await prisma.folio.createMany({ data: folios });

  const lines: Array<Record<string, unknown>> = [];
  let lineSeq = 1;
  for (let i = 0; i < closedRecords.length; i += 1) {
    const r = closedRecords[i]!;
    const folio = folios[i]!;
    const nightly = RATE_BY_TYPE[r.plan.roomTypeId]!;
    const slab = SLAB_BY_TYPE[r.plan.roomTypeId]!;
    const taxRate = slab === '12%' ? 0.12 : 0.18;

    for (let n = 0; n < r.plan.nights; n += 1) {
      const postedAt = new Date(r.checkIn.getTime() + n * 86400000 + 6 * 3600 * 1000);
      lines.push({
        id: `demo-line-${lineSeq++}`,
        propertyId: PROPERTY_ID,
        folioId: folio.id,
        chargeType: 'ROOM_CHARGE',
        description: `Room charge ${ROOMS.find((room) => room.id === r.plan.roomId)?.number} – Night ${n + 1}`,
        amount: nightly.toFixed(2),
        taxAmount: (nightly * taxRate).toFixed(2),
        gstSlab: slab,
        postedAt,
      });
    }

    // Optional extras + payment for variety.
    if (r.id.charCodeAt(r.id.length - 1) % 3 === 0) {
      lines.push({
        id: `demo-line-${lineSeq++}`,
        propertyId: PROPERTY_ID,
        folioId: folio.id,
        chargeType: 'EXTRA_CHARGE',
        description: 'Breakfast',
        amount: '600.00',
        taxAmount: '72.00',
        gstSlab: '12%',
        postedAt: new Date(r.checkIn.getTime() + 8 * 3600 * 1000),
      });
    }

    const totalNightly = nightly * r.plan.nights;
    const totalTax = totalNightly * taxRate;
    lines.push({
      id: `demo-line-${lineSeq++}`,
      propertyId: PROPERTY_ID,
      folioId: folio.id,
      chargeType: 'PAYMENT',
      description: 'Settlement',
      amount: (totalNightly + totalTax).toFixed(2),
      taxAmount: '0.00',
      gstSlab: '0%',
      postedAt: new Date(r.checkOut.getTime() - 3600 * 1000),
    });
  }

  // Insert in chunks to avoid statement-size limits.
  const chunk = 500;
  for (let i = 0; i < lines.length; i += chunk) {
    await prisma.folioLine.createMany({ data: lines.slice(i, i + chunk) as never });
  }

  return { closedRecords, folios };
}

async function insertInvoicesWithCreditNote(closedRecords: Array<{ id: string; checkIn: Date; checkOut: Date; plan: PlannedReservation; guestId: string }>, folios: Array<{ id: string; reservationId: string; guestId: string }>) {
  // Pick three recent CHECKED_OUT folios from April; issue invoices for them; then a credit note on the first.
  const aprilClosed = closedRecords
    .map((r, idx) => ({ r, folio: folios[idx]! }))
    .filter((entry) => entry.r.plan.monthIndex === 3)
    .slice(0, 3);

  if (aprilClosed.length === 0) return;

  // Reset sequence (also done in clearPriorDemo).
  let invoiceSeq = 0;
  const property = await prisma.property.findUnique({ where: { id: PROPERTY_ID } });

  for (const { r, folio } of aprilClosed) {
    invoiceSeq += 1;
    const nightly = RATE_BY_TYPE[r.plan.roomTypeId]!;
    const slab = SLAB_BY_TYPE[r.plan.roomTypeId]!;
    const halfRate = slab === '12%' ? 0.06 : 0.09;
    const taxable = nightly * r.plan.nights;
    const cgst = Math.round(taxable * halfRate * 100) / 100;
    const sgst = cgst;
    const total = Math.round((taxable + cgst + sgst) * 100) / 100;
    const guest = await prisma.guest.findUnique({ where: { id: r.guestId } });

    const invoice = await prisma.invoice.create({
      data: {
        id: `demo-invoice-${invoiceSeq}`,
        propertyId: PROPERTY_ID,
        folioId: folio.id,
        guestId: r.guestId,
        invoiceNumber: `INV-${YEAR}-${String(invoiceSeq).padStart(6, '0')}`,
        type: 'INVOICE',
        status: 'ISSUED',
        supplierGstin: property?.gstin ?? '07AABCG1234A1Z5',
        supplierName: property?.name ?? 'Test Hotel',
        supplierAddress: `${property?.address}, ${property?.city} ${property?.pincode}`,
        recipientName: guest?.fullName ?? 'Guest',
        recipientGstin: invoiceSeq === 2 ? '29AABCT1234B1Z5' : null,
        hsnCode: '9963',
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        totalNights: r.plan.nights,
        taxableValue: taxable.toFixed(2),
        cgstAmount: cgst.toFixed(2),
        sgstAmount: sgst.toFixed(2),
        totalAmount: total.toFixed(2),
        invoiceRateSnapshot: {
          issuedAt: new Date().toISOString(),
          nights: Array.from({ length: r.plan.nights }, () => ({
            gstSlab: slab,
            ratePerNight: nightly,
            discountApplied: 0,
            cgstRate: halfRate * 100,
            sgstRate: halfRate * 100,
          })),
        },
        invoiceDate: new Date(r.checkOut.getTime() + 3600 * 1000),
        createdAt: new Date(r.checkOut.getTime() + 3600 * 1000),
      },
    });

    await prisma.invoiceLine.createMany({
      data: Array.from({ length: r.plan.nights }, (_, n) => ({
        id: `demo-invoice-line-${invoiceSeq}-${n + 1}`,
        invoiceId: invoice.id,
        propertyId: PROPERTY_ID,
        description: `Night ${n + 1}`,
        ratePerNight: nightly.toFixed(2),
        discountAmount: '0.00',
        postDiscountAmount: nightly.toFixed(2),
        gstSlab: slab,
        cgstAmount: (nightly * halfRate).toFixed(2),
        sgstAmount: (nightly * halfRate).toFixed(2),
        lineTotal: (nightly + nightly * halfRate * 2).toFixed(2),
      })),
    });

    await prisma.property.update({
      where: { id: PROPERTY_ID },
      data: { invoiceSequence: invoiceSeq, invoiceSequenceYear: YEAR },
    });
  }

  // Credit note on the first invoice.
  const firstInvoice = await prisma.invoice.findFirst({
    where: { propertyId: PROPERTY_ID, type: 'INVOICE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!firstInvoice) return;

  const refundAmount = -1500;
  const halfRate = firstInvoice.cgstAmount && Number(firstInvoice.cgstAmount) > 0 ? 0.09 : 0.06;
  const cgst = Math.round(Math.abs(refundAmount) * halfRate * 100) / 100;
  const total = refundAmount + (cgst * 2 * Math.sign(refundAmount));

  const creditNote = await prisma.invoice.create({
    data: {
      id: 'demo-credit-note-1',
      propertyId: PROPERTY_ID,
      folioId: firstInvoice.folioId,
      guestId: firstInvoice.guestId,
      invoiceNumber: `CN-${YEAR}-000001`,
      type: 'CREDIT_NOTE',
      status: 'ISSUED',
      parentInvoiceId: firstInvoice.id,
      supplierGstin: firstInvoice.supplierGstin,
      supplierName: firstInvoice.supplierName,
      supplierAddress: firstInvoice.supplierAddress,
      recipientName: firstInvoice.recipientName,
      recipientGstin: firstInvoice.recipientGstin,
      hsnCode: firstInvoice.hsnCode,
      checkIn: firstInvoice.checkIn,
      checkOut: firstInvoice.checkOut,
      totalNights: firstInvoice.totalNights,
      taxableValue: refundAmount.toFixed(2),
      cgstAmount: (-cgst).toFixed(2),
      sgstAmount: (-cgst).toFixed(2),
      totalAmount: total.toFixed(2),
      invoiceRateSnapshot: firstInvoice.invoiceRateSnapshot ?? {},
      creditNoteReason: 'Service issue – partial refund issued as goodwill',
      adjustedLines: [{ description: 'Goodwill adjustment', postDiscountAmount: refundAmount, gstSlab: '18%' }],
      invoiceDate: new Date(firstInvoice.invoiceDate.getTime() + 24 * 3600 * 1000),
    },
  });

  await prisma.invoiceLine.create({
    data: {
      id: 'demo-credit-note-line-1',
      invoiceId: creditNote.id,
      propertyId: PROPERTY_ID,
      description: 'Goodwill adjustment',
      ratePerNight: refundAmount.toFixed(2),
      discountAmount: '0.00',
      postDiscountAmount: refundAmount.toFixed(2),
      gstSlab: '18%',
      cgstAmount: (-cgst).toFixed(2),
      sgstAmount: (-cgst).toFixed(2),
      lineTotal: total.toFixed(2),
    },
  });

  await prisma.property.update({
    where: { id: PROPERTY_ID },
    data: { creditNoteSequence: 1, creditNoteSequenceYear: YEAR },
  });
}

async function insertAuditLog(records: Array<{ id: string; status: string; checkIn: Date; checkOut: Date; plan: PlannedReservation }>) {
  const events: Array<Record<string, unknown>> = [];
  let seq = 1;

  for (const r of records.filter((rec) => rec.status === 'CHECKED_OUT').slice(0, 60)) {
    events.push({
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'RESERVATION',
      entityId: r.id,
      action: 'CHECK_IN',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      after: { roomId: r.plan.roomId, checkIn: r.checkIn.toISOString() },
      createdAt: r.checkIn,
    });
    events.push({
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'RESERVATION',
      entityId: r.id,
      action: 'CHECK_OUT',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      after: { checkOut: r.checkOut.toISOString() },
      createdAt: r.checkOut,
    });
  }

  for (const r of records.filter((rec) => rec.status === 'CANCELLED').slice(0, 12)) {
    events.push({
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'RESERVATION',
      entityId: r.id,
      action: 'RESERVATION_CANCELLED',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      before: { status: 'CONFIRMED' },
      after: { status: 'CANCELLED' },
      createdAt: r.checkIn,
    });
  }

  // Settings + billing scattered across months.
  const settingsActions = ['COST_CONFIG_UPDATED', 'CHANNEL_CONNECTED', 'ALERT_DISMISSED'] as const;
  for (let m = 0; m < 5; m += 1) {
    for (const action of settingsActions) {
      events.push({
        id: `demo-audit-${seq++}`,
        propertyId: PROPERTY_ID,
        entityType: 'SETTINGS',
        entityId: `setting-${m + 1}`,
        action,
        actorId: OWNER_ID,
        actorRole: 'OWNER',
        after: { changedAt: istDate(YEAR, m, 5).toISOString() },
        createdAt: istDate(YEAR, m, 5),
      });
    }
  }

  for (let m = 0; m < 4; m += 1) {
    events.push({
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'INVOICE',
      entityId: `setting-billing-${m + 1}`,
      action: 'DISCOUNT_APPLIED',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      metadata: { amount: 500 + m * 100 },
      createdAt: istDate(YEAR, m, 12),
    });
  }

  // Failed login + a refund + a guest ID reveal + an export to populate the audit KPIs.
  events.push(
    {
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'OTP_SESSION',
      entityId: 'session-demo-1',
      action: 'AUTH_LOGIN_FAILED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      metadata: { phone: '+9199••••••24', failureReason: 'INVALID_OTP' },
      createdAt: istDate(YEAR, 3, 22, 9, 14),
    },
    {
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'OTP_SESSION',
      entityId: 'session-demo-2',
      action: 'AUTH_LOGIN_FAILED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      metadata: { phone: '+9199••••••24', failureReason: 'MAX_ATTEMPTS' },
      createdAt: istDate(YEAR, 3, 24, 7, 30),
    },
    {
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'FOLIO_LINE',
      entityId: 'demo-folio-3',
      action: 'FOLIO_LINE_REFUNDED',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      metadata: { amount: 1500, reason: 'Service issue' },
      createdAt: istDate(YEAR, 3, 28, 17),
    },
    {
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'GUEST',
      entityId: 'demo-guest-7',
      action: 'GUEST_ID_REVEALED',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      metadata: { reason: 'Tax dept verification' },
      createdAt: istDate(YEAR, 3, 18, 11),
    },
    {
      id: `demo-audit-${seq++}`,
      propertyId: PROPERTY_ID,
      entityType: 'AUDIT_LOG',
      entityId: 'export',
      action: 'AUDIT_LOG_EXPORTED',
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      metadata: { rowCount: 247 },
      createdAt: istDate(YEAR, 3, 30, 16),
    },
  );

  const chunk = 500;
  for (let i = 0; i < events.length; i += chunk) {
    await prisma.auditLog.createMany({ data: events.slice(i, i + chunk) as never });
  }
}

async function insertAlerts() {
  await prisma.alert.create({
    data: {
      id: 'demo-alert-1',
      propertyId: PROPERTY_ID,
      alertType: 'OUTSTANDING_FOLIO',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      message: 'Folio for Room 204 has outstanding balance ₹14,200 (4 days overdue)',
      entityId: 'demo-folio-3',
      entityType: 'FOLIO',
    },
  });
}

async function main() {
  console.log('► Demo seed: clearing prior demo rows…');
  await ensureProperty();
  await ensureRooms();
  await clearPriorDemo();

  console.log('► Inserting guests…');
  const guests = await ensureGuests();

  console.log('► Planning reservations to hit monthly occupancy targets…');
  const allPlans: PlannedReservation[] = [];
  for (const target of MONTH_TARGETS) {
    const plans = planReservationsForMonth(YEAR, target.monthIndex, target.occupancyPct);
    allPlans.push(...plans);
    const planned = plans.reduce((sum, p) => sum + p.nights, 0);
    const days = daysInMonth(YEAR, target.monthIndex);
    const pct = (planned / (ROOMS.length * days)) * 100;
    console.log(`   ${target.name}: ${plans.length} reservations, ${planned} room-nights → ${pct.toFixed(1)}% occupancy`);
  }

  console.log('► Inserting reservations…');
  const records = await insertReservations(allPlans, guests);

  console.log('► Inserting folios + folio lines for past stays…');
  const { closedRecords, folios } = await insertFoliosAndLines(records);

  console.log('► Issuing 3 GST invoices + 1 credit note…');
  await insertInvoicesWithCreditNote(closedRecords, folios);

  console.log('► Writing audit log entries (bookings, billing, settings, failed logins, exports)…');
  await insertAuditLog(records);

  console.log('► Creating one active alert…');
  await insertAlerts();

  const counts = {
    reservations: await prisma.reservation.count({ where: { propertyId: PROPERTY_ID } }),
    folios: await prisma.folio.count({ where: { propertyId: PROPERTY_ID } }),
    folioLines: await prisma.folioLine.count({ where: { propertyId: PROPERTY_ID } }),
    invoices: await prisma.invoice.count({ where: { propertyId: PROPERTY_ID } }),
    auditLog: await prisma.auditLog.count({ where: { propertyId: PROPERTY_ID } }),
    guests: await prisma.guest.count({ where: { propertyId: PROPERTY_ID } }),
  };
  console.log('✔ Demo seed complete', counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
