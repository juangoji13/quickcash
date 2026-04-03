/* ============================================
 * QuickCash — Loans Service
 * Motor de préstamos y cálculos financieros (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { loans, payments, clients, users } from '@/lib/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { Loan, LoanWithClient, LoanWithPayments, Payment, InstallmentScheduleItem, LoanStatus } from '@/types';

/* ---- Algoritmo de Cronograma de Cuotas ---- */

interface ScheduleOptions {
  principalAmount: number;
  interestRate: number;
  totalInstallments: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  skipNonWorkingDays: boolean;
  nonWorkingDays: string[]; 
  holidays: string[];        
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

  const interestAmount = principalAmount * (interestRate / 100);
  const totalAmount = principalAmount + interestAmount;
  const installmentAmount = Math.ceil(totalAmount / totalInstallments);

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
      case 'daily': next.setDate(next.getDate() + 1); break;
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'biweekly': next.setDate(next.getDate() + 14); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
    }
    return next;
  }

  let dueDate = addFrequency(currentDate, frequency);
  if (skipNonWorkingDays) {
    while (isNonWorkingDay(dueDate)) {
      dueDate = getNextBusinessDay(dueDate);
    }
  }

  for (let i = 1; i <= totalInstallments; i++) {
    const amountDue = i === totalInstallments
      ? totalAmount - (installmentAmount * (totalInstallments - 1))
      : installmentAmount;

    schedule.push({
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      amount_due: amountDue,
      status: 'pending' as any,
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

  return { totalAmount, installmentAmount, endDate, schedule };
}

/* ---- CRUD de Préstamos ---- */

export async function getLoans(): Promise<LoanWithClient[]> {
  try {
    const results = await db.query.loans.findMany({
      with: {
        client: true,
      },
      orderBy: [desc(loans.created_at)],
    });

    return results as unknown as LoanWithClient[];
  } catch (error) {
    console.error('Error fetching loans:', error);
    return [];
  }
}

export async function getLoanById(id: string): Promise<LoanWithPayments | null> {
  try {
    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, id),
      with: {
        payments: {
          orderBy: [asc(payments.installment_number)],
        },
      },
    });

    return loan as unknown as LoanWithPayments;
  } catch (error) {
    console.error('Error fetching loan:', error);
    return null;
  }
}

export async function getLoansByClientId(clientId: string): Promise<LoanWithPayments[]> {
  try {
    const results = await db.query.loans.findMany({
      where: eq(loans.client_id, clientId),
      with: {
        payments: {
          orderBy: [asc(payments.installment_number)],
        },
      },
      orderBy: [desc(loans.created_at)],
    });

    return results as unknown as LoanWithPayments[];
  } catch (error) {
    console.error('Error fetching client loans:', error);
    return [];
  }
}

export async function createLoan(
  loanData: any,
  schedule: InstallmentScheduleItem[]
): Promise<{ data: any | null; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Insertar el préstamo
      const [newLoan] = await tx.insert(loans).values({
        tenant_id: loanData.tenant_id,
        client_id: loanData.client_id,
        collector_id: loanData.collector_id,
        principal_amount: loanData.principal_amount,
        interest_rate: loanData.interest_rate,
        total_amount: loanData.total_amount,
        balance: loanData.total_amount,
        total_installments: loanData.total_installments,
        installment_amount: loanData.installment_amount,
        frequency: loanData.frequency,
        status: 'active',
        start_date: new Date(loanData.start_date),
        end_date: new Date(loanData.end_date),
        skip_non_working_days: loanData.skip_non_working_days || false,
      }).returning();

      // 2. Insertar cuotas
      const paymentValues = schedule.map((item) => ({
        tenant_id: loanData.tenant_id,
        loan_id: newLoan.id,
        collector_id: loanData.collector_id,
        installment_number: item.installment_number,
        amount_due: item.amount_due,
        amount_paid: 0,
        due_date: new Date(item.due_date),
        status: 'pending',
        is_locked: false,
      }));

      await tx.insert(payments).values(paymentValues);

      return { data: newLoan };
    });
  } catch (err: any) {
    console.error('Error in createLoan:', err);
    return { data: null, error: err.message };
  }
}

/* ---- Registro de Pagos ---- */

