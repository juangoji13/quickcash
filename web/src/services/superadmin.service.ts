'use server';

/* ============================================
 * QuickCash — Dirección del Negocio & Plataforma
 * Telemetría macro, control de prestamistas y módulo de mensualidades
 * ============================================ */

import { db } from '@/lib/db';
import { tenants, users, loans, payments, clients } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireSuperAdminAuth } from '@/lib/auth-guard';
import type {
  SuperAdminKPIs,
  SuperAdminTenant,
  PlatformBillingSettings,
  TenantBillingInfo,
} from '@/types';

const GLOBAL_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

/**
 * Obtiene métricas agregadas a nivel global de toda la plataforma QuickCash.
 */
export async function getSuperAdminKPIs(): Promise<SuperAdminKPIs> {
  try {
    await requireSuperAdminAuth();

    // 1. Tenants totales
    const allTenants = await db.query.tenants.findMany({
      with: {
        users: true,
      },
    });

    // Excluir el tenant maestro del conteo de prestamistas de negocio
    const businessTenants = allTenants.filter((t) => t.id !== GLOBAL_TENANT_ID);
    const totalTenants = businessTenants.length;
    let activeTenants = 0;

    businessTenants.forEach((t) => {
      const admin = t.users.find((u) => u.role === 'admin') || t.users[0];
      if (admin ? admin.is_active : t.users.some((u) => u.is_active)) {
        activeTenants++;
      }
    });

    // 2. Total de usuarios registrados en el sistema
    const allUsers = await db.query.users.findMany();
    const totalUsers = allUsers.length;

    // 3. Total de clientes registrados en la red
    const allClients = await db.query.clients.findMany();
    const totalClients = allClients.length;

    // 4. Total de cobradores en operación
    const collectors = await db.query.users.findMany({
      where: and(
        eq(users.role, 'collector'),
        eq(users.is_active, true)
      ),
    });
    const totalCollectors = collectors.length;

    // 5. Volumen en Circulación (GMV) - Suma de cartera de préstamos activos
    const allActiveLoans = await db.query.loans.findMany({
      where: eq(loans.status, 'active'),
    });
    const globalCapitalActive = allActiveLoans.reduce(
      (sum, l) => sum + (Number(l.total_amount) || 0),
      0
    );

    // 6. Recaudo de Hoy en toda la plataforma
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayPayments = await db.query.payments.findMany({
      where: and(
        sql`${payments.paid_date} >= ${startOfDay}`,
        eq(payments.status, 'paid')
      ),
    });
    const globalTodayCollected = todayPayments.reduce(
      (sum, p) => sum + (Number(p.amount_paid) || 0),
      0
    );

    // 7. Usuarios Activos Hoy (DAU)
    const activeActorsToday = new Set<string>();
    todayPayments.forEach((p) => {
      if (p.collector_id) activeActorsToday.add(p.collector_id);
    });
    const dauToday = Math.max(activeActorsToday.size, 1);

    // 8. Configuración de Cobro Global (Plataforma)
    const globalTenant = allTenants.find((t) => t.id === GLOBAL_TENANT_ID);
    const globalSettings = (globalTenant?.settings as any) || {};
    const platformBilling: PlatformBillingSettings = {
      is_billing_enabled: Boolean(globalSettings.platform_billing?.is_billing_enabled ?? false),
      default_monthly_fee: Number(globalSettings.platform_billing?.default_monthly_fee ?? 25000),
      grace_days: Number(globalSettings.platform_billing?.grace_days ?? 2),
      contact_phone: globalSettings.platform_billing?.contact_phone || '+57 300 000 0001',
    };

    // 9. MRR Proyectado (Prestamistas × Tarifa Mensual)
    const mrrProjected = totalTenants * platformBilling.default_monthly_fee;

    return {
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      total_users: totalUsers,
      total_clients: totalClients,
      total_collectors: totalCollectors,
      dau_today: dauToday,
      global_capital_active: globalCapitalActive,
      global_today_collected: globalTodayCollected,
      mrr_projected: mrrProjected,
      platform_billing: platformBilling,
      total_capital_in_street: globalCapitalActive,
      total_today_collected: globalTodayCollected,
    };
  } catch (error) {
    console.error('Error in getSuperAdminKPIs:', error);
    return {
      total_tenants: 0,
      active_tenants: 0,
      total_users: 0,
      total_clients: 0,
      total_collectors: 0,
      dau_today: 0,
      global_capital_active: 0,
      global_today_collected: 0,
      mrr_projected: 0,
      platform_billing: {
        is_billing_enabled: false,
        default_monthly_fee: 25000,
        grace_days: 2,
        contact_phone: '+57 300 000 0001',
      },
    };
  }
}

