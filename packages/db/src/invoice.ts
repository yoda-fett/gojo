import { AppError } from '@gojo/types';
import type { Actor } from '@gojo/types';

import { writeAuditLog } from './audit-log.js';
import { prisma } from './client.js';
import type { Prisma } from './generated/client/index.js';
import { calculateGST, pickSlabForPostDiscount, roundTo2Decimals, type GstSlab } from './gst.js';
import type { DbClient } from './types.js';

const HSN_ACCOMMODATION = '9963';

function pad6(value: number): string {
  return String(value).padStart(6, '0');
}

function istYear(date: Date): number {
  // IST = UTC+5:30; shift then read year
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.getUTCFullYear();
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = startOfIstDay(checkOut).getTime() - startOfIstDay(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function startOfIstDay(date: Date): Date {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 5.5 * 60 * 60 * 1000);
}

export async function nextInvoiceNumber(
  tx: DbClient,
  propertyId: string,
  type: 'INVOICE' | 'CREDIT_NOTE',
  now = new Date(),
): Promise<string> {
  const year = istYear(now);
  const property = await tx.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new AppError('NOT_FOUND', 'Property not found', 404);

  const sequenceField = type === 'INVOICE' ? 'invoiceSequence' : 'creditNoteSequence';
  const yearField = type === 'INVOICE' ? 'invoiceSequenceYear' : 'creditNoteSequenceYear';

  if (property[yearField] !== year) {
    await tx.property.update({
      where: { id: propertyId },
      data: { [sequenceField]: 0, [yearField]: year },
    });
  }

  const updated = await tx.property.update({
    where: { id: propertyId },
    data: { [sequenceField]: { increment: 1 } },
    select: { [sequenceField]: true },
  });

  const seq = (updated as Record<string, number>)[sequenceField] ?? 0;
  const prefix = type === 'INVOICE' ? 'INV' : 'CN';
  return `${prefix}-${year}-${pad6(seq)}`;
}

export interface InvoiceRateNight {
  ratePerNight: number;
  discountAmount?: number;
  /** Optional override; otherwise picked via slab boundary on post-discount amount. */
  gstSlab?: GstSlab;
}

export interface GenerateInvoiceParams {
  folioId: string;
  /** Per-night rate schedule in chronological order. */
  nights: InvoiceRateNight[];
  /** Optional snapshot extras stored alongside the rate schedule. */
  snapshotExtras?: Record<string, unknown>;
}

export async function generateInvoice(actor: Actor, params: GenerateInvoiceParams) {
  return prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUnique({ where: { id: params.folioId } });
    if (!folio || folio.propertyId !== actor.propertyId) {
      throw new AppError('NOT_FOUND', 'Folio not found', 404);
    }

    const existing = await tx.invoice.findUnique({
      where: { folioId_type: { folioId: params.folioId, type: 'INVOICE' } },
    });
    if (existing) return existing;

    const reservation = await tx.reservation.findUnique({
      where: { id: folio.reservationId },
    });
    if (!reservation) throw new AppError('NOT_FOUND', 'Reservation not found', 404);

    const property = await tx.property.findUnique({ where: { id: actor.propertyId } });
    if (!property?.gstin) {
      throw new AppError(
        'PROPERTY_GSTIN_MISSING',
        'Property GSTIN required to issue an invoice',
        400,
      );
    }

    const guest = await tx.guest.findUnique({ where: { id: folio.guestId } });
    if (!guest) throw new AppError('NOT_FOUND', 'Guest not found', 404);

    const nightsCount = params.nights.length || nightsBetween(reservation.checkIn, reservation.checkOut);
    const nights: InvoiceRateNight[] = params.nights.length
      ? params.nights
      : (() => {
          const nightlyRate = Number(
            (reservation.rateSnapshot as Record<string, unknown>)?.['nightlyRate'] ??
              (reservation.rateSnapshot as Record<string, unknown>)?.['ratePerNight'] ??
              0,
          );
          return Array.from({ length: nightsCount }, () => ({ ratePerNight: nightlyRate }));
        })();

    const lineDrafts = nights.map((night, index) => {
      const discount = night.discountAmount ?? 0;
      const post = roundTo2Decimals(night.ratePerNight - discount);
      const slab: GstSlab = night.gstSlab ?? pickSlabForPostDiscount(post);
      const gst = calculateGST(post, slab);
      return {
        index,
        ratePerNight: roundTo2Decimals(night.ratePerNight),
        discountAmount: roundTo2Decimals(discount),
        postDiscountAmount: post,
        gstSlab: slab,
        cgstAmount: gst.cgst,
        sgstAmount: gst.sgst,
        lineTotal: gst.total,
      };
    });

    const taxableValue = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.postDiscountAmount, 0));
    const cgstTotal = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.cgstAmount, 0));
    const sgstTotal = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.sgstAmount, 0));
    const totalAmount = roundTo2Decimals(taxableValue + cgstTotal + sgstTotal);
    const discountTotal = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.discountAmount, 0));

    const invoiceNumber = await nextInvoiceNumber(tx, actor.propertyId, 'INVOICE');

    const snapshot: Prisma.InputJsonValue = {
      issuedAt: new Date().toISOString(),
      nights: lineDrafts.map((line) => ({
        gstSlab: line.gstSlab,
        ratePerNight: line.ratePerNight,
        discountApplied: line.discountAmount,
        cgstRate: line.gstSlab === '0%' ? 0 : line.gstSlab === '12%' ? 6 : 9,
        sgstRate: line.gstSlab === '0%' ? 0 : line.gstSlab === '12%' ? 6 : 9,
      })),
      ...(params.snapshotExtras ?? {}),
    };

    const invoice = await tx.invoice.create({
      data: {
        propertyId: actor.propertyId,
        folioId: folio.id,
        guestId: guest.id,
        invoiceNumber,
        type: 'INVOICE',
        status: 'ISSUED',
        supplierGstin: property.gstin,
        supplierName: property.name,
        supplierAddress: `${property.address}, ${property.city} ${property.pincode}`,
        recipientName: guest.fullName,
        recipientGstin: (guest as Record<string, unknown>)['gstin'] as string | null ?? null,
        hsnCode: HSN_ACCOMMODATION,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        totalNights: nightsCount,
        taxableValue,
        cgstAmount: cgstTotal,
        sgstAmount: sgstTotal,
        totalAmount,
        discountApplied: discountTotal > 0 ? discountTotal : null,
        invoiceRateSnapshot: snapshot,
      },
    });

    await tx.invoiceLine.createMany({
      data: lineDrafts.map((line) => ({
        invoiceId: invoice.id,
        propertyId: actor.propertyId,
        description: `Night ${line.index + 1}`,
        ratePerNight: line.ratePerNight,
        discountAmount: line.discountAmount,
        postDiscountAmount: line.postDiscountAmount,
        gstSlab: line.gstSlab,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        lineTotal: line.lineTotal,
      })),
    });

    await writeAuditLog(tx, actor, {
      action: 'INVOICE_ISSUED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      after: {
        invoiceNumber,
        totalAmount,
        cgstAmount: cgstTotal,
        sgstAmount: sgstTotal,
      } as Prisma.JsonValue,
    });

    return invoice;
  });
}

