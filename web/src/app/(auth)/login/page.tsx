'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import styles from './login.module.css';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(identifier, password);

    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      router.replace('/overview');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left Panel — Branding */}
        <div className={styles.brandPanel}>
          <div className={styles.brandContent}>
            <h1 className={styles.brandLogo}>
              Quick<span className={styles.brandAccent}>Cash</span>
            </h1>
            <p className={styles.brandTagline}>
              Control total de tu capital.
              <br />
              Sin papel. Sin excusas.
            </p>
            <div className={styles.brandStats}>
              <div className={styles.brandStat}>
                <span className={styles.brandStatValue}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <span className={styles.brandStatLabel}>Capital en calle</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.brandStatValue}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className={styles.brandStatLabel}>GPS de cobros</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.brandStatValue}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span className={styles.brandStatLabel}>Métricas en vivo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — Login Form */}
        <div className={styles.formPanel}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Iniciar Sesión</h2>
              <p className={styles.formSubtitle}>
                Ingresa tus credenciales para acceder al panel
              </p>
            </div>

            {error && (
              <div className={styles.errorBox}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="identifier" className="input-label">
                Usuario o Correo
              </label>
              <input
                id="identifier"
                type="text"
                className="input"
                placeholder="@usuario o email@empresa.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className="input-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className={`btn btn--primary btn--lg ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>

            <div className={styles.registerPrompt}>
              <span>¿Quieres registrar tu propio negocio de préstamos? </span>
              <Link href="/registro" className={styles.registerLink}>
                Regístrate aquí
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
