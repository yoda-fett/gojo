import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, phone: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-dark-gray)]">Profile</h1>
      <ProfileForm initialName={user?.name ?? ''} phone={user?.phone ?? ''} />
    </div>
  );
}
