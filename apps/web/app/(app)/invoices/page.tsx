// @ts-nocheck
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { prisma } from '@gojo/db';

import { InvoiceFilterBar } from '@/components/invoices/invoice-filter-bar';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';

import { getServerActor } from '@/lib/auth/server-actor';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { formatInr } from '@/lib/format';

function numberize(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

function formatIstDate(date: Date) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// "May 2026" form for card subtitles. Falls back to range string if parsing fails.
function formatMonthYear(rangeFrom: string): string {
  const d = new Date(`${rangeFrom}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return rangeFrom;
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// "18 May" form for in-table dates per koko's spec.
function formatDayMonth(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

// GST state codes for the few states we operate in. Prefer the GSTIN prefix
// when available since it's authoritative.
const STATE_CODE_BY_NAME: Record<string, string> = {
  'West Bengal': '19',
  Sikkim: '11',
  Delhi: '07',
};

function stateWithCode(state?: string | null, gstin?: string | null): string {
  if (!state) return '—';
  const code = gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : STATE_CODE_BY_NAME[state];
  return code ? `${state} (${code})` : state;
}

export default async function InvoicesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const range = parseDateRange(
    typeof params.startDate === 'string' ? params.startDate : null,
    typeof params.endDate === 'string' ? params.endDate : null,
    'mtd',
  );
  const q = (typeof params.q === 'string' ? params.q : '').trim();
  const statusFilter = typeof params.status === 'string' ? params.status : '';
  const typeFilter = typeof params.type === 'string' ? params.type : '';

  const from = new Date(`${range.from}T00:00:00+05:30`);
  const to = new Date(`${range.to}T23:59:59.999+05:30`);

  // Translate the typeFilter UI value into prisma where clauses.
  const typeWhere = (() => {
    if (typeFilter === 'B2B') return { type: 'INVOICE', recipientGstin: { not: null } };
    if (typeFilter === 'B2C') return { type: 'INVOICE', recipientGstin: null };
    if (typeFilter === 'CREDIT_NOTE') return { type: 'CREDIT_NOTE' };
    return {};
  })();

  const where = {
    propertyId: actor.propertyId,
    invoiceDate: { gte: from, lte: to },
    ...(statusFilter ? { status: statusFilter } : {}),
    ...typeWhere,
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: 'insensitive' as const } },
            { recipientName: { contains: q, mode: 'insensitive' as const } },
            { recipientGstin: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [property, invoices] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { name: true, gstin: true, address: true, city: true, state: true, pincode: true },
    }),
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
    }),
  ]);

  // Resolve folio → reservation booking ref + id (one batched query) so the
  // table can show Booking Ref and the chevron can deep-link to the booking.
  const folioIds = Array.from(new Set(invoices.map((inv) => inv.folioId)));
  const folios = folioIds.length
    ? await prisma.folio.findMany({
        where: { id: { in: folioIds } },
        select: { id: true, reservationId: true },
      })
    : [];
  const reservationIds = Array.from(new Set(folios.map((f) => f.reservationId)));
  const reservations = reservationIds.length
    ? await prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { id: true, bookingReference: true },
      })
    : [];
  const folioToReservation = new Map(folios.map((f) => [f.id, f.reservationId]));
  const reservationMap = new Map(reservations.map((r) => [r.id, r]));

  function reservationForInvoice(folioId: string): { id: string; bookingReference: string | null } | null {
    const reservationId = folioToReservation.get(folioId);
    if (!reservationId) return null;
    return reservationMap.get(reservationId) ?? null;
  }

  const totals = invoices.reduce(
    (acc, inv) => {
      const sign = inv.type === 'CREDIT_NOTE' ? -1 : 1;
      acc.taxable += sign * numberize(inv.taxableValue);
      acc.cgst += sign * numberize(inv.cgstAmount);
      acc.sgst += sign * numberize(inv.sgstAmount);
      acc.total += sign * numberize(inv.totalAmount);
      if (inv.type === 'INVOICE') {
        acc.count += 1;
        if (inv.recipientGstin) acc.b2b += 1;
      }
      if (inv.type === 'CREDIT_NOTE') acc.creditNotes += 1;
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, total: 0, count: 0, b2b: 0, creditNotes: 0 },
  );

  return (
    <div>
      <Topbar
        title="GST Invoices"
        subtitle={`${property?.name ?? 'Property'} · ${range.from} to ${range.to}`}
        controls={
          <ReportTopbarControls
            startDate={range.from}
            endDate={range.to}
            exportHref={`/api/invoices?startDate=${range.from}&endDate=${range.to}`}
            basePath="/invoices"
          />
        }
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReportKpiCard label="Invoices Issued" value={String(totals.count)} subLabel={`${totals.creditNotes} credit notes`} delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Total Billed" value={formatInr(totals.total)} subLabel="Net of credit notes" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Taxable Value" value={formatInr(totals.taxable)} subLabel="Pre-tax revenue" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="GST Collected" value={formatInr(totals.cgst + totals.sgst)} subLabel="CGST + SGST" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="B2B Invoices" value={String(totals.b2b)} subLabel="With recipient GSTIN" delta={0} deltaLabel="this period" />
        </section>

        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
          <ReportCard className="lg:col-span-2 h-full" title={`GST Breakdown — ${formatMonthYear(range.from)}`}>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">Taxable Value</div>
                <div className="mt-1 text-[22px] font-bold leading-tight text-[var(--color-charcoal)]">{formatInr(totals.taxable)}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">Room + F&amp;B + extras</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">CGST (6%)</div>
                <div className="mt-1 text-[22px] font-bold leading-tight text-[#0A6B58]">{formatInr(totals.cgst)}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">Central GST</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">SGST (6%)</div>
                <div className="mt-1 text-[22px] font-bold leading-tight text-[#0A6B58]">{formatInr(totals.sgst)}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">State GST{property?.state ? ` (${property.state})` : ''}</div>
              </div>
            </div>
            <div className="mt-5 border-t border-[var(--color-line-soft)] pt-4">
              <ul className="space-y-2 text-[13px] text-[var(--color-mid-gray)]">
                <li className="flex items-baseline justify-between">
                  <span>Room tariff ≤ ₹7,500/night</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">12% GST (6+6)</span>
                </li>
                <li className="flex items-baseline justify-between">
                  <span>Room tariff &gt; ₹7,500/night</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">18% GST (9+9)</span>
                </li>
                <li className="flex items-baseline justify-between">
                  <span>Restaurant / F&amp;B</span>
                  <span className="font-semibold text-[var(--color-charcoal)]">5% GST (2.5+2.5)</span>
                </li>
              </ul>
            </div>
          </ReportCard>

          <ReportCard className="h-full" title="Property GST Details">
            {(() => {
              const addressLine = [property?.address, property?.city].filter(Boolean).join(', ') || '—';
              const rows: Array<{ label: string; value: React.ReactNode; mono?: boolean }> = [
                { label: 'Legal Name', value: property?.name ?? '—' },
                { label: 'GSTIN', value: property?.gstin ?? <span className="text-[#C45A20]">Not registered</span>, mono: true },
                { label: 'Registered Address', value: addressLine },
                { label: 'State', value: stateWithCode(property?.state, property?.gstin) },
                { label: 'Registration Type', value: 'Regular' },
                { label: 'HSN / SAC Code', value: '9963 (Accommodation)', mono: true },
                { label: 'Filing Frequency', value: 'Monthly (GSTR-1 + 3B)' },
              ];
              return (
                <dl className="divide-y divide-[#F4F9F8]">
                  {rows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-6 py-0.5">
                      <dt className="text-[12px] text-[var(--color-mid-gray)]">{row.label}</dt>
                      <dd className={`max-w-[180px] text-right text-[12px] font-medium text-[var(--color-charcoal)] ${row.mono ? 'font-mono text-[12px] tracking-[0.5px]' : ''}`}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}
            {!property?.gstin ? (
              <p className="mt-3 rounded-md bg-[rgba(232,118,63,0.08)] px-3 py-2 text-[10px] text-[#C45A20]">
                Add a GSTIN in Property Settings before issuing invoices.
              </p>
            ) : null}
          </ReportCard>
        </div>

        <InvoiceFilterBar basePath="/invoices" />

        <div className="flex flex-col gap-5">
          <ReportCard title="Tax Invoices" subtitle={`${invoices.length} document${invoices.length === 1 ? '' : 's'} · ${range.from} to ${range.to}`} bodyPadding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead>
                  <tr style={{ background: '#FAFCFC' }}>
                    {[
                      { label: 'Invoice No.', align: 'left' as const },
                      { label: 'Booking', align: 'left' as const },
                      { label: 'Type', align: 'left' as const },
                      { label: 'Recipient', align: 'left' as const },
                      { label: 'Check-out', align: 'left' as const },
                      { label: 'Taxable', align: 'right' as const },
                      { label: 'CGST', align: 'right' as const },
                      { label: 'SGST', align: 'right' as const },
                      { label: 'Total', align: 'right' as const },
                      { label: 'Status', align: 'left' as const },
                      { label: '', align: 'right' as const },
                    ].map((col) => (
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
                  {invoices.map((inv) => {
                    const isCredit = inv.type === 'CREDIT_NOTE';
                    const sign = isCredit ? -1 : 1;
                    const linkedReservation = reservationForInvoice(inv.folioId);
                    const detailHref = linkedReservation?.id ? `/reservations/${linkedReservation.id}` : null;
                    return (
                      <tr key={inv.id} className="border-t border-[#F0F5F4] hover:bg-[var(--color-off-white)]">
                        <td className="px-6 py-3 font-mono text-[12px] font-semibold text-[var(--color-charcoal)]">{inv.invoiceNumber}</td>
                        <td className="px-2 py-3 font-mono text-[12px] text-[var(--color-mid-gray)]">
                          {linkedReservation?.bookingReference ?? '—'}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${isCredit ? 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]' : inv.recipientGstin ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]' : 'bg-[rgba(158,174,172,0.12)] text-[#6B7574]'}`}>
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
                        <td className="px-6 py-3 text-right text-[var(--color-charcoal)]">{formatInr(sign * numberize(inv.taxableValue))}</td>
                        <td className="px-6 py-3 text-right text-[var(--color-mid-gray)]">{formatInr(sign * numberize(inv.cgstAmount))}</td>
                        <td className="px-6 py-3 text-right text-[var(--color-mid-gray)]">{formatInr(sign * numberize(inv.sgstAmount))}</td>
                        <td className="px-6 py-3 text-right font-semibold text-[var(--color-charcoal)]">{formatInr(sign * numberize(inv.totalAmount))}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${inv.status === 'PAID' ? 'bg-[rgba(29,168,136,0.12)] text-[#0A6B58]' : inv.status === 'VOID' ? 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]' : 'bg-[rgba(158,174,172,0.18)] text-[var(--color-charcoal)]'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {detailHref ? (
                            <Link
                              href={detailHref}
                              aria-label={`Open booking ${linkedReservation?.bookingReference ?? ''}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-teal)]"
                            >
                              <ChevronRight className="size-4" />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                        No invoices match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t-2 border-[#E8EFEE] px-6 py-3.5">
              <span className="text-[13px] font-semibold text-[var(--color-mid-gray)]">Total</span>
              <span className="text-[15px] font-bold text-[var(--color-charcoal)]">{formatInr(totals.total)} billed · {formatInr(totals.cgst + totals.sgst)} GST</span>
            </div>
          </ReportCard>
        </div>
      </div>
    </div>
  );
}
