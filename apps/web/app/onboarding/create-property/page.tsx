// @ts-nocheck
// Hotfix 2 Phase C: property-less signup_token holders land here to create
// their first Property + Subscription. Anyone without a signup_token is
// bounced to /sign-in.

import { redirect } from 'next/navigation';

import { readSignupToken } from '@/lib/auth/signup-token';

import { CreatePropertyForm } from './_components/create-property-form';

export const dynamic = 'force-dynamic';

export default async function CreatePropertyPage() {
  const token = await readSignupToken();
  if (!token?.userId) {
    redirect('/sign-in');
  }
  return <CreatePropertyForm />;
}
