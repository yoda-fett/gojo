import { redirect } from 'next/navigation';

type Context = { params: Promise<{ id: string }> };

// The standalone reservation detail page is superseded by inline row
// expansion on /reservations (Epic 13). Inbound links are preserved via
// this redirect into the workspace with the row pre-expanded.
export default async function ReservationDetailPage({ params }: Context) {
  const { id } = await params;
  redirect(`/reservations?expanded=${id}`);
}
