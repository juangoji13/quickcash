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
  const whatsappMsg = encodeURIComponent(
    `Hola Juan, te escribo de ${tenantName}. Ya tengo listo el comprobante de pago de mi mensualidad de QuickCash (${formatCurrency(monthlyFee)}) para reactivar mi cuenta.`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone || '573000000001'}?text=${whatsappMsg}`;

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
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.whatsappBtn}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.174.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.13.332.203.043.072.043.419-.101.824z" />
            </svg>
            <span>Enviar Comprobante por WhatsApp</span>
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
