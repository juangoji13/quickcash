'use server';

/* ============================================
 * QuickCash — Dashboard Service
 * KPIs y métricas en tiempo real (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { loans, payments, clients, tenants } from '@/lib/db/schema';
import { eq, and, sql, or, inArray, desc } from 'drizzle-orm';
import type { DashboardKPIs } from '@/types';
import { getClientsRiskMap, syncClientsRisk } from '@/services/clients.service';

export async function getDashboardKPIs(tenantId: string): Promise<DashboardKPIs> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Capital en calle y Préstamos Activos
    const activeLoans = await db.query.loans.findMany({
      where: and(
        eq(loans.status, 'active'),
        eq(loans.tenant_id, tenantId)
      ),
    });

    let capitalInStreet = 0;
    let interestReceivable = 0;

    activeLoans.forEach((loan) => {
      const total = loan.total_amount || 0;
      const paid = (loan.paid_installments || 0) * (loan.installment_amount || 0);
      const principalTotal = loan.principal_amount || 0;
      
      // Amortización de Capital Primero (Opción B)
      const remainingPrincipal = Math.max(0, principalTotal - paid);
      const remainingInterest = Math.max(0, total - paid) - remainingPrincipal;

      capitalInStreet += remainingPrincipal;
      interestReceivable += remainingInterest;
    });

    // 2. Recaudo del día
    const todayCollectedResult = await db.select({
      sum: sql<number>`sum(${payments.amount_paid})`
    }).from(payments)
      .where(and(
        eq(payments.tenant_id, tenantId),
        sql`DATE(${payments.paid_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
      ));

    const todayCollected = Number(todayCollectedResult[0]?.sum || 0);

    // 3. Total esperado hoy
    const todayExpectedResult = await db.select({
      sum: sql<number>`sum(${payments.amount_due})`
    }).from(payments)
      .where(and(
        eq(payments.tenant_id, tenantId),
        sql`DATE(${payments.due_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
      ));

    const todayExpected = Number(todayExpectedResult[0]?.sum || 0);

    // 4. Clientes y Semáforo de Riesgo dinámico
    // Basado en cuotas vencidas: 0 vencidas = verde, 1-2 = amarillo, 3+ = rojo
    const [allClients, riskMap] = await Promise.all([
      db.query.clients.findMany({
        where: eq(clients.tenant_id, tenantId)
      }),
      getClientsRiskMap(tenantId),
    ]);

    // Opcionalmente mantener sincronizado en BD en segundo plano
    syncClientsRisk(tenantId).catch(() => {});

    const riskDist = { green: 0, yellow: 0, red: 0 };
    
    allClients.forEach((c) => {
      const risk = riskMap.get(c.id) || 'green';
      if (risk in riskDist) {
        riskDist[risk as keyof typeof riskDist]++;
      }
    });

    const totalClients = allClients.length;
    const delinquencyRate = totalClients > 0
      ? Math.round(((riskDist.yellow + riskDist.red) / totalClients) * 100 * 10) / 10
      : 0;

    return {
      capital_in_street: capitalInStreet,
      interest_receivable: interestReceivable,
      today_collected: todayCollected,
      today_expected: todayExpected,
      delinquency_rate: delinquencyRate,
      total_active_loans: activeLoans.length,
      total_clients: totalClients,
      risk_distribution: riskDist,
    };
  } catch (error) {
    console.error('Error fetching dashboard KPIs:', error);
    throw error;
  }
}

export async function getUpcomingPayments(tenantId: string, limit: number = 5) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Obtener pagos próximos
    const upcoming = await db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        inArray(payments.status, ['pending', 'partial', 'missed'])
      ),
      with: {
        loan: {
          with: {
            client: true,
          }
        }
      },
      orderBy: [payments.due_date],
    });

    // Solo incluir préstamos activos
    const filtered = upcoming.filter(p => 
      p.loan?.status === 'active' || p.loan?.status === 'defaulted'
    );

    // Unicidad por préstamo
    const seenLoans = new Set<string>();
    const unique = [];

    for (const p of filtered) {
      if (!seenLoans.has(p.loan_id)) {
        seenLoans.add(p.loan_id);
        unique.push(p);
      }
      if (unique.length >= limit) break;
    }

    return unique.map((p) => ({
      id: p.id,
      amount: p.amount_due,
      date: p.due_date.toISOString().split('T')[0],
      clientName: p.loan?.client?.full_name || 'Desconocido',
      status: p.status,
      isOverdue: p.due_date < new Date(),
    }));
  } catch (error) {
    console.error('Error fetching upcoming payments:', error);
    return [];
  }
}

export interface PreviewPaymentItem {
  id: string;
  amount: number;
  dueDate: string;
  clientName: string;
  clientPhone: string | null;
  clientToken: string | null;
  status: 'paid' | 'today' | 'missed' | 'pending';
  installmentNumber: number;
}

export interface PreviewDashboardData {
  capital_in_street: number;
  interest_receivable: number;
  today_collected: number;
  today_expected: number;
  today_progress_pct: number;
  today_paid_count: number;
  today_total_due_count: number;
  delinquency_rate: number;
  total_active_loans: number;
  total_clients: number;
  risk_distribution: { green: number; yellow: number; red: number };
  today_payments: PreviewPaymentItem[];
  membership: {
    status: 'active' | 'grace' | 'locked';
    days_left: number;
    expires_at: string | null;
    is_free_mode: boolean;
  };
}

/**
 * Obtiene los datos completos para el nuevo Dashboard de Prestamista (Fase 2 Preview).
 * NO altera el comportamiento de producción de /overview.
 */
