import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PwaBootstrap } from '@/components/pwa-bootstrap';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gojo Housekeeping',
  description: 'Mobile housekeeping companion for Gojo properties',
  manifest: '/manifest.json',
  themeColor: '#1DA888',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="hk-app">
          <PwaBootstrap>{children}</PwaBootstrap>
        </div>
      </body>
    </html>
  );
}
