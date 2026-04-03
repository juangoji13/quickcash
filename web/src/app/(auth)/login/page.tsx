'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
                <span className={styles.brandStatValue}>💰</span>
                <span className={styles.brandStatLabel}>Capital en calle</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.brandStatValue}>📍</span>
                <span className={styles.brandStatLabel}>GPS de cobros</span>
              </div>
              <div className={styles.brandStat}>
                <span className={styles.brandStatValue}>📊</span>
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
                <span>⚠️</span> {error}
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
          </form>
        </div>
      </div>
    </div>
  );
}