export async function getPreviewDashboardData(tenantId: string): Promise<PreviewDashboardData> {
  const kpis = await getDashboardKPIs(tenantId);

  // 1. Calcular conteo de cuotas cobradas y esperadas hoy
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [paidTodayList, dueTodayList] = await Promise.all([
    db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        eq(payments.status, 'paid'),
        sql`DATE(${payments.paid_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
      ),
    }),
    db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        sql`DATE(${payments.due_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
      ),
    }),
  ]);

  const todayPaidCount = paidTodayList.length;
  const todayTotalDueCount = Math.max(dueTodayList.length, todayPaidCount);

  let progressPct = 0;
  if (kpis.today_expected > 0) {
    progressPct = Math.min(100, Math.round((kpis.today_collected / kpis.today_expected) * 100));
  } else if (kpis.today_collected > 0) {
    progressPct = 100;
  }

  // 2. Pagos de hoy y cobranzas prioritarias
  const candidatePayments = await db.query.payments.findMany({
    where: and(
      eq(payments.tenant_id, tenantId),
      or(
        eq(payments.status, 'missed'),
        and(
          eq(payments.status, 'pending'),
          sql`DATE(${payments.due_date}) <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
        ),
        and(
          eq(payments.status, 'paid'),
          sql`DATE(${payments.paid_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
        )
      )
    ),
    with: {
      loan: {
        with: {
          client: true,
        },
      },
    },
    orderBy: [payments.status, desc(payments.due_date)],
    limit: 8,
  });

  const todayPayments: PreviewPaymentItem[] = candidatePayments.map((p) => {
    let itemStatus: 'paid' | 'today' | 'missed' | 'pending' = 'pending';
    if (p.status === 'paid') {
      itemStatus = 'paid';
    } else if (p.status === 'missed' || p.due_date < startOfDay) {
      itemStatus = 'missed';
    } else {
      itemStatus = 'today';
    }

    return {
      id: p.id,
      amount: p.status === 'paid' ? (p.amount_paid || p.amount_due) : p.amount_due,
      dueDate: p.due_date.toISOString().split('T')[0],
      clientName: p.loan?.client?.full_name || 'Cliente',
      clientPhone: p.loan?.client?.phone || null,
      clientToken: p.loan?.client?.access_token || null,
      status: itemStatus,
      installmentNumber: p.installment_number,
    };
  });

  // 3. Estado de Membresía del Tenant
  let membership = {
    status: 'active' as 'active' | 'grace' | 'locked',
    days_left: 30,
    expires_at: null as string | null,
    is_free_mode: true,
  };

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    const settings = (tenant?.settings as any) || {};
    const billing = settings.billing || {};

    if (billing.expires_at) {
      const expDate = new Date(billing.expires_at);
      const diffMs = expDate.getTime() - Date.now();
      membership.days_left = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      membership.expires_at = billing.expires_at;
      membership.status = billing.status || 'active';
    }
  } catch (e) {
    console.error('Error fetching tenant membership:', e);
  }

  return {
    capital_in_street: kpis.capital_in_street,
    interest_receivable: kpis.interest_receivable,
    today_collected: kpis.today_collected,
    today_expected: kpis.today_expected,
    today_progress_pct: progressPct,
    today_paid_count: todayPaidCount,
    today_total_due_count: todayTotalDueCount,
    delinquency_rate: kpis.delinquency_rate,
    total_active_loans: kpis.total_active_loans,
    total_clients: kpis.total_clients,
    risk_distribution: kpis.risk_distribution,
    today_payments: todayPayments,
    membership,
  };
}
