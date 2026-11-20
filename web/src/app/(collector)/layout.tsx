'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

export default function CollectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login');
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: '#1A252F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F1C40F',
          fontFamily: 'Rubik, sans-serif',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
          Quick<span style={{ color: '#F1C40F' }}>Cash</span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#BDC3C7' }}>
          Iniciando módulo de cobranza móvil...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