/**
 * Obtiene la lista completa de todos los Prestamistas de negocio con su información
 * de suscripción, cartera activa y estado de actividad.
 */
export async function getAllTenants(): Promise<SuperAdminTenant[]> {
  try {
    await requireSuperAdminAuth();
    const tenantsList = await db.query.tenants.findMany({
      orderBy: [desc(tenants.created_at)],
      with: {
        users: true,
        clients: true,
        loans: true,
      },
    });

    // Cargar configuración global de cobro
    const globalTenant = tenantsList.find((t) => t.id === GLOBAL_TENANT_ID);
    const globalSettings = (globalTenant?.settings as any) || {};
    const isGlobalBillingEnabled = Boolean(globalSettings.platform_billing?.is_billing_enabled ?? false);
    const defaultFee = Number(globalSettings.platform_billing?.default_monthly_fee ?? 25000);
    const graceDays = Number(globalSettings.platform_billing?.grace_days ?? 2);

    // Solo devolver prestamistas reales (excluir tenant QuickCash Global del listado de clientes)
    const businessTenants = tenantsList.filter((t) => t.id !== GLOBAL_TENANT_ID);

    return businessTenants.map((t) => {
      const adminUser = t.users.find((u) => u.role === 'admin') || t.users[0] || null;
      const isActive = adminUser ? adminUser.is_active : t.users.some((u) => u.is_active);
      const activeLoans = t.loans.filter((l) => l.status === 'active');
      const activeLoansCount = activeLoans.length;
      const totalCapitalLent = activeLoans.reduce((sum, l) => sum + (Number(l.total_amount) || 0), 0);

      // Datos de Facturación / Mensualidad
      const settings = (t.settings as any) || {};
      const billingData = settings.billing || {};
      const fee = Number(billingData.monthly_fee ?? defaultFee);
      const enabled = Boolean(billingData.enabled ?? false);

      // Si no tiene fecha de vencimiento, inicializar a 30 días a futuro
      let expiresAtStr = billingData.expires_at || null;
      let daysLeft = 30;
      let status: 'active' | 'grace' | 'locked' = billingData.status || 'active';

      if (expiresAtStr) {
        const expDate = new Date(expiresAtStr);
        const diffMs = expDate.getTime() - Date.now();
        daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (status !== 'locked') {
          if (daysLeft < -graceDays) {
            status = 'locked';
          } else if (daysLeft <= 0) {
            status = 'grace';
          } else {
            status = 'active';
          }
        }
      }

      // Bloqueado si el cobro global está activo, el cobro al tenant está activo y el estado es locked
      const isLocked = isGlobalBillingEnabled && enabled && status === 'locked';

      const billing: TenantBillingInfo = {
        enabled,
        monthly_fee: fee,
        status,
        expires_at: expiresAtStr,
        days_left: daysLeft,
        is_locked: isLocked,
        last_payment_date: billingData.last_payment_date || null,
        last_payment_amount: billingData.last_payment_amount || null,
      };

      return {
        id: t.id,
        name: t.name,
        currency: t.currency || 'COP',
        created_at: t.created_at ? new Date(t.created_at).toISOString() : '',
        updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : '',
        is_active: isActive,
        admin: adminUser ? {
          id: adminUser.id,
          full_name: adminUser.full_name,
          email: adminUser.email,
          username: adminUser.username,
          phone: adminUser.phone,
          is_active: adminUser.is_active,
        } : null,
        total_clients: t.clients.length,
        total_loans: t.loans.length,
        active_loans_count: activeLoansCount,
        total_capital_lent: totalCapitalLent,
        billing,
      };
    });
  } catch (error) {
    console.error('Error in getAllTenants:', error);
    return [];
  }
}

