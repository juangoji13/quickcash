'use client';

/* ==============================================================================
 * QuickCash — Dashboard Prestamista (Vista Previa Oculta · Fase 2)
 * Ruta de Staging / Pruebas: /overview/preview
 * NO interviene ni reemplaza la vista existente de producción (/overview).
 * ============================================================================== */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { getPreviewDashboardData, type PreviewDashboardData } from '@/services/dashboard.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import styles from './preview.module.css';

export default function OverviewPreviewPage() {
  const { appUser } = useAuth();
  const [data, setData] = useState<PreviewDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!appUser?.tenant_id) return;
      try {
        setLoading(true);
        const res = await getPreviewDashboardData(appUser.tenant_id);
        setData(res);
      } catch (err) {
        console.error('Error cargando preview dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appUser?.tenant_id]);

  const firstName = appUser?.full_name?.split(' ')[0] || 'Prestamista';
  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.page}>
      {/* Banner de Previsualización Aislada */}
      <div className={styles.previewBanner}>
        <div className={styles.previewText}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>
            <strong>Previsualización Privada:</strong> Este es el nuevo diseño con el ADN del Talonario Digital. La ruta oficial sigue intacta en /overview.
          </span>
        </div>
        <Link href="/overview" className={styles.backToNormalLink}>
          Ir al original
        </Link>
      </div>

      {/* Header con Saludo y Pastilla de Membresía */}
      <header className={styles.header}>
        <div className={styles.greetingBlock}>
          <h1 className={styles.greeting}>
            Hola, <span className={styles.nameHighlight}>{firstName}</span>
          </h1>
          <span className={styles.todayDate}>{todayFormatted}</span>
        </div>

        {/* Pastilla de Membresía */}
        <div className={styles.membershipPill}>
          <span
            className={
              data?.membership.status === 'locked'
                ? styles.membershipDotYellow
                : styles.membershipDotGreen
            }
          />
          <span>
            {data?.membership.is_free_mode
              ? 'Membresía: Modo Promocional (Gratis)'
              : `Membresía: Al Día (${data?.membership.days_left ?? 30} días restantes)`}
          </span>
        </div>
      </header>

      {/* DARK HERO CARD: Recaudo de Hoy | Progreso | Cartera en Calle */}
      <section className={styles.heroCard}>
        {/* Swoop Amarillo Orgánico */}
        <svg
          className={styles.heroSwoop}
          viewBox="0 0 140 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M20 0 C 70 0, 125 20, 140 100 L 140 0 Z" fill="#FEBF02" />
        </svg>

        {/* Fila Superior: Recaudo Hoy (Izq) vs Progreso de Cobro (Der) */}
        <div className={styles.heroTopRow}>
          {/* Columna Izquierda: Dinero Recaudado Hoy */}
          <div className={styles.heroColLeft}>
            <span className={styles.heroLabel}>Recaudo del Día</span>
            <div className={styles.heroAmountGold}>
              {loading ? '—' : formatCurrency(data?.today_collected || 0)}
            </div>
            <span className={styles.heroExpectedSub}>
              {loading
                ? 'Calculando meta...'
                : data && data.today_expected > 0
                ? `de ${formatCurrency(data.today_expected)} programados para hoy`
                : 'Sin cobros programados para hoy'}
            </span>
          </div>

          <div className={styles.heroDivider} />

          {/* Columna Derecha: Velocímetro de Cobro */}
          <div className={styles.heroColRight}>
            <div className={styles.heroPercentRow}>
              <span className={styles.heroLabel}>Efectividad de Cobro</span>
              <span className={styles.heroPercentVal}>
                {loading ? '0%' : `${data?.today_progress_pct || 0}%`}
              </span>
            </div>

            <div className={styles.heroProgressTrack}>
              <div
                className={styles.heroProgressFill}
                style={{
                  width: `${Math.min(100, Math.max(4, data?.today_progress_pct || 0))}%`,
                }}
              />
            </div>

            <span className={styles.heroProgressCounter}>
              {loading
                ? '—'
                : `${data?.today_paid_count || 0} de ${
                    data?.today_total_due_count || 0
                  } cuotas cobradas hoy`}
            </span>
          </div>
        </div>

        {/* Fila Inferior: Capital en Calle & Ganancias */}
        <div className={styles.heroBottomRow}>
          <div className={styles.heroSubMetric}>
            <span className={styles.heroSubLabel}>Capital en Calle</span>
            <span className={styles.heroSubVal}>
              {loading ? '—' : formatCurrency(data?.capital_in_street || 0)}
            </span>
          </div>

          <div className={styles.heroSubMetric}>
            <span className={styles.heroSubLabel}>Ganancia por Cobrar</span>
            <span className={styles.heroSubValGreen}>
              {loading ? '—' : formatCurrency(data?.interest_receivable || 0)}
            </span>
          </div>

          <div className={styles.heroSubMetric}>
            <span className={styles.heroSubLabel}>Índice de Mora</span>
            <span className={styles.heroSubVal}>
              {loading ? '—' : `${data?.delinquency_rate || 0}%`}
            </span>
          </div>
        </div>
      </section>

      {/* Grid de Contenido: Cobros de Hoy (Izq) + Semáforo de Riesgo (Der) */}
      <div className={styles.mainGrid}>
        {/* Columna 1: Cobros de Hoy y Prioritarios (Estilo Filas de Talonario) */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Cobranza de Hoy & Prioridades</h2>
              <span className={styles.sectionSubtitle}>
                Cuotas programadas y seguimiento de la jornada
              </span>
            </div>
          </div>

          <div className={styles.paymentsStack}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#64748B' }}>
                Cargando cobros del día...
              </div>
            ) : !data?.today_payments || data.today_payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#64748B' }}>
                No hay cobros pendientes programados para hoy.
              </div>
            ) : (
              data.today_payments.map((p) => {
                const isPaid = p.status === 'paid';
                const isToday = p.status === 'today';
                const isMissed = p.status === 'missed';

                const cleanPhone = p.clientPhone ? p.clientPhone.replace(/\D/g, '') : '';

                return (
                  <div
                    key={p.id}
                    className={`${styles.cuotaRow} ${
                      isPaid
                        ? styles.cuotaPaid
                        : isMissed
                        ? styles.cuotaMissed
                        : styles.cuotaToday
                    }`}
                  >
                    <div className={styles.cuotaLeft}>
                      <div
                        className={
                          isPaid
                            ? styles.iconBoxPaid
                            : isMissed
                            ? styles.iconBoxMissed
                            : styles.iconBoxToday
                        }
                      >
                        {isPaid ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B6A30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : isMissed ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B47012" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <polyline points="12 7 12 12 15 15" />
                          </svg>
                        )}
                      </div>

                      <div className={styles.cuotaInfo}>
                        <span className={styles.clientName}>{p.clientName}</span>
                        <span className={styles.cuotaMeta}>
                          Cuota #{p.installmentNumber} · {isPaid ? 'Pagada hoy' : isMissed ? 'Atrasada' : 'Por cobrar hoy'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cuotaRight}>
                      <span className={styles.amountVal}>
                        {formatCurrency(p.amount)}
                      </span>

                      {isPaid ? (
                        <span className={styles.badgePaid}>Cobrada</span>
                      ) : p.clientPhone ? (
                        <a
                          href={`tel:${cleanPhone}`}
                          className={styles.remindBtn}
                          title="Llamar al cliente"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          <span>Llamar</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna 2: Semáforo de Riesgo y Cartera */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Salud de Cartera</h2>
            <span className={styles.sectionSubtitle}>
              {data?.total_clients || 0} clientes activos
            </span>
          </div>

          <div className={styles.riskBox}>
            {/* Al día */}
            <div className={styles.riskItem}>
              <div className={styles.riskTop}>
                <span style={{ color: '#0B6A30' }}>● Al Día</span>
                <span>{data?.risk_distribution.green || 0} clientes</span>
              </div>
              <div className={styles.riskTrack}>
                <div
                  className={styles.riskFill}
                  style={{
                    backgroundColor: '#10B981',
                    width: `${
                      data && data.total_clients > 0
                        ? Math.round(
                            (data.risk_distribution.green / data.total_clients) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* En Alerta */}
            <div className={styles.riskItem}>
              <div className={styles.riskTop}>
                <span style={{ color: '#B45309' }}>● En Alerta (1-2 cuotas)</span>
                <span>{data?.risk_distribution.yellow || 0} clientes</span>
              </div>
              <div className={styles.riskTrack}>
                <div
                  className={styles.riskFill}
                  style={{
                    backgroundColor: '#F59E0B',
                    width: `${
                      data && data.total_clients > 0
                        ? Math.round(
                            (data.risk_distribution.yellow / data.total_clients) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* En Mora */}
            <div className={styles.riskItem}>
              <div className={styles.riskTop}>
                <span style={{ color: '#DC2626' }}>● Mora Crítica (3+ cuotas)</span>
                <span>{data?.risk_distribution.red || 0} clientes</span>
              </div>
              <div className={styles.riskTrack}>
                <div
                  className={styles.riskFill}
                  style={{
                    backgroundColor: '#EF4444',
                    width: `${
                      data && data.total_clients > 0
                        ? Math.round(
                            (data.risk_distribution.red / data.total_clients) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Resumen Operativo */}
          <div className={styles.summaryRow}>
            <div className={styles.summaryWidget}>
              <span className={styles.summaryWidgetLabel}>Préstamos Activos</span>
              <span className={styles.summaryWidgetVal}>
                {loading ? '—' : data?.total_active_loans || 0}
              </span>
            </div>

            <div className={styles.summaryWidget}>
              <span className={styles.summaryWidgetLabel}>Total Prestatarios</span>
              <span className={styles.summaryWidgetVal}>
                {loading ? '—' : data?.total_clients || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className={styles.bottomActions}>
        <Link href="/loans" className={styles.primaryActionBtn}>
          <span style={{ fontSize: '1.1rem' }}>+</span>
          <span>Nuevo Préstamo</span>
        </Link>

        <Link href="/clients" className={styles.secondaryActionBtn}>
          <span>Registrar Cliente</span>
        </Link>

        <Link href="/routes" className={styles.secondaryActionBtn}>
          <span>Modo Cobrador / Rutas</span>
        </Link>
      </div>
    </div>
  );
}
