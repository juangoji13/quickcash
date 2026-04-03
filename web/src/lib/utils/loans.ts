/* ============================================
 * QuickCash — Loan Calculation Utilities
 * Funciones puras de cálculo (Sin DB)
 * ============================================ */

export interface InstallmentScheduleItem {
  installment_number: number;
  due_date: string;
  amount_due: number;
  status: 'pending' | 'partial' | 'paid' | 'missed' | 'grace';
  amount_paid: number;
  paid_date: string | null;
}

export interface ScheduleOptions {
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

  return { totalAmount, installmentAmount, endDate, schedule };
}

export function calculateRenewal(
  currentLoan: any,
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
