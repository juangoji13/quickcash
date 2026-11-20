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
  icons: {
    icon: [
      { url: '/favicon.ico?v=4' },
      { url: '/favicon.png?v=4', type: 'image/png' },
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
      { url: '/icon-192x192.png?v=4', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png?v=4', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=4', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-precomposed.png?v=4', sizes: '180x180', type: 'image/png' },
    ],
  },
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
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=4" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png?v=4" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4" />
        <link rel="shortcut icon" href="/favicon.ico?v=4" />
      </head>
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

