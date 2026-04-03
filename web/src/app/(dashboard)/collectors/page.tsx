'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks';
import {
  getCollectors,
  updateCollector,
  getInvitations,
  createInvitation,
  deleteInvitation,
} from '@/services/collectors.service';
import { formatDate, getInitials } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/Modal';
import type { User, Invitation } from '@/types';
import styles from './collectors.module.css';

type Tab = 'team' | 'invitations';

export default function CollectorsPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<Tab>('team');
  const [collectors, setCollectors] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<'collector' | 'admin'>('collector');
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState('');

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [colls, invs] = await Promise.all([getCollectors(), getInvitations()]);
    setCollectors(colls);
    setInvitations(invs);
    setLoading(false);
  }, []);

  const stats = {
    total: collectors.length,
    admins: collectors.filter(c => c.role === 'admin').length,
    collectors: collectors.filter(c => c.role === 'collector').length,
    pendingInvs: invitations.filter(i => i.status === 'pending').length
  };

  const filteredCollectors = collectors.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleActive(user: User) {
    const { success, error } = await updateCollector(user.id, { is_active: !user.is_active });
    if (error) alert(`Error: ${error}`);
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
    if (!deleteTarget) return;
    await deleteInvitation(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Cobradores</h2>
          <p className={styles.pageSubtitle}>{collectors.length} miembros del equipo</p>
        </div>
        <button className="btn btn--primary" onClick={() => { setShowInvite(!showInvite); setTab('invitations'); }}>
          {showInvite ? 'Cerrar' : '+ Invitar Cobrador'}
        </button>
      </div>

      {/* Mini KPIs Summary */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total Equipo</span>
          <span className={styles.summaryValue}>{stats.total}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Administradores</span>
          <span className={styles.summaryValue}>{stats.admins}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Cobradores</span>
          <span className={styles.summaryValue}>{stats.collectors}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Inv. Pendientes</span>
          <span className={styles.summaryValue}>{stats.pendingInvs}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`} onClick={() => setTab('team')}>
            Equipo ({collectors.length})
          </button>
          <button className={`${styles.tab} ${tab === 'invitations' ? styles.tabActive : ''}`} onClick={() => setTab('invitations')}>
            Invitaciones ({invitations.length})
          </button>
        </div>

        {tab === 'team' && (
          <div className={styles.searchContainer}>
            <div className={styles.searchIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="Buscar por nombre o email..." 
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
              <label className="input-label" htmlFor="invEmail">Email</label>
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
            <button type="submit" className="btn btn--primary" disabled={invSaving} style={{ alignSelf: 'flex-end' }}>
              {invSaving ? 'Enviando...' : 'Enviar Invitación'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140 }} />)}
        </div>
      ) : tab === 'team' ? (
        /* ---- Team Grid ---- */
        collectors.length === 0 ? (
          <div className={styles.empty}>
            <span><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
            <h3>Sin cobradores</h3>
            <p>Invita a tu primer cobrador para comenzar</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredCollectors.map((user) => (
              <div key={user.id} className={`card ${styles.memberCard}`}>
                <div className={styles.memberHeader}>
                  <div className={styles.avatar}>{getInitials(user.full_name)}</div>
                  <div className={styles.memberInfo}>
                    <h4 className={styles.memberName}>{user.full_name}</h4>
                    <span className={styles.memberEmail}>{user.email}</span>
                  </div>
                  <span className={`${styles.roleBadge} ${styles[`role_${user.role}`]}`}>
                    {user.role === 'admin' ? 'Admin' : 'Cobrador'}
                  </span>
                </div>
                <div className={styles.memberDetails}>
                  {user.phone && <span>{user.phone}</span>}
                  <span>Registrado: {formatDate(user.created_at)}</span>
                </div>
                <div className={styles.memberFooter}>
                  <span className={user.is_active ? styles.statusActive : styles.statusInactive}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  {user.id !== appUser?.id && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ---- Invitations List ---- */
        invitations.length === 0 ? (
          <div className={styles.empty}>
            <span><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-gray-300)" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
            <h3>Sin invitaciones pendientes</h3>
          </div>
        ) : (
          <div className={styles.invList}>
            {invitations.map((inv) => (
              <div key={inv.id} className={`card ${styles.invCard}`}>
                <div className={styles.invInfo}>
                  <strong>{inv.email}</strong>
                  <span className={styles.invMeta}>
                    {inv.role === 'admin' ? 'Admin' : 'Cobrador'} ·
                    Enviada: {formatDate(inv.created_at)}
                  </span>
                </div>
                <div className={styles.invActions}>
                  <span className={`${styles.invStatus} ${styles[`inv_${inv.status}`]}`}>
                    {inv.status === 'pending' ? 'Pendiente' : inv.status === 'accepted' ? 'Aceptada' : 'Expirada'}
                  </span>
                  <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteInv(inv.id, inv.email)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteInv}
        title="Eliminar Invitación"
        message={`¿Estás seguro de que deseas eliminar la invitación para "${deleteTarget?.email}"?`}
        isDestructive={true}
      />
    </div>
  );
}
