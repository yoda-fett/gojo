import { redirect } from 'next/navigation';

type Context = { params: Promise<{ id: string }> };

// Amend moved into a drawer on /reservations (Epic 13). This legacy route
// redirects into the workspace with the amend drawer open.
export default async function AmendReservationPage({ params }: Context) {
  const { id } = await params;
  redirect(`/reservations?drawer=amend:${id}`);
}
