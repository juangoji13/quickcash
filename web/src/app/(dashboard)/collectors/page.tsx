'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import {
  getCollectorsWithMetrics,
  updateCollector,
  deleteCollector,
  getInvitations,
  createInvitation,
  deleteInvitation,
} from '@/services/collectors.service';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { ConfirmModal, AlertModal } from '@/components/ui/Modal';
import CollectorDetailModal from '@/components/collectors/CollectorDetailModal';
import type { CollectorWithMetrics, Invitation, User } from '@/types';
import styles from './collectors.module.css';

type Tab = 'team' | 'invitations';

export default function CollectorsPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<Tab>('team');
  const [collectors, setCollectors] = useState<CollectorWithMetrics[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected collector for full detail modal
  const [detailCollectorId, setDetailCollectorId] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<'collector' | 'admin'>('collector');
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState('');

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [collectorToDelete, setCollectorToDelete] = useState<CollectorWithMetrics | null>(null);
  const [isDeletingCollector, setIsDeletingCollector] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!appUser?.tenant_id) return;
    setLoading(true);
    const [colls, invs] = await Promise.all([
      getCollectorsWithMetrics(appUser.tenant_id),
      getInvitations(appUser.tenant_id),
    ]);
    setCollectors(colls);
    setInvitations(invs);
    setLoading(false);
  }, [appUser?.tenant_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Totales de rendimiento del equipo
  const collectorsWithClients = collectors.filter((c) => c.stats.clientsCount > 0);
  const teamStats = {
    totalCollectedToday: collectors.reduce((sum, c) => sum + c.stats.totalCollectedToday, 0),
    totalCapitalInStreet: collectors.reduce((sum, c) => sum + c.stats.capitalInStreet, 0),
    totalClients: collectors.reduce((sum, c) => sum + c.stats.clientsCount, 0),
    avgEfficiency: collectorsWithClients.length > 0
      ? Math.round(
          collectorsWithClients.reduce((sum, c) => sum + c.stats.collectionEfficiency, 0) /
            collectorsWithClients.length
        )
      : 0,
  };

  const filteredCollectors = collectors.filter((c) =>
    c.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.user.username && c.user.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Excluir al prestamista/administrador si no opera como cobrador directo con clientes en calle
  const visibleCollectors = filteredCollectors.filter((c) => {
    if (c.user.id === appUser?.id && c.user.role === 'admin' && c.stats.clientsCount === 0) {
      return false;
    }
    return true;
  });

  async function handleConfirmDeleteCollector() {
    if (!collectorToDelete || !appUser?.tenant_id) return;
    setIsDeletingCollector(true);
    const { success, error } = await deleteCollector(collectorToDelete.user.id, appUser.tenant_id);
    setIsDeletingCollector(false);
    if (!success) {
      setErrorAlert(error || 'No se pudo desvincular al cobrador.');
    } else {
      setCollectorToDelete(null);
      loadData();
    }
  }

  async function handleToggleActive(user: User) {
    if (!appUser?.tenant_id) return;
    const { success, error } = await updateCollector(user.id, appUser.tenant_id, { is_active: !user.is_active });
    if (error) setErrorAlert(`Error al actualizar estado: ${error}`);
    else loadData();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser || !invEmail) return;
    setInvSaving(true);
    setInvError('');
    const { error } = await createInvitation({
      tenant_id: appUser.tenant_id,
      email: invEmail,
      role: invRole,
      invited_by: appUser.id,
    });
    if (error) {
      setInvError(error);
    } else {
      setInvEmail('');
      setShowInvite(false);
      loadData();
    }
    setInvSaving(false);
  }

  function handleDeleteInv(id: string, email: string) {
    setDeleteTarget({ id, email });
  }

  async function confirmDeleteInv() {
    if (!deleteTarget || !appUser?.tenant_id) return;
    await deleteInvitation(deleteTarget.id, appUser.tenant_id);
    setDeleteTarget(null);
    loadData();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Equipo & Cobradores</h2>
          <p className={styles.pageSubtitle}>
            Supervisión en vivo de rendimiento, carteras de clientes y arqueos diarios
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => {
            setShowInvite(!showInvite);
            setTab('invitations');
          }}
        >
          {showInvite ? 'Cerrar' : '+ Invitar Cobrador'}
        </button>
      </div>

      {/* Mini KPIs de Rendimiento del Equipo */}
      <div className={styles.summaryGrid}>
        <div className={`${styles.summaryCard} ${styles.summaryCardHighlight}`}>
          <span className={styles.summaryLabel}>Recaudo Hoy Equipo</span>
          <span className={styles.summaryValue} style={{ color: '#10B981' }}>
            {formatCurrency(teamStats.totalCollectedToday)}
          </span>
          <span className={styles.summarySub}>Ingreso de la jornada</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Capital en Calle</span>
          <span className={styles.summaryValue}>
            {formatCurrency(teamStats.totalCapitalInStreet)}
          </span>
          <span className={styles.summarySub}>Cartera total asignada</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Clientes en Cobro</span>
          <span className={styles.summaryValue}>{teamStats.totalClients}</span>
          <span className={styles.summarySub}>{visibleCollectors.length} cobradores en supervisión</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Efectividad de Cobro</span>
          <span className={styles.summaryValue}>
            {teamStats.totalClients > 0 ? `${teamStats.avgEfficiency}%` : '—'}
          </span>
          <span className={styles.summarySub}>
            {teamStats.totalClients > 0 ? 'Cumplimiento global' : 'Sin clientes asignados'}
          </span>
        </div>
      </div>

      {/* Toolbar: Tabs & Search */}
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`}
            onClick={() => setTab('team')}
          >
            Equipo ({visibleCollectors.length})
          </button>
          <button
            className={`${styles.tab} ${tab === 'invitations' ? styles.tabActive : ''}`}
            onClick={() => setTab('invitations')}
          >
            Invitaciones ({invitations.length})
          </button>
        </div>

        {tab === 'team' && (
          <div className={styles.searchContainer}>
            <div className={styles.searchIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por nombre, @usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && tab === 'invitations' && (
        <div className={`card card--elevated ${styles.inviteForm}`}>
          <h3 className={styles.formTitle}>Invitar Nuevo Cobrador</h3>
          {invError && <div className={styles.formError}>{invError}</div>}
          <form onSubmit={handleInvite} className={styles.formRow}>
            <div className={styles.field}>
              <label className="input-label" htmlFor="invEmail">Email del Cobrador</label>
              <input
                id="invEmail"
                className="input"
                type="email"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="cobrador@email.com"
                required
              />
            </div>
            <div className={styles.field}>
              <label className="input-label" htmlFor="invRole">Rol</label>
              <select
                id="invRole"
                className="input"
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as 'collector' | 'admin')}
              >
                <option value="collector">Cobrador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button type="submit" className="btn btn--primary" disabled={invSaving} style={{ alignSelf: 'flex-end', height: '42px' }}>
              {invSaving ? 'Enviando...' : 'Enviar Invitación'}
            </button>
          </form>
        </div>
      )}

      {/* Contenido Principal */}
      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          ))}
        </div>
      ) : tab === 'team' ? (
        visibleCollectors.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>No se encontraron miembros</h3>
            <p>No hay cobradores que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleCollectors.map((c) => {
              const isAdminOnly = c.user.role === 'admin' && c.stats.clientsCount === 0 && c.stats.capitalInStreet === 0;

              return (
                <div key={c.user.id} className={styles.memberCard}>
                  {/* Header del Miembro */}
                  <div className={styles.memberHeader}>
                    <div className={styles.avatar}>{getInitials(c.user.full_name)}</div>
                    <div className={styles.memberInfo}>
                      <h4 className={styles.memberName}>{c.user.full_name}</h4>
                      <div className={styles.memberMeta}>
                        {c.user.username && (
                          <span style={{ color: '#2563EB', fontWeight: 700 }}>
                            {c.user.username.startsWith('@') ? c.user.username : `@${c.user.username}`}
                          </span>
                        )}
                        <span>·</span>
                        <span className={styles.roleText}>
                          {c.user.role === 'admin' ? 'Administrador' : 'Cobrador'}
                        </span>
                      </div>
                    </div>
                    <span className={c.user.is_active ? styles.statusActive : styles.statusInactive}>
                      {c.user.is_active ? '● Activo' : '● Inactivo'}
                    </span>
                  </div>

                  {isAdminOnly ? (
                    <div className={styles.adminCardBody}>
                      <p className={styles.adminDescText}>
                        Titular de la cuenta y administración general del negocio.
                      </p>
                      <div className={styles.secondaryActions}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {c.user.phone && (
                            <a
                              href={`tel:${c.user.phone}`}
                              className={styles.btnCall}
                              title="Llamar"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                              <span>Llamar</span>
                            </a>
                          )}
                          {c.user.id !== appUser?.id && (
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => handleToggleActive(c.user)}
                              style={{ fontSize: '0.72rem' }}
                            >
                              {c.user.is_active ? 'Pausar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Ruta Asignada */}
                      <div className={styles.routeText}>
                        <span className={styles.routeLabel}>Ruta:</span>
                        <span className={styles.routeName}>
                          {c.assignedRoute
                            ? `${c.assignedRoute.name} (${c.assignedRoute.zone || 'Ruta General'})`
                            : 'Sin ruta fija asignada'}
                        </span>
                      </div>

                      {/* Grid 2x2 de Rendimiento Financiero */}
                      <div className={styles.kpiPreviewGrid}>
                        <div className={styles.kpiPreviewItem}>
                          <span className={styles.kpiPreviewLabel}>Cobrado Hoy</span>
                          <span className={`${styles.kpiPreviewVal} ${c.stats.totalCollectedToday > 0 ? styles.kpiPreviewValHighlight : ''}`}>
                            {formatCurrency(c.stats.totalCollectedToday)}
                          </span>
                        </div>
                        <div className={styles.kpiPreviewItem}>
                          <span className={styles.kpiPreviewLabel}>Cobrado Mes</span>
                          <span className={styles.kpiPreviewVal}>
                            {formatCurrency(c.stats.totalCollectedMonth)}
                          </span>
                        </div>
                        <div className={styles.kpiPreviewItem}>
                          <span className={styles.kpiPreviewLabel}>Capital en Calle</span>
                          <span className={styles.kpiPreviewVal}>
                            {formatCurrency(c.stats.capitalInStreet)}
                          </span>
                        </div>
                        <div className={styles.kpiPreviewItem}>
                          <span className={styles.kpiPreviewLabel}>Clientes / Cartera</span>
                          <span className={styles.kpiPreviewVal}>
                            {c.stats.clientsCount} Clientes
                          </span>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className={styles.cardActions}>
                        <button
                          className={styles.btnViewDetail}
                          onClick={() => setDetailCollectorId(c.user.id)}
                        >
                          <span>Ver Cartera y Rendimiento</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>

                        <div className={styles.secondaryActions}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {c.user.phone && (
                              <a
                                href={`tel:${c.user.phone}`}
                                className={styles.btnCall}
                                title="Llamar al Cobrador"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                                <span>Llamar</span>
                              </a>
                            )}

                            {c.user.id !== appUser?.id && (
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => handleToggleActive(c.user)}
                                style={{ fontSize: '0.72rem' }}
                              >
                                {c.user.is_active ? 'Pausar' : 'Activar'}
                              </button>
                            )}
                          </div>

                          {c.user.id !== appUser?.id && (
                            <button
                              className={styles.btnDeleteCollector}
                              onClick={() => setCollectorToDelete(c)}
                              title="Desvincular cobrador de la organización"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                              </svg>
                              <span>Desvincular</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Pestaña Invitaciones */
        invitations.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h3>Sin invitaciones pendientes</h3>
            <p>Invita a un cobrador con su correo electrónico para darle acceso al equipo.</p>
          </div>
        ) : (
          <div className={styles.invList}>
            {invitations.map((inv) => (
              <div key={inv.id} className={styles.invCard}>
                <div className={styles.invInfo}>
                  <strong>{inv.email}</strong>
                  <span className={styles.invMeta}>
                    {inv.role === 'admin' ? 'Administrador' : 'Cobrador'} · Enviada: {formatDate(inv.created_at)}
                  </span>
                </div>
                <div className={styles.invActions}>
                  <span className={`${styles.invStatus} ${styles[`inv_${inv.status}`]}`}>
                    {inv.status === 'pending' ? 'Pendiente' : inv.status === 'accepted' ? 'Aceptada' : 'Expirada'}
                  </span>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDeleteInv(inv.id, inv.email)}
                    title="Eliminar invitación"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal de Detalle Completo del Cobrador */}
      <CollectorDetailModal
        isOpen={!!detailCollectorId}
        onClose={() => setDetailCollectorId(null)}
        collectorId={detailCollectorId}
        tenantId={appUser?.tenant_id || null}
      />

      {/* Modales de Confirmación y Alerta */}
      <ConfirmModal
        isOpen={!!collectorToDelete}
        onClose={() => setCollectorToDelete(null)}
        onConfirm={handleConfirmDeleteCollector}
        title="Desvincular Cobrador"
        message={
          <div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.92rem' }}>
              ¿Estás seguro de que deseas desvincular a <strong>{collectorToDelete?.user.full_name}</strong> del equipo?
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Sus rutas asignadas y su cartera de clientes quedarán liberadas automáticamente en el sistema para que puedas reasignarlas a otro cobrador.
            </p>
          </div>
        }
        confirmLabel={isDeletingCollector ? 'Desvinculando...' : 'Sí, Desvincular'}
        isDestructive={true}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteInv}
        title="Eliminar Invitación"
        message={`¿Estás seguro de que deseas eliminar la invitación para "${deleteTarget?.email}"?`}
        isDestructive={true}
      />
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
