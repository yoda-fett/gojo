import Image from 'next/image';

import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
  return (
    <main className="gojo-auth-shell">
      <div className="gojo-auth-frame">
        <div className="gojo-auth-brand">
          <Image src="/assets/gojo-logo.png" alt="Gojo" width={120} height={120} priority className="gojo-auth-logo" />
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
