// @ts-nocheck
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { formatInr } from '@/lib/utils/currency';

export function CheckOutPanel({ reservation }: { reservation: any }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/folios/${reservation.folio.id}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chargeType: 'PAYMENT',
        description: note || 'Cash payment',
        amount: Number(amount),
        note,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? 'Unable to record payment');
      return;
    }
    router.refresh();
    setAmount('');
    setNote('');
  }

  async function confirmCheckOut() {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/reservations/${reservation.id}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateVersion: reservation.stateVersion,
        acknowledgedOutstandingBalance: acknowledged,
      }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.message ?? 'Unable to check out guest');
      return;
    }
    router.push(`/reservations/${reservation.id}`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <BaseCard title="Consolidated Folio" subtitle={`Invoice ${reservation.folio.invoiceNumber}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
              <tr>
                <th className="pb-3">Date</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Type</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {reservation.folio.lines.map((line) => (
                <tr key={line.id} className="border-t border-[#edf3f1]">
                  <td className="py-3">{line.postedAt.slice(0, 10)}</td>
                  <td>{line.description}</td>
                  <td>{line.chargeType}</td>
                  <td className={`text-right ${line.amount < 0 ? 'text-[var(--color-teal)]' : ''}`}>
                    {formatInr(line.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 text-[13px]">
          <div className="flex items-center justify-between"><span>Total Charges</span><strong>{formatInr(reservation.folio.totalCharges, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <div className="flex items-center justify-between"><span>Total Payments</span><strong className="text-[var(--color-teal)]">{formatInr(reservation.folio.totalPayments, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <div className="flex items-center justify-between text-[15px]"><span>Balance Due</span><strong className={reservation.folio.balanceDue > 0 ? 'text-[var(--color-coral)]' : 'text-[var(--color-teal)]'}>{formatInr(reservation.folio.balanceDue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        </div>
        <p className="mt-4 text-[12px] text-[var(--color-mid-gray)]">All figures exclude GST. Tax-inclusive invoicing is introduced in Epic 6.</p>
      </BaseCard>

      <div className="space-y-4">
        <BaseCard title="Record Cash Payment" subtitle="Add a manual cash receipt before checkout.">
          <form className="space-y-3" onSubmit={addPayment}>
            <input required type="number" min="1" placeholder="Amount" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <input placeholder="Note (optional)" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button type="submit" variant="secondary">Record Cash Payment</Button>
          </form>
        </BaseCard>
        <BaseCard title="Confirm Check Out" subtitle="Close the folio and move the room into housekeeping dirty state.">
          {reservation.folio.balanceDue > 0 ? (
            <label className="mb-4 flex items-start gap-3 rounded-[10px] bg-[rgba(233,196,106,0.18)] px-4 py-3 text-[13px]">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              <span>Outstanding balance of {formatInr(reservation.folio.balanceDue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Confirm to proceed anyway.</span>
            </label>
          ) : null}
          {error ? <p className="mb-3 rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)]">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={confirmCheckOut} disabled={submitting || (reservation.folio.balanceDue > 0 && !acknowledged)}>
              {submitting ? 'Checking Out...' : 'Confirm Check Out'}
            </Button>
            <Button variant="secondary" href={`/reservations/${reservation.id}`}>Back to Reservation</Button>
          </div>
        </BaseCard>
      </div>
    </div>
  );
}
