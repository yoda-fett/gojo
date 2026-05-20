import { redirect } from 'next/navigation';

// New-reservation creation moved into a drawer on /reservations (Epic 13).
// This legacy route redirects into the workspace with the drawer open.
export default function NewReservationPage() {
  redirect('/reservations?new=1');
}
