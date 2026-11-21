'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getTalonarioData, type TalonarioData } from '@/services/talonario.service';
import { formatCurrency } from '@/lib/utils';
import styles from './talonario.module.css';

export default function PublicTalonarioPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = useState<TalonarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    if (!token) return;

    const cacheKey = `qc_talonario_${token}`;
    const cacheTimeKey = `qc_talonario_time_${token}`;

    // 1. Cargar caché offline inmediatamente si existe
    try {
      const cached = localStorage.getItem(cacheKey);
      const time = localStorage.getItem(cacheTimeKey);
      if (cached) {
        setData(JSON.parse(cached));
        setCachedTime(time);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Error leyendo caché offline:', e);
    }

    // 2. Monitorear estado de red
    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 3. Obtener datos frescos del servidor
    getTalonarioData(token)
      .then((res) => {
        if (res) {
          setData(res);
          const nowStr = new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          setCachedTime(nowStr);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
            localStorage.setItem(cacheTimeKey, nowStr);
          } catch (e) {
            // QuotaExceeded o modo privado
          }
        }
      })
      .catch((err) => {
        console.error('Error cargando talonario:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [token]);

  if (loading && !data) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>
          Cargando tu talonario digital...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
        <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>Talonario no encontrado</h3>
        <p style={{ color: '#64748B', fontSize: '0.88rem', maxWidth: 300, marginTop: 6 }}>
          Este enlace no es válido o ha expirado. Por favor pídele a tu cobrador que te comparta su código QR actualizado.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Banner de funcionamiento sin internet */}
        {isOffline && (
          <div className={styles.offlineBanner}>
            <span>📶</span>
            <span>
              Estás en <strong>modo sin conexión</strong>. Mostrando tu última copia guardada
              {cachedTime ? ` (${cachedTime})` : ''}.
            </span>
          </div>
        )}

        {/* Header con marca y verificación */}
        <header className={styles.headerCard}>
          <div className={styles.brandGroup}>
            <div className={styles.brandLogo}>QC</div>
            <div className={styles.brandText}>
              <h1 className={styles.brandTitle}>QuickCash</h1>
              <span className={styles.brandSubtitle}>Talonario Digital</span>
            </div>
          </div>
          <div className={styles.verifiedBadge}>
            <span>🛡️</span>
            <span>Oficial</span>
          </div>
        </header>

        {/* Saludo Cálido y Personalizado */}
        <div className={styles.greetingRow}>
          <h2 className={styles.greetingTitle}>¡Hola, {data.first_name}! 👋</h2>
          <p className={styles.greetingSub}>
            Aquí puedes ver el control de tus cuotas siempre claro y al día.
          </p>
        </div>

        {/* Caso: No tiene crédito activo o ya lo completó */}
        {!data.has_active_loan ? (
          <div className={styles.progressCard} style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>
              {data.is_completed ? '🎉' : '✨'}
            </div>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A', fontSize: '1.2rem' }}>
              {data.is_completed ? '¡Crédito Completado!' : 'Sin Cuotas Pendientes'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, marginTop: 8 }}>
              {data.encouragement_message}
            </p>
          </div>
        ) : (
          <>
            {/* HERO CARD: Únicamente el valor de la cuota a pagar */}
            <section className={styles.cuotaCard}>
              <span className={styles.cuotaLabel}>Tu Cuota a Pagar</span>
              <div className={styles.cuotaAmount}>
                {formatCurrency(data.installment_amount || 0)}
              </div>
              <span className={styles.cuotaFrequency}>
                {data.frequency_label || 'Cobro diario (Lunes a Sábado)'}
              </span>
            </section>

            {/* BARRA DE PROGRESO DE CUOTAS (Sin dinero) */}
            <section className={styles.progressCard}>
              <div className={styles.progressTopRow}>
                <span className={styles.progressLabel}>Progreso de tu crédito</span>
                <span className={styles.progressNumbers}>
                  {data.paid_installments} de {data.total_installments} cuotas ({data.progress_percent}%)
                </span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.min(100, Math.max(5, data.progress_percent || 0))}%` }}
                />
              </div>
              {data.encouragement_message && (
                <div className={styles.encouragementBox}>
                  {data.encouragement_message}
                </div>
              )}
            </section>

            {/* CUADRÍCULA DE CONTROL (Punchcard / Casillas selladas) */}
            <section className={styles.punchcardSection}>
              <div className={styles.sectionTitleRow}>
                <h3 className={styles.sectionTitle}>Casillas de Cuotas</h3>
                <div className={styles.legendRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.legendDotPaid} />
                    <span>Pagada</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.legendDotToday} />
                    <span>Hoy</span>
                  </div>
                </div>
              </div>

              <div className={styles.gridBoxes}>
                {data.installments.map((inst) => {
                  if (inst.status === 'paid') {
                    return (
                      <div key={inst.number} className={`${styles.boxItem} ${styles.boxPaid}`}>
                        <span className={styles.boxPaidCheck}>✔</span>
                        <span className={styles.boxPaidNumber}>#{inst.number}</span>
                        {inst.paid_date && (
                          <span className={styles.boxPaidDate}>{inst.paid_date}</span>
                        )}
                      </div>
                    );
                  }

                  if (inst.status === 'today') {
                    return (
                      <div key={inst.number} className={`${styles.boxItem} ${styles.boxToday}`}>
                        <span className={styles.boxTodayBadge}>HOY</span>
                        <span className={styles.boxTodayNumber}>#{inst.number}</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700 }}>Pendiente</span>
                      </div>
                    );
                  }

                  if (inst.status === 'missed') {
                    return (
                      <div key={inst.number} className={`${styles.boxItem} ${styles.boxMissed}`}>
                        <span className={styles.boxMissedNumber}>#{inst.number}</span>
                        <span className={styles.boxMissedSub}>Atrasada</span>
                      </div>
                    );
                  }

                  return (
                    <div key={inst.number} className={`${styles.boxItem} ${styles.boxPending}`}>
                      <span className={styles.boxPendingNumber}>#{inst.number}</span>
                      <span className={styles.boxPendingSub}>Pendiente</span>
                    </div>
                  );
                })}
              </div>

              {/* Sello de seguridad del último pago */}
              {data.last_payment_note && (
                <div className={styles.sealCard}>
                  <span className={styles.sealIcon}>✅</span>
                  <div className={styles.sealText}>
                    <span style={{ fontWeight: 700 }}>Control de Pago Verificado</span>
                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      {data.last_payment_note}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Botón para guardar en inicio / PWA */}
        <button
          type="button"
          className={styles.installPromptBtn}
          onClick={() => setShowInstallHelp(!showInstallHelp)}
        >
          <span>📲</span>
          <span>
            {showInstallHelp ? 'Ocultar guía' : '¿Cómo guardar este talonario en tu pantalla?'}
          </span>
        </button>

        {showInstallHelp && (
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '14px 16px',
              border: '1px solid #E2E8F0',
              fontSize: '0.82rem',
              color: '#334155',
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#0F172A' }}>
              Para tener tu talonario siempre a la mano sin buscar el enlace:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                <strong>En Android (Chrome):</strong> Toca los tres puntos de arriba (⋮) y elige{' '}
                <em>«Agregar a la pantalla principal»</em>.
              </li>
              <li style={{ marginTop: 4 }}>
                <strong>En iPhone (Safari):</strong> Toca el botón de Compartir (el cuadrito con la
                flecha hacia arriba) y selecciona <em>«Agregar al inicio»</em>.
              </li>
            </ul>
          </div>
        )}

        {/* Footer amigable */}
        <footer className={styles.footerNote}>
          Cobrador asignado: <strong>{data.collector_name}</strong> · QuickCash
          <br />
          Tus pagos se actualizan de forma segura. Todo claro, sin sorpresas.
        </footer>
      </div>
    </div>
  );
}
