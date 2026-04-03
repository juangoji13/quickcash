'use server';

/* ============================================
 * QuickCash — Dashboard Service
 * KPIs y métricas en tiempo real (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { loans, payments, clients } from '@/lib/db/schema';
import { eq, and, sql, or, inArray } from 'drizzle-orm';
import type { DashboardKPIs } from '@/types';

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Capital en calle y Préstamos Activos
    const activeLoans = await db.query.loans.findMany({
      where: eq(loans.status, 'active'),
    });

    let capitalInStreet = 0;
    let interestReceivable = 0;

    activeLoans.forEach((loan) => {
      const total = loan.total_amount;
      const paid = (loan.paid_installments || 0) * (loan.installment_amount || 0);
      const remaining = Math.max(0, total - paid);
      const ratio = total > 0 ? remaining / total : 0;
      
      const principalTotal = loan.principal_amount;
      const interestTotal = total - principalTotal;

      capitalInStreet += principalTotal * ratio;
      interestReceivable += interestTotal * ratio;
    });

    // 2. Recaudo del día
    // Comparison in SQL for dates can be tricky with timestamps, so we use sql template
    const todayCollectedResult = await db.select({
      sum: sql<number>`sum(${payments.amount_paid})`
    }).from(payments)
      .where(sql`DATE(${payments.paid_date}) = CURRENT_DATE`);

    const todayCollected = Number(todayCollectedResult[0]?.sum || 0);

    // 3. Total esperado hoy
    const todayExpectedResult = await db.select({
      sum: sql<number>`sum(${payments.amount_due})`
    }).from(payments)
      .where(sql`DATE(${payments.due_date}) = CURRENT_DATE`);

    const todayExpected = Number(todayExpectedResult[0]?.sum || 0);

    // 4. Clientes y Riesgo
    const allClients = await db.query.clients.findMany();
    const riskDist = { green: 0, yellow: 0, red: 0 };
    
    allClients.forEach((c) => {
      if (c.risk_status in riskDist) {
        riskDist[c.risk_status as keyof typeof riskDist]++;
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

export async function getUpcomingPayments(limit: number = 5) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Obtener pagos próximos
    const upcoming = await db.query.payments.findMany({
      where: inArray(payments.status, ['pending', 'partial', 'missed']),
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
