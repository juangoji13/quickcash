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
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [viewAll, setViewAll] = useState(false);

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

  // CÁLCULO DE LA VENTANA RODANTE DE 4 CUOTAS (Rolling Window inteligente)
  const rollingWindow = useMemo(() => {
    const list = data?.installments || [];
    const n = list.length;
    if (n <= 4) {
      return {
        slots: list.map((inst, idx) => ({
          installment: inst,
          isLastGoal: idx === n - 1,
        })),
        hasIntermediateGap: false,
        intermediateCount: 0,
      };
    }

    // Localizar índice 0-based de la cuota activa (la primera pendiente / hoy / atrasada)
    let activeIdx = list.findIndex(
      (inst) => inst.status === 'today' || inst.status === 'pending' || inst.status === 'missed'
    );
    if (activeIdx === -1) {
      activeIdx = n - 1; // Si todas están pagadas
    }

    const k = activeIdx + 1; // Cuota actual 1-based (ej: 1, 2, 3...)
    let chosenIndices: number[] = [];

    if (k === 1) {
      // Día 1: Cuota 1 (hoy), Cuota 2 (gris), Cuota 3 (gris), Cuota N (última)
      chosenIndices = [1, 2, 3, n];
    } else if (k === 2) {
      // Día 2: Cuota 1 (pagada), Cuota 2 (hoy), Cuota 3 (gris), Cuota N (última)
      chosenIndices = [1, 2, 3, n];
    } else if (k >= 3 && k <= n - 2) {
      // Día 3 en adelante: Cuota k-1 (pagada anterior), Cuota k (hoy), Cuota k+1 (gris), Cuota N (última)
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

    // Detección de brecha antes de la última cuota
    const beforeLastIdx = uniqueIndices[uniqueIndices.length - 2];
    const lastIdx = uniqueIndices[uniqueIndices.length - 1];
    const hasIntermediateGap = lastIdx - beforeLastIdx > 1;
    const intermediateCount = hasIntermediateGap ? lastIdx - beforeLastIdx - 1 : 0;

    const slots: DisplaySlot[] = uniqueIndices.map((idx) => ({
      installment: list[idx - 1],
      isLastGoal: idx === n && n > 4,
    }));

    return {
      slots,
      hasIntermediateGap,
      intermediateCount,
    };
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
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
        <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>Talonario no encontrado</h3>
        <p style={{ color: '#64748B', fontSize: '0.85rem', maxWidth: 300, marginTop: 6, lineHeight: 1.4 }}>
          Este enlace no es válido o cambió. Por favor pídele a tu cobrador que te comparta su código QR actualizado.
        </p>
      </div>
    );
  }

  // Lista a renderizar: o la ventana rodante de 4 o todas si el cliente pulsa "Ver todas"
  const installmentsToRender = viewAll
    ? (data.installments || []).map((inst, idx, arr) => ({
        installment: inst,
        isLastGoal: idx === arr.length - 1,
      }))
    : rollingWindow.slots;

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

        {/* TARJETA PRINCIPAL UNIFICADA (Todo vive aquí adentro) */}
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

              {/* LISTA DE CUOTAS (Ventana Rodante de 4 cuotas) */}
              <section className={styles.cuotasList}>
                {installmentsToRender.map((slot, index) => {
                  const inst = slot.installment;
                  const isPaid = inst.status === 'paid';
                  const isToday = inst.status === 'today';
                  const isMissed = inst.status === 'missed';
                  const isLastGoal = slot.isLastGoal && !viewAll;

                  // ¿Insertar el separador de cuotas intermedias antes del último slot?
                  const shouldShowGapBeforeThis =
                    !viewAll &&
                    rollingWindow.hasIntermediateGap &&
                    index === installmentsToRender.length - 1;

                  return (
                    <div key={inst.number} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Brecha elegante de cuotas intermedias */}
                      {shouldShowGapBeforeThis && (
                        <div className={styles.gapDivider}>
                          <div className={styles.gapLine} />
                          <span className={styles.gapBadge}>
                            • • • ({rollingWindow.intermediateCount} cuotas intermedias) • • •
                          </span>
                          <div className={styles.gapLine} />
                        </div>
                      )}

                      {/* FILA: Pagada (Verde) */}
                      {isPaid && (
                        <div className={`${styles.cuotaRow} ${styles.cuotaPaid}`}>
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
                      )}

                      {/* FILA: Hoy / Pendiente activa (Amarillo) */}
                      {isToday && (
                        <div className={`${styles.cuotaRow} ${styles.cuotaToday}`}>
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
                      )}

                      {/* FILA: Atrasada (Rojo) */}
                      {isMissed && (
                        <div className={`${styles.cuotaRow} ${styles.cuotaMissed}`}>
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
                      )}

                      {/* FILA: Futura Pendiente (Gris) */}
                      {!isPaid && !isToday && !isMissed && (
                        <div className={`${styles.cuotaRow} ${styles.cuotaPending}`}>
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
                              {isLastGoal ? 'Última cuota · Meta' : 'Pendiente'}
                            </span>
                          </div>
                          <span className={styles.badgePending}>
                            {isLastGoal ? 'Meta' : 'Pendiente'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>

              {/* Botón discreto si hay más de 4 cuotas para ver todas o resumen */}
              {(data.installments?.length || 0) > 4 && (
                <button
                  type="button"
                  className={styles.viewAllToggleBtn}
                  onClick={() => setViewAll(!viewAll)}
                >
                  {viewAll
                    ? '▲ Ver resumen de 4 cuotas'
                    : `Ver las ${data.total_installments} cuotas completas ▼`}
                </button>
              )}
            </>
          )}

          {/* Footer integrado en la misma tarjeta */}
          <footer className={styles.footer}>
            <span className={styles.footerBrand}>
              QuickCash · Tu tarjeta de cuotas digital
            </span>

            {/* Enlace discreto a pantalla de inicio (sin tarjeta externa ni tecnicismos) */}
            <button
              type="button"
              className={styles.saveShortcutBtn}
              onClick={() => setShowInstallHelp(!showInstallHelp)}
            >
              <span>📲</span>
              <span>
                {showInstallHelp ? 'Ocultar guía de pantalla' : 'Guardar en pantalla de inicio'}
              </span>
            </button>

            {/* Mini guía rápida que se despliega DENTRO de la misma tarjeta */}
            {showInstallHelp && (
              <div className={styles.installHelpBox}>
                <div className={styles.installHelpGrid}>
                  <div className={styles.installHelpItem}>
                    <span className={styles.installHelpPlatform}>🤖 Android (Chrome)</span>
                    <p className={styles.installHelpText}>
                      Toca <strong>(⋮)</strong> arriba a la derecha y elige <strong>«Agregar a la pantalla principal»</strong>.
                    </p>
                  </div>
                  <div className={styles.installHelpItem}>
                    <span className={styles.installHelpPlatform}>🍏 iPhone (Safari)</span>
                    <p className={styles.installHelpText}>
                      Toca Compartir <strong>(⬆)</strong> abajo y elige <strong>«Agregar al inicio»</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
