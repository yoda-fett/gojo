'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { formatInr } from '@/lib/format';

type InvoiceLine = {
  id: string;
  description: string;
  ratePerNight: string | number;
  discountAmount: string | number;
  postDiscountAmount: string | number;
  gstSlab: string;
  cgstAmount: string | number;
  sgstAmount: string | number;
  lineTotal: string | number;
};

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  supplierName: string;
  supplierGstin: string;
  supplierAddress: string;
  recipientName: string;
  recipientGstin: string | null;
  hsnCode: string;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  taxableValue: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  totalAmount: string | number;
  discountApplied: string | number | null;
  creditNoteReason: string | null;
  invoiceDate: string;
  lines: InvoiceLine[];
};

type InvoiceDetailResponse = {
  invoice: InvoiceDetail;
  creditNote: InvoiceDetail | null;
};

function numberize(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#f0f4f3] bg-white px-[18px] py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--color-charcoal)]">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-r border-[#f4f9f8] pr-3.5 last:border-r-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-mid-gray)]">{label}</p>
      <p className={`text-[15px] font-bold ${accent ? 'text-[#0A6B58]' : 'text-[var(--color-charcoal)]'}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-mid-gray)]">{label}</p>
      <p className={`text-[12.5px] font-medium text-[var(--color-charcoal)] ${mono ? 'font-mono tracking-[0.5px]' : ''}`}>
        {value}
      </p>
    </div>
  );
}

export function ExpandedInvoice({
  invoiceId,
  bookingReference,
  reservationId,
}: {
  invoiceId: string;
  bookingReference: string | null;
  reservationId: string | null;
}) {
  const detailQuery = useQuery<InvoiceDetailResponse>({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Unable to load invoice');
      return (await response.json()) as InvoiceDetailResponse;
    },
  });

  if (detailQuery.isLoading) {
    return <div className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">Loading invoice…</div>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <div className="px-6 py-10 text-center text-[13px] text-[var(--color-coral)]">Could not load this invoice.</div>;
  }

  const { invoice: inv, creditNote } = detailQuery.data;
  const isCredit = inv.type === 'CREDIT_NOTE';
  const sign = isCredit ? -1 : 1;
  const typeLabel = isCredit ? 'Credit Note' : inv.recipientGstin ? 'B2B' : 'B2C';

  return (
    <div className="px-6 pb-6 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#e8efee] pb-3.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[16px] font-bold tracking-[-0.2px] text-[var(--color-charcoal)]">
            {inv.invoiceNumber}
          </span>
          <span
            className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${
              isCredit
                ? 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]'
                : inv.recipientGstin
                  ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]'
                  : 'bg-[rgba(158,174,172,0.12)] text-[#6B7574]'
            }`}
          >
            {typeLabel}
          </span>
          <span
            className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${
              inv.status === 'PAID'
                ? 'bg-[rgba(29,168,136,0.12)] text-[#0A6B58]'
                : inv.status === 'VOID'
                  ? 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]'
                  : 'bg-[rgba(158,174,172,0.18)] text-[var(--color-charcoal)]'
            }`}
          >
            {inv.status}
          </span>
        </div>
        <span className="text-[12px] text-[var(--color-mid-gray)]">Issued {formatDate(inv.invoiceDate)}</span>
      </div>

      <div className="grid grid-cols-[1fr_280px] items-start gap-5">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          <Card title="Line Items">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--color-mid-gray)]">
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-left" style={{ width: '40%' }}>Description</th>
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-left">GST</th>
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">Taxable</th>
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">CGST</th>
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">SGST</th>
                  <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2.5 py-4 text-center text-[12.5px] text-[var(--color-mid-gray)]">
                      No line items on this invoice.
                    </td>
                  </tr>
                ) : (
                  inv.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-[12.5px] text-[var(--color-charcoal)]">
                        {line.description}
                      </td>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-[12.5px] text-[var(--color-mid-gray)]">
                        {line.gstSlab}
                      </td>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] tabular-nums text-[var(--color-charcoal)]">
                        {formatInr(sign * numberize(line.postDiscountAmount))}
                      </td>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] tabular-nums text-[var(--color-mid-gray)]">
                        {formatInr(sign * numberize(line.cgstAmount))}
                      </td>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] tabular-nums text-[var(--color-mid-gray)]">
                        {formatInr(sign * numberize(line.sgstAmount))}
                      </td>
                      <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[var(--color-charcoal)]">
                        {formatInr(sign * numberize(line.lineTotal))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          <Card title="Tax Summary">
            <div className="grid grid-cols-3">
              <Tile label="Taxable Value" value={formatInr(sign * numberize(inv.taxableValue))} />
              <Tile label="CGST" value={formatInr(sign * numberize(inv.cgstAmount))} accent />
              <Tile label="SGST" value={formatInr(sign * numberize(inv.sgstAmount))} accent />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[#f9fcfb] px-3.5 py-3">
              <p className="text-[12px] font-semibold text-[var(--color-charcoal)]">
                {isCredit ? 'Total Credited' : 'Total Billed'}
              </p>
              <p className="text-[18px] font-bold tabular-nums text-[var(--color-teal)]">
                {formatInr(sign * numberize(inv.totalAmount))}
              </p>
            </div>
            {isCredit && inv.creditNoteReason ? (
              <p className="mt-3 rounded-md bg-[rgba(232,118,63,0.08)] px-3 py-2 text-[11.5px] text-[#C45A20]">
                Reason: {inv.creditNoteReason}
              </p>
            ) : null}
            {!isCredit && creditNote ? (
              <p className="mt-3 rounded-md bg-[rgba(232,118,63,0.08)] px-3 py-2 text-[11.5px] text-[#C45A20]">
                Credit note {creditNote.invoiceNumber} issued against this invoice
                {creditNote.creditNoteReason ? ` — ${creditNote.creditNoteReason}` : ''}.
              </p>
            ) : null}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          <Card title="Recipient">
            <Field label="Name" value={inv.recipientName || '—'} />
            <Field label="GSTIN" value={inv.recipientGstin || 'Unregistered (B2C)'} mono={Boolean(inv.recipientGstin)} />
          </Card>

          <Card title="Stay">
            <Field label="Check-in" value={formatDate(inv.checkIn)} />
            <Field label="Check-out" value={formatDate(inv.checkOut)} />
            <Field label="Nights" value={String(inv.totalNights)} />
            <Field label="HSN / SAC" value={inv.hsnCode} mono />
            {bookingReference || reservationId ? (
              <div className="mt-3 border-t border-[#f4f9f8] pt-3">
                <p className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-mid-gray)]">
                  Booking
                </p>
                {reservationId ? (
                  <Link
                    href={`/reservations/${reservationId}`}
                    className="inline-flex items-center gap-1 font-mono text-[12.5px] font-medium text-[var(--color-teal)] hover:text-[var(--color-teal-dark)]"
                  >
                    {bookingReference ?? 'View reservation'}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                ) : (
                  <p className="font-mono text-[12.5px] font-medium text-[var(--color-charcoal)]">
                    {bookingReference}
                  </p>
                )}
              </div>
            ) : null}
          </Card>

          <Card title="Supplier">
            <Field label="Legal Name" value={inv.supplierName || '—'} />
            <Field label="GSTIN" value={inv.supplierGstin || '—'} mono />
            <Field label="Address" value={inv.supplierAddress || '—'} />
          </Card>
        </div>
      </div>
    </div>
  );
}
