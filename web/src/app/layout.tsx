import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/store/auth-context';
import { NextAuthProvider } from '@/components/providers/SessionProvider';
import { PwaProvider } from '@/components/providers/PwaProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuickCash — Gestor de Préstamos',
  description:
    'Sistema de gestión de préstamos y cobros. Control total de capital, cobradores y clientes.',
  manifest: '/manifest.json',
  applicationName: 'QuickCash',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuickCash',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2C3E50',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <NextAuthProvider>
          <AuthProvider>
            <PwaProvider>{children}</PwaProvider>
          </AuthProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}

