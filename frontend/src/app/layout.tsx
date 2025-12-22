import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import AuthInitializer from '@/components/AuthInitializer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Svara - Real-time Messaging',
  description: 'Modern messaging app with voice and video calls',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthInitializer>{children}</AuthInitializer>
      </body>
    </html>
  );
}