export async function registerPayment(
  paymentId: string,
  amountPaid: number,
  latitude?: number,
  longitude?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentPayment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
    });

    if (!currentPayment) return { success: false, error: 'Cuota no encontrada' };
    if (currentPayment.is_locked) return { success: false, error: 'Esta cuota ya ha sido registrada' };

    let status = 'paid';
    if (amountPaid === 0) status = 'missed';
    else if (amountPaid < currentPayment.amount_due) status = 'partial';

    await db.transaction(async (tx) => {
      await tx.update(payments).set({
        amount_paid: amountPaid,
        paid_date: new Date(),
        status: status as any,
        latitude: latitude || null,
        longitude: longitude || null,
        is_locked: true,
      }).where(eq(payments.id, paymentId));

      const currentLoan = await tx.query.loans.findFirst({
        where: eq(loans.id, currentPayment.loan_id),
      });

      if (!currentLoan) return;

      // Lógica de traslado de saldo
      if (amountPaid < currentPayment.amount_due) {
        const remainder = currentPayment.amount_due - amountPaid;
        
        if (currentPayment.installment_number >= currentLoan.total_installments) {
          // Nueva cuota al final
          const nextDate = new Date(currentPayment.due_date);
          const addDays = currentLoan.frequency === 'daily' ? 1 
                        : currentLoan.frequency === 'weekly' ? 7 
                        : currentLoan.frequency === 'biweekly' ? 14 
                        : 30;
          nextDate.setDate(nextDate.getDate() + addDays);

          await tx.insert(payments).values({
            tenant_id: currentLoan.tenant_id,
            loan_id: currentLoan.id,
            collector_id: currentLoan.collector_id,
            installment_number: currentPayment.installment_number + 1,
            amount_due: remainder,
            due_date: nextDate,
            status: 'pending',
          });

          await tx.update(loans).set({
            total_installments: currentLoan.total_installments + 1,
            balance: (currentLoan.balance || 0) - amountPaid,
          }).where(eq(loans.id, currentLoan.id));
        } else {
          // Sumar a la siguiente
          const nextPayment = await tx.query.payments.findFirst({
            where: and(
              eq(payments.loan_id, currentLoan.id),
              eq(payments.installment_number, currentPayment.installment_number + 1)
            ),
          });

          if (nextPayment) {
            await tx.update(payments).set({
              amount_due: nextPayment.amount_due + remainder,
            }).where(eq(payments.id, nextPayment.id));
          }
        }
      }

      // Actualizar status del préstamo
      const newPaidInstallments = currentLoan.paid_installments + (status === 'paid' ? 1 : 0);
      const isCompleted = (status === 'paid' && newPaidInstallments >= currentLoan.total_installments);

      await tx.update(loans).set({
        paid_installments: newPaidInstallments,
        balance: (currentLoan.balance || 0) - amountPaid,
        status: isCompleted ? 'completed' : 'active',
      }).where(eq(loans.id, currentLoan.id));
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error in registerPayment:', err);
    return { success: false, error: err.message };
  }
}

/* ---- Día de Gracia ---- */

export async function applyGraceDay(
  loanId: string,
  missedPaymentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx.update(payments).set({
        status: 'grace' as any,
        is_locked: true,
      }).where(eq(payments.id, missedPaymentId));

      const loanRecord = await tx.query.loans.findFirst({
        where: eq(loans.id, loanId),
      });

      if (loanRecord) {
        const newEndDate = new Date(loanRecord.end_date);
        newEndDate.setDate(newEndDate.getDate() + 1);
        await tx.update(loans).set({
          end_date: newEndDate,
        }).where(eq(loans.id, loanId));
      }
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
  const paidAmount = currentLoan.installment_amount * (currentLoan.paid_installments || 0);
  const remainingBalance = currentLoan.total_amount - paidAmount;
  const newInterest = newPrincipal * (newInterestRate / 100);
  const newTotalAmount = newPrincipal + newInterest;
  const netToDiburse = newPrincipal - remainingBalance;

  return { remainingBalance, netToDiburse, newTotalAmount };
}

/* ---- Eliminar Préstamo ---- */

export async function deleteLoan(loanId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(payments).where(eq(payments.loan_id, loanId));
      await tx.delete(loans).where(eq(loans.id, loanId));
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ---- Saldar Crédito ---- */

export async function payOffLoan(loanId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction(async (tx) => {
      const pending = await tx.query.payments.findMany({
        where: and(
          eq(payments.loan_id, loanId),
          sql`${payments.status} IN ('pending', 'partial', 'missed')`
        ),
      });

      for (const p of pending) {
        await tx.update(payments).set({
          amount_paid: p.amount_due,
          status: 'paid',
          paid_date: new Date(),
          is_locked: true,
        }).where(eq(payments.id, p.id));
      }

      const loanRecord = await tx.query.loans.findFirst({ where: eq(loans.id, loanId) });
      await tx.update(loans).set({
        status: 'completed',
        paid_installments: loanRecord?.total_installments || 0,
        balance: 0,
      }).where(eq(loans.id, loanId));
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
