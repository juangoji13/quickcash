'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import { getDashboardKPIs, getUpcomingPayments } from '@/services/dashboard.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardKPIs } from '@/types';
import styles from './overview.module.css';

interface UpcomingPayment {
  id: string;
  amount: number;
  date: string;
  clientName: string;
  status: string;
  isOverdue?: boolean;
}

export default function OverviewPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin') {
      router.replace('/superadmin');
    }
  }, [appUser, router]);

  useEffect(() => {
    async function load() {
      if (!appUser?.tenant_id || appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin') return;
      
      try {
        setLoading(true);
        const [kpiData, upcomingData] = await Promise.all([
          getDashboardKPIs(appUser.tenant_id),
          getUpcomingPayments(appUser.tenant_id)
        ]);
        setKpis(kpiData);
        setUpcoming(upcomingData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appUser?.tenant_id]);

  const firstName = appUser?.full_name?.split(' ')[0] || 'Admin';

  if (appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin') {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.greeting}>
            {getGreeting()}, <span className={styles.name}>{firstName}</span>
          </h1>
          <p className={styles.date}>{formatToday()}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <KPICard
          label="Capital en Calle"
          value={loading ? null : formatCurrency(kpis?.capital_in_street || 0)}
          sub={loading ? '—' : `${kpis?.total_active_loans || 0} préstamos activos`}
          accent="var(--color-safety-yellow)"
        />
        <KPICard
          label="Intereses por Cobrar"
          value={loading ? null : formatCurrency(kpis?.interest_receivable || 0)}
          sub="Ganancia calculada"
          accent="var(--color-green)"
        />
        <KPICard
          label="Recaudo del Día"
          value={loading ? null : formatCurrency(kpis?.today_collected || 0)}
          sub={!loading && kpis && kpis.today_expected > 0
            ? `de ${formatCurrency(kpis.today_expected)} esperados hoy`
            : 'Sin cobros pendientes para hoy'}
          accent="var(--color-blue)"
        />
        <KPICard
          label="Índice de Mora"
          value={loading ? null : `${kpis?.delinquency_rate || 0}%`}
          sub={loading ? '—' : `${kpis?.total_clients || 0} clientes registrados`}
          accent="var(--color-red)"
        />
      </div>

      {/* Body Grid */}
      <div className={styles.bodyGrid}>
        {/* Risk */}
        <div className={`card ${styles.sectionCard}`}>
          <h3 className={styles.sectionTitle}>Semáforo de Riesgo</h3>
          {loading ? (
            <div className="skeleton" style={{ height: 100 }} />
          ) : (
            <div className={styles.riskBars}>
              <RiskRow label="Al Día" count={kpis?.risk_distribution.green || 0} total={kpis?.total_clients || 1} color="var(--color-green)" />
              <RiskRow label="Alerta" count={kpis?.risk_distribution.yellow || 0} total={kpis?.total_clients || 1} color="var(--color-yellow)" />
              <RiskRow label="En Mora" count={kpis?.risk_distribution.red || 0} total={kpis?.total_clients || 1} color="var(--color-red)" />
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className={`card ${styles.sectionCard}`}>
          <h3 className={styles.sectionTitle}>Resumen</h3>
          <div className={styles.quickStats}>
            <div className={styles.quickStat}>
              <span className={styles.quickLabel}>Préstamos Activos</span>
              <span className={styles.quickValue}>{loading ? '—' : kpis?.total_active_loans || 0}</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.quickLabel}>Total Clientes</span>
              <span className={styles.quickValue}>{loading ? '—' : kpis?.total_clients || 0}</span>
            </div>
          </div>
        </div>

        {/* Upcoming Collections (Spans full width in bodyGrid) */}
        <div className={`card ${styles.sectionCard} ${styles.spanAll}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Cronograma de Cobros Próximos</h3>
            <span className={styles.sectionSub}>5 próximos cobros pendientes</span>
          </div>
          
          {loading ? (
            <div className={styles.loadingList}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 12, borderRadius: 12 }} />)}
            </div>
          ) : upcoming.length > 0 ? (
            <div className={styles.upcomingList}>
              {upcoming.map((p) => (
                <div key={p.id} className={styles.upcomingItem}>
                  <div className={styles.upcomingClient}>
                    <div className={styles.clientAvatar} style={{ background: p.isOverdue ? '#ef4444' : undefined }}>{p.clientName.charAt(0)}</div>
                    <div className={styles.clientInfo}>
                      <span className={styles.clientName}>{p.clientName}</span>
                      <span className={`${styles.paymentStatus} ${styles[p.status]}`}>
                        {p.isOverdue ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Atrasado
                          </span>
                        ) :
                         p.status === 'missed' ? 'Atrasado' : 
                         p.status === 'partial' ? 'Pago Parcial' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.upcomingDetails}>
                    <span className={styles.paymentAmount}>{formatCurrency(p.amount)}</span>
                    <span className={styles.paymentDate}>{formatDate(p.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCollections}>
              <div className={styles.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p>No hay cobros programados para los próximos 7 días.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
    <div className={styles.actions}>
      <Link href="/loans" className={styles.actionBtn}>
        <span className={styles.actionIcon}>$</span>
        <span>Nuevo Préstamo</span>
      </Link>
      <Link href="/clients" className={styles.actionBtn}>
        <span className={styles.actionIcon}>+</span>
        <span>Nuevo Cliente</span>
      </Link>
    </div>
    </div>
  );
}

/* ---- Helpers ---- */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatToday(): string {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function KPICard({ label, value, sub, accent }: { label: string; value: string | null; sub: string; accent: string }) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-accent': accent } as React.CSSProperties}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>
        {value ?? <span className="skeleton" style={{ width: 100, height: 32, display: 'inline-block' }} />}
      </span>
      <span className={styles.kpiSub}>{sub}</span>
    </div>
  );
}

function RiskRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className={styles.riskRow}>
      <span className={styles.riskDot} style={{ background: color }} />
      <span className={styles.riskLabel}>{label}</span>
      <div className={styles.riskTrack}>
        <div className={styles.riskFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.riskCount} style={{ color }}>{count}</span>
    </div>
  );
}
