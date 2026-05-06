// @ts-nocheck
import { prisma } from '@gojo/db';
import { notFound, redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';
import { formatIST } from '@/lib/tz';

import { AcknowledgeButton } from './acknowledge-button';

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export default async function ReconciliationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'OWNER' && actor.role !== 'MANAGER') {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-600">You do not have access to this report.</p>
      </main>
    );
  }

  const recon = await prisma.upiSettlementReconciliation.findFirst({
    where: { id, propertyId: actor.propertyId },
  });
  if (!recon) notFound();

  const discrepancies = await prisma.reconciliationDiscrepancy.findMany({
    where: { reconciliationId: id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-slate-900">UPI settlement reconciliation</h1>
      <p className="mt-1 text-sm text-slate-600">
        {formatIST(recon.date)} · Run at {formatIST(recon.runAt, 'dd MMM yyyy hh:mm a')}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Status" value={recon.status} accent={recon.status === 'CLEAN' ? 'teal' : 'red'} />
        <Stat label="Gateway txns" value={recon.totalGatewayTransactions} />
        <Stat label="Ledger txns" value={recon.totalLedgerTransactions} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Discrepancies</h2>
      {discrepancies.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No discrepancies for this run.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Booking ref</th>
                <th className="px-4 py-2">Order id</th>
                <th className="px-4 py-2 text-right">Gateway ₹</th>
                <th className="px-4 py-2 text-right">Ledger ₹</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{d.bookingRef || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{d.gatewayOrderId || '—'}</td>
                  <td className="px-4 py-2 text-right">{Number(d.gatewayAmount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-right">{Number(d.ledgerAmount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-xs">{d.discrepancyType}</td>
                  <td className="px-4 py-2 text-xs">{d.status}</td>
                  <td className="px-4 py-2 text-right">
                    {d.status === 'UNRESOLVED' ? (
                      <AcknowledgeButton reconciliationId={id} discrepancyId={d.id} />
                    ) : (
                      <span className="text-xs text-slate-500">Acknowledged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: 'teal' | 'red' }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${accent === 'teal' ? 'text-teal-700' : accent === 'red' ? 'text-red-700' : 'text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  );
}
