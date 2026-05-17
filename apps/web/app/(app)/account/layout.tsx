import type { ReactNode } from 'react';

import { AccountSubnav } from './_components/account-subnav';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1100px] gap-8 p-8">
      <AccountSubnav />
      <section className="flex-1">{children}</section>
    </div>
  );
}
