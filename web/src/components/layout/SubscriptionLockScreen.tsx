'use client';

/* ==============================================================================
 * QuickCash — Pantalla de Bloqueo por Suscripción Pausada
 * Vista amigable para prestamistas y cobradores con mensualidad vencida
 * ============================================================================== */

import { formatCurrency } from '@/lib/utils';
import styles from './SubscriptionLockScreen.module.css';

interface SubscriptionLockScreenProps {
  monthlyFee?: number;
  contactPhone?: string;
  onSignOut: () => void;
  tenantName?: string;
}

export default function SubscriptionLockScreen({
  monthlyFee = 25000,
  contactPhone = '+57 300 000 0001',
  onSignOut,
  tenantName = 'tu negocio',
}: SubscriptionLockScreenProps) {
  const cleanPhone = contactPhone.replace(/\D/g, '');

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Swoop Amarillo Orgánico */}
        <div className={styles.topSwoop} aria-hidden="true" />

        {/* Cabecera con Logo QC */}
        <div className={styles.brandRow}>
          <div className={styles.brandLogo}>QC</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>QuickCash</span>
            <span className={styles.brandTag}>Membresía de Plataforma</span>
          </div>
        </div>

        {/* Badge de Estado */}
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} />
          <span>Suscripción en Pausa</span>
        </div>

        {/* Título y Mensaje */}
        <h2 className={styles.title}>Tu cuenta está temporalmente pausada</h2>
        <p className={styles.description}>
          La mensualidad de <strong>{tenantName}</strong> ha llegado a su fecha de corte. Para continuar registrando cuotas, rutas y talonarios con tu equipo, realiza tu aporte mensual.
        </p>

        {/* Tarjeta de Tarifa */}
        <div className={styles.feeBox}>
          <span className={styles.feeLabel}>Valor de la mensualidad</span>
          <div className={styles.feeAmount}>{formatCurrency(monthlyFee)}</div>
          <span className={styles.feePeriod}>Acceso completo por 30 días</span>
        </div>

        {/* Acciones */}
        <div className={styles.actions}>
          <a
            href={`tel:${cleanPhone || '573000000001'}`}
            className={styles.contactSupportBtn}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>Contactar a Soporte y Administración</span>
          </a>

          <button
            type="button"
            onClick={onSignOut}
            className={styles.signOutBtn}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
