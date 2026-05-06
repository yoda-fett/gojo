'use client';
// @ts-nocheck
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AcknowledgeButton({
  reconciliationId,
  discrepancyId,
}: {
  reconciliationId: string;
  discrepancyId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ack() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reconciliation/${reconciliationId}/acknowledge/${discrepancyId}`, {
        method: 'POST',
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={ack}
      className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white disabled:bg-slate-300"
    >
      {busy ? 'Working…' : 'Acknowledge'}
    </button>
  );
}
