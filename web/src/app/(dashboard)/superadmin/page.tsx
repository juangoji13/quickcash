'use client';

/* ==============================================================================
 * QuickCash — Panel de Dirección del Negocio & Plataforma
 * Enfoque Founder/SaaS: Métricas Macro, Volumen GMV, Usuarios Activos & Mensualidades
 * ============================================================================== */

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import {
  getSuperAdminKPIs,
  getAllTenants,
  getAllPlatformUsers,
  toggleGlobalBillingSwitch,
  updateTenantBilling,
  toggleUserActive,
} from '@/services/superadmin.service';
import type { SuperAdminKPIs, SuperAdminTenant } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
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
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isSuperAdmin =
    appUser?.role === 'superadmin' || (appUser?.role as string) === 'super_admin';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
      console.error('Error cargando datos de dirección:', err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      loadData();
    }
  }, [authLoading, isSuperAdmin, loadData]);

  // Interruptor Maestro de Cobro
  const handleToggleGlobalBilling = async () => {
    if (!kpis) return;
    setActionLoading(true);
    const nextState = !kpis.platform_billing.is_billing_enabled;

    try {
      const res = await toggleGlobalBillingSwitch(nextState);
      if (res.success) {
        showToast(
          nextState
            ? 'Cobro de mensualidades ACTIVADO ($25.000 COP / mes)'
            : 'Modo Gratuito ACTIVADO (Plataforma promocional sin bloqueos)'
        );
        await loadData();
      } else {
        alert(res.error || 'No se pudo cambiar el interruptor de cobro.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar pago de mensualidad a un prestamista ($25.000 / +30 días)
  const handleRegisterPayment = async (tenant: SuperAdminTenant) => {
    setActionLoading(true);
    try {
      const res = await updateTenantBilling(tenant.id, {
        enabled: true,
        addDays: 30,
        status: 'active',
      });
      if (res.success) {
        showToast(`Pago registrado para ${tenant.name}. +30 días agregados.`);
        await loadData();
      } else {
        alert(res.error || 'Error registrando pago.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Simular Bloqueo / Desbloqueo rápido para pruebas
  const handleToggleLock = async (tenant: SuperAdminTenant) => {
    setActionLoading(true);
    const nextStatus = tenant.billing?.status === 'locked' ? 'active' : 'locked';

    try {
      const res = await updateTenantBilling(tenant.id, {
        enabled: true,
        status: nextStatus,
      });
      if (res.success) {
        showToast(
          nextStatus === 'locked'
            ? `Se ha simulado el bloqueo de ${tenant.name}.`
            : `${tenant.name} ha sido desbloqueado exitosamente.`
        );
        await loadData();
      } else {
        alert(res.error || 'Error al modificar estado de bloqueo.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtrado de prestamistas
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

  // Filtrado de usuarios
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

  if (authLoading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          Cargando panel de dirección...
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Acceso Restringido</h2>
        <p>Esta consola es exclusiva para la dirección de QuickCash.</p>
        <Link href="/overview" className="btn btn--primary">
          Ir al Inicio
        </Link>
      </div>
    );
  }

  const isGlobalBillingOn = Boolean(kpis?.platform_billing?.is_billing_enabled);

  return (
    <div className={styles.page}>
      {/* Toast Notification Flotante */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#0C2237',
            color: '#FFE600',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '0.88rem',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(12, 34, 55, 0.25)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header con Interruptor Maestro de Cobro */}
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitleWrapper}>
            <h1 className={styles.title}>Dirección del Negocio</h1>
            <span className={styles.platformBadge}>QuickCash SaaS</span>
          </div>
          <p className={styles.subtitle}>
            Métricas de crecimiento, volumen de plataforma y control de mensualidades
          </p>
        </div>

        {/* Interruptor Maestro de Cobro de Mensualidades */}
        <div className={styles.masterBillingCard}>
          <div className={styles.masterBillingInfo}>
            <span className={styles.masterBillingLabel}>Modo de Cobro</span>
            <span
              className={`${styles.masterBillingStatus} ${
                isGlobalBillingOn
                  ? styles.masterBillingStatusActive
                  : styles.masterBillingStatusFree
              }`}
            >
              {isGlobalBillingOn
                ? 'Cobro Activo ($25.000/mes)'
                : 'Gratuito (Promocional)'}
            </span>
          </div>

          <button
            type="button"
            className={`${styles.switchBtn} ${
              isGlobalBillingOn ? styles.switchBtnActive : ''
            }`}
            onClick={handleToggleGlobalBilling}
            disabled={actionLoading}
            title={
              isGlobalBillingOn
                ? 'Hacer la plataforma gratuita (Sin bloqueos)'
                : 'Activar cobro de mensualidades ($25.000 COP)'
            }
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
      </header>

      {/* HERO COCKPIT: Métricas Macro de Negocio (Estilo Talonario Deep Navy) */}
      <section className={styles.heroCockpit}>
        {/* Columna 1: Tus Ingresos Mensuales Proyectados */}
        <div className={styles.heroCol}>
          <span className={styles.heroLabel}>Tus Ingresos Mensuales (MRR)</span>
          <div className={styles.heroValGold}>
            {formatCurrency(kpis?.mrr_projected || 0)}
          </div>
          <span className={styles.heroSub}>
            {isGlobalBillingOn
              ? `${kpis?.total_tenants || 0} prestamistas × $25.000`
              : 'En modo promocional (gratis)'}
          </span>
        </div>

        <div className={styles.heroDivider} />

        {/* Columna 2: Volumen de Dinero en Circulación (GMV) */}
        <div className={styles.heroCol}>
          <span className={styles.heroLabel}>Dinero en Circulación (GMV)</span>
          <div className={styles.heroValWhite}>
            {formatCurrency(kpis?.global_capital_active || 0)}
          </div>
          <span className={styles.heroSub}>Capital colocado en la red</span>
        </div>

        <div className={styles.heroDivider} />

        {/* Columna 3: Usuarios Activos Hoy (DAU) */}
        <div className={styles.heroCol}>
          <span className={styles.heroLabel}>Usuarios Activos Hoy</span>
          <div className={styles.heroValGreen}>{kpis?.dau_today || 1}</div>
          <span className={styles.heroSub}>Interactuando en plataforma</span>
        </div>

        <div className={styles.heroDivider} />

        {/* Columna 4: Censo de la Red */}
        <div className={styles.heroCol}>
          <span className={styles.heroLabel}>Censo de la Red</span>
          <div className={styles.censusRow}>
            <div className={styles.censusItem}>
              <span className={styles.censusVal}>{kpis?.total_tenants || 0}</span>
              <span className={styles.censusTag}>Prestamistas</span>
            </div>
            <div className={styles.censusItem}>
              <span className={styles.censusVal}>{kpis?.total_collectors || 0}</span>
              <span className={styles.censusTag}>Cobradores</span>
            </div>
            <div className={styles.censusItem}>
              <span className={styles.censusVal}>{kpis?.total_clients || 0}</span>
              <span className={styles.censusTag}>Clientes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Principales */}
      <div className={styles.tabsRow}>
        <button
          type="button"
          className={`${styles.tabBtn} ${
            viewTab === 'tenants' ? styles.tabBtnActive : ''
          }`}
          onClick={() => {
            setViewTab('tenants');
            setSearchQuery('');
          }}
        >
          Prestamistas Afiliados ({tenants.length})
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${
            viewTab === 'users' ? styles.tabBtnActive : ''
          }`}
          onClick={() => {
            setViewTab('users');
            setSearchQuery('');
          }}
        >
          Directorio de Usuarios ({usersList.length})
        </button>
      </div>

      {/* Toolbar: Búsqueda y Filtros */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg
            className={styles.searchIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={
              viewTab === 'tenants'
                ? 'Buscar negocio, titular o teléfono...'
                : 'Buscar por nombre, usuario, correo u organización...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterBtn} ${
              filter === 'all' ? styles.filterBtnActive : ''
            }`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${
              filter === 'active' ? styles.filterBtnActive : ''
            }`}
            onClick={() => setFilter('active')}
          >
            Activos
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${
              filter === 'suspended' ? styles.filterBtnActive : ''
            }`}
            onClick={() => setFilter('suspended')}
          >
            Suspendidos
          </button>
        </div>
      </div>

      {/* VISTA 1: Prestamistas Afiliados con Módulo de Mensualidad */}
      {viewTab === 'tenants' && (
        <div className={styles.tenantsStack}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
              Cargando prestamistas...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
              No se encontraron prestamistas con ese criterio.
            </div>
          ) : (
            filteredTenants.map((t) => {
              const billing = t.billing;
              const isLocked = Boolean(billing?.is_locked);
              const daysLeft = billing?.days_left ?? 30;
              const isDueSoon = daysLeft <= 3 && daysLeft >= 0;

              return (
                <div key={t.id} className={styles.tenantCard}>
                  {/* Negocio & Titular */}
                  <div className={styles.tenantMain}>
                    <div className={styles.tenantLogo}>
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={styles.tenantInfo}>
                      <div className={styles.tenantNameRow}>
                        <span className={styles.tenantName}>{t.name}</span>
                        {t.is_active ? (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#10B981',
                            }}
                            title="Cuenta activa"
                          />
                        ) : (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#EF4444',
                            }}
                            title="Cuenta suspendida"
                          />
                        )}
                      </div>
                      <span className={styles.tenantAdmin}>
                        {t.admin?.full_name || 'Sin titular'}
                        {t.admin?.phone && (
                          <>
                            <span>·</span>
                            <a
                              href={`tel:${t.admin.phone}`}
                              className={styles.phoneLink}
                              title="Llamar"
                            >
                              {t.admin.phone}
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Cifras de Operación del Prestamista */}
                  <div className={styles.tenantStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statVal}>{t.total_clients}</span>
                      <span className={styles.statTag}>Clientes</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statVal}>{t.active_loans_count}</span>
                      <span className={styles.statTag}>Créditos</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statVal}>
                        {formatCurrency(t.total_capital_lent || 0)}
                      </span>
                      <span className={styles.statTag}>Cartera</span>
                    </div>
                  </div>

                  {/* Módulo de Mensualidad */}
                  <div className={styles.billingBox}>
                    <div className={styles.billingText}>
                      <span className={styles.billingTitle}>Plan / Mensualidad</span>
                      {isLocked ? (
                        <span className={styles.badgeLocked}>
                          ● Bloqueado (No pagó)
                        </span>
                      ) : !isGlobalBillingOn || !billing?.enabled || !billing?.expires_at ? (
                        <span className={styles.badgeFree}>Plan Gratis</span>
                      ) : isDueSoon ? (
                        <span className={styles.badgeGrace}>
                          ● Vence en {daysLeft} días
                        </span>
                      ) : (
                        <span className={styles.badgeActive}>
                          ● Al Día ({daysLeft} días)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className={styles.tenantActions}>
                    <button
                      type="button"
                      className={styles.payBtn}
                      onClick={() => handleRegisterPayment(t)}
                      disabled={actionLoading}
                      title="Registrar pago de mensualidad (+30 días)"
                    >
                      <span>+ Pago $25.000</span>
                    </button>

                    {/* Botón para Simular Bloqueo / Desbloqueo en Pruebas */}
                    {billing?.status === 'locked' ? (
                      <button
                        type="button"
                        className={styles.unlockBtn}
                        onClick={() => handleToggleLock(t)}
                        disabled={actionLoading}
                        title="Desbloquear acceso"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                        </svg>
                        <span>Desbloquear</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.testLockBtn}
                        onClick={() => handleToggleLock(t)}
                        disabled={actionLoading}
                        title="Simular bloqueo por no pago para pruebas"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span>Simular Bloqueo</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VISTA 2: Directorio de Usuarios de la Red */}
      {viewTab === 'users' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Organización</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center' }}>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center' }}>
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  let roleBadge = (
                    <span className={styles.roleBadgeCollector}>COBRADOR</span>
                  );
                  if (u.role === 'admin') {
                    roleBadge = (
                      <span className={styles.roleBadgeAdmin}>PRESTAMISTA</span>
                    );
                  } else if (
                    u.role === 'superadmin' ||
                    u.role === 'super_admin'
                  ) {
                    roleBadge = (
                      <span className={styles.roleBadgeSuper}>DIRECCIÓN</span>
                    );
                  }

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.userAvatar}>
                            {u.full_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800 }}>{u.full_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#656B81' }}>
                              {u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#475569' }}>{u.email}</td>
                      <td>{roleBadge}</td>
                      <td style={{ fontWeight: 600 }}>{u.tenant_name}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {u.phone}
                      </td>
                      <td>
                        {u.is_active ? (
                          <span style={{ color: '#10B981', fontWeight: 700 }}>
                            ● Activo
                          </span>
                        ) : (
                          <span style={{ color: '#EF4444', fontWeight: 700 }}>
                            ● Inactivo
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          fontSize: '0.78rem',
                          color: '#656B81',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {u.created_at ? formatDate(u.created_at) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
