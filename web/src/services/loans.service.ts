/* ============================================
 * QuickCash — Loans Service
 * Motor de préstamos y cálculos financieros
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { Loan, LoanWithClient, LoanWithPayments, Payment, InstallmentScheduleItem } from '@/types';

/* ---- Algoritmo de Cronograma de Cuotas ---- */

interface ScheduleOptions {
  principalAmount: number;
  interestRate: number;
  totalInstallments: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  skipNonWorkingDays: boolean;
  nonWorkingDays: string[];  // ['sunday', 'saturday']
  holidays: string[];        // ['2026-12-25', '2026-01-01']
}

export function calculateLoanSchedule(options: ScheduleOptions): {
  totalAmount: number;
  installmentAmount: number;
  endDate: string;
  schedule: InstallmentScheduleItem[];
} {
  const {
    principalAmount,
    interestRate,
    totalInstallments,
    frequency,
    startDate,
    skipNonWorkingDays,
    nonWorkingDays,
    holidays,
  } = options;

  // Calcular montos
  const interestAmount = principalAmount * (interestRate / 100);
  const totalAmount = principalAmount + interestAmount;
  const installmentAmount = Math.ceil(totalAmount / totalInstallments);

  // Generar cronograma de fechas
  const schedule: InstallmentScheduleItem[] = [];
  let currentDate = new Date(startDate + 'T12:00:00');

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function isNonWorkingDay(date: Date): boolean {
    if (!skipNonWorkingDays) return false;

    const dayName = dayNames[date.getDay()];
    if (nonWorkingDays.includes(dayName)) return true;

    const dateStr = date.toISOString().split('T')[0];
    if (holidays.includes(dateStr)) return true;

    return false;
  }

  function getNextBusinessDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (isNonWorkingDay(next)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function addFrequency(date: Date, freq: string): Date {
    const next = new Date(date);
    switch (freq) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  // Primera cuota
  let dueDate = addFrequency(currentDate, frequency);
  if (skipNonWorkingDays) {
    while (isNonWorkingDay(dueDate)) {
      dueDate = getNextBusinessDay(dueDate);
    }
  }

  for (let i = 1; i <= totalInstallments; i++) {
    // Última cuota ajusta el monto para cuadrar exactamente
    const amountDue = i === totalInstallments
      ? totalAmount - (installmentAmount * (totalInstallments - 1))
      : installmentAmount;

    schedule.push({
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      amount_due: amountDue,
      status: 'pending',
      amount_paid: 0,
      paid_date: null,
    });

    if (i < totalInstallments) {
      dueDate = addFrequency(dueDate, frequency);
      if (skipNonWorkingDays) {
        while (isNonWorkingDay(dueDate)) {
          dueDate = getNextBusinessDay(dueDate);
        }
      }
    }
  }

  const endDate = schedule[schedule.length - 1].due_date;

  return {
    totalAmount,
    installmentAmount,
    endDate,
    schedule,
  };
}

/* ---- CRUD de Préstamos ---- */

export async function getLoans(): Promise<LoanWithClient[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      client:clients (id, full_name, document_id, phone, risk_status)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching loans:', error);
    return [];
  }
  return (data || []) as LoanWithClient[];
}

export async function getLoanById(id: string): Promise<LoanWithPayments | null> {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      payments (*)
    `)
    .eq('id', id)
    .order('installment_number', { referencedTable: 'payments', ascending: true })
    .single();

  if (error) {
    console.error('Error fetching loan:', error);
    return null;
  }
  return data as LoanWithPayments;
}

export async function createLoan(
  loanData: {
    tenant_id: string;
    client_id: string;
    collector_id: string;
    principal_amount: number;
    interest_rate: number;
    total_amount: number;
    total_installments: number;
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    installment_amount: number;
    start_date: string;
    end_date: string;
    skip_non_working_days: boolean;
  },
  schedule: InstallmentScheduleItem[]
): Promise<{ data: Loan | null; error?: string }> {
  // Crear préstamo
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .insert(loanData)
    .select()
    .single();

  if (loanError) return { data: null, error: loanError.message };

  // Crear todas las cuotas del cronograma
  const payments: Omit<Payment, 'id' | 'created_at' | 'updated_at'>[] = schedule.map((item) => ({
    tenant_id: loanData.tenant_id,
    loan_id: loan.id,
    collector_id: loanData.collector_id,
    installment_number: item.installment_number,
    amount_due: item.amount_due,
    amount_paid: 0,
    due_date: item.due_date,
    paid_date: null,
    status: 'pending' as const,
    latitude: null,
    longitude: null,
    is_locked: false,
  }));

  const { error: paymentsError } = await supabase
    .from('payments')
    .insert(payments);

  if (paymentsError) {
    console.error('Error creating payment schedule:', paymentsError);
    // Loan was created but payments failed — log for admin review
    return { data: loan, error: `Préstamo creado pero error en cuotas: ${paymentsError.message}` };
  }

  return { data: loan };
}

/* ---- Registro de Pagos ---- */

export async function registerPayment(
  paymentId: string,
  amountPaid: number,
  latitude?: number,
  longitude?: number
): Promise<{ success: boolean; error?: string }> {
  // Obtener información del pago actual
  const { data: currentPayment, error: fetchErr } = await supabase
    .from('payments')
    .select('amount_due, loan_id, installment_number, is_locked, due_date')
    .eq('id', paymentId)
    .single();

  if (fetchErr || !currentPayment) {
    return { success: false, error: fetchErr?.message || 'Cuota no encontrada' };
  }

  if (currentPayment.is_locked) {
    return { success: false, error: 'Esta cuota ya ha sido registrada' };
  }

  let status = 'paid';
  if (amountPaid === 0) status = 'missed';
  else if (amountPaid < currentPayment.amount_due) status = 'partial';

  const { error } = await supabase
    .from('payments')
    .update({
      amount_paid: amountPaid,
      paid_date: new Date().toISOString().split('T')[0],
      status,
      latitude: latitude || null,
      longitude: longitude || null,
      is_locked: true,
    })
    .eq('id', paymentId);

  if (error) return { success: false, error: error.message };

  // Fetch parent loan for total_installments and frequency
  const { data: currentLoan } = await supabase
    .from('loans')
    .select('paid_installments, total_installments, frequency')
    .eq('id', currentPayment.loan_id)
    .single();

  if (!currentLoan) return { success: true };

  // Lógica de traslado de saldo: Si hay faltante (partial o missed), sumar el restante 
  if (amountPaid < currentPayment.amount_due) {
    const remainder = currentPayment.amount_due - amountPaid;
    
    // Si estamos en la última cuota (o la pasamos), creamos una cuota adicional
    if (currentPayment.installment_number >= currentLoan.total_installments) {
      const nextDate = new Date(currentPayment.due_date + 'T12:00:00');
      const addDays = currentLoan.frequency === 'daily' ? 1 
                    : currentLoan.frequency === 'weekly' ? 7 
                    : currentLoan.frequency === 'biweekly' ? 14 
                    : 30; // approx monthly
      nextDate.setDate(nextDate.getDate() + addDays);

      await supabase.from('payments').insert({
        loan_id: currentPayment.loan_id,
        installment_number: currentPayment.installment_number + 1,
        amount_due: remainder,
        due_date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        is_locked: false
      });

      // Expandimos el total de cuotas del préstamo
      await supabase.from('loans').update({
        total_installments: currentLoan.total_installments + 1
      }).eq('id', currentPayment.loan_id);
      
    } else {
      // Sumar a la siguiente cuota existente
      const { data: nextPayment } = await supabase
        .from('payments')
        .select('id, amount_due')
        .eq('loan_id', currentPayment.loan_id)
        .eq('installment_number', currentPayment.installment_number + 1)
        .single();

      if (nextPayment) {
        await supabase
          .from('payments')
          .update({ amount_due: nextPayment.amount_due + remainder })
          .eq('id', nextPayment.id);
      }
    }
  }

  // Actualizar status del préstamo
  const newPaid = currentLoan.paid_installments + (status === 'paid' ? 1 : 0);
  
  // Es completado si es un pago FULL y con este pago se cubren todas las cuotas
  // (Nota: Si fue partial/missed, total_installments se expandió o no sumó paid)
  // Re-fetch currentLoan total_installments to be safe incase it increased
  const currentTotal = amountPaid < currentPayment.amount_due ? currentLoan.total_installments + 1 : currentLoan.total_installments;
  const isCompleted = (status === 'paid' && newPaid >= currentTotal);

  await supabase
    .from('loans')
    .update({ 
      paid_installments: newPaid,
      ...(isCompleted ? { status: 'completed' } : {})
    })
    .eq('id', currentPayment.loan_id);

  return { success: true };
}

/* ---- Día de Gracia (Desplazamiento) ---- */

export async function applyGraceDay(
  loanId: string,
  missedPaymentId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Marcar el pago como "grace"
  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: 'grace', is_locked: true })
    .eq('id', missedPaymentId);

  if (updateError) return { success: false, error: updateError.message };

  // 2. Obtener el préstamo para recalcular
  const { data: loan } = await supabase
    .from('loans')
    .select('end_date')
    .eq('id', loanId)
    .single();

  if (!loan) return { success: false, error: 'Préstamo no encontrado' };

  // 3. Extender la fecha final del préstamo en 1 día
  const endDate = new Date(loan.end_date + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 1);

  const { error: loanError } = await supabase
    .from('loans')
    .update({ end_date: endDate.toISOString().split('T')[0] })
    .eq('id', loanId);

  if (loanError) return { success: false, error: loanError.message };

  return { success: true };
}

/* ---- Motor de Renovaciones ---- */

export function calculateRenewal(
  currentLoan: Loan,
  newPrincipal: number,
  newInterestRate: number,
  newInstallments: number
): {
  remainingBalance: number;
  netToDiburse: number;
  newTotalAmount: number;
} {
  // Calcular saldo pendiente del préstamo actual
  const paidAmount = currentLoan.installment_amount * currentLoan.paid_installments;
  const remainingBalance = currentLoan.total_amount - paidAmount;

  // Calcular nuevo préstamo
  const newInterest = newPrincipal * (newInterestRate / 100);
  const newTotalAmount = newPrincipal + newInterest;

  // El neto a entregar es: nuevo capital - lo que debe del anterior
  const netToDiburse = newPrincipal - remainingBalance;

  return {
    remainingBalance,
    netToDiburse,
    newTotalAmount,
  };
}

/* ---- Eliminar Préstamo Completo ---- */
export async function deleteLoan(loanId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Borrar pagos (si no hay CASCADE configurado, evita error fk)
  const { error: paymentsErr } = await supabase
    .from('payments')
    .delete()
    .eq('loan_id', loanId);

  if (paymentsErr) {
    return { success: false, error: paymentsErr.message };
  }

  // 2. Borrar préstamo
  const { error: loanErr } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId);

  if (loanErr) {
    return { success: false, error: loanErr.message };
  }

  return { success: true };
}

/* ---- Saldar Crédito Completo (pago total) ---- */
export async function payOffLoan(loanId: string): Promise<{ success: boolean; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  // 1. Obtener todas las cuotas pendientes
  const { data: pendingPayments, error: fetchErr } = await supabase
    .from('payments')
    .select('id, amount_due')
    .eq('loan_id', loanId)
    .in('status', ['pending', 'partial', 'missed'])
    .order('installment_number', { ascending: true });

  if (fetchErr || !pendingPayments) {
    return { success: false, error: fetchErr?.message || 'Error al obtener cuotas' };
  }

  // 2. Marcar cada cuota pendiente como pagada hoy con su monto completo
  for (const p of pendingPayments) {
    await supabase
      .from('payments')
      .update({
        amount_paid: p.amount_due,
        status: 'paid',
        paid_date: today,
        is_locked: true,
      })
      .eq('id', p.id);
  }

  // 3. Marcar el préstamo como completado
  const { data: loan } = await supabase
    .from('loans')
    .select('total_installments')
    .eq('id', loanId)
    .single();

  await supabase
    .from('loans')
    .update({
      status: 'completed',
      paid_installments: loan?.total_installments || 0,
    })
    .eq('id', loanId);

  return { success: true };
}

