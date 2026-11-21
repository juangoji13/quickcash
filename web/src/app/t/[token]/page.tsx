'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getTalonarioData, type TalonarioData, type TalonarioInstallmentItem } from '@/services/talonario.service';
import { formatCurrency } from '@/lib/utils';
import styles from './talonario.module.css';

interface DisplaySlot {
  installment: TalonarioInstallmentItem;
  isLastGoal?: boolean;
}

export default function PublicTalonarioPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = useState<TalonarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'android' | 'ios'>('android');

  // Detección automática del teléfono del cliente (Android vs iPhone)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setActivePlatform('ios');
      } else {
        setActivePlatform('android');
      }
    }
  }, []);

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

  // CÁLCULO DE LA VENTANA RODANTE DE 4 CUOTAS EXACTA
  const rollingSlots = useMemo<DisplaySlot[]>(() => {
    const list = data?.installments || [];
    const n = list.length;
    if (n <= 4) {
      return list.map((inst, idx) => ({
        installment: inst,
        isLastGoal: idx === n - 1 && n > 1,
      }));
    }

    // Localizar la cuota activa (la primera pendiente / hoy / atrasada)
    let activeIdx = list.findIndex(
      (inst) => inst.status === 'today' || inst.status === 'pending' || inst.status === 'missed'
    );
    if (activeIdx === -1) {
      activeIdx = n - 1; // Si todas están pagadas
    }

    const k = activeIdx + 1; // Cuota actual 1-based (ej: 1, 2, 3...)
    let chosenIndices: number[] = [];

    if (k === 1) {
      // Día 1: Cuota 1 (hoy), Cuota 2 (siguiente), Cuota 3 (siguiente), Cuota N (última)
      chosenIndices = [1, 2, 3, n];
    } else if (k === 2) {
      // Día 2: Cuota 1 (pagada), Cuota 2 (hoy), Cuota 3 (siguiente), Cuota N (última)
      chosenIndices = [1, 2, 3, n];
    } else if (k >= 3 && k <= n - 2) {
      // Día 3 en adelante: Cuota k-1 (pagada anterior), Cuota k (hoy), Cuota k+1 (siguiente), Cuota N (última)
      chosenIndices = [k - 1, k, k + 1, n];
    } else if (k === n - 1) {
      // Penúltima cuota
      chosenIndices = [n - 3, n - 2, n - 1, n];
    } else {
      // Última cuota (k === n) o completado
      chosenIndices = [n - 3, n - 2, n - 1, n];
    }

    const uniqueIndices = Array.from(new Set(chosenIndices)).filter(
      (idx) => idx >= 1 && idx <= n
    );

    return uniqueIndices.map((idx) => ({
      installment: list[idx - 1],
      isLastGoal: idx === n && n > 4,
    }));
  }, [data?.installments]);

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
        <div style={{ marginBottom: 12, color: '#64748B' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
            <span>
              Modo sin conexión. Mostrando última copia guardada
              {cachedTime ? ` (${cachedTime})` : ''}.
            </span>
          </div>
        )}

        {/* TARJETA PRINCIPAL UNIFICADA (Limpia y con diseño acorde al mockup) */}
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

          {/* Header: QC Logo | QuickCash / Talonario de Jose */}
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
              <div style={{ marginBottom: 12, color: data.is_completed ? '#16A34A' : '#F1C40F', display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
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

              {/* LISTA DE 4 CUOTAS EXACTAS (Sin saltos ni divisores) */}
              <section className={styles.cuotasList}>
                {rollingSlots.map((slot) => {
                  const inst = slot.installment;
                  const isPaid = inst.status === 'paid';
                  const isMissed = inst.status === 'missed';
                  const isCurrentToPay =
                    !isPaid &&
                    !isMissed &&
                    (inst.status === 'today' || inst.number === (data.paid_installments || 0) + 1);
                  const isLastGoal = slot.isLastGoal;

                  // FILA: Pagada (Verde)
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

                  // FILA: Hoy / Activa por pagar (Amarillo)
                  if (isCurrentToPay) {
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

                  // FILA: Atrasada (Rojo)
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

                  // FILA: Futura Pendiente (Gris)
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
                        <span className={styles.cuotaSub}>
                          {isLastGoal ? 'Última cuota' : 'Pendiente'}
                        </span>
                      </div>
                      <span className={styles.badgePending}>
                        Pendiente
                      </span>
                    </div>
                  );
                })}
              </section>

              {/* GUÍA DE ACCESO RÁPIDO INTEGRADA (Limpia, elegante y sin emojis) */}
              <section className={styles.guideSection}>
                <button
                  type="button"
                  className={styles.guideTrigger}
                  onClick={() => setGuideOpen(!guideOpen)}
                  aria-expanded={guideOpen}
                >
                  <div className={styles.guideLeft}>
                    <div className={styles.guideMiniLogo}>QC</div>
                    <div className={styles.guideText}>
                      <span className={styles.guideTitle}>Guardar en tu celular</span>
                      <span className={styles.guideSubtitle}>Para abrirlo rápido sin buscar enlaces</span>
                    </div>
                  </div>
                  <svg
                    className={`${styles.guideChevronSvg} ${guideOpen ? styles.guideChevronSvgOpen : ''}`}
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {guideOpen && (
                  <div className={styles.guideContent}>
                    {/* Selector de Plataforma */}
                    <div className={styles.platformSelector} role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activePlatform === 'android'}
                        className={`${styles.platformTab} ${activePlatform === 'android' ? styles.platformTabActive : ''}`}
                        onClick={() => setActivePlatform('android')}
                      >
                        <svg className={styles.platformSvg} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1.0001 0-.5516.4482-1.0002.9993-1.0002.5516 0 .9998.4486.9998 1.0002 0 .5515-.4482 1.0001-.9998 1.0001m-11.046 0c-.5511 0-.9993-.4486-.9993-1.0001 0-.5516.4482-1.0002.9993-1.0002.5516 0 .9998.4486.9998 1.0002 0 .5515-.4482 1.0001-.9998 1.0001m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4115 13.8533 8.125 12 8.125c-1.8533 0-3.5902.2865-5.1378.8247L4.84 5.4467a.416.416 0 00-.5677-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.75h24c-.3432-4.0911-2.6889-7.5633-6.1185-9.4286"/>
                        </svg>
                        <span>Android</span>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={activePlatform === 'ios'}
                        className={`${styles.platformTab} ${activePlatform === 'ios' ? styles.platformTabActive : ''}`}
                        onClick={() => setActivePlatform('ios')}
                      >
                        <svg className={styles.platformSvg} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.09.64-2.74 1.4-.55.63-.99 1.68-.94 2.73 1.06.08 2.06-.51 2.67-1.26z"/>
                        </svg>
                        <span>iPhone</span>
                      </button>
                    </div>

                    {/* Pasos Visuales Simples */}
                    <div className={styles.stepsList}>
                      {activePlatform === 'android' ? (
                        <>
                          <div className={styles.stepRow}>
                            <div className={styles.stepNum}>1</div>
                            <span className={styles.stepText}>
                              Toca los tres puntos
                              <span className={styles.actionIconPill}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="19" r="2.5"/></svg>
                              </span>
                              arriba en Chrome
                            </span>
                          </div>
                          <div className={styles.stepRow}>
                            <div className={styles.stepNum}>2</div>
                            <span className={styles.stepText}>
                              Elige <strong>«Agregar a la pantalla principal»</strong>
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.stepRow}>
                            <div className={styles.stepNum}>1</div>
                            <span className={styles.stepText}>
                              Toca Compartir
                              <span className={styles.actionIconPill}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                              </span>
                              abajo en Safari
                            </span>
                          </div>
                          <div className={styles.stepRow}>
                            <div className={styles.stepNum}>2</div>
                            <span className={styles.stepText}>
                              Elige <strong>«Agregar al inicio»</strong>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Footer limpio */}
          <footer className={styles.footer}>
            QuickCash · Tu tarjeta de cuotas digital
          </footer>
        </main>
      </div>
    </div>
  );
}
