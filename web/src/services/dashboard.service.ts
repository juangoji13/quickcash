/* ============================================
 * QuickCash — Dashboard Service
 * KPIs y métricas en tiempo real
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { DashboardKPIs } from '@/types';

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const today = new Date().toISOString().split('T')[0];

  // Capital en calle: suma de saldo pendiente de préstamos activos
  const { data: activeLoans } = await supabase
    .from('loans')
    .select('principal_amount, total_amount, paid_installments, installment_amount')
    .eq('status', 'active');

  let capitalInStreet = 0;
  let interestReceivable = 0;

  (activeLoans || []).forEach((loan) => {
    const total = loan.total_amount;
    const paid = (loan.paid_installments || 0) * (loan.installment_amount || 0);
    const remaining = Math.max(0, total - paid);
    
    // Proporción de lo que falta por pagar respecto al total
    const ratio = total > 0 ? remaining / total : 0;
    
    const principalTotal = loan.principal_amount;
    const interestTotal = total - principalTotal;

    capitalInStreet += principalTotal * ratio;
    interestReceivable += interestTotal * ratio;
  });

  // Recaudo del día
  const { data: todayPayments } = await supabase
    .from('payments')
    .select('amount_paid, amount_due')
    .eq('paid_date', today);

  const todayCollected = (todayPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);

  // Total esperado hoy
  const { data: expectedToday } = await supabase
    .from('payments')
    .select('amount_due')
    .eq('due_date', today);

  const todayExpected = (expectedToday || []).reduce((sum, p) => sum + Number(p.amount_due), 0);

  // Distribución de riesgo
  const { data: riskData } = await supabase
    .from('clients')
    .select('risk_status');

  const riskDist = { green: 0, yellow: 0, red: 0 };
  (riskData || []).forEach((c) => {
    if (c.risk_status in riskDist) {
      riskDist[c.risk_status as keyof typeof riskDist]++;
    }
  });

  const totalClients = (riskData || []).length;
  const delinquencyRate = totalClients > 0
    ? Math.round(((riskDist.yellow + riskDist.red) / totalClients) * 100 * 10) / 10
    : 0;

  return {
    capital_in_street: capitalInStreet,
    interest_receivable: interestReceivable,
    today_collected: todayCollected,
    today_expected: todayExpected,
    delinquency_rate: delinquencyRate,
    total_active_loans: (activeLoans || []).length,
    total_clients: totalClients,
    risk_distribution: riskDist,
  };
}

export async function getUpcomingPayments(limit: number = 5) {
  const today = new Date().toISOString().split('T')[0];

  // Obtener TODOS los pagos pendientes (sin límite de fecha) y traer la info del préstamo+cliente
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount_due,
      due_date,
      status,
      loan_id,
      loan:loans (
        id,
        status,
        client:clients (
          full_name
        )
      )
    `)
    .or('status.eq.pending,status.eq.partial,status.eq.missed')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming payments:', error);
    return [];
  }

  // Solo incluir préstamos activos o en mora
  const activePayments = (data || []).filter(
    (p: any) => p.loan?.status === 'active' || p.loan?.status === 'defaulted'
  );

  // Agrupar por loan_id — tomar solo la cuota más próxima por préstamo
  const seenLoans = new Set<string>();
  const uniqueByLoan: typeof activePayments = [];

  for (const p of activePayments) {
    if (!seenLoans.has(p.loan_id)) {
      seenLoans.add(p.loan_id);
      uniqueByLoan.push(p);
    }
    if (uniqueByLoan.length >= limit) break;
  }

  return uniqueByLoan.map((p: any) => ({
    id: p.id,
    amount: p.amount_due,
    date: p.due_date,
    clientName: p.loan?.client?.full_name || 'Desconocido',
    status: p.status,
    isOverdue: p.due_date < today,
  }));
}

