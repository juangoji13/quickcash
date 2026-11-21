'use server';

/* ==============================================================================
 * QuickCash — Talonario Virtual Service
 * Vista pública segura, privada y humanizada de cuotas para el cliente
 * NO expone capital total, deuda acumulada ni tasas de interés.
 * ============================================================================== */

import { db } from '@/lib/db';
import { clients, loans, payments, users } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { formatDate } from '@/lib/utils';

export interface TalonarioInstallmentItem {
  number: number;
  status: 'paid' | 'today' | 'pending' | 'missed';
  paid_date?: string | null;
  paid_time?: string | null;
  due_date: string;
  verification_code?: string;
}

export interface TalonarioData {
  client_name: string;
  first_name: string;
  has_active_loan: boolean;
  installment_amount?: number;
  frequency_label?: string;
  total_installments?: number;
  paid_installments?: number;
  remaining_installments?: number;
  progress_percent?: number;
  encouragement_message?: string;
  collector_name?: string;
  last_payment_note?: string;
  installments: TalonarioInstallmentItem[];
  is_completed?: boolean;
}

export async function getTalonarioData(token: string): Promise<TalonarioData | null> {
  try {
    if (!token) return null;

    // 1. Localizar cliente por su token de acceso público
    const client = await db.query.clients.findFirst({
      where: eq(clients.access_token, token),
    });

    if (!client) {
      return null;
    }

    const firstName = client.full_name.trim().split(' ')[0] || 'Cliente';

    // 2. Buscar préstamo activo del cliente
    const activeLoan = await db.query.loans.findFirst({
      where: and(
        eq(loans.client_id, client.id),
        eq(loans.tenant_id, client.tenant_id),
        eq(loans.status, 'active')
      ),
      orderBy: [desc(loans.created_at)],
    });

    if (!activeLoan) {
      // Verificar si hay algún préstamo completado reciente para mostrar mensaje de felicitación
      const completedLoan = await db.query.loans.findFirst({
        where: and(
          eq(loans.client_id, client.id),
          eq(loans.tenant_id, client.tenant_id),
          eq(loans.status, 'completed')
        ),
        orderBy: [desc(loans.updated_at)],
      });

      return {
        client_name: client.full_name,
        first_name: firstName,
        has_active_loan: false,
        is_completed: !!completedLoan,
        installments: [],
        encouragement_message: completedLoan
          ? '¡Felicidades! Todas tus cuotas han sido canceladas con éxito. Tienes las puertas abiertas con tu prestamista de confianza.'
          : 'En este momento no registras cuotas pendientes de pago. ¡Que tengas un excelente día!',
      };
    }

    // 3. Obtener cuotas programadas del préstamo
    const loanPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.loan_id, activeLoan.id),
        eq(payments.tenant_id, client.tenant_id)
      ),
      orderBy: [asc(payments.installment_number)],
    });

    // 4. Obtener nombre del cobrador asignado
    let collectorName = 'Tu cobrador de confianza';
    if (activeLoan.collector_id) {
      const collectorUser = await db.query.users.findFirst({
        where: eq(users.id, activeLoan.collector_id),
      });
      if (collectorUser && collectorUser.full_name) {
        collectorName = collectorUser.full_name.trim().split(' ')[0] || collectorUser.full_name;
      }
    }

    // Fecha actual en Bogotá (YYYY-MM-DD)
    const nowBogotaStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    let paidCount = 0;
    let lastPaidInfo: { number: number; dateStr: string; code: string } | null = null;
    const items: TalonarioInstallmentItem[] = [];

    for (const p of loanPayments) {
      const isPaid = p.status === 'paid' || p.amount_paid >= p.amount_due;
      const paymentDueDateStr = p.due_date ? new Date(p.due_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '';
      const isToday = paymentDueDateStr === nowBogotaStr;

      let itemStatus: 'paid' | 'today' | 'pending' | 'missed' = 'pending';

      if (isPaid) {
        itemStatus = 'paid';
        paidCount++;
      } else if (isToday) {
        itemStatus = 'today';
      } else if (p.status === 'missed' || (paymentDueDateStr && paymentDueDateStr < nowBogotaStr)) {
        itemStatus = 'missed';
      }

      // Código de verificación amigable basado en ID de pago
      const shortCode = 'QC-' + p.id.replace(/-/g, '').slice(0, 4).toUpperCase();

      let formattedPaidDate: string | null = null;
      let formattedPaidTime: string | null = null;

      if (isPaid && p.paid_date) {
        const pd = new Date(p.paid_date);
        formattedPaidDate = pd.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });
        formattedPaidTime = pd.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });

        lastPaidInfo = {
          number: p.installment_number,
          dateStr: `${formattedPaidDate} · ${formattedPaidTime}`,
          code: shortCode,
        };
      }

      const formattedDueDate = p.due_date
        ? new Date(p.due_date).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
        : `Cuota #${p.installment_number}`;

      items.push({
        number: p.installment_number,
        status: itemStatus,
        paid_date: formattedPaidDate,
        paid_time: formattedPaidTime,
        due_date: formattedDueDate,
        verification_code: isPaid ? shortCode : undefined,
      });
    }

    const totalCount = loanPayments.length || activeLoan.total_installments || 1;
    const remainingCount = Math.max(0, totalCount - paidCount);
    const progressPercent = Math.round((paidCount / totalCount) * 100);

    // Mensaje cálido y motivador humanizado
    let encouragement = '¡Bienvenido! Ten lista tu cuota del día cuando pase tu cobrador.';
    if (progressPercent >= 100) {
      encouragement = '¡Felicidades de corazón! Has completado todas las cuotas de tu crédito con total puntualidad 🎉.';
    } else if (progressPercent >= 80) {
      encouragement = `¡Estás en la recta final! Solo te faltan ${remainingCount} cuoticas para estar al 100% libre. ¡Gran trabajo! 💪`;
    } else if (progressPercent >= 50) {
      encouragement = '¡Ya superaste más de la mitad del camino! Gracias por tu puntualidad y seriedad 👏.';
    } else if (progressPercent > 0) {
      encouragement = `¡Llevas un excelente ritmo! Cada cuota pagada suma a tu buen historial con nosotros.`;
    }

    // Frecuencia en texto natural
    const freqMap: Record<string, string> = {
      daily: 'Cobro diario (Lunes a Sábado)',
      weekly: 'Cobro semanal',
      biweekly: 'Cobro quincenal',
      monthly: 'Cobro mensual',
    };

    return {
      client_name: client.full_name,
      first_name: firstName,
      has_active_loan: true,
      installment_amount: activeLoan.installment_amount,
      frequency_label: freqMap[activeLoan.frequency] || 'Cobro diario',
      total_installments: totalCount,
      paid_installments: paidCount,
      remaining_installments: remainingCount,
      progress_percent: progressPercent,
      encouragement_message: encouragement,
      collector_name: collectorName,
      last_payment_note: lastPaidInfo
        ? `Último pago registrado: Cuota #${lastPaidInfo.number} el ${lastPaidInfo.dateStr} (Sello ${lastPaidInfo.code})`
        : undefined,
      installments: items,
      is_completed: progressPercent >= 100,
    };
  } catch (error) {
    console.error('Error fetching talonario data:', error);
    return null;
  }
}
