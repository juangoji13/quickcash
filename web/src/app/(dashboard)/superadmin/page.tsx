'use client';

/* ============================================
 * QuickCash — SuperAdmin Portal
 * Panel de Control Global y Gestión de Prestamistas
 * ============================================ */

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks';
import {
  getSuperAdminKPIs,
  getAllTenants,
  toggleTenantStatus,
} from '@/services/superadmin.service';
import type { SuperAdminKPIs, SuperAdminTenant } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/Modal';
import styles from './superadmin.module.css';

type FilterState = 'all' | 'active' | 'suspended';

export default function SuperAdminPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const [kpis, setKpis] = useState<SuperAdminKPIs | null>(null);
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterState>('all');
  const [statusTarget, setStatusTarget] = useState<{
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
      const [kpiData, tenantsData] = await Promise.all([
        getSuperAdminKPIs(),
        getAllTenants(),
      ]);
      setKpis(kpiData);
      setTenants(tenantsData);
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
      // Filtro por estado
      if (filter === 'active' && !t.is_active) return false;
      if (filter === 'suspended' && t.is_active) return false;

      // Filtro por texto
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchAdmin = t.admin?.full_name?.toLowerCase().includes(q) || false;
      const matchEmail = t.admin?.email?.toLowerCase().includes(q) || false;
      const matchHandle = t.admin?.username?.toLowerCase().includes(q) || false;
      return matchName || matchAdmin || matchEmail || matchHandle;
    });
  }, [tenants, filter, searchQuery]);

  async function handleToggleStatus() {
    if (!statusTarget) return;
    setActionLoading(true);
    const nextState = !statusTarget.currentActive;

    try {
      const res = await toggleTenantStatus(statusTarget.id, nextState);
      if (res.success) {
        // Actualización optimista en la tabla local
        setTenants((prev) =>
          prev.map((t) =>
            t.id === statusTarget.id ? { ...t, is_active: nextState } : t
          )
        );
        // Refrescar KPIs
        const updatedKpis = await getSuperAdminKPIs();
        setKpis(updatedKpis);
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

  // 1. Pantalla de carga mientras se resuelve la sesión
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

  // 2. Pantalla de Acceso Restringido (si no es SuperAdmin)
  if (!isSuperAdmin) {
    return (
      <div className={styles.restrictedPage}>
        <div className={styles.restrictedCard}>
          <div className={styles.restrictedIcon}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className={styles.restrictedTitle}>Acceso Restringido</h2>
          <p className={styles.restrictedDesc}>
            Esta consola es exclusiva para el Súper Administrador de la plataforma
            QuickCash. Tu cuenta actual no posee privilegios globales.
          </p>
          <Link href="/overview" className="btn btn--primary">
            Volver al Dashboard
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
            <h1 className={styles.title}>Portal Súper Administrador</h1>
            <span className={styles.platformBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Plataforma Global
            </span>
          </div>
          <p className={styles.subtitle}>
            Control centralizado de organizaciones, métricas cross-tenant y auditoría
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

      {/* Tarjetas KPI Globales */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-safety-yellow, #F1C40F)' } as any}>
          <span className={styles.kpiLabel}>Prestamistas Activos</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : `${kpis?.active_tenants ?? 0} / ${kpis?.total_tenants ?? 0}`}
          </span>
          <span className={styles.kpiSub}>
            Organizaciones registradas
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-blue, #2980B9)' } as any}>
          <span className={styles.kpiLabel}>Capital en Calle Global</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : formatCurrency(kpis?.total_capital_in_street ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Cartera activa en toda la red
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': 'var(--color-green, #27AE60)' } as any}>
          <span className={styles.kpiLabel}>Recaudo Global Hoy</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : formatCurrency(kpis?.total_today_collected ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Flujo real recaudado hoy (COP)
          </span>
        </div>

        <div className={styles.kpiCard} style={{ '--kpi-accent': '#8E44AD' } as any}>
          <span className={styles.kpiLabel}>Cobradores en Operación</span>
          <span className={styles.kpiValue}>
            {loading ? '—' : (kpis?.total_collectors ?? 0)}
          </span>
          <span className={styles.kpiSub}>
            Operadores activos en campo
          </span>
        </div>
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
            placeholder="Buscar por negocio, administrador o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos ({tenants.length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'active' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('active')}
          >
            Activos ({tenants.filter((t) => t.is_active).length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'suspended' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('suspended')}
          >
            Suspendidos ({tenants.filter((t) => !t.is_active).length})
          </button>
        </div>
      </div>

      {/* Tabla Interactiva de Prestamistas */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa / Organización</th>
                <th>Admin Principal</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Préstamos Activos</th>
                <th style={{ textAlign: 'center' }}>Clientes</th>
                <th>Registro</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: '80%', height: 24 }} />
                      <div className="skeleton" style={{ width: '60%', height: 20 }} />
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className={styles.emptyState}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      <div className={styles.emptyTitle}>No se encontraron prestamistas</div>
                      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                        {searchQuery ? 'Prueba con otro término de búsqueda' : 'No hay organizaciones con este filtro'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    {/* Empresa */}
                    <td>
                      <div className={styles.tenantInfo}>
                        <span className={styles.tenantName}>{tenant.name}</span>
                        <div className={styles.tenantMeta}>
                          <span className={styles.currencyTag}>{tenant.currency}</span>
                          <span>ID: {tenant.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Admin Principal */}
                    <td>
                      <div className={styles.adminInfo}>
                        <span className={styles.adminName}>
                          {tenant.admin?.full_name || 'Sin admin asignado'}
                        </span>
                        {tenant.admin?.username && (
                          <span className={styles.adminHandle}>@{tenant.admin.username}</span>
                        )}
                        <span className={styles.adminEmail}>{tenant.admin?.email || '—'}</span>
                      </div>
                    </td>

                    {/* Teléfono */}
                    <td>{tenant.admin?.phone || '—'}</td>

                    {/* Estado */}
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

                    {/* Préstamos Activos */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={styles.statNum}>{tenant.active_loans_count}</span>
                    </td>

                    {/* Clientes */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={styles.statNum}>{tenant.total_clients}</span>
                    </td>

                    {/* Fecha de Registro */}
                    <td>{formatDate(tenant.created_at)}</td>

                    {/* Botón de Acción */}
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

      {/* Modal de Confirmación para Suspender / Reactivar */}
      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        title={statusTarget?.currentActive ? 'Suspender Prestamista' : 'Reactivar Prestamista'}
        message={
          statusTarget?.currentActive
            ? `¿Estás seguro de que deseas suspender la cuenta de "${statusTarget?.name}"? Sus usuarios y cobradores no podrán iniciar sesión ni operar hasta que sea reactivada.`
            : `¿Deseas reactivar el acceso para "${statusTarget?.name}"? Sus administradores y cobradores podrán volver a ingresar y operar normalmente.`
        }
        confirmLabel={statusTarget?.currentActive ? 'Sí, Suspender' : 'Sí, Reactivar'}
        cancelLabel="Cancelar"
        isDestructive={statusTarget?.currentActive}
      />
    </div>
  );
}
