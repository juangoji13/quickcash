'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

export default function Home() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        router.replace('/overview');
      } else {
        router.replace('/login');
      }
    }
  }, [session, isLoading, router]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--color-bg-light)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-logo)',
            fontSize: 'var(--text-5xl)',
            color: 'var(--color-asphalt)',
          }}
        >
          Quick<span style={{ color: 'var(--color-safety-yellow)' }}>Cash</span>
        </h1>
        <p
          style={{
            marginTop: 'var(--space-4)',
            color: 'var(--color-gray-400)',
            fontSize: 'var(--text-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Cargando...
        </p>
      </div>
    </div>
  );
}
