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
} from '@/services/collection-routes.service';
import { getCollectors } from '@/services/collectors.service';
import { registerPayment } from '@/services/loans.service';
import { formatCurrency } from '@/lib/utils';
import { getRiskBadgeClass, getRiskLabel, getInitials } from '@/lib/utils';
import type { CollectionRouteWithDetails, User } from '@/types';
import { ConfirmModal, PromptModal } from '@/components/ui/Modal';
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const [routesData, collectorsData] = await Promise.all([
      getCollectionRoutes(),
      getCollectors(),
    ]);
    setRoutes(routesData);
    setCollectors(collectorsData);
    setLoading(false);
  }, []);

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
    
    const { error } = await deleteRoute(id);
    if (error) {
      alert(`Error al eliminar la ruta: ${error}`);
      loadData(); // Revertir en caso de error
    }
  }

  function handleDelete(id: string, name: string) {
    setDeleteRouteTarget({ id, name });
  }

  async function handleAssignCollector(collectorId: string) {
    if (!selectedRoute) return;
    const { error } = await updateRoute(selectedRoute.id, { collector_id: collectorId || undefined });
    if (error) alert(`Error: ${error}`);
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
    const data = await getUnassignedClients();
    setUnassigned(data);
    setShowAssign(true);
  }

  async function handleAssignClient(clientId: string) {
    if (!selectedRoute) return;
    const { error } = await addClientToRoute(clientId, selectedRoute.id);
    if (error) {
      alert(`Error al asignar cliente: ${error}`);
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
    
    const { error } = await removeClientFromRoute(clientId);
    if (error) {
      alert(`Error al quitar cliente: ${error}`);
      refreshRouteDetail(); // Revertir en caso de error
    }
  }

  function handleRemoveClient(clientId: string, clientName: string) {
    setRemoveClientTarget({ id: clientId, name: clientName });
  }

  async function refreshRouteDetail() {
    const updatedRoutes = await getCollectionRoutes();
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
    if (!selectedRoute) return;
    setRouteStarted(true);
    setLoadingChecklist(true);
    const list = await getRouteActiveChecklist(selectedRoute.id);
    setActiveChecklist(list);
    
    // Set default values to the expected quota
    const defaults: Record<string, string> = {};
    list.forEach(i => {
      if (i) defaults[i.client_id] = i.expectedQuota.toString();
    });
    setPaymentAmounts(defaults);
    setLoadingChecklist(false);
  }

  function handleCloseRoute() {
    alert(`Ruta "${selectedRoute?.name}" cerrada.\nRecaudo total: ${formatCurrency(selectedRoute?.total_collected_today || 0)}`);
    setRouteStarted(false);
    refreshRouteDetail();
  }

  function initPayment(item: any, isFull: boolean = false) {
    setPayTarget({ id: item.payment_id, client_name: item.client?.full_name || 'Cliente', amount: item.expectedQuota, isFull });
  }

  async function confirmRegisterPayment(amountStr: string) {
    if (!payTarget) return;
    const { id, isFull } = payTarget;
    
    // If not full payment, use the provided amount.
    let amt = parseFloat(amountStr);
    if (isNaN(amt) || amt < 0) return alert('Monto inválido');

    const { success, error } = await registerPayment(id, amt);
    if (!success) {
      alert(`Error al registrar: ${error}`);
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
            {view === 'list' ? 'Rutas de Cobro' : view === 'create' ? 'Nueva Ruta' : selectedRoute?.name}
          </h2>
          <p className={styles.subtitle}>
            {view === 'list' ? `${routes.length} rutas configuradas`
              : view === 'create' ? 'Configura los datos de la ruta'
              : `${selectedRoute?.clients?.length || 0} clientes · ${selectedRoute?.collector?.full_name || 'Sin cobrador'}`}
          </p>
        </div>
        <div className={styles.headerBtns}>
          {view === 'list' && (
            <button className={`btn btn--primary`} onClick={() => setView('create')}>
              + Nueva Ruta
            </button>
          )}
          {view !== 'list' && (
            <button className="btn btn--ghost" onClick={() => { setView('list'); setSelectedRoute(null); setRouteStarted(false); }}>
              ← Volver
            </button>
          )}
        </div>
      </div>

      {/* ===== LIST ===== */}
      {view === 'list' && (
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
                <button className={`btn btn--dark btn--lg`} onClick={handleCloseRoute}>
                  Cerrar Ruta
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
                          <span className={styles.checkName}>{item.client_name}</span>
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
    </div>
  );
}
