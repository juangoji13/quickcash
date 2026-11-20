'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { registerLender } from '@/services/register.service';
import styles from './registro.module.css';

export default function RegistroPage() {
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Pre-validaciones visuales
    if (!businessName.trim()) {
      setError('Por favor ingresa el nombre de tu negocio.');
      return;
    }
    if (!fullName.trim()) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!username.trim()) {
      setError('Por favor define tu nombre de usuario (@handle).');
      return;
    }
    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const cleanHandle = username.trim().startsWith('@')
        ? username.trim()
        : `@${username.trim()}`;

      const res = await registerLender({
        businessName: businessName.trim(),
        fullName: fullName.trim(),
        username: cleanHandle,
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || 'Ocurrió un error al registrar el negocio.');
        setLoading(false);
        return;
      }

      setSuccessMsg('¡Negocio registrado con éxito! Iniciando tu sesión...');

      // Iniciar sesión automáticamente
      const { error: signInError } = await signIn(cleanHandle, password);

      if (signInError) {
        // Fallback al login con parámetro para avisar
        router.replace('/login?registered=1');
      } else {
        router.replace('/overview');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left Panel — Branding & Features */}
        <div className={styles.brandPanel}>
          <div className={styles.brandContent}>
            <h1 className={styles.brandLogo}>
              Quick<span className={styles.brandAccent}>Cash</span>
            </h1>
            <p className={styles.brandTagline}>
              Plataforma integral para prestamistas independientes y empresas de crédito.
              Toma el control absoluto de tus rutas, cobradores y capital.
            </p>

            <div className={styles.featuresList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Multi-Tenant 100% Autónomo</span>
                  <span className={styles.featureDesc}>Base de datos aislada, clientes y préstamos privados para tu empresa.</span>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="19" r="3"/>
                    <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/>
                    <circle cx="18" cy="5" r="3"/>
                  </svg>
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Rutas y Cierres en Asfalto</span>
                  <span className={styles.featureDesc}>Control diario de recaudo, cuotas atrasadas y semáforo de riesgo en tiempo real.</span>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>Operación en Asfalto</span>
                  <span className={styles.featureDesc}>Cálculos automáticos de interés, pagos parciales y sincronización ágil.</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.brandFooter}>
            QuickCash v2.0 · Identidad Metal y Asfalto
          </div>
        </div>

        {/* Right Panel — Registration Form */}
        <div className={styles.formPanel}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Registrar Negocio</h2>
              <p className={styles.formSubtitle}>
                Crea tu cuenta de prestamista y empieza a gestionar tu capital hoy mismo
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

            {successMsg && (
              <div className={styles.successBox}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="businessName" className="input-label">
                Nombre del Negocio o Empresa *
              </label>
              <input
                id="businessName"
                type="text"
                className="input"
                placeholder="Ej: Inversiones El Trébol"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="fullName" className="input-label">
                  Nombre Completo *
                </label>
                <input
                  id="fullName"
                  type="text"
                  className="input"
                  placeholder="Tu nombre y apellido"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="username" className="input-label">
                  Usuario (@handle) *
                </label>
                <div className={styles.inputPrefixWrap}>
                  <span className={styles.inputPrefix}>@</span>
                  <input
                    id="username"
                    type="text"
                    className={`input ${styles.inputPrefixed}`}
                    placeholder="carlos_prestamos"
                    value={username.startsWith('@') ? username.substring(1) : username}
                    onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="email" className="input-label">
                  Correo Electrónico *
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="carlos@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="phone" className="input-label">
                  Teléfono / WhatsApp
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  placeholder="+57 300 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className="input-label">
                Contraseña de Acceso (mín. 6 caracteres) *
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={`btn btn--primary btn--lg ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? 'Creando cuenta y configurando negocio...' : 'Registrar Negocio y Comenzar'}
            </button>

            <div className={styles.loginPrompt}>
              <span>¿Ya tienes una cuenta registrada? </span>
              <Link href="/login" className={styles.loginLink}>
                Inicia sesión aquí
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
