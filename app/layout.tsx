import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { AuthProvider } from '@/components/Auth/AuthProvider';

export const metadata: Metadata = {
  title: 'Document Filler - PDF Form Automation',
  description: 'Automatically fill PDF forms with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
