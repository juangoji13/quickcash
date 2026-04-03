'use client';

import { useEffect, useState } from 'react';
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
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [kpiData, upcomingData] = await Promise.all([
          getDashboardKPIs(),
          getUpcomingPayments()
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
  }, []);

  const firstName = appUser?.full_name?.split(' ')[0] || 'Admin';

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
          sub="Rendimiento esperado"
          accent="var(--color-green)"
        />
        <KPICard
          label="Recaudo del Día"
          value={loading ? null : formatCurrency(kpis?.today_collected || 0)}
          sub={!loading && kpis && kpis.today_expected > 0
            ? `de ${formatCurrency(kpis.today_expected)} esperados`
            : 'Sin cobros programados'}
          accent="var(--color-blue)"
        />
        <KPICard
          label="Índice de Mora"
          value={loading ? null : `${kpis?.delinquency_rate || 0}%`}
          sub={loading ? '—' : `${kpis?.total_clients || 0} clientes`}
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
                        {p.isOverdue ? '⚠️ Atrasado' :
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
              <div className={styles.emptyIcon}>📅</div>
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
