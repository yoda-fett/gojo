import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Actor } from '@gojo/types';

const txMock = {
  property: { findUnique: vi.fn(), update: vi.fn() },
  folio: { findUnique: vi.fn() },
  reservation: { findUnique: vi.fn() },
  guest: { findUnique: vi.fn() },
  invoice: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  invoiceLine: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
};

const prismaMock = {
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
};

vi.mock('../client.js', () => ({ prisma: prismaMock }));

const actor: Actor = {
  userId: 'user-1',
  role: 'OWNER',
  propertyId: 'prop-1',
  sessionId: 'sess-1',
} as Actor;

describe('generateInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.invoice.findUnique.mockResolvedValue(null);
    txMock.folio.findUnique.mockResolvedValue({
      id: 'folio-1',
      propertyId: 'prop-1',
      reservationId: 'res-1',
      guestId: 'guest-1',
    });
    txMock.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      propertyId: 'prop-1',
      checkIn: new Date('2026-04-10T11:00:00+05:30'),
      checkOut: new Date('2026-04-13T11:00:00+05:30'),
      rateSnapshot: { nightlyRate: 6000 },
    });
    txMock.property.findUnique.mockResolvedValue({
      id: 'prop-1',
      gstin: '07ABCDE1234F1Z5',
      name: 'Test Hotel',
      address: '12 MG Road',
      city: 'Bengaluru',
      pincode: '560001',
      invoiceSequenceYear: 2026,
      invoiceSequence: 0,
      creditNoteSequenceYear: 2026,
      creditNoteSequence: 0,
    });
    txMock.property.update.mockResolvedValue({ invoiceSequence: 1 });
    txMock.guest.findUnique.mockResolvedValue({ id: 'guest-1', fullName: 'Asha Rao' });
    txMock.invoice.create.mockImplementation(({ data }) => ({ id: 'inv-1', ...data }));
  });

  it('generates an invoice with sequential number, per-night lines, and AuditLog', async () => {
    const { generateInvoice } = await import('../invoice.js');
    const invoice = await generateInvoice(actor, { folioId: 'folio-1', nights: [] });

    expect(invoice.invoiceNumber).toBe('INV-2026-000001');
    expect(invoice.totalNights).toBe(3);
    expect(invoice.taxableValue).toBe(18000);
    expect(invoice.cgstAmount).toBeCloseTo(1080, 2);
    expect(invoice.sgstAmount).toBeCloseTo(1080, 2);
    expect(invoice.totalAmount).toBeCloseTo(20160, 2);
    expect(txMock.invoiceLine.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(txMock.auditLog.create.mock.calls[0]![0]!.data.action).toBe('INVOICE_ISSUED');
  });

  it('uses mixed slabs per night when crossing the ₹7,500 boundary', async () => {
    const { generateInvoice } = await import('../invoice.js');
    txMock.property.update.mockResolvedValue({ invoiceSequence: 2 });
    const invoice = await generateInvoice(actor, {
      folioId: 'folio-1',
      nights: [
        { ratePerNight: 7000 },
        { ratePerNight: 7000 },
        { ratePerNight: 8500 },
      ],
    });
    expect(invoice.totalNights).toBe(3);
    // Two 12% nights + one 18% night
    const lines = txMock.invoiceLine.createMany.mock.calls[0]![0]!.data;
    expect(lines.map((l: { gstSlab: string }) => l.gstSlab)).toEqual(['12%', '12%', '18%']);
  });

  it('refuses when property has no GSTIN', async () => {
    const { generateInvoice } = await import('../invoice.js');
    txMock.property.findUnique.mockResolvedValueOnce({
      id: 'prop-1',
      name: 'X',
      gstin: null,
      address: 'a',
      city: 'b',
      pincode: 'c',
      invoiceSequenceYear: 2026,
      invoiceSequence: 0,
    });
    await expect(generateInvoice(actor, { folioId: 'folio-1', nights: [] })).rejects.toThrow(/GSTIN/);
  });

  it('returns existing invoice if one already exists for the folio', async () => {
    const { generateInvoice } = await import('../invoice.js');
    txMock.invoice.findUnique.mockResolvedValueOnce({ id: 'inv-existing' });
    const result = await generateInvoice(actor, { folioId: 'folio-1', nights: [] });
    expect(result).toEqual({ id: 'inv-existing' });
    expect(txMock.invoice.create).not.toHaveBeenCalled();
  });
});

describe('createCreditNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      propertyId: 'prop-1',
      folioId: 'folio-1',
      guestId: 'guest-1',
      type: 'INVOICE',
      supplierGstin: 'GSTIN',
      supplierName: 'Test Hotel',
      supplierAddress: '12 MG Road',
      recipientName: 'Asha Rao',
      recipientGstin: null,
      hsnCode: '9963',
      checkIn: new Date(),
      checkOut: new Date(),
      totalNights: 1,
      invoiceRateSnapshot: {},
    });
    txMock.invoice.findFirst.mockResolvedValue(null);
    txMock.property.findUnique.mockResolvedValue({
      id: 'prop-1',
      creditNoteSequenceYear: 2026,
      creditNoteSequence: 0,
    });
    txMock.property.update.mockResolvedValue({ creditNoteSequence: 1 });
    txMock.invoice.create.mockImplementation(({ data }) => ({ id: 'cn-1', ...data }));
  });

  it('creates a credit note with negative line totals and audit log', async () => {
    const { createCreditNote } = await import('../invoice.js');
    const cn = await createCreditNote(actor, {
      originalInvoiceId: 'inv-1',
      reason: 'Overcharge',
      adjustedLines: [{ description: 'Refund night 1', postDiscountAmount: -5000, gstSlab: '12%' }],
    });
    expect(cn.invoiceNumber).toBe('CN-2026-000001');
    expect(cn.type).toBe('CREDIT_NOTE');
    expect(cn.parentInvoiceId).toBe('inv-1');
    expect(Number(cn.totalAmount)).toBeCloseTo(-5600, 2);
    expect(txMock.auditLog.create.mock.calls[0]![0]!.data.action).toBe('CREDIT_NOTE_ISSUED');
  });

  it('rejects a second credit note for the same invoice', async () => {
    const { createCreditNote } = await import('../invoice.js');
    txMock.invoice.findFirst.mockResolvedValueOnce({ id: 'cn-existing' });
    await expect(
      createCreditNote(actor, {
        originalInvoiceId: 'inv-1',
        reason: 'X',
        adjustedLines: [{ description: 'x', postDiscountAmount: -100, gstSlab: '12%' }],
      }),
    ).rejects.toThrow(/CREDIT_NOTE_ALREADY_EXISTS|already issued/);
  });
});
