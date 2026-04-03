/* ============================================
 * QuickCash — Reports Service
 * Reportes financieros y análisis
 * ============================================ */

import { supabase } from '@/lib/supabase/client';

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

export async function getCollectionReport(dateFrom: string, dateTo: string): Promise<FinancialReport> {
  // Pagos en el periodo
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid, amount_due, status')
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo);

  const totalCollected = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalExpected = (payments || []).reduce((sum, p) => sum + Number(p.amount_due), 0);

  // Préstamos creados en el periodo
  const { data: newLoans } = await supabase
    .from('loans')
    .select('id, principal_amount, interest_rate, status')
    .gte('created_at', dateFrom + 'T00:00:00')
    .lte('created_at', dateTo + 'T23:59:59');

  const capitalDeployed = (newLoans || []).reduce((sum, l) => sum + Number(l.principal_amount), 0);
  const interestEarned = (newLoans || []).reduce((sum, l) =>
    sum + (Number(l.principal_amount) * Number(l.interest_rate) / 100), 0);

  return {
    period: `${dateFrom} — ${dateTo}`,
    capital_deployed: capitalDeployed,
    interest_earned: interestEarned,
    total_collected: totalCollected,
    total_expected: totalExpected,
    collection_rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100 * 10) / 10 : 0,
    new_loans: (newLoans || []).length,
    completed_loans: (newLoans || []).filter(l => l.status === 'completed').length,
    defaulted_loans: (newLoans || []).filter(l => l.status === 'defaulted').length,
  };
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

export async function getCollectorPerformance(): Promise<CollectorPerformance[]> {
  const today = new Date().toISOString().split('T')[0];

  // Get all collectors
  const { data: collectors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('role', 'collector');

  if (!collectors || collectors.length === 0) return [];

  const results: CollectorPerformance[] = [];

  for (const collector of collectors) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_paid, amount_due')
      .eq('collector_id', collector.id)
      .eq('due_date', today);

    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('collector_id', collector.id);

    const { data: loans } = await supabase
      .from('loans')
      .select('id')
      .eq('collector_id', collector.id)
      .eq('status', 'active');

    const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount_paid), 0);
    const totalExpected = (payments || []).reduce((s, p) => s + Number(p.amount_due), 0);

    results.push({
      collector_id: collector.id,
      collector_name: collector.full_name,
      total_collected: totalCollected,
      total_expected: totalExpected,
      collection_rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
      total_clients: (clients || []).length,
      active_loans: (loans || []).length,
    });
  }

  return results;
}
