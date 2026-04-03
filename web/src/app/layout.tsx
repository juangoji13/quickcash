import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/store/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuickCash — Gestor de Préstamos',
  description:
    'Sistema de gestión de préstamos y cobros. Control total de capital, cobradores y clientes.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuickCash',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
