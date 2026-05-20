'use client';

import { useQuery } from '@tanstack/react-query';

import { Drawer } from '@/components/ui/drawer';
import { formatInr } from '@/lib/utils/currency';

type FolioLine = {
  id: string;
  postedAt: string;
  description: string;
  chargeType: string;
  amount: number;
};

type ReservationDetail = {
  bookingReference: string;
  folio: {
    invoiceNumber: string;
    status: string;
    balanceDue: number;
    lines: FolioLine[];
  } | null;
};

export function ReservationFolioDrawer({
  reservationId,
  open,
  onClose,
}: {
  reservationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const detailQuery = useQuery<ReservationDetail>({
    queryKey: ['reservation-detail', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) throw new Error('Unable to load reservation');
      return (await response.json()) as ReservationDetail;
    },
    enabled: open,
  });

  const folio = detailQuery.data?.folio ?? null;
  const lines = folio?.lines ?? [];
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Folio"
      subtitle={detailQuery.data ? detailQuery.data.bookingReference : undefined}
      width={560}
    >
      {detailQuery.isLoading ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">Loading folio…</p>
      ) : !folio ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">
          No folio yet — charges post at check-in.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-[12.5px]">
            <span className="text-[var(--color-mid-gray)]">
              {folio.invoiceNumber} · {folio.status}
            </span>
            <span className="font-semibold text-[var(--color-charcoal)]">
              Balance due: {formatInr(folio.balanceDue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <table className="min-w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Type</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-[#edf3f1]">
                  <td className="py-2 text-[var(--color-mid-gray)]">{line.postedAt.slice(0, 10)}</td>
                  <td className="py-2 text-[var(--color-charcoal)]">{line.description}</td>
                  <td className="py-2 text-[var(--color-mid-gray)]">{line.chargeType}</td>
                  <td className="py-2 text-right text-[var(--color-charcoal)]">
                    {formatInr(line.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr className="border-t border-[#edf3f1]">
                  <td colSpan={4} className="py-3 text-[var(--color-mid-gray)]">
                    No folio charges yet.
                  </td>
                </tr>
              ) : (
                <tr className="border-t-2 border-[#d7e3e0]">
                  <td colSpan={3} className="py-2 font-semibold text-[var(--color-charcoal)]">
                    Total
                  </td>
                  <td className="py-2 text-right font-semibold text-[var(--color-charcoal)]">
                    {formatInr(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </Drawer>
  );
}
