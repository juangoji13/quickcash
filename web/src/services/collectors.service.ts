'use server';

/* ============================================
 * QuickCash — Collectors Service
 * Gestión de cobradores e invitaciones (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { users, invitations, clients, loans, payments, collection_routes, route_closures } from '@/lib/db/schema';
import { eq, and, inArray, desc, sql, or } from 'drizzle-orm';
import type { 
  User, 
  Invitation, 
  CollectorWithMetrics, 
  CollectorFullDetail, 
  CollectorClientItem, 
  CollectorRecentPayment 
} from '@/types';

export async function getCollectors(tenantId: string): Promise<User[]> {
  try {
    const results = await db.query.users.findMany({
      where: and(
        eq(users.tenant_id, tenantId),
        inArray(users.role, ['collector', 'admin']),
        sql`${users.email} NOT LIKE '%.unlinked.%'`
      ),
      orderBy: [users.full_name],
    });
    return results as unknown as User[];
  } catch (error) {
    console.error('Error fetching collectors:', error);
    return [];
  }
}

export async function getCollectorsWithMetrics(tenantId: string): Promise<CollectorWithMetrics[]> {
  try {
    const rawUsers = await db.query.users.findMany({
      where: and(
        eq(users.tenant_id, tenantId),
        inArray(users.role, ['collector', 'admin']),
        sql`${users.email} NOT LIKE '%.unlinked.%'`
      ),
      orderBy: [users.full_name],
    });

    const nowBogota = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const currentMonthYear = nowBogota.slice(0, 7);

    const collectorsWithMetrics: CollectorWithMetrics[] = [];

    for (const u of rawUsers) {
      // 1. Ruta asignada al cobrador
      const route = await db.query.collection_routes.findFirst({
        where: and(
          eq(collection_routes.tenant_id, tenantId),
          eq(collection_routes.collector_id, u.id)
        ),
      });

      // 2. Clientes asignados directa o rutariamente
      const clientConditions = [eq(clients.collector_id, u.id)];
      if (route) {
        clientConditions.push(eq(clients.route_id, route.id));
      }

      const assignedClients = await db.query.clients.findMany({
        where: and(
          eq(clients.tenant_id, tenantId),
          or(...clientConditions)
        ),
      });

      const clientIds = assignedClients.map((c) => c.id);

      // 3. Préstamos activos y cuotas
      let activeLoans: any[] = [];
      if (clientIds.length > 0) {
        activeLoans = await db.query.loans.findMany({
          where: and(
            eq(loans.tenant_id, tenantId),
            inArray(loans.client_id, clientIds),
            eq(loans.status, 'active')
          ),
          with: {
            payments: true,
          },
        });
      }

      let capitalInStreet = 0;
      let expectedInterest = 0;
      let totalInstallmentsExpected = 0;
      let totalInstallmentsPaid = 0;

      for (const l of activeLoans) {
        const totalPaid = (l.payments || [])
          .filter((p: any) => p.status === 'paid' || p.amount_paid > 0)
          .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);

        capitalInStreet += Math.max(0, l.principal_amount - totalPaid);
        expectedInterest += Math.max(0, l.total_amount - l.principal_amount);
        totalInstallmentsExpected += l.total_installments;
        totalInstallmentsPaid += l.paid_installments;
      }

      // 4. Pagos registrados por este cobrador
      const allPayments = await db.query.payments.findMany({
        where: and(
          eq(payments.tenant_id, tenantId),
          eq(payments.collector_id, u.id),
          sql`${payments.amount_paid} > 0`
        ),
        orderBy: [desc(payments.paid_date)],
      });

      const totalCollectedAllTime = allPayments.reduce((acc, p) => acc + (p.amount_paid || 0), 0);

      let totalCollectedToday = 0;
      let totalCollectedMonth = 0;
      let lastPaymentDate: string | null = null;

      for (const p of allPayments) {
        if (!p.paid_date) continue;
        const pDateBogota = new Date(p.paid_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        if (pDateBogota === nowBogota) {
          totalCollectedToday += p.amount_paid || 0;
        }
        if (pDateBogota.startsWith(currentMonthYear)) {
          totalCollectedMonth += p.amount_paid || 0;
        }
        if (!lastPaymentDate) {
          lastPaymentDate = p.paid_date.toISOString();
        }
      }

      // 5. Riesgo de la cartera
      const greenClients = assignedClients.filter((c) => c.risk_status === 'green').length;
      const yellowClients = assignedClients.filter((c) => c.risk_status === 'yellow').length;
      const redClients = assignedClients.filter((c) => c.risk_status === 'red').length;

      const efficiency = (totalInstallmentsExpected > 0 && assignedClients.length > 0)
        ? Math.round((totalInstallmentsPaid / totalInstallmentsExpected) * 100)
        : 0;

      const delinquencyRate = assignedClients.length > 0
        ? Math.round((redClients / assignedClients.length) * 100)
        : 0;

      // 6. Cierre diario de caja
      const closure = await db.query.route_closures.findFirst({
        where: and(
          eq(route_closures.tenant_id, tenantId),
          eq(route_closures.collector_id, u.id),
          sql`DATE(${route_closures.closure_date} AT TIME ZONE 'America/Bogota') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
        ),
        orderBy: [desc(route_closures.created_at)],
      });

      collectorsWithMetrics.push({
        user: u as unknown as User,
        assignedRoute: route ? {
          id: route.id,
          name: route.name,
          zone: route.zone,
          color: route.color,
        } : null,
        stats: {
          clientsCount: assignedClients.length,
          activeLoansCount: activeLoans.length,
          capitalInStreet,
          totalCollectedToday,
          totalCollectedMonth,
          totalCollectedAllTime,
          expectedInterest,
          collectionEfficiency: efficiency,
          delinquencyRate,
          greenClients,
          yellowClients,
          redClients,
          lastPaymentDate,
          closureStatus: (closure?.status as 'open' | 'closed') || 'none',
          closureAmountToday: closure?.total_collected || totalCollectedToday,
        },
      });
    }

    return collectorsWithMetrics;
  } catch (err) {
    console.error('Error fetching collectors with metrics:', err);
    return [];
  }
}

export async function getCollectorDetail(collectorId: string, tenantId: string): Promise<CollectorFullDetail | null> {
  try {
    const collectors = await getCollectorsWithMetrics(tenantId);
    const summary = collectors.find((c) => c.user.id === collectorId);
    if (!summary) return null;

    const nowBogota = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    // 1. Obtener clientes asignados con su préstamo activo y cuota de hoy
    const clientConditions = [eq(clients.collector_id, collectorId)];
    if (summary.assignedRoute) {
      clientConditions.push(eq(clients.route_id, summary.assignedRoute.id));
    }

    const assignedClients = await db.query.clients.findMany({
      where: and(
        eq(clients.tenant_id, tenantId),
        or(...clientConditions)
      ),
      orderBy: [clients.full_name],
      with: {
        loans: {
          where: eq(loans.status, 'active'),
          with: {
            payments: {
              orderBy: [desc(payments.installment_number)],
            },
          },
        },
      },
    });

    const clientItems: CollectorClientItem[] = assignedClients.map((c) => {
      const activeLoan = c.loans?.[0] || null;
      let todayPaymentStatus: 'paid' | 'pending' | 'missed' | 'none' = 'none';
      let todayPaymentAmount = 0;

      if (activeLoan && activeLoan.payments) {
        todayPaymentAmount = activeLoan.installment_amount;
        const todayPayment = activeLoan.payments.find((p) => {
          const pDateBogota = new Date(p.due_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          return pDateBogota === nowBogota;
        });

        if (todayPayment) {
          todayPaymentStatus = todayPayment.status === 'paid' ? 'paid' : todayPayment.status === 'missed' ? 'missed' : 'pending';
        } else {
          // Si no tiene cuota exactamente hoy, mirar la última cuota pendiente
          const pending = activeLoan.payments.find((p) => p.status === 'pending');
          if (pending) todayPaymentStatus = 'pending';
        }
      }

      return {
        id: c.id,
        full_name: c.full_name,
        document_id: c.document_id || '',
        phone: c.phone,
        address: c.address,
        risk_status: c.risk_status as any,
        active_loan: activeLoan ? {
          id: activeLoan.id,
          principal_amount: activeLoan.principal_amount,
          total_amount: activeLoan.total_amount,
          balance: activeLoan.balance ?? (activeLoan.total_amount - (activeLoan.paid_installments * activeLoan.installment_amount)),
          installment_amount: activeLoan.installment_amount,
          paid_installments: activeLoan.paid_installments,
          total_installments: activeLoan.total_installments,
          frequency: activeLoan.frequency as any,
        } : null,
        today_payment_status: todayPaymentStatus,
        today_payment_amount: todayPaymentAmount,
      };
    });

    // 2. Obtener los últimos 20 cobros registrados por este cobrador
    const recentPaymentsRaw = await db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        eq(payments.collector_id, collectorId),
        sql`${payments.amount_paid} > 0`
      ),
      orderBy: [desc(payments.paid_date)],
      limit: 20,
      with: {
        loan: {
          with: {
            client: true,
          },
        },
      },
    });

    const recentPayments: CollectorRecentPayment[] = recentPaymentsRaw.map((p) => ({
      id: p.id,
      amount_paid: p.amount_paid,
      amount_due: p.amount_due,
      paid_date: p.paid_date ? p.paid_date.toISOString() : p.created_at.toISOString(),
      installment_number: p.installment_number,
      status: p.status as any,
      client_name: p.loan?.client?.full_name || 'Cliente',
    }));

    return {
      ...summary,
      clients: clientItems,
      recentPayments,
    };
  } catch (err) {
    console.error('Error fetching collector detail:', err);
    return null;
  }
}


export async function updateCollector(
  id: string,
  tenantId: string,
  updates: Partial<Pick<User, 'full_name' | 'phone' | 'is_active'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(users)
      .set(updates as any)
      .where(and(
        eq(users.id, id),
        eq(users.tenant_id, tenantId)
      ));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCollector(
  collectorId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, collectorId),
        eq(users.tenant_id, tenantId)
      ),
    });

    if (!targetUser) {
      return { success: false, error: 'Cobrador no encontrado en tu organización.' };
    }

    // 1. Liberar rutas asignadas a este cobrador
    await db.update(collection_routes)
      .set({ collector_id: null })
      .where(and(
        eq(collection_routes.tenant_id, tenantId),
        eq(collection_routes.collector_id, collectorId)
      ));

    // 2. Liberar clientes asignados a este cobrador
    await db.update(clients)
      .set({ collector_id: null })
      .where(and(
        eq(clients.tenant_id, tenantId),
        eq(clients.collector_id, collectorId)
      ));

    // 3. Comprobar si tiene registros contables históricos (pagos o arqueos)
    const [hasPayments, hasClosures] = await Promise.all([
      db.query.payments.findFirst({
        where: eq(payments.collector_id, collectorId),
      }),
      db.query.route_closures.findFirst({
        where: eq(route_closures.collector_id, collectorId),
      }),
    ]);

    if (hasPayments || hasClosures) {
      // Tiene historial contable: Desactivar y revocar acceso inmediatamente para preservar la integridad contable
      await db.update(users)
        .set({
          is_active: false,
          email: `${targetUser.email}.unlinked.${Date.now()}`,
        })
        .where(and(
          eq(users.id, collectorId),
          eq(users.tenant_id, tenantId)
        ));
    } else {
      // Sin historial contable: Borrado físico seguro
      await db.delete(users).where(and(
        eq(users.id, collectorId),
        eq(users.tenant_id, tenantId)
      ));
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error desvinculando cobrador:', err);
    return { success: false, error: err.message || 'Error al desvincular el cobrador.' };
  }
}

/* ---- Invitaciones ---- */

export async function getInvitations(tenantId: string): Promise<Invitation[]> {
  try {
    const results = await db.query.invitations.findMany({
      where: eq(invitations.tenant_id, tenantId),
      orderBy: [desc(invitations.created_at)],
    });
    return results as unknown as Invitation[];
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
}

export async function createInvitation(
  invitationData: any
): Promise<{ data: Invitation | null; error?: string }> {
  try {
    // Default expiry 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [newInvitation] = await db.insert(invitations).values({
      tenant_id: invitationData.tenant_id,
      email: invitationData.email,
      role: invitationData.role,
      invited_by: invitationData.invited_by,
      status: 'pending',
      expires_at: expiresAt,
    }).returning();

    return { data: newInvitation as unknown as Invitation };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteInvitation(id: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(invitations).where(and(
      eq(invitations.id, id),
      eq(invitations.tenant_id, tenantId)
    ));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
