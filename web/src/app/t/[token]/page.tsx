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
  const [tutorialOpen, setTutorialOpen] = useState(false);

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
        <p style={{ fontWeight: 700, color: '#475569', fontSize: '0.88rem' }}>
          Abriendo tu tarjeta de cuotas...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
        <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>Tarjeta no encontrada</h3>
        <p style={{ color: '#64748B', fontSize: '0.85rem', maxWidth: 300, marginTop: 6, lineHeight: 1.4 }}>
          Este enlace no es válido o cambió. Por favor pídele a tu cobrador que te comparta su código QR actualizado.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Banner discreto sin internet */}
        {isOffline && (
          <div className={styles.offlineBanner}>
            <span>📶</span>
            <span>
              Modo sin conexión. Mostrando última copia guardada
              {cachedTime ? ` (${cachedTime})` : ''}.
            </span>
          </div>
        )}

        {/* Barra Superior Familiar */}
        <header className={styles.topBar}>
          <div className={styles.brandGroup}>
            <div className={styles.brandLogo}>QC</div>
            <div className={styles.brandText}>
              <h1 className={styles.brandTitle}>QuickCash</h1>
              <span className={styles.brandTagline}>Tarjeta de Cuotas</span>
            </div>
          </div>
          <div className={styles.statusPill}>
            <span>●</span>
            <span>Al Día</span>
          </div>
        </header>

        {/* Saludo Cálido y Personalizado */}
        <div className={styles.greetingBlock}>
          <h2 className={styles.greetingTitle}>¡Hola, {data.first_name}! 👋</h2>
          <p className={styles.greetingSub}>
            Aquí llevas el control de tus cuotas, claro y al día.
          </p>
        </div>

        {/* Caso: No tiene crédito activo o ya lo completó */}
        {!data.has_active_loan ? (
          <div className={styles.punchcardCard} style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>
              {data.is_completed ? '🎉' : '✨'}
            </div>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A', fontSize: '1.15rem' }}>
              {data.is_completed ? '¡Crédito Completado!' : 'Sin Cuotas Pendientes'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.45, marginTop: 6 }}>
              {data.encouragement_message}
            </p>
          </div>
        ) : (
          <>
            {/* MASTER HERO CARD COMPACTA: Cuota a Pagar + Progreso Integrado */}
            <section className={styles.masterHeroCard}>
              <div className={styles.heroMainRow}>
                <div className={styles.heroCuotaCol}>
                  <span className={styles.heroCuotaLabel}>Tu Cuota a Pagar</span>
                  <div className={styles.heroCuotaAmount}>
                    {formatCurrency(data.installment_amount || 0)}
                  </div>
                  <span className={styles.heroFrequency}>
                    {data.frequency_label || 'Cobro semanal'}
                  </span>
                </div>

                <div className={styles.heroProgressCol}>
                  <span className={styles.heroProgressLabel}>
                    {data.paid_installments} de {data.total_installments} pagadas ({data.progress_percent}%)
                  </span>
                  <div className={styles.progressBarTrack}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${Math.min(100, Math.max(8, data.progress_percent || 0))}%` }}
                    />
                  </div>
                </div>
              </div>

              {data.encouragement_message && (
                <div className={styles.heroEncouragement}>
                  {data.encouragement_message}
                </div>
              )}
            </section>

            {/* SECCIÓN CASILLAS DE CUOTAS (Talonario / Punchcard) */}
            <section className={styles.punchcardCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Casillas de Cuotas</h3>
                <div className={styles.legendPills}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.dotPaid} />
                    <span>Pagada</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.dotToday} />
                    <span>Hoy</span>
                  </div>
                </div>
              </div>

              <div className={styles.casillasGrid}>
                {data.installments.map((inst) => {
                  if (inst.status === 'paid') {
                    return (
                      <div key={inst.number} className={`${styles.casillaItem} ${styles.casillaPaid}`}>
                        <span className={styles.casillaPaidCheck}>✔</span>
                        <span className={styles.casillaPaidNumber}>#{inst.number}</span>
                        {inst.paid_date && (
                          <span className={styles.casillaPaidDate}>{inst.paid_date}</span>
                        )}
                      </div>
                    );
                  }

                  if (inst.status === 'today') {
                    return (
                      <div key={inst.number} className={`${styles.casillaItem} ${styles.casillaToday}`}>
                        <span className={styles.casillaTodayBadge}>HOY</span>
                        <span className={styles.casillaTodayNumber}>#{inst.number}</span>
                        <span className={styles.casillaTodaySub}>Pendiente</span>
                      </div>
                    );
                  }

                  if (inst.status === 'missed') {
                    return (
                      <div key={inst.number} className={`${styles.casillaItem} ${styles.casillaMissed}`}>
                        <span className={styles.casillaMissedNumber}>#{inst.number}</span>
                        <span className={styles.casillaMissedSub}>Atrasada</span>
                      </div>
                    );
                  }

                  return (
                    <div key={inst.number} className={`${styles.casillaItem} ${styles.casillaPending}`}>
                      <span className={styles.casillaPendingNumber}>#{inst.number}</span>
                      <span className={styles.casillaPendingSub}>Pendiente</span>
                    </div>
                  );
                })}
              </div>

              {/* Mensaje de Pago Confirmado Humanizado */}
              {data.last_payment_note && (
                <div className={styles.receiptBanner}>
                  <span className={styles.receiptIcon}>💚</span>
                  <div className={styles.receiptBody}>
                    <span className={styles.receiptTitle}>¡Pago al día confirmado!</span>
                    <span className={styles.receiptText}>
                      {data.last_payment_note}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Mini Tutorial Táctil Amigable (PWA / Guardar en inicio) */}
        <section className={styles.tutorialCard}>
          <div
            className={styles.tutorialHeader}
            onClick={() => setTutorialOpen(!tutorialOpen)}
          >
            <div className={styles.tutorialTitleGroup}>
              <span style={{ fontSize: '1.1rem' }}>📲</span>
              <h4 className={styles.tutorialTitle}>
                {tutorialOpen ? '¿Cómo guardar en tu pantalla?' : 'Ten tu tarjeta siempre a la mano'}
              </h4>
            </div>
            <span className={styles.tutorialToggleIcon}>
              {tutorialOpen ? '▲ Ocultar' : '▼ Ver cómo'}
            </span>
          </div>

          {tutorialOpen && (
            <div className={styles.tutorialStepsGrid}>
              <div className={styles.stepTile}>
                <div className={styles.stepPlatform}>
                  <span>🤖</span>
                  <span>Android (Chrome)</span>
                </div>
                <p className={styles.stepInstruction}>
                  1. Toca los tres puntos <strong>(⋮)</strong> arriba a la derecha.
                  <br />
                  2. Elige <strong>«Agregar a la pantalla principal»</strong>.
                </p>
              </div>

              <div className={styles.stepTile}>
                <div className={styles.stepPlatform}>
                  <span>🍏</span>
                  <span>iPhone (Safari)</span>
                </div>
                <p className={styles.stepInstruction}>
                  1. Toca el botón Compartir <strong>(⬆)</strong> abajo.
                  <br />
                  2. Elige <strong>«Agregar al inicio»</strong>.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Footer Cálido (Sin cobrador asignado) */}
        <footer className={styles.warmFooter}>
          QuickCash · Tu tarjeta de cuotas digital
          <br />
          Cuentas claras para tu tranquilidad ✨
        </footer>
      </div>
    </div>
  );
}
