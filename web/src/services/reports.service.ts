'use server';

/* ============================================
 * QuickCash — Reports Service
 * Reportes financieros y análisis (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { payments, loans, users, clients } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface FinancialReport {
  period: string;
  capital_deployed: number;
  interest_earned: number;
  total_collected: number;
  total_expected: number;
  collection_rate: number;
  new_loans: number;
  completed_loans: number;
  defaulted_loans: number;
}

export async function getCollectionReport(dateFrom: string, dateTo: string, tenantId: string): Promise<FinancialReport> {
  try {
    const from = new Date(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000`);
    const to = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999`);

    // Recaudo del periodo bajo criterio de caja (flujo real de dinero por paid_date)
    const paidPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        gte(payments.paid_date, from),
        lte(payments.paid_date, to)
      ),
    });

    const totalCollected = paidPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

    // Cuotas esperadas en el periodo por calendario de vencimientos (due_date)
    const expectedPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.tenant_id, tenantId),
        gte(payments.due_date, from),
        lte(payments.due_date, to)
      ),
    });

    const totalExpected = expectedPayments.reduce((sum, p) => sum + Number(p.amount_due), 0);

    // Préstamos creados en el periodo
    const newLoansList = await db.query.loans.findMany({
      where: and(
        eq(loans.tenant_id, tenantId),
        gte(loans.created_at, from),
        lte(loans.created_at, to)
      ),
    });

    const capitalDeployed = newLoansList.reduce((sum, l) => sum + Number(l.principal_amount), 0);
    const interestEarned = newLoansList.reduce((sum, l) =>
      sum + (Number(l.principal_amount) * Number(l.interest_rate) / 100), 0);

    return {
      period: `${dateFrom} — ${dateTo}`,
      capital_deployed: capitalDeployed,
      interest_earned: interestEarned,
      total_collected: totalCollected,
      total_expected: totalExpected,
      collection_rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100 * 10) / 10 : 0,
      new_loans: newLoansList.length,
      completed_loans: newLoansList.filter(l => l.status === 'completed').length,
      defaulted_loans: newLoansList.filter(l => l.status === 'defaulted').length,
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

export interface CollectorPerformance {
  collector_id: string;
  collector_name: string;
  total_collected: number;
  total_expected: number;
  collection_rate: number;
  total_clients: number;
  active_loans: number;
}

export async function getCollectorPerformance(tenantId: string): Promise<CollectorPerformance[]> {
  try {
    const collectors = await db.query.users.findMany({
      where: and(
        eq(users.role, 'collector'),
        eq(users.tenant_id, tenantId)
      ),
    });

    const results: CollectorPerformance[] = [];

    for (const collector of collectors) {
      // Recaudo del día (flujo real por paid_date)
      const todayCollectedPayments = await db.query.payments.findMany({
        where: and(
          eq(payments.collector_id, collector.id),
          eq(payments.tenant_id, tenantId),
          sql`DATE(${payments.paid_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
        ),
      });

      // Cobro esperado del día (por due_date)
      const todayExpectedPayments = await db.query.payments.findMany({
        where: and(
          eq(payments.collector_id, collector.id),
          eq(payments.tenant_id, tenantId),
          sql`DATE(${payments.due_date}) = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
        ),
      });

      const collectorClients = await db.query.clients.findMany({
        where: and(
          eq(clients.collector_id, collector.id),
          eq(clients.tenant_id, tenantId)
        ),
      });

      const activeLoans = await db.query.loans.findMany({
        where: and(
          eq(loans.collector_id, collector.id),
          eq(loans.tenant_id, tenantId),
          eq(loans.status, 'active')
        ),
      });

      const totalCollected = todayCollectedPayments.reduce((s, p) => s + Number(p.amount_paid), 0);
      const totalExpected = todayExpectedPayments.reduce((s, p) => s + Number(p.amount_due), 0);

      results.push({
        collector_id: collector.id,
        collector_name: collector.full_name || 'Sin Nombre',
        total_collected: totalCollected,
        total_expected: totalExpected,
        collection_rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
        total_clients: collectorClients.length,
        active_loans: activeLoans.length,
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching collector performance:', error);
    return [];
  }
}
