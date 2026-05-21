'use client';

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { ExpandedInvoice } from '@/components/invoices/expanded-invoice';
import { formatInr } from '@/lib/format';

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  type: string;
  recipientName: string;
  recipientGstin: string | null;
  checkOut: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  status: string;
  bookingReference: string | null;
  reservationId: string | null;
};

const COLUMN_COUNT = 11;

const COLUMNS: Array<{ label: string; align: 'left' | 'right' }> = [
  { label: 'Invoice No.', align: 'left' },
  { label: 'Booking', align: 'left' },
  { label: 'Type', align: 'left' },
  { label: 'Recipient', align: 'left' },
  { label: 'Check-out', align: 'left' },
  { label: 'Taxable', align: 'right' },
  { label: 'CGST', align: 'right' },
  { label: 'SGST', align: 'right' },
  { label: 'Total', align: 'right' },
  { label: 'Status', align: 'left' },
  { label: '', align: 'right' },
];

// "18 May" form for in-table dates per koko's spec.
function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function InvoiceTable({ rows }: { rows: InvoiceRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead>
          <tr style={{ background: '#FAFCFC' }}>
            {COLUMNS.map((col) => (
              <th
                key={col.label || 'arrow'}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9EAEAC',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  padding: '10px 24px',
                  borderBottom: '1px solid #F0F5F4',
                  textAlign: col.align,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const isCredit = inv.type === 'CREDIT_NOTE';
            const sign = isCredit ? -1 : 1;
            const expanded = expandedId === inv.id;
            return (
              <Fragment key={inv.id}>
                <tr
                  onClick={() => setExpandedId(expanded ? null : inv.id)}
                  aria-expanded={expanded}
                  className={`cursor-pointer border-t border-[#F0F5F4] ${
                    expanded ? 'bg-[#f0faf7]' : 'hover:bg-[var(--color-off-white)]'
                  }`}
                >
                  <td className="px-6 py-3 font-mono text-[12px] font-semibold text-[var(--color-charcoal)]">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-2 py-3 font-mono text-[12px] text-[var(--color-mid-gray)]">
                    {inv.bookingReference ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${
                        isCredit
                          ? 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]'
                          : inv.recipientGstin
                            ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]'
                            : 'bg-[rgba(158,174,172,0.12)] text-[#6B7574]'
                      }`}
                    >
                      {isCredit ? 'Credit Note' : inv.recipientGstin ? 'B2B' : 'B2C'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-[var(--color-charcoal)]">{inv.recipientName}</div>
                    {inv.recipientGstin ? (
                      <div className="font-mono text-[11px] text-[var(--color-mid-gray)]">{inv.recipientGstin}</div>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 text-[var(--color-mid-gray)]">{formatDayMonth(inv.checkOut)}</td>
                  <td className="px-6 py-3 text-right text-[var(--color-charcoal)]">
                    {formatInr(sign * inv.taxableValue)}
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--color-mid-gray)]">
                    {formatInr(sign * inv.cgstAmount)}
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--color-mid-gray)]">
                    {formatInr(sign * inv.sgstAmount)}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-[var(--color-charcoal)]">
                    {formatInr(sign * inv.totalAmount)}
                  </td>
                  <td className="px-6 py-3">
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
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-7 items-center justify-center rounded-md"
                    >
                      <ChevronRight
                        className={`transition-transform ${
                          expanded
                            ? 'size-[18px] rotate-90 text-[var(--color-teal)]'
                            : 'size-4 text-[var(--color-mid-gray)]'
                        }`}
                        strokeWidth={expanded ? 3 : 2}
                      />
                    </span>
                  </td>
                </tr>
                {expanded ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="border-y border-[#e8efee] bg-[#fafcfc] p-0">
                      <ExpandedInvoice
                        invoiceId={inv.id}
                        bookingReference={inv.bookingReference}
                        reservationId={inv.reservationId}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                No invoices match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
