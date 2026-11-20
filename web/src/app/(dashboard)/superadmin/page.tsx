'use client';

/* ============================================
 * QuickCash — SuperAdmin Portal
 * Consola de Control Global, Gobernanza y Directorio de Usuarios
 * ============================================ */

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import {
  getSuperAdminKPIs,
  getAllTenants,
  toggleTenantStatus,
  getAllPlatformUsers,
  toggleUserActive,
} from '@/services/superadmin.service';
import type { SuperAdminKPIs, SuperAdminTenant } from '@/types';
import { formatDate } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/Modal';
import styles from './superadmin.module.css';

type FilterState = 'all' | 'active' | 'suspended';
type ViewTab = 'tenants' | 'users';

interface PlatformUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  phone: string;
  is_active: boolean;
  tenant_name: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const [viewTab, setViewTab] = useState<ViewTab>('tenants');
  const [kpis, setKpis] = useState<SuperAdminKPIs | null>(null);
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [usersList, setUsersList] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterState>('all');
  
  // Modal target for tenant
  const [statusTarget, setStatusTarget] = useState<{
    id: string;
    name: string;
    currentActive: boolean;
  } | null>(null);

  // Modal target for user
  const [userStatusTarget, setUserStatusTarget] = useState<{
    id: string;
    name: string;
    currentActive: boolean;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const isSuperAdmin =
    appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin';

  const loadData = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setLoading(true);
      const [kpiData, tenantsData, usersData] = await Promise.all([
        getSuperAdminKPIs(),
        getAllTenants(),
        getAllPlatformUsers(),
      ]);
      setKpis(kpiData);
      setTenants(tenantsData);
      setUsersList(usersData as PlatformUser[]);
    } catch (err) {
      console.error('Error loading SuperAdmin data:', err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      loadData();
    }
  }, [authLoading, isSuperAdmin, loadData]);

  // Filtrado reactivo de prestamistas
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (filter === 'active' && !t.is_active) return false;
      if (filter === 'suspended' && t.is_active) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchAdmin = t.admin?.full_name?.toLowerCase().includes(q) || false;
      const matchEmail = t.admin?.email?.toLowerCase().includes(q) || false;
      const matchHandle = t.admin?.username?.toLowerCase().includes(q) || false;
      return matchName || matchAdmin || matchEmail || matchHandle;
    });
  }, [tenants, filter, searchQuery]);

  // Filtrado reactivo de usuarios
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (filter === 'active' && !u.is_active) return false;
      if (filter === 'suspended' && u.is_active) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = u.full_name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchHandle = u.username.toLowerCase().includes(q);
      const matchTenant = u.tenant_name.toLowerCase().includes(q);
      return matchName || matchEmail || matchHandle || matchTenant;
    });
  }, [usersList, filter, searchQuery]);

  // Toggle tenant status
  async function handleToggleStatus() {
    if (!statusTarget) return;
    setActionLoading(true);
    const nextState = !statusTarget.currentActive;

    try {
      const res = await toggleTenantStatus(statusTarget.id, nextState);
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === statusTarget.id ? { ...t, is_active: nextState } : t
          )
        );
        const [updatedKpis, updatedUsers] = await Promise.all([
          getSuperAdminKPIs(),
          getAllPlatformUsers(),
        ]);
        setKpis(updatedKpis);
        setUsersList(updatedUsers as PlatformUser[]);
        setStatusTarget(null);
      } else {
        console.error('Error al cambiar estado del tenant:', res.error);
      }
    } catch (err) {
      console.error('Error al ejecutar toggleTenantStatus:', err);
    } finally {
      setActionLoading(false);
    }
  }

  // Toggle single user status
  async function handleToggleUserStatus() {
    if (!userStatusTarget) return;
    setActionLoading(true);
    const nextState = !userStatusTarget.currentActive;

    try {
      const res = await toggleUserActive(userStatusTarget.id, nextState);
      if (res.success) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === userStatusTarget.id ? { ...u, is_active: nextState } : u
          )
        );
        const updatedKpis = await getSuperAdminKPIs();
        setKpis(updatedKpis);
        setUserStatusTarget(null);
      } else {
        console.error('Error al cambiar estado de usuario:', res.error);
      }
    } catch (err) {
      console.error('Error al ejecutar toggleUserActive:', err);
    } finally {
      setActionLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.kpiGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className={styles.restrictedPage}>
        <div className={styles.restrictedCard}>
          <div className={styles.restrictedIcon}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className={styles.restrictedTitle}>Acceso Restringido</h2>
          <p className={styles.restrictedDesc}>
            Esta consola es exclusiva para el Súper Administrador de la plataforma QuickCash.
          </p>
          <Link href="/overview" className="btn btn--primary">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitleWrapper}>
            <h1 className={styles.title}>Consola de Control Global</h1>
            <span className={styles.platformBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              SuperAdmin
            </span>
          </div>
          <p className={styles.subtitle}>
            Gobernanza de la plataforma, control de organizaciones registradas y directorio de usuarios
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={loadData}
            disabled={loading}
            title="Recargar datos"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refrescar
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Gobernanza de Plataforma (Sin datos financieros de préstamos) */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-safety-yellow, #F1C40F)' } as any}>
          <span className={styles.kpiLabel}>Organizaciones / Prestamistas</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : `${kpis?.active_tenants ?? 0} / ${kpis?.total_tenants ?? 0}`}
          </span>
          <span className={styles.kpiSub}>
            Prestamistas activos / totales
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-blue, #2980B9)' } as any}>
          <span className={styles.kpiLabel}>Usuarios en Plataforma</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : (kpis?.total_users ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Cuentas registradas en el sistema
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-green, #27AE60)' } as any}>
          <span className={styles.kpiLabel}>Clientes en la Red</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : (kpis?.total_clients ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Prestatarios en todas las rutas
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': '#8E44AD' } as any}>
          <span className={styles.kpiLabel}>Cobradores en Campo</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : (kpis?.total_collectors ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Operadores activos en calle
          </span>
        </div>
      </div>

      {/* Selector de Pestañas Principales */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => { setViewTab('tenants'); setSearchQuery(''); }}
          style={{
            padding: '10px 20px',
            backgroundColor: viewTab === 'tenants' ? 'var(--color-asphalt)' : 'var(--color-white)',
            color: viewTab === 'tenants' ? 'var(--color-safety-yellow)' : 'var(--color-gray-600)',
            border: '1px solid var(--color-gray-200)',
            borderRadius: '8px',
            fontFamily: 'var(--font-heading)',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: viewTab === 'tenants' ? '0 2px 8px rgba(44, 62, 80, 0.2)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Organizaciones y Prestamistas ({tenants.length})
        </button>

        <button
          onClick={() => { setViewTab('users'); setSearchQuery(''); }}
          style={{
            padding: '10px 20px',
            backgroundColor: viewTab === 'users' ? 'var(--color-asphalt)' : 'var(--color-white)',
            color: viewTab === 'users' ? 'var(--color-safety-yellow)' : 'var(--color-gray-600)',
            border: '1px solid var(--color-gray-200)',
            borderRadius: '8px',
            fontFamily: 'var(--font-heading)',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: viewTab === 'users' ? '0 2px 8px rgba(44, 62, 80, 0.2)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Directorio Global de Usuarios ({usersList.length})
        </button>
      </div>

      {/* Toolbar: Búsqueda y Filtros */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={`input ${styles.searchInput}`}
            placeholder={
              viewTab === 'tenants'
                ? 'Buscar por negocio, prestamista o correo...'
                : 'Buscar por nombre, usuario, correo u organización...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'active' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('active')}
          >
            Activos
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'suspended' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('suspended')}
          >
            Suspendidos
          </button>
        </div>
      </div>

      {/* TAB 1: Organizaciones y Prestamistas */}
      {viewTab === 'tenants' && (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Empresa / Prestamista</th>
                  <th>Titular de la Cuenta</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Clientes</th>
                  <th>Fecha de Registro</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center' }}>
                      <div className="skeleton" style={{ width: '80%', height: 24, margin: '0 auto 8px' }} />
                      <div className="skeleton" style={{ width: '60%', height: 20, margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyTitle}>No se encontraron organizaciones</div>
                        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                          {searchQuery ? 'Prueba con otro término' : 'No hay organizaciones con este filtro'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <div className={styles.tenantInfo}>
                          <span className={styles.tenantName}>{tenant.name}</span>
                          <div className={styles.tenantMeta}>
                            <span className={styles.currencyTag}>{tenant.currency}</span>
                            <span>ID: {tenant.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.adminInfo}>
                          <span className={styles.adminName}>
                            {tenant.admin?.full_name || 'Sin titular asignado'}
                          </span>
                          {tenant.admin?.username && (
                            <span className={styles.adminHandle}>@{tenant.admin.username.replace('@', '')}</span>
                          )}
                          <span className={styles.adminEmail}>{tenant.admin?.email || '—'}</span>
                        </div>
                      </td>

                      <td>{tenant.admin?.phone || '—'}</td>

                      <td>
                        {tenant.is_active ? (
                          <span className={styles.statusBadgeActive}>
                            <span className={styles.statusDot} />
                            Activo
                          </span>
                        ) : (
                          <span className={styles.statusBadgeSuspended}>
                            <span className={styles.statusDot} />
                            Suspendido
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={styles.statNum}>{tenant.total_clients}</span>
                      </td>

                      <td>{formatDate(tenant.created_at)}</td>

                      <td className={styles.actionsCell}>
                        {tenant.is_active ? (
                          <button
                            className={styles.suspendBtn}
                            onClick={() =>
                              setStatusTarget({
                                id: tenant.id,
                                name: tenant.name,
                                currentActive: true,
                              })
                            }
                          >
                            Suspender
                          </button>
                        ) : (
                          <button
                            className={styles.reactivateBtn}
                            onClick={() =>
                              setStatusTarget({
                                id: tenant.id,
                                name: tenant.name,
                                currentActive: false,
                              })
                            }
                          >
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Directorio Global de Usuarios */}
      {viewTab === 'users' && (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre y Usuario</th>
                  <th>Correo Electrónico</th>
                  <th>Rol</th>
                  <th>Organización</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center' }}>
                      <div className="skeleton" style={{ width: '80%', height: 24, margin: '0 auto 8px' }} />
                      <div className="skeleton" style={{ width: '60%', height: 20, margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyTitle}>No se encontraron usuarios</div>
                        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                          {searchQuery ? 'Prueba con otro término' : 'No hay usuarios registrados con este filtro'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleBadge =
                      u.role === 'superadmin' || u.role === 'super_admin'
                        ? 'SuperAdmin'
                        : u.role === 'admin'
                        ? 'Prestamista'
                        : 'Cobrador';

                    return (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.adminInfo}>
                            <span className={styles.adminName}>{u.full_name}</span>
                            <span className={styles.adminHandle}>@{u.username.replace('@', '')}</span>
                          </div>
                        </td>

                        <td>{u.email}</td>

                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              backgroundColor:
                                roleBadge === 'SuperAdmin'
                                  ? 'var(--color-asphalt)'
                                  : roleBadge === 'Prestamista'
                                  ? '#FEF3C7'
                                  : '#E0F2FE',
                              color:
                                roleBadge === 'SuperAdmin'
                                  ? 'var(--color-safety-yellow)'
                                  : roleBadge === 'Prestamista'
                                  ? '#92400E'
                                  : '#0369A1',
                            }}
                          >
                            {roleBadge}
                          </span>
                        </td>

                        <td>{u.tenant_name}</td>

                        <td>{u.phone}</td>

                        <td>
                          {u.is_active ? (
                            <span className={styles.statusBadgeActive}>
                              <span className={styles.statusDot} />
                              Activo
                            </span>
                          ) : (
                            <span className={styles.statusBadgeSuspended}>
                              <span className={styles.statusDot} />
                              Inactivo
                            </span>
                          )}
                        </td>

                        <td>{formatDate(u.created_at)}</td>

                        <td className={styles.actionsCell}>
                          {u.role !== 'superadmin' && (
                            u.is_active ? (
                              <button
                                className={styles.suspendBtn}
                                onClick={() =>
                                  setUserStatusTarget({
                                    id: u.id,
                                    name: u.full_name,
                                    currentActive: true,
                                  })
                                }
                              >
                                Desactivar
                              </button>
                            ) : (
                              <button
                                className={styles.reactivateBtn}
                                onClick={() =>
                                  setUserStatusTarget({
                                    id: u.id,
                                    name: u.full_name,
                                    currentActive: false,
                                  })
                                }
                              >
                                Activar
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Suspender / Reactivar Organizaciones */}
      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        title={statusTarget?.currentActive ? 'Suspender Prestamista' : 'Reactivar Prestamista'}
        message={
          statusTarget?.currentActive
            ? `¿Estás seguro de que deseas suspender la cuenta de "${statusTarget?.name}"? Sus usuarios y cobradores no podrán ingresar hasta que sea reactivada.`
            : `¿Deseas reactivar el acceso para "${statusTarget?.name}"? Sus usuarios podrán volver a ingresar y operar normalmente.`
        }
        confirmLabel={statusTarget?.currentActive ? 'Sí, Suspender' : 'Sí, Reactivar'}
        cancelLabel="Cancelar"
        isDestructive={statusTarget?.currentActive}
      />

      {/* Modal de Confirmación para Activar / Desactivar Usuario */}
      <ConfirmModal
        isOpen={!!userStatusTarget}
        onClose={() => setUserStatusTarget(null)}
        onConfirm={handleToggleUserStatus}
        title={userStatusTarget?.currentActive ? 'Desactivar Usuario' : 'Activar Usuario'}
        message={
          userStatusTarget?.currentActive
            ? `¿Deseas desactivar a "${userStatusTarget?.name}"? No podrá iniciar sesión hasta que vuelva a ser activado.`
            : `¿Deseas activar a "${userStatusTarget?.name}"? Podrá iniciar sesión normalmente.`
        }
        confirmLabel={userStatusTarget?.currentActive ? 'Sí, Desactivar' : 'Sí, Activar'}
        cancelLabel="Cancelar"
        isDestructive={userStatusTarget?.currentActive}
      />
    </div>
  );
}