export interface AdjustedLineInput {
  description: string;
  /** Negative amount for refund/correction. */
  postDiscountAmount: number;
  gstSlab: GstSlab;
}

export interface CreateCreditNoteParams {
  originalInvoiceId: string;
  reason: string;
  adjustedLines: AdjustedLineInput[];
}

export async function createCreditNote(actor: Actor, params: CreateCreditNoteParams) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.invoice.findUnique({ where: { id: params.originalInvoiceId } });
    if (!original || original.propertyId !== actor.propertyId) {
      throw new AppError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }
    if (original.type !== 'INVOICE') {
      throw new AppError('VALIDATION_ERROR', 'Cannot credit a non-invoice', 400);
    }

    const existing = await tx.invoice.findFirst({
      where: { propertyId: actor.propertyId, parentInvoiceId: params.originalInvoiceId, type: 'CREDIT_NOTE' },
    });
    if (existing) {
      throw new AppError('CREDIT_NOTE_ALREADY_EXISTS', 'Credit note already issued for this invoice', 409);
    }

    const lineDrafts = params.adjustedLines.map((line) => {
      const post = roundTo2Decimals(line.postDiscountAmount);
      const gst = calculateGST(Math.abs(post), line.gstSlab);
      const sign = post < 0 ? -1 : 1;
      return {
        description: line.description,
        ratePerNight: post,
        discountAmount: 0,
        postDiscountAmount: post,
        gstSlab: line.gstSlab,
        cgstAmount: roundTo2Decimals(gst.cgst * sign),
        sgstAmount: roundTo2Decimals(gst.sgst * sign),
        lineTotal: roundTo2Decimals(gst.total * sign),
      };
    });

    const taxableValue = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.postDiscountAmount, 0));
    const cgstTotal = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.cgstAmount, 0));
    const sgstTotal = roundTo2Decimals(lineDrafts.reduce((sum, l) => sum + l.sgstAmount, 0));
    const totalAmount = roundTo2Decimals(taxableValue + cgstTotal + sgstTotal);

    const creditNoteNumber = await nextInvoiceNumber(tx, actor.propertyId, 'CREDIT_NOTE');

    const creditNote = await tx.invoice.create({
      data: {
        propertyId: actor.propertyId,
        folioId: original.folioId,
        guestId: original.guestId,
        invoiceNumber: creditNoteNumber,
        type: 'CREDIT_NOTE',
        status: 'ISSUED',
        parentInvoiceId: original.id,
        supplierGstin: original.supplierGstin,
        supplierName: original.supplierName,
        supplierAddress: original.supplierAddress,
        recipientName: original.recipientName,
        recipientGstin: original.recipientGstin,
        hsnCode: original.hsnCode,
        checkIn: original.checkIn,
        checkOut: original.checkOut,
        totalNights: original.totalNights,
        taxableValue,
        cgstAmount: cgstTotal,
        sgstAmount: sgstTotal,
        totalAmount,
        invoiceRateSnapshot: original.invoiceRateSnapshot as Prisma.InputJsonValue,
        creditNoteReason: params.reason,
        adjustedLines: params.adjustedLines as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.invoiceLine.createMany({
      data: lineDrafts.map((line) => ({
        invoiceId: creditNote.id,
        propertyId: actor.propertyId,
        description: line.description,
        ratePerNight: line.ratePerNight,
        discountAmount: line.discountAmount,
        postDiscountAmount: line.postDiscountAmount,
        gstSlab: line.gstSlab,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        lineTotal: line.lineTotal,
      })),
    });

    await writeAuditLog(tx, actor, {
      action: 'CREDIT_NOTE_ISSUED',
      entityType: 'INVOICE',
      entityId: original.id,
      metadata: {
        creditNoteId: creditNote.id,
        creditNoteNumber,
        reason: params.reason,
        adjustedAmount: totalAmount,
      } as Prisma.JsonValue,
    });

    return creditNote;
  });
}
