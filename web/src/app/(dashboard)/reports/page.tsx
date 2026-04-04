'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import { getCollectionReport, getCollectorPerformance, type FinancialReport, type CollectorPerformance } from '@/services/reports.service';
import { formatCurrency } from '@/lib/utils';
import styles from './reports.module.css';

type ReportTab = 'financial' | 'performance';

export default function ReportsPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<ReportTab>('financial');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [performance, setPerformance] = useState<CollectorPerformance[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadReport = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    const [rep, perf] = await Promise.all([
      getCollectionReport(dateFrom, dateTo, appUser.tenant_id),
      getCollectorPerformance(appUser.tenant_id),
    ]);
    setReport(rep);
    setPerformance(perf);
    setLoading(false);
  }, [dateFrom, dateTo, appUser]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Reportes</h2>
          <p className={styles.pageSubtitle}>Análisis financiero y de rendimiento</p>
        </div>
      </div>

      {/* Date Range */}
      <div className={styles.toolbar}>
        <div className={styles.dateRange}>
          <div className={styles.field}>
            <label className="input-label">Desde</label>
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className="input-label">Hasta</label>
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'financial' ? styles.tabActive : ''}`} onClick={() => setTab('financial')}>
            Financiero
          </button>
          <button className={`${styles.tab} ${tab === 'performance' ? styles.tabActive : ''}`} onClick={() => setTab('performance')}>
            Rendimiento
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.gridLoading}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : tab === 'financial' && report ? (
        /* ---- FINANCIAL TAB ---- */
        <>
          <div className={styles.kpiGrid}>
            <KPICard label="Capital Desplegado" value={formatCurrency(report.capital_deployed)} color="#2563EB" />
            <KPICard label="Intereses Generados" value={formatCurrency(report.interest_earned)} color="var(--color-green)" />
            <KPICard label="Total Recaudado" value={formatCurrency(report.total_collected)} color="var(--color-safety-yellow)" />
            <KPICard label="Tasa de Cobro" value={`${report.collection_rate}%`} color={report.collection_rate >= 80 ? 'var(--color-green)' : 'var(--color-red)'} />
          </div>

          <div className={styles.detailGrid}>
            <div className="card">
              <h3 className={styles.sectionTitle}>Movimientos del Periodo</h3>
              <div className={styles.statList}>
                <StatRow label="Nuevos préstamos creados" value={report.new_loans.toString()} />
                <StatRow label="Préstamos completados" value={report.completed_loans.toString()} />
                <StatRow label="Préstamos en mora" value={report.defaulted_loans.toString()} warn={report.defaulted_loans > 0} />
                <StatRow label="Esperado en cobros" value={formatCurrency(report.total_expected)} />
                <StatRow label="Efectivamente cobrado" value={formatCurrency(report.total_collected)} />
                <StatRow label="Diferencia (gap)" value={formatCurrency(report.total_expected - report.total_collected)} warn={report.total_expected - report.total_collected > 0} />
              </div>
            </div>

            <div className="card">
              <h3 className={styles.sectionTitle}>Indicadores Clave</h3>
              <div className={styles.gaugeGrid}>
                <Gauge label="Tasa de Cobro" value={report.collection_rate} max={100} unit="%" color={report.collection_rate >= 80 ? 'var(--color-green)' : 'var(--color-red)'} />
                <Gauge label="ROI del Periodo" value={report.capital_deployed > 0 ? Math.round((report.interest_earned / report.capital_deployed) * 100 * 10) / 10 : 0} max={50} unit="%" color="var(--color-safety-yellow)" />
              </div>
            </div>
          </div>
        </>
      ) : tab === 'performance' ? (
        /* ---- PERFORMANCE TAB ---- */
        performance.length === 0 ? (
          <div className={styles.empty}>
            <span><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
            <h3>Sin datos de rendimiento</h3>
            <p>Asigna cobradores y registra cobros para ver métricas</p>
          </div>
        ) : (
          <div className={styles.perfGrid}>
            {performance.map((p) => (
              <div key={p.collector_id} className={`card ${styles.perfCard}`}>
                <div className={styles.perfHeader}>
                  <h4 className={styles.perfName}>{p.collector_name}</h4>
                  <span className={styles.perfRate} style={{ color: p.collection_rate >= 80 ? 'var(--color-green)' : p.collection_rate >= 50 ? 'var(--color-yellow)' : 'var(--color-red)' }}>
                    {p.collection_rate}%
                  </span>
                </div>
                <div className={styles.perfBar}>
                  <div className={styles.perfBarBg}>
                    <div className={styles.perfBarFill} style={{ width: `${Math.min(p.collection_rate, 100)}%` }} />
                  </div>
                </div>
                <div className={styles.perfStats}>
                  <div><span>Cobrado</span><strong>{formatCurrency(p.total_collected)}</strong></div>
                  <div><span>Esperado</span><strong>{formatCurrency(p.total_expected)}</strong></div>
                  <div><span>Clientes</span><strong>{p.total_clients}</strong></div>
                  <div><span>Préstamos</span><strong>{p.active_loans}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

/* ---- Sub-components ---- */

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={styles.kpiCard} style={{ borderTopColor: color }}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue} style={{ color }}>{value}</span>
    </div>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <strong style={warn ? { color: 'var(--color-red)' } : {}}>{value}</strong>
    </div>
  );
}

function Gauge({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={styles.gauge}>
      <div className={styles.gaugeCircle}>
        <svg viewBox="0 0 36 36">
          <path
            className={styles.gaugeTrack}
            d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
          />
          <path
            className={styles.gaugeFill}
            strokeDasharray={`${pct}, 100`}
            style={{ stroke: color }}
            d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
          />
        </svg>
        <span className={styles.gaugeValue}>{value}{unit}</span>
      </div>
      <span className={styles.gaugeLabel}>{label}</span>
    </div>
  );
}
