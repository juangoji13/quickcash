'use server';

/* ============================================
 * QuickCash — SuperAdmin Service
 * Gestión global de plataforma, KPIs cross-tenant y control de prestamistas
 * ============================================ */

import { db } from '@/lib/db';
import { tenants, users, loans, payments, clients } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireSuperAdminAuth } from '@/lib/auth-guard';
import type { SuperAdminKPIs, SuperAdminTenant } from '@/types';

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

    const totalTenants = allTenants.length;
    let activeTenants = 0;

    allTenants.forEach((t) => {
      const admin = t.users.find((u) => u.role === 'admin') || t.users[0];
      if (admin ? admin.is_active : t.users.some((u) => u.is_active)) {
        activeTenants++;
      }
    });

    // 2. Capital en calle global (préstamos activos)
    const activeLoans = await db.query.loans.findMany({
      where: eq(loans.status, 'active'),
    });

    let totalCapitalInStreet = 0;
    activeLoans.forEach((loan) => {
      const paid = (loan.paid_installments || 0) * (loan.installment_amount || 0);
      const principalTotal = loan.principal_amount || 0;
      const remainingPrincipal = Math.max(0, principalTotal - paid);
      totalCapitalInStreet += remainingPrincipal;
    });

    // 3. Recaudo global hoy (con zona horaria America/Bogota)
    const todayCollectedResult = await db.select({
      sum: sql<number>`sum(${payments.amount_paid})`
    }).from(payments)
      .where(sql`DATE(${payments.paid_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`);

    const totalTodayCollected = Number(todayCollectedResult[0]?.sum || 0);

    // 4. Total de cobradores en operación
    const collectors = await db.query.users.findMany({
      where: and(
        eq(users.role, 'collector'),
        eq(users.is_active, true)
      ),
    });

    const totalCollectors = collectors.length;

    return {
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      total_capital_in_street: Math.round(totalCapitalInStreet * 100) / 100,
      total_today_collected: totalTodayCollected,
      total_collectors: totalCollectors,
    };
  } catch (error) {
    console.error('Error in getSuperAdminKPIs:', error);
    return {
      total_tenants: 0,
      active_tenants: 0,
      total_capital_in_street: 0,
      total_today_collected: 0,
      total_collectors: 0,
    };
  }
}

/**
 * Obtiene la lista completa de todos los Tenants con su administrador principal,
 * conteo de clientes, préstamos y estado de actividad.
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

    return tenantsList.map((t) => {
      const adminUser = t.users.find((u) => u.role === 'admin') || t.users[0] || null;
      const isActive = adminUser ? adminUser.is_active : t.users.some((u) => u.is_active);
      const activeLoansCount = t.loans.filter((l) => l.status === 'active').length;

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
      };
    });
  } catch (error) {
    console.error('Error in getAllTenants:', error);
    return [];
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

    // Actualizar todos los usuarios pertenecientes al tenant para activar o suspender su acceso
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
