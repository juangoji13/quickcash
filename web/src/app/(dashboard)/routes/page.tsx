'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import {
  getCollectionRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  addClientToRoute,
  removeClientFromRoute,
  getUnassignedClients,
  getRouteActiveChecklist,
  closeRouteRecord,
  getRouteClosures,
  verifyRouteClosure,
  type RouteClosureDetail,
} from '@/services/collection-routes.service';
import { getCollectors } from '@/services/collectors.service';
import { registerPayment } from '@/services/loans.service';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getRiskBadgeClass, getRiskLabel, getInitials } from '@/lib/utils';
import type { CollectionRouteWithDetails, User } from '@/types';
import { Modal, ConfirmModal, PromptModal, AlertModal } from '@/components/ui/Modal';
import styles from './routes.module.css';

type ViewMode = 'list' | 'create' | 'detail';

const ROUTE_COLORS = ['#F1C40F','#E67E22','#E74C3C','#8E44AD','#2980B9','#1ABC9C','#27AE60','#2C3E50'];

export default function RoutesPage() {
  const { appUser } = useAuth();
  const [routes, setRoutes] = useState<CollectionRouteWithDetails[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedRoute, setSelectedRoute] = useState<CollectionRouteWithDetails | null>(null);

  // Tab navigation in list view: 'routes' | 'closures'
  const [mainTab, setMainTab] = useState<'routes' | 'closures'>('routes');
  const [closures, setClosures] = useState<RouteClosureDetail[]>([]);
  const [loadingClosures, setLoadingClosures] = useState(false);

  // Reconciliation modal state
  const [reconcileTarget, setReconcileTarget] = useState<RouteClosureDetail | null>(null);
  const [physicalCash, setPhysicalCash] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Active Route checklist
  const [activeChecklist, setActiveChecklist] = useState<any[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  const [unassignedClients, setUnassignedClients] = useState<any[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  // Modals
  const [deleteRouteTarget, setDeleteRouteTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeClientTarget, setRemoveClientTarget] = useState<{ id: string; name: string } | null>(null);
  const [payTarget, setPayTarget] = useState<{ id: string; client_name: string; amount: number; isFull: boolean } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingRoute, setClosingRoute] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  // Load Data [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  // Create form
  const [formName, setFormName] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formCollector, setFormCollector] = useState('');
  const [formColor, setFormColor] = useState(ROUTE_COLORS[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Route state
  const [routeStarted, setRouteStarted] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [unassigned, setUnassigned] = useState<{ id: string; full_name: string; document_id: string; phone: string | null }[]>([]);
  const [showCollectorPicker, setShowCollectorPicker] = useState(false);

  const loadClosures = useCallback(async () => {
    if (!appUser) return;
    setLoadingClosures(true);
    const closuresData = await getRouteClosures(appUser.tenant_id);
    setClosures(closuresData);
    setLoadingClosures(false);
  }, [appUser]);

  const loadData = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    const [routesData, collectorsData, closuresData] = await Promise.all([
      getCollectionRoutes(appUser.tenant_id),
      getCollectors(appUser.tenant_id),
      getRouteClosures(appUser.tenant_id),
    ]);
    setRoutes(routesData);
    setCollectors(collectorsData);
    setClosures(closuresData);
    setLoading(false);
  }, [appUser]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser || !formName.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true); setFormError('');
    const { error } = await createRoute({
      tenant_id: appUser.tenant_id,
      name: formName.trim(),
      zone: formZone || undefined,
      collector_id: formCollector || undefined,
      color: formColor,
      notes: formNotes || undefined,
    });
    if (error) { setFormError(error); }
    else { setView('list'); resetForm(); loadData(); }
    setSaving(false);
  }

  async function confirmDeleteRoute() {
    if (!deleteRouteTarget) return;
    const { id } = deleteRouteTarget;
    
    // UI Optimista
    setRoutes(prev => prev.filter(r => r.id !== id));
    if (selectedRoute?.id === id) { setView('list'); setSelectedRoute(null); }
    setDeleteRouteTarget(null);
    
    if (!appUser) return;
    const { error } = await deleteRoute(id, appUser.tenant_id);
    if (error) {
      setErrorAlert(`Error al eliminar la ruta: ${error}`);
      loadData(); // Revertir en caso de error
    }
  }

  function handleDelete(id: string, name: string) {
    setDeleteRouteTarget({ id, name });
  }

  async function handleAssignCollector(collectorId: string) {
    if (!selectedRoute || !appUser) return;
    const { error } = await updateRoute(selectedRoute.id, appUser.tenant_id, { collector_id: collectorId || undefined });
    if (error) setErrorAlert(`Error: ${error}`);
    else {
      setShowCollectorPicker(false);
      await refreshRouteDetail();
    }
  }

  async function openDetail(route: CollectionRouteWithDetails) {
    setSelectedRoute(route);
    setView('detail');
    setShowAssign(false);
    setShowCollectorPicker(false);
    setRouteStarted(false);
  }

  async function openAssign() {
    if (!appUser) return;
    const data = await getUnassignedClients(appUser.tenant_id);
    setUnassigned(data);
    setShowAssign(true);
  }

  async function handleAssignClient(clientId: string) {
    if (!selectedRoute || !appUser) return;
    const { error } = await addClientToRoute(clientId, selectedRoute.id, appUser.tenant_id);
    if (error) {
      setErrorAlert(`Error al asignar cliente: ${error}`);
      return;
    }
    setUnassigned(prev => prev.filter(c => c.id !== clientId));
    await refreshRouteDetail();
  }

  async function confirmRemoveClient() {
    if (!removeClientTarget || !selectedRoute) return;
    const clientId = removeClientTarget.id;
    
    // UI Optimista
    setSelectedRoute(prev => prev ? { ...prev, clients: (prev.clients || []).filter(c => c.id !== clientId) } : null);
    setRoutes(prev => prev.map(r => r.id === selectedRoute.id ? { ...r, clients: (r.clients || []).filter((c: any) => c.id !== clientId) } : r));
    setRemoveClientTarget(null);
    
    if (!appUser) return;
    const { error } = await removeClientFromRoute(clientId, appUser.tenant_id);
    if (error) {
      setErrorAlert(`Error al quitar cliente: ${error}`);
      refreshRouteDetail(); // Revertir en caso de error
    }
  }

  function handleRemoveClient(clientId: string, clientName: string) {
    setRemoveClientTarget({ id: clientId, name: clientName });
  }

  async function refreshRouteDetail() {
    if (!appUser) return;
    const updatedRoutes = await getCollectionRoutes(appUser.tenant_id);
    setRoutes(updatedRoutes);
    if (selectedRoute) {
      const r = updatedRoutes.find(r => r.id === selectedRoute.id);
      if (r) setSelectedRoute(r);
    }
  }

  function resetForm() {
    setFormName(''); setFormZone(''); setFormCollector('');
    setFormColor(ROUTE_COLORS[0]); setFormNotes(''); setFormError('');
  }

  async function handleStartRoute() {
    if (!selectedRoute || !appUser) return;
    setRouteStarted(true);
    setLoadingChecklist(true);
    const list = await getRouteActiveChecklist(selectedRoute.id, appUser.tenant_id);
    setActiveChecklist(list);
    
    // Set default values to the expected quota
    const defaults: Record<string, string> = {};
    list.forEach(i => {
      if (i) defaults[i.client_id] = i.expectedQuota.toString();
    });
    setPaymentAmounts(defaults);
    setLoadingChecklist(false);
  }

  async function handleCloseRoute() {
    if (!selectedRoute || !appUser) return;
    setClosingRoute(true);
    try {
      const collectorId = selectedRoute.collector?.id || (selectedRoute as any).collector_id || appUser.id;
      const totalCollected = selectedRoute.total_collected_today || 0;
      const totalExpected = selectedRoute.total_daily_quota || 0;

      const res = await closeRouteRecord(
        appUser.tenant_id,
        selectedRoute.id,
        collectorId,
        totalCollected,
        totalExpected
      );

      if (res.success) {
        setRouteStarted(false);
        setShowCloseModal(false);
        await Promise.all([refreshRouteDetail(), loadClosures()]);
      } else {
        console.error('Error al registrar cierre de ruta:', res.error);
      }
    } catch (err) {
      console.error('Error al cerrar ruta:', err);
    } finally {
      setClosingRoute(false);
    }
  }

  function openReconcileModal(closure: RouteClosureDetail) {
    setReconcileTarget(closure);
    setPhysicalCash(closure.total_collected.toString());
    setReconcileNotes(closure.notes || '');
  }

  async function handleConfirmReconcile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!reconcileTarget || !appUser) return;
    const amount = parseFloat(physicalCash);
    if (isNaN(amount) || amount < 0) {
      setErrorAlert('Monto de efectivo físico inválido. Ingresa un número mayor o igual a 0.');
      return;
    }
    setReconciling(true);
    try {
      const res = await verifyRouteClosure(
        reconcileTarget.id,
        appUser.tenant_id,
        amount,
        reconcileNotes.trim() || undefined
      );
      if (res.success) {
        setReconcileTarget(null);
        await loadClosures();
      } else {
        setErrorAlert(res.error || 'Error al conciliar arqueo de ruta');
      }
    } catch (err: any) {
      setErrorAlert(err?.message || 'Error al procesar la conciliación');
    } finally {
      setReconciling(false);
    }
  }

  function initPayment(item: any, isFull: boolean = false) {
    setPayTarget({ id: item.payment_id, client_name: item.client?.full_name || 'Cliente', amount: item.expectedQuota, isFull });
  }

  async function confirmRegisterPayment(amountStr: string) {
    if (!payTarget || !appUser) return;
    const { id } = payTarget;
    
    // If not full payment, use the provided amount.
    let amt = parseFloat(amountStr);
    if (isNaN(amt) || amt < 0) {
      setErrorAlert('Monto inválido. Ingresa un número positivo.');
      return;
    }

    const { success, error } = await registerPayment(id, appUser.tenant_id, amt);
    if (!success) {
      setErrorAlert(`Error al registrar cobro: ${error}`);
      return;
    }

    setPayTarget(null);

    // Update UI marking as paid
    setActiveChecklist(prev => prev.map(p => p.payment_id === id ? { ...p, paid: true } : p));
    
    // Update KPI Header in real time
    setSelectedRoute(prev => prev ? {
      ...prev,
      total_collected_today: (prev.total_collected_today || 0) + amt
    } : null);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {view === 'list'
              ? (mainTab === 'routes' ? 'Rutas de Cobro' : 'Cierres y Arqueos Diarios')
              : view === 'create'
              ? 'Nueva Ruta'
              : selectedRoute?.name}
          </h2>
          <p className={styles.subtitle}>
            {view === 'list'
              ? (mainTab === 'routes'
                  ? `${routes.length} rutas configuradas`
                  : `${closures.length} cierres registrados en el sistema`)
              : view === 'create'
              ? 'Configura los datos de la ruta'
              : `${selectedRoute?.clients?.length || 0} clientes · ${selectedRoute?.collector?.full_name || 'Sin cobrador'}`}
          </p>
        </div>
        <div className={styles.headerBtns}>
          {view === 'list' && mainTab === 'routes' && (
            <button className={`btn btn--primary`} onClick={() => setView('create')}>
              + Nueva Ruta
            </button>
          )}
          {view === 'list' && mainTab === 'closures' && (
            <button className="btn btn--ghost" onClick={loadClosures} disabled={loadingClosures}>
              {loadingClosures ? 'Actualizando...' : '↻ Actualizar Arqueos'}
            </button>
          )}
          {view !== 'list' && (
            <button className="btn btn--ghost" onClick={() => { setView('list'); setSelectedRoute(null); setRouteStarted(false); }}>
              ← Volver
            </button>
          )}
        </div>
      </div>

      {/* Tabs in List View */}
      {view === 'list' && (
        <div className={styles.tabSwitch}>
          <button
            type="button"
            className={`${styles.tabBtn} ${mainTab === 'routes' ? styles.tabBtnActive : ''}`}
            onClick={() => setMainTab('routes')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></svg>
            <span>Rutas de Cobro</span>
            <span className={styles.tabBadge}>{routes.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${mainTab === 'closures' ? styles.tabBtnActive : ''}`}
            onClick={() => { setMainTab('closures'); loadClosures(); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span>Cierres y Arqueos Diarios</span>
            <span className={styles.tabBadge}>{closures.length}</span>
          </button>
        </div>
      )}

      {/* ===== LIST: RUTAS ===== */}
      {view === 'list' && mainTab === 'routes' && (
        loading ? (
          <div className={styles.grid}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{height:180}}/>)}</div>
        ) : routes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></svg>
            </div>
            <h3>Sin rutas de cobro</h3>
            <p>Organiza tus cobros creando tu primera ruta</p>
            <button className="btn btn--primary" style={{marginTop:16}} onClick={() => setView('create')}>+ Crear Ruta</button>
          </div>
        ) : (
          <div className={styles.grid}>
            {routes.map(route => (
              <div key={route.id} className={styles.routeCard} onClick={() => openDetail(route)}>
                <div className={styles.cardTop} style={{background: route.color}}>
                  <span className={styles.cardName}>{route.name}</span>
                  {route.zone && <span className={styles.cardZone}>{route.zone}</span>}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardStats}>
                    <div className={styles.cardStat}>
                      <span className={styles.statNum}>{route.clients?.length || 0}</span>
                      <span className={styles.statLbl}>Clientes</span>
                    </div>
                    <div className={styles.cardStat}>
                      <span className={styles.statNum}>{formatCurrency(route.total_daily_quota || 0)}</span>
                      <span className={styles.statLbl}>Cuota Total</span>
                    </div>
                    <div className={styles.cardStat}>
                      <span className={styles.statNum}>{formatCurrency(route.total_collected_today || 0)}</span>
                      <span className={styles.statLbl}>Recaudado</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardCollector}>
                      {route.collector?.full_name || 'Sin cobrador asignado'}
                    </span>
                    <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(route.id, route.name); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ===== LIST: CIERRES Y ARQUEOS DIARIOS ===== */}
      {view === 'list' && mainTab === 'closures' && (
        loadingClosures ? (
          <div className={styles.closuresCard} style={{ padding: 'var(--space-6)' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 12 }} />)}
          </div>
        ) : closures.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h3>Sin arqueos ni cierres de ruta</h3>
            <p>Cuando los cobradores registren el cierre de su jornada, aparecerán aquí para conciliar caja física contra el recaudo digital.</p>
          </div>
        ) : (
          <div className={styles.closuresCard}>
            <div className={styles.closuresTableWrapper}>
              <table className={styles.closuresTable}>
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Cobrador</th>
                    <th style={{ textAlign: 'right' }}>Total Esperado</th>
                    <th style={{ textAlign: 'right' }}>Recaudado</th>
                    <th>Efectividad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map(c => {
                    const isVerified = c.status === 'verified';
                    const rateColor = c.effectiveness_rate >= 90 ? 'var(--color-green)' : c.effectiveness_rate >= 70 ? 'var(--color-safety-yellow)' : 'var(--color-red)';
                    const timePart = c.closure_date ? new Date(c.closure_date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

                    return (
                      <tr key={c.id}>
                        <td>
                          <span className={styles.closureDate}>{formatDate(c.closure_date)}</span>
                          <span className={styles.closureTime}>{timePart}</span>
                        </td>
                        <td>
                          <div className={styles.collectorCell}>
                            <div className={styles.collectorMiniAvatar}>{getInitials(c.collector_name)}</div>
                            <div className={styles.collectorMeta}>
                              <span style={{ fontWeight: 600 }}>{c.collector_name}</span>
                              {c.collector_username && <span className={styles.collectorUsername}>@{c.collector_username}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={styles.numCell}>{formatCurrency(c.total_expected)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={styles.numCell}>{formatCurrency(c.total_collected)}</span>
                        </td>
                        <td>
                          <div className={styles.rateCell}>
                            <div className={styles.rateProgress}>
                              <div className={styles.rateProgressBar} style={{ width: `${Math.min(100, Math.max(0, c.effectiveness_rate))}%`, backgroundColor: rateColor }} />
                            </div>
                            <span>{c.effectiveness_rate}%</span>
                          </div>
                        </td>
                        <td>
                          {isVerified ? (
                            <span className={styles.statusBadgeVerified}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Verificado
                            </span>
                          ) : (
                            <span className={styles.statusBadgeClosed}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              Cerrado
                            </span>
                          )}
                        </td>
                        <td>
                          {isVerified ? (
                            <button
                              type="button"
                              className={styles.reconcileBtnVerified}
                              onClick={() => openReconcileModal(c)}
                              title="Revisar o actualizar arqueo verificado"
                            >
                              Revisar Arqueo
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.reconcileBtn}
                              onClick={() => openReconcileModal(c)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                              Conciliar Caja
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ===== CREATE ===== */}
      {view === 'create' && (
        <div className={styles.createCard}>
          {formError && <div className={styles.alert}>{formError}</div>}
          <form onSubmit={handleCreate}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Nombre *</label>
                <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ej: Ruta Centro" required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Zona / Sector</label>
                <input className="input" value={formZone} onChange={e => setFormZone(e.target.value)} placeholder="Ej: Barrio Centro" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Cobrador</label>
                <select className="input" value={formCollector} onChange={e => setFormCollector(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {collectors.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <div className={styles.colorRow}>
                  {ROUTE_COLORS.map(c => (
                    <button key={c} type="button" className={`${styles.colorDot} ${formColor === c ? styles.colorActive : ''}`} style={{background:c}} onClick={() => setFormColor(c)} />
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notas</label>
              <textarea className="input" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notas opcionales..." rows={2} />
            </div>
            <div className={styles.formFooter}>
              <button type="button" className="btn btn--ghost" onClick={() => { setView('list'); resetForm(); }}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Ruta'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ===== DETAIL ===== */}
      {view === 'detail' && selectedRoute && (
        <div className={styles.detail}>
          {/* Route Info Bar */}
          <div className={styles.infoBar} style={{borderColor: selectedRoute.color}}>
            <div className={styles.infoLeft}>
              <div className={styles.infoDot} style={{background: selectedRoute.color}} />
              <div>
                <h3 className={styles.infoName}>{selectedRoute.name}</h3>
                {selectedRoute.zone && <span className={styles.infoZone}>{selectedRoute.zone}</span>}
              </div>
            </div>
            <div className={styles.infoStats}>
              <div className={styles.infoStat}>
                <span className={styles.infoNum}>{selectedRoute.clients?.length || 0}</span>
                <span className={styles.infoLbl}>Clientes</span>
              </div>
              <div className={styles.infoStat}>
                <span className={styles.infoNum}>{formatCurrency(selectedRoute.total_daily_quota || 0)}</span>
                <span className={styles.infoLbl}>Cuota Total</span>
              </div>
              <div className={styles.infoStat}>
                <span className={styles.infoNum}>{formatCurrency(selectedRoute.total_collected_today || 0)}</span>
                <span className={styles.infoLbl}>Recaudado</span>
              </div>
            </div>
          </div>

          {/* Collector Assignment */}
          <div className={styles.collectorSection}>
            <div className={styles.collectorRow}>
              <div className={styles.collectorInfo}>
                <span className={styles.collectorLabel}>Cobrador Asignado</span>
                <span className={styles.collectorName}>{selectedRoute.collector?.full_name || 'Ninguno'}</span>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowCollectorPicker(!showCollectorPicker)}>
                {selectedRoute.collector ? 'Cambiar' : 'Asignar'}
              </button>
            </div>
            {showCollectorPicker && (
              <div className={styles.pickerList}>
                {collectors.map(c => (
                  <button key={c.id} className={`${styles.pickerItem} ${selectedRoute.collector?.id === c.id ? styles.pickerItemActive : ''}`} onClick={() => handleAssignCollector(c.id)}>
                    <span className={styles.pickerAvatar}>{c.full_name.charAt(0)}</span>
                    <div className={styles.pickerInfo}>
                      <span className={styles.pickerName}>{c.full_name}</span>
                      <span className={styles.pickerEmail}>{c.email}</span>
                    </div>
                    {selectedRoute.collector?.id === c.id && <span className={styles.pickerCheck}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Route Operations */}
          <div className={styles.opsSection}>
            {!routeStarted ? (
              <button className={`btn btn--primary btn--lg ${styles.startBtn}`} onClick={handleStartRoute} disabled={!selectedRoute.clients?.length}>
                Comenzar Ruta
              </button>
            ) : (
              <div className={styles.activeRoute}>
                <div className={styles.activeBanner}>
                  <span className={styles.activeDot} />
                  <span>Ruta en curso</span>
                </div>
                <button className={`btn btn--dark btn--lg`} onClick={() => setShowCloseModal(true)} disabled={closingRoute}>
                  {closingRoute ? 'Cerrando...' : 'Cerrar Ruta'}
                </button>
              </div>
            )}
          </div>

          {/* Client List or Operational Checklist */}
          {!routeStarted ? (
            <>
              <div className={styles.clientsHeader}>
                <h4 className={styles.sectionTitle}>Clientes ({selectedRoute.clients?.length || 0})</h4>
                <button className="btn btn--ghost btn--sm" onClick={openAssign}>+ Agregar</button>
              </div>

              {/* Assign Panel */}
              {showAssign && (
                <div className={styles.assignPanel}>
                  <div className={styles.assignHead}>
                    <span className={styles.assignTitle}>Clientes disponibles</span>
                    <button className={styles.closeBtn} onClick={() => setShowAssign(false)}>✕</button>
                  </div>
                  {unassigned.length === 0 ? (
                    <p className={styles.assignEmpty}>Todos los clientes ya están asignados</p>
                  ) : (
                    <div className={styles.assignList}>
                      {unassigned.map(c => (
                        <div key={c.id} className={styles.assignRow}>
                          <div className={styles.assignInfo}>
                            <span className={styles.assignName}>{c.full_name}</span>
                            <span className={styles.assignMeta}>CC {c.document_id}</span>
                          </div>
                          <button className="btn btn--primary btn--sm" onClick={() => handleAssignClient(c.id)}>Agregar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Client Rows */}
              {(!selectedRoute.clients || selectedRoute.clients.length === 0) ? (
                <div className={styles.emptyClients}>
                  <p>Agrega clientes a esta ruta para comenzar</p>
                  <button className="btn btn--ghost btn--sm" onClick={openAssign}>+ Agregar cliente</button>
                </div>
              ) : (
                <div className={styles.clientList}>
                  {selectedRoute.clients.map((client, idx) => (
                    <div key={client.id} className={styles.clientRow}>
                      <span className={styles.clientNum}>{idx + 1}</span>
                      <div className={styles.clientAvatar}>{getInitials(client.full_name)}</div>
                      <div className={styles.clientInfo}>
                        <span className={styles.clientName}>{client.full_name}</span>
                        <span className={styles.clientMeta}>CC {client.document_id}{client.phone ? ` · ${client.phone}` : ''}</span>
                      </div>
                      <span className={getRiskBadgeClass(client.risk_status)}>{getRiskLabel(client.risk_status)}</span>
                      <button className={styles.removeBtn} onClick={() => handleRemoveClient(client.id, client.full_name)} title="Quitar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.activeRouteMode}>
               <div className={styles.clientsHeader}>
                 <h4 className={styles.sectionTitle}>Cobros Pendientes ({activeChecklist.filter(i => !i.paid).length})</h4>
               </div>
               
               {loadingChecklist ? (
                 <div className="skeleton" style={{height: 120}} />
               ) : activeChecklist.length === 0 ? (
                 <div className={styles.emptyClients}>
                   <p>No hay cuotas pendientes por cobrar hoy en esta ruta.</p>
                 </div>
               ) : (
                 <div className={styles.checklist}>
                   {activeChecklist.map((item, idx) => (
                     <div key={item.client_id} className={`${styles.checkItem} ${item.paid ? styles.checkItemPaid : ''}`}>
                       <span className={styles.clientNum}>{idx + 1}</span>
                       <div className={styles.clientAvatar}>{getInitials(item.client_name)}</div>
                       <div className={styles.checkInfo}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className={styles.checkName}>{item.client_name}</span>
                            {item.latitude && item.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.gpsLink}
                                title={`Ver auditoría de visita GPS (${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)})`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg className={styles.gpsIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>GPS</span>
                              </a>
                            )}
                          </div>
                          <span className={styles.checkMeta}>
                            Cuota {item.installment_number} · Esperado: <b>{formatCurrency(item.expectedQuota)}</b>
                          </span>
                       </div>
                       
                       {!item.paid ? (
                         <div className={styles.checkAction}>
                            <div className={styles.inputWrapper}>
                              <span className={styles.inputPrefix}>$</span>
                              <input 
                                type="number" 
                                className={styles.payInput} 
                                value={paymentAmounts[item.client_id] || ''} 
                                onChange={e => setPaymentAmounts(prev => ({...prev, [item.client_id]: e.target.value}))}
                                placeholder="0"
                              />
                            </div>
                            <button className="btn btn--sm btn--primary" onClick={() => initPayment(item, true)}>
                            Ok Completo
                          </button>
                          <button className="btn btn--sm btn--ghost" onClick={() => initPayment(item, false)}>
                            Abonar
                          </button>
                         </div>
                       ) : (
                         <div className={styles.paidBadge}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Cobrado
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteRouteTarget}
        onClose={() => setDeleteRouteTarget(null)}
        onConfirm={confirmDeleteRoute}
        title="Eliminar Ruta"
        message={`¿Estás seguro de que deseas eliminar la ruta "${deleteRouteTarget?.name}"? Esta acción desasignará a los clientes y no se puede deshacer.`}
        isDestructive={true}
      />
      <ConfirmModal
        isOpen={!!removeClientTarget}
        onClose={() => setRemoveClientTarget(null)}
        onConfirm={confirmRemoveClient}
        title="Quitar Cliente"
        message={`¿Estás seguro de que deseas quitar a "${removeClientTarget?.name}" de esta ruta?`}
        isDestructive={true}
      />
      <PromptModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={confirmRegisterPayment}
        title={payTarget?.isFull ? "Confirmar Pago Completo" : "Registrar Abono"}
        label={`Monto a cobrar a ${payTarget?.client_name}`}
        placeholder="Ej. 10000"
        defaultValue={payTarget?.amount.toString()}
        type="number"
      />
      <ConfirmModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleCloseRoute}
        title="Cerrar Ruta"
        message={`¿Estás seguro de que deseas cerrar la ruta "${selectedRoute?.name}"? Recaudo registrado hoy: ${formatCurrency(selectedRoute?.total_collected_today || 0)}.`}
      />
      {/* ===== MODAL: CONCILIAR CAJA Y ARQUEO DE RUTA ===== */}
      <Modal
        isOpen={!!reconcileTarget}
        onClose={() => { if (!reconciling) setReconcileTarget(null); }}
        title="Conciliar Caja y Arqueo de Ruta"
        width="520px"
      >
        {reconcileTarget && (
          <form onSubmit={handleConfirmReconcile} className={styles.reconcileForm}>
            <div className={styles.reconcileHero}>
              <span className={styles.reconcileHeroLbl}>Monto Recaudado por Sistema (Efectivo)</span>
              <span className={styles.reconcileHeroAmt}>{formatCurrency(reconcileTarget.total_collected)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--color-gray-400)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Cobrador</span>
                <b>{reconcileTarget.collector_name}</b>
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-400)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Fecha Cierre</span>
                <b className="tabular-nums">{formatDateTime(reconcileTarget.closure_date)}</b>
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-400)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Esperado</span>
                <b className="tabular-nums">{formatCurrency(reconcileTarget.total_expected)}</b>
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-400)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Efectividad</span>
                <b className="tabular-nums">{reconcileTarget.effectiveness_rate}%</b>
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: '8px' }}>
              <label className={styles.label}>Efectivo Físico Contado ($ COP) *</label>
              <input
                type="number"
                className={`input ${styles.reconcileInput}`}
                value={physicalCash}
                onChange={e => setPhysicalCash(e.target.value)}
                placeholder="0"
                min="0"
                step="100"
                required
                autoFocus
              />
            </div>

            {/* Diferencia Dinámica */}
            {(() => {
              const physical = parseFloat(physicalCash) || 0;
              const diff = physical - reconcileTarget.total_collected;
              if (diff === 0) {
                return (
                  <div className={`${styles.reconcileDiffCard} ${styles.diffExact}`}>
                    <span>✓ Cuadre Exacto de Caja</span>
                    <span>$0</span>
                  </div>
                );
              } else if (diff > 0) {
                return (
                  <div className={`${styles.reconcileDiffCard} ${styles.diffSurplus}`}>
                    <span>▲ Sobrante en Caja</span>
                    <span>+{formatCurrency(diff)}</span>
                  </div>
                );
              } else {
                return (
                  <div className={`${styles.reconcileDiffCard} ${styles.diffShortage}`}>
                    <span>▼ Faltante en Caja</span>
                    <span>-{formatCurrency(Math.abs(diff))}</span>
                  </div>
                );
              }
            })()}

            <div className={styles.field}>
              <label className={styles.label}>Notas de Conciliación / Observaciones</label>
              <textarea
                className="input"
                value={reconcileNotes}
                onChange={e => setReconcileNotes(e.target.value)}
                placeholder="Detalles sobre billetes contados, novedades o justificación de diferencias..."
                rows={2}
              />
            </div>

            <div className={styles.reconcileModalBtns}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setReconcileTarget(null)}
                disabled={reconciling}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={reconciling}
                style={{ minWidth: '180px' }}
              >
                {reconciling ? 'Verificando...' : 'Verificar y Conciliar'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <AlertModal
        isOpen={!!errorAlert}
        onClose={() => setErrorAlert(null)}
        title="Error"
        message={errorAlert}
        isError={true}
      />
    </div>
  );
}
