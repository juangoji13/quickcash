'use client';

import { useState, useEffect } from 'react';
import { getCollectorDetail } from '@/services/collectors.service';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import type { CollectorFullDetail } from '@/types';
import styles from './CollectorDetailModal.module.css';

interface CollectorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectorId: string | null;
  tenantId: string | null;
}

type TabType = 'clients' | 'performance' | 'history';

export default function CollectorDetailModal({
  isOpen,
  onClose,
  collectorId,
  tenantId,
}: CollectorDetailModalProps) {
  const [data, setData] = useState<CollectorFullDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('clients');
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (isOpen && collectorId && tenantId) {
      setLoading(true);
      getCollectorDetail(collectorId, tenantId)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setData(null);
      setActiveTab('clients');
      setClientSearch('');
    }
  }, [isOpen, collectorId, tenantId]);

  if (!isOpen) return null;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  const filteredClients = (data?.clients || []).filter(c => 
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.document_id.includes(clientSearch)
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.collectorHeaderProfile}>
            <div className={styles.avatar}>
              {getInitials(data?.user.full_name || 'Cobrador')}
            </div>
            <div className={styles.profileInfo}>
              <h3 className={styles.collectorName}>{data?.user.full_name || 'Cargando cobrador...'}</h3>
              <div className={styles.collectorMeta}>
                {data?.user.username && (
                  <span className={styles.handleBadge}>{data.user.username}</span>
                )}
                <span className={`${styles.roleBadge} ${data?.user.role === 'admin' ? styles.role_admin : styles.role_collector}`}>
                  {data?.user.role === 'admin' ? 'Administrador' : 'Cobrador'}
                </span>
                {data?.user.is_active ? (
                  <span style={{ color: '#16A34A', fontWeight: 700 }}>● Activo</span>
                ) : (
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>● Inactivo</span>
                )}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Route & Quick Contact Banner */}
        {data && (
          <div className={styles.routeBanner}>
            <div className={styles.routeBadge}>
              <span 
                className={styles.routeDot} 
                style={{ backgroundColor: data.assignedRoute?.color || '#3B82F6' }} 
              />
              <span>{data.assignedRoute ? `${data.assignedRoute.name} (${data.assignedRoute.zone || 'Ruta General'})` : 'Sin ruta fija asignada'}</span>
            </div>
            <div className={styles.directActions}>
              {data.user.phone && (
                <>
                  <a
                    href={`https://wa.me/${data.user.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles.actionBtnMini} ${styles.btnWhatsapp}`}
                    title="WhatsApp Cobrador"
                  >
                    💬 WhatsApp
                  </a>
                  <a
                    href={`tel:${data.user.phone}`}
                    className={`${styles.actionBtnMini} ${styles.btnCall}`}
                    title="Llamar Cobrador"
                  >
                    📞 Llamar
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* Segmented Tabs */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'clients' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('clients')}
          >
            👥 Clientes Asignados
            <span className={styles.tabCountBadge}>{data?.clients.length || 0}</span>
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'performance' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('performance')}
          >
            💰 Rendimiento & Caja
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange('history')}
          >
            🧾 Cobros Recientes
            <span className={styles.tabCountBadge}>{data?.recentPayments.length || 0}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
              <div className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
            </div>
          ) : !data ? (
            <div className={styles.emptyState}>No se pudo cargar la información del cobrador.</div>
          ) : activeTab === 'clients' ? (
            /* ---- PESTAÑA 1: CLIENTES ASIGNADOS ---- */
            <div>
              {data.clients.length > 3 && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Filtrar por nombre o cédula..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                  />
                </div>
              )}

              {filteredClients.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Este cobrador no tiene clientes asignados en este momento.</p>
                </div>
              ) : (
                <div className={styles.clientsList}>
                  {filteredClients.map((c) => (
                    <div 
                      key={c.id} 
                      className={`${styles.clientCard} ${
                        c.risk_status === 'green' ? styles.cardRiskGreen :
                        c.risk_status === 'yellow' ? styles.cardRiskYellow : styles.cardRiskRed
                      }`}
                    >
                      <div className={styles.clientMainRow}>
                        <div className={styles.clientIdentity}>
                          <h4 className={styles.clientName}>{c.full_name}</h4>
                          <div className={styles.clientAddress}>
                            <span>📍 {c.address || 'Sin dirección registrada'}</span>
                            {c.phone && <span>· 📞 {c.phone}</span>}
                          </div>
                        </div>
                        <span className={`${styles.clientStatusPill} ${
                          c.risk_status === 'green' ? styles.pillGreen :
                          c.risk_status === 'yellow' ? styles.pillYellow : styles.pillRed
                        }`}>
                          {c.risk_status === 'green' ? 'Al Día' : c.risk_status === 'yellow' ? 'Alerta' : 'En Mora'}
                        </span>
                      </div>

                      {c.active_loan ? (
                        <div className={styles.clientLoanRow}>
                          <div className={styles.loanMetric}>
                            <span className={styles.loanMetricLabel}>Cuota Programada</span>
                            <span className={styles.loanMetricValue}>{formatCurrency(c.active_loan.installment_amount)}</span>
                          </div>
                          <div className={styles.loanMetric}>
                            <span className={styles.loanMetricLabel}>Saldo Deuda</span>
                            <span className={styles.loanMetricValue}>{formatCurrency(c.active_loan.balance)}</span>
                          </div>
                          <div className={styles.loanMetric}>
                            <span className={styles.loanMetricLabel}>Estado Cuota Hoy</span>
                            <span className={`${styles.todayIndicator} ${c.today_payment_status === 'paid' ? styles.todayPaid : styles.todayPending}`}>
                              {c.today_payment_status === 'paid' ? 'Cobrada ✅' : c.today_payment_status === 'missed' ? 'Atrasada ⚠️' : 'Pendiente ⏳'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>
                          Sin crédito activo actualmente
                        </div>
                      )}

                      {c.phone && (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                          <a
                            href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`${styles.actionBtnMini} ${styles.btnWhatsapp}`}
                          >
                            💬 WhatsApp Cliente
                          </a>
                          <a
                            href={`tel:${c.phone}`}
                            className={`${styles.actionBtnMini} ${styles.btnCall}`}
                          >
                            📞 Llamar
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'performance' ? (
            /* ---- PESTAÑA 2: RENDIMIENTO & CAJA ---- */
            <div>
              <div className={styles.performanceGrid}>
                <div className={`${styles.metricTile} ${styles.metricTileHighlight}`}>
                  <span className={styles.metricTileLabel}>Recaudado Hoy</span>
                  <span className={styles.metricTileValue}>{formatCurrency(data.stats.totalCollectedToday)}</span>
                  <span className={styles.metricTileSub}>Ingreso de hoy en caja</span>
                </div>
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>Recaudado Este Mes</span>
                  <span className={styles.metricTileValue}>{formatCurrency(data.stats.totalCollectedMonth)}</span>
                  <span className={styles.metricTileSub}>Acumulado mensual</span>
                </div>
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>Capital en Calle</span>
                  <span className={styles.metricTileValue}>{formatCurrency(data.stats.capitalInStreet)}</span>
                  <span className={styles.metricTileSub}>{data.stats.activeLoansCount} préstamos activos</span>
                </div>
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>Total Histórico Cobrado</span>
                  <span className={styles.metricTileValue}>{formatCurrency(data.stats.totalCollectedAllTime)}</span>
                  <span className={styles.metricTileSub}>Total recaudado</span>
                </div>
              </div>

              {/* Arqueo de Caja / Cierre Diario */}
              <h4 className={styles.sectionTitle}>Arqueo & Cierre de Caja del Día</h4>
              <div className={styles.closureCard}>
                <div className={styles.closureHeader}>
                  <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>Caja de Ruta Diaria</strong>
                  <span className={data.stats.closureStatus === 'closed' ? styles.closureStatusClosed : styles.closureStatusOpen}>
                    {data.stats.closureStatus === 'closed' ? 'Caja Entregada / Cerrada' : 'Caja en Calle (Abierta)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748B' }}>Efectivo reportado hoy:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>{formatCurrency(data.stats.closureAmountToday)}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', lineHeight: 1.4 }}>
                  {data.stats.closureStatus === 'closed' 
                    ? 'El cobrador ya realizó la liquidación de la jornada y entregó el efectivo.'
                    : 'El cobrador tiene la ruta activa y el dinero en efectivo pendiente por liquidar al final de la jornada.'}
                </p>
              </div>

              {/* Indicadores Clave de Riesgo */}
              <h4 className={styles.sectionTitle}>Indicadores de Cartera y Cobranza</h4>
              <div className={styles.breakdownBox}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownRowLabel}>Efectividad de Cobro</span>
                  <span className={styles.breakdownRowValue} style={{ color: '#16A34A' }}>
                    {data.stats.collectionEfficiency}%
                  </span>
                </div>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownRowLabel}>Tasa de Morosidad de Cartera</span>
                  <span className={styles.breakdownRowValue} style={{ color: data.stats.delinquencyRate > 10 ? '#DC2626' : '#16A34A' }}>
                    {data.stats.delinquencyRate}%
                  </span>
                </div>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownRowLabel}>Distribución Semáforo de Riesgo</span>
                  <span className={styles.breakdownRowValue}>
                    🟢 {data.stats.greenClients} Al Día · 🟡 {data.stats.yellowClients} Alerta · 🔴 {data.stats.redClients} Mora
                  </span>
                </div>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownRowLabel}>Último Cobro Registrado</span>
                  <span className={styles.breakdownRowValue} style={{ fontSize: '0.8rem' }}>
                    {data.stats.lastPaymentDate ? formatDate(data.stats.lastPaymentDate) : 'Sin cobros registrados'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ---- PESTAÑA 3: COBROS RECIENTES ---- */
            <div>
              {data.recentPayments.length === 0 ? (
                <div className={styles.emptyState}>No hay cobros registrados por este cobrador.</div>
              ) : (
                <div className={styles.paymentsFeed}>
                  {data.recentPayments.map((p) => (
                    <div key={p.id} className={styles.paymentItem}>
                      <div className={styles.paymentItemInfo}>
                        <span className={styles.paymentClientName}>{p.client_name}</span>
                        <span className={styles.paymentDate}>
                          Cuota #{p.installment_number} · {formatDate(p.paid_date)}
                        </span>
                      </div>
                      <span className={styles.paymentAmount}>
                        +{formatCurrency(p.amount_paid)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
