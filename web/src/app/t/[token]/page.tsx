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
          Abriendo tu talonario de cuotas...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loadingContainer}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
        <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>Talonario no encontrado</h3>
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

        {/* TARJETA PRINCIPAL UNIFICADA (Idéntica al mockup) */}
        <main className={styles.mainCard}>
          {/* Swoop Amarillo Orgánico en Esquina Superior Derecha */}
          <svg
            className={styles.topRightSwoop}
            viewBox="0 0 160 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M30 0 C 85 0, 145 25, 160 120 L 160 0 Z"
              fill="#FEBF02"
            />
          </svg>

          {/* Header: QC Logo | QuickCash / Talonario de Cuotas */}
          <header className={styles.header}>
            <div className={styles.brandRow}>
              <div className={styles.brandLogo}>QC</div>
              <div className={styles.brandDivider} />
              <div className={styles.brandText}>
                <h1 className={styles.brandTitle}>QuickCash</h1>
                <span className={styles.brandSubtitle}>
                  {data.first_name ? `Talonario de ${data.first_name}` : 'Talonario de Cuotas'}
                </span>
              </div>
            </div>
          </header>

          {/* Si no tiene crédito activo o ya lo completó */}
          {!data.has_active_loan ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>
                {data.is_completed ? '🎉' : '✨'}
              </div>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0C2237', fontSize: '1.2rem' }}>
                {data.is_completed ? '¡Crédito Completado!' : 'Sin Cuotas Pendientes'}
              </h3>
              <p style={{ color: '#656B81', fontSize: '0.88rem', lineHeight: 1.45, marginTop: 8 }}>
                {data.encouragement_message}
              </p>
            </div>
          ) : (
            <>
              {/* DARK HERO CARD: Valor de la cuota | Progreso */}
              <section className={styles.heroCard}>
                {/* Columna Izquierda: Valor de la cuota */}
                <div className={styles.heroColLeft}>
                  <span className={styles.heroLabel}>Valor de la cuota</span>
                  <div className={styles.heroAmount}>
                    {formatCurrency(data.installment_amount || 0)}
                  </div>
                  <div className={styles.heroFrequencyRow}>
                    <svg
                      className={styles.calendarIcon}
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="3" ry="3"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                      <circle cx="8" cy="14" r="1" fill="currentColor"></circle>
                      <circle cx="12" cy="14" r="1" fill="currentColor"></circle>
                      <circle cx="16" cy="14" r="1" fill="currentColor"></circle>
                      <circle cx="8" cy="18" r="1" fill="currentColor"></circle>
                      <circle cx="12" cy="18" r="1" fill="currentColor"></circle>
                    </svg>
                    <span>{data.frequency_label || 'Cobro semanal'}</span>
                  </div>
                </div>

                {/* Divisor vertical */}
                <div className={styles.heroDivider} />

                {/* Columna Derecha: Progreso */}
                <div className={styles.heroColRight}>
                  <span className={styles.heroLabel}>Progreso</span>
                  <div className={styles.heroPercent}>
                    {data.progress_percent || 0}%
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${Math.min(100, Math.max(6, data.progress_percent || 0))}%`,
                      }}
                    />
                  </div>
                  <span className={styles.progressCounter}>
                    {data.paid_installments} de {data.total_installments} pagadas
                  </span>
                </div>
              </section>

              {/* LISTA DE CUOTAS (Filas estilo mockup) */}
              <section className={styles.cuotasList}>
                {data.installments.map((inst) => {
                  const isPaid = inst.status === 'paid';
                  const isToday = inst.status === 'today';
                  const isMissed = inst.status === 'missed';

                  // Fila: Cuota Pagada (Verde)
                  if (isPaid) {
                    return (
                      <div key={inst.number} className={`${styles.cuotaRow} ${styles.cuotaPaid}`}>
                        <div className={styles.iconBoxPaid}>
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#0B6A30"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <div className={styles.cuotaInfo}>
                          <span className={styles.cuotaTitle}>Cuota #{inst.number}</span>
                          <span className={styles.cuotaSub}>
                            {inst.paid_date || 'Pagada'}
                          </span>
                        </div>
                        <span className={styles.badgePaid}>Pagada</span>
                      </div>
                    );
                  }

                  // Fila: Cuota de Hoy / Por Pagar (Ámbar)
                  if (isToday) {
                    return (
                      <div key={inst.number} className={`${styles.cuotaRow} ${styles.cuotaToday}`}>
                        <div className={styles.iconBoxToday}>
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#B47012"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="9"></circle>
                            <polyline points="12 7 12 12 15 15"></polyline>
                          </svg>
                        </div>
                        <div className={styles.cuotaInfo}>
                          <span className={styles.cuotaTitle}>Cuota #{inst.number}</span>
                          <span className={styles.cuotaSubToday}>Por pagar</span>
                        </div>
                        <span className={styles.badgeToday}>Pendiente</span>
                      </div>
                    );
                  }

                  // Fila: Cuota Atrasada (Rojo)
                  if (isMissed) {
                    return (
                      <div key={inst.number} className={`${styles.cuotaRow} ${styles.cuotaMissed}`}>
                        <div className={styles.iconBoxMissed}>
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#DC2626"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="9"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </div>
                        <div className={styles.cuotaInfo}>
                          <span className={styles.cuotaTitle}>Cuota #{inst.number}</span>
                          <span className={styles.cuotaSubMissed}>Atrasada</span>
                        </div>
                        <span className={styles.badgeMissed}>Atrasada</span>
                      </div>
                    );
                  }

                  // Fila: Cuota Pendiente Futura (Gris suave)
                  return (
                    <div key={inst.number} className={`${styles.cuotaRow} ${styles.cuotaPending}`}>
                      <div className={styles.iconBoxPending}>
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#94A3B8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9"></circle>
                          <polyline points="12 7 12 12 15 15"></polyline>
                        </svg>
                      </div>
                      <div className={styles.cuotaInfo}>
                        <span className={styles.cuotaTitlePending}>Cuota #{inst.number}</span>
                        <span className={styles.cuotaSub}>Pendiente</span>
                      </div>
                      <span className={styles.badgePending}>Pendiente</span>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {/* Footer en el pie de la tarjeta */}
          <footer className={styles.footer}>
            QuickCash · Tu tarjeta de cuotas digital
          </footer>
        </main>

        {/* Tutorial Táctil Amigable (PWA / Guardar en inicio) debajo de la tarjeta */}
        <section className={styles.tutorialContainer}>
          <button
            type="button"
            className={styles.tutorialButton}
            onClick={() => setTutorialOpen(!tutorialOpen)}
            aria-expanded={tutorialOpen}
          >
            <span>📲 Ten tu tarjeta siempre a la mano</span>
            <span className={styles.tutorialToggle}>
              {tutorialOpen ? '▲ Ocultar' : '▼ Ver cómo'}
            </span>
          </button>

          {tutorialOpen && (
            <div className={styles.tutorialSteps}>
              <div className={styles.stepTile}>
                <div className={styles.stepPlatform}>🤖 Android (Chrome)</div>
                <p className={styles.stepText}>
                  1. Toca los tres puntos <strong>(⋮)</strong> arriba.
                  <br />
                  2. Elige <strong>«Agregar a la pantalla principal»</strong>.
                </p>
              </div>

              <div className={styles.stepTile}>
                <div className={styles.stepPlatform}>🍏 iPhone (Safari)</div>
                <p className={styles.stepText}>
                  1. Toca el botón Compartir <strong>(⬆)</strong> abajo.
                  <br />
                  2. Elige <strong>«Agregar al inicio»</strong>.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
