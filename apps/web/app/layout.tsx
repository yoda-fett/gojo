import '../env';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '../lib/query-provider';

export const metadata: Metadata = {
  title: 'Gojo',
  description: 'Owner-first property management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