/**
 * Interruptor Maestro de Cobro:
 * Activa o desactiva el cobro general de la plataforma (Modo Gratuito vs Cobro Activo).
 */
export async function toggleGlobalBillingSwitch(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdminAuth();

    const globalTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, GLOBAL_TENANT_ID),
    });

    if (!globalTenant) {
      return { success: false, error: 'No se encontró el registro de configuración global.' };
    }

    const currentSettings = (globalTenant.settings as any) || {};
    const platformBilling = currentSettings.platform_billing || {
      default_monthly_fee: 25000,
      grace_days: 2,
      contact_phone: '+57 300 000 0001',
    };

    platformBilling.is_billing_enabled = enabled;
    currentSettings.platform_billing = platformBilling;

    await db.update(tenants)
      .set({
        settings: currentSettings,
        updated_at: new Date(),
      })
      .where(eq(tenants.id, GLOBAL_TENANT_ID));

    return { success: true };
  } catch (error: any) {
    console.error('Error in toggleGlobalBillingSwitch:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza la suscripción de un prestamista específico:
 * - Activar/Desactivar cobro individual
 * - Registrar pago de mensualidad (agrega 30 días y desbloquea)
 * - Simular bloqueo o desbloqueo manual
 */
export async function updateTenantBilling(
  tenantId: string,
  updates: {
    enabled?: boolean;
    status?: 'active' | 'grace' | 'locked';
    addDays?: number;
    fee?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdminAuth();

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return { success: false, error: 'Prestamista no encontrado.' };
    }

    const settings = (tenant.settings as any) || {};
    const billing = settings.billing || {
      enabled: false,
      monthly_fee: 25000,
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      grace_period_days: 2,
    };

    if (updates.enabled !== undefined) {
      billing.enabled = updates.enabled;
    }

    if (updates.fee !== undefined) {
      billing.monthly_fee = updates.fee;
    }

    if (updates.status !== undefined) {
      billing.status = updates.status;
    }

    // Agregar días al ciclo de facturación (ej: 30 días al registrar pago)
    if (updates.addDays) {
      const currentExp = billing.expires_at ? new Date(billing.expires_at) : new Date();
      const baseDate = currentExp > new Date() ? currentExp : new Date();
      baseDate.setDate(baseDate.getDate() + updates.addDays);

      billing.expires_at = baseDate.toISOString();
      billing.status = 'active';
      billing.last_payment_date = new Date().toISOString();
      billing.last_payment_amount = billing.monthly_fee || 25000;
    }

    settings.billing = billing;

    await db.update(tenants)
      .set({
        settings,
        updated_at: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateTenantBilling:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Consulta de verificación para el layout del prestamista:
 * Determina si la cuenta está bloqueada por no pago.
 */
export async function checkTenantSubscriptionStatus(tenantId: string): Promise<{
  isBlocked: boolean;
  status: 'active' | 'grace' | 'locked';
  monthlyFee: number;
  contactPhone: string;
  daysLeft: number;
}> {
  try {
    if (!tenantId || tenantId === GLOBAL_TENANT_ID) {
      return {
        isBlocked: false,
        status: 'active',
        monthlyFee: 25000,
        contactPhone: '+57 300 000 0001',
        daysLeft: 999,
      };
    }

    // 1. Verificar si el cobro global está habilitado
    const globalTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, GLOBAL_TENANT_ID),
    });
    const globalSettings = (globalTenant?.settings as any) || {};
    const isGlobalBillingEnabled = Boolean(globalSettings.platform_billing?.is_billing_enabled ?? false);
    const contactPhone = globalSettings.platform_billing?.contact_phone || '+57 300 000 0001';
    const defaultFee = Number(globalSettings.platform_billing?.default_monthly_fee ?? 25000);
    const graceDays = Number(globalSettings.platform_billing?.grace_days ?? 2);

    // Si el cobro global está desactivado (Modo Gratuito), nadie se bloquea
    if (!isGlobalBillingEnabled) {
      return {
        isBlocked: false,
        status: 'active',
        monthlyFee: defaultFee,
        contactPhone,
        daysLeft: 999,
      };
    }

    // 2. Verificar datos del tenant específico
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return {
        isBlocked: false,
        status: 'active',
        monthlyFee: defaultFee,
        contactPhone,
        daysLeft: 999,
      };
    }

    const settings = (tenant.settings as any) || {};
    const billing = settings.billing || {};
    const isTenantBillingEnabled = Boolean(billing.enabled ?? false);
    const fee = Number(billing.monthly_fee ?? defaultFee);

    // Si a este prestamista se le tiene en modo gratuito/exento, no se bloquea
    if (!isTenantBillingEnabled) {
      return {
        isBlocked: false,
        status: 'active',
        monthlyFee: fee,
        contactPhone,
        daysLeft: 999,
      };
    }

    let status: 'active' | 'grace' | 'locked' = billing.status || 'active';
    let daysLeft = 30;

    if (billing.expires_at) {
      const expDate = new Date(billing.expires_at);
      const diffMs = expDate.getTime() - Date.now();
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (status !== 'locked') {
        if (daysLeft < -graceDays) {
          status = 'locked';
        } else if (daysLeft <= 0) {
          status = 'grace';
        }
      }
    }

    const isBlocked = status === 'locked';

    return {
      isBlocked,
      status,
      monthlyFee: fee,
      contactPhone,
      daysLeft,
    };
  } catch (error) {
    console.error('Error in checkTenantSubscriptionStatus:', error);
    return {
      isBlocked: false,
      status: 'active',
      monthlyFee: 25000,
      contactPhone: '+57 300 000 0001',
      daysLeft: 999,
    };
  }
}

/**
 * Activa o suspende el acceso de un Tenant y de todos sus usuarios asociados.
 */
export async function toggleTenantStatus(
  tenantId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdminAuth();
    if (!tenantId) {
      return { success: false, error: 'tenantId es obligatorio.' };
    }

    await db.update(users)
      .set({
        is_active: isActive,
        updated_at: new Date(),
      })
      .where(eq(users.tenant_id, tenantId));

    return { success: true };
  } catch (error: any) {
    console.error('Error in toggleTenantStatus:', error);
    return {
      success: false,
      error: error.message || 'Error al actualizar el estado del prestamista.',
    };
  }
}

/**
 * Obtiene el directorio completo de todos los usuarios registrados en la plataforma.
 */
export async function getAllPlatformUsers() {
  try {
    await requireSuperAdminAuth();
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.created_at)],
      with: {
        tenant: true,
      },
    });

    return allUsers.map((u) => ({
      id: u.id,
      full_name: u.full_name || 'Sin nombre',
      username: u.username || '—',
      email: u.email,
      role: u.role,
      phone: u.phone || '—',
      is_active: u.is_active,
      tenant_name: u.tenant ? u.tenant.name : 'Plataforma Global',
      created_at: u.created_at ? new Date(u.created_at).toISOString() : '',
    }));
  } catch (error) {
    console.error('Error in getAllPlatformUsers:', error);
    return [];
  }
}

/**
 * Activa o suspende a un usuario específico del sistema.
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdminAuth();
    await db.update(users)
      .set({ is_active: isActive, updated_at: new Date() })
      .where(eq(users.id, userId));
    return { success: true };
  } catch (error: any) {
    console.error('Error in toggleUserActive:', error);
    return { success: false, error: error.message };
  }
}
