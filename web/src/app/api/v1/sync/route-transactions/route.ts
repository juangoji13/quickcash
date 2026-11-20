/* ============================================
 * QuickCash — Batch Offline Sync API Route Handler
 * Sincronización en lote de transacciones offline
 * ============================================ */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { payments, loans } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface SyncTransactionItem {
  localId: string;
  paymentId: string;
  amountPaid: number;
  status: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

export interface SyncBatchRequest {
  transactions: SyncTransactionItem[];
}

export async function POST(request: Request) {
  try {
    // 1. Seguridad: Validar sesión de servidor
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Se requiere sesión activa.' },
        { status: 401 }
      );
    }

    const tenantId = (session.user as any).tenantId as string | undefined;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. La sesión no contiene una organización válida.' },
        { status: 401 }
      );
    }

    // 2. Validar payload de entrada
    const body: SyncBatchRequest = await request.json();
    const transactions = body?.transactions;

    if (!Array.isArray(transactions)) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido. Se espera el campo { transactions: [...] }.' },
        { status: 400 }
      );
    }

    const syncedIds: string[] = [];

    // 3. Procesamiento Transaccional ACID
    for (const txItem of transactions) {
      const { localId, paymentId, amountPaid, latitude, longitude, timestamp } = txItem;

      if (!paymentId || !localId) {
        continue;
      }

      const amt = Number(amountPaid) || 0;

      try {
        await db.transaction(async (tx) => {
          // Verificar que el pago pertenezca al tenant verificado
          const currentPayment = await tx.query.payments.findFirst({
            where: and(
              eq(payments.id, paymentId),
              eq(payments.tenant_id, tenantId)
            ),
          });

          if (!currentPayment) {
            console.warn(`Payment ${paymentId} not found or does not belong to tenant ${tenantId}`);
            return;
          }

          // Si ya está bloqueado (ya fue procesado o sincronizado previamente), confirmar synced
          if (currentPayment.is_locked) {
            syncedIds.push(localId);
            return;
          }

          // Determinar estado de la transacción
          let paymentStatus: 'paid' | 'partial' | 'missed' = 'paid';
          if (amt === 0) {
            paymentStatus = 'missed';
          } else if (amt < currentPayment.amount_due) {
            paymentStatus = 'partial';
          }

          // Respetar timestamp original de cobro offline para flujo de caja real
          const paidDate = timestamp ? new Date(timestamp) : new Date();

          // Actualizar cuota
          await tx.update(payments).set({
            amount_paid: amt,
            paid_date: paidDate,
            status: paymentStatus,
            latitude: latitude || null,
            longitude: longitude || null,
            is_locked: true,
          }).where(eq(payments.id, paymentId));

          // Cargar información del crédito
          const currentLoan = await tx.query.loans.findFirst({
            where: eq(loans.id, currentPayment.loan_id),
          });

          if (!currentLoan) {
            syncedIds.push(localId);
            return;
          }

          // Lógica de traslado de saldo si fue pago parcial
          if (amt < currentPayment.amount_due) {
            const remainder = currentPayment.amount_due - amt;

            if (currentPayment.installment_number >= currentLoan.total_installments) {
              // Si era la última cuota, generar una adicional con el saldo restante
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
                balance: (currentLoan.balance || 0) - amt,
              }).where(eq(loans.id, currentLoan.id));
            } else {
              // Sumar el saldo restante a la siguiente cuota inmediata
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

          // Actualizar estatus y saldo del crédito de forma matemáticamente exacta
          const newPaidInstallments = currentLoan.paid_installments + (paymentStatus === 'paid' ? 1 : 0);
          const newBalance = Math.max(0, (currentLoan.balance ?? currentLoan.total_amount ?? 0) - amt);
          const isCompleted = newBalance <= 0 || (paymentStatus === 'paid' && newPaidInstallments >= currentLoan.total_installments);

          await tx.update(loans).set({
            paid_installments: newPaidInstallments,
            balance: newBalance,
            status: isCompleted ? 'completed' : 'active',
          }).where(eq(loans.id, currentLoan.id));

          syncedIds.push(localId);
        });
      } catch (itemErr: any) {
        console.error(`Error processing offline tx ${localId}:`, itemErr);
      }
    }

    // 4. Respuesta exitosa con confirmación de IDs sincronizados
    return NextResponse.json({
      success: true,
      processed: syncedIds.length,
      syncedIds,
    });
  } catch (error: any) {
    console.error('Error in batch sync route handler:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor en sincronización.' },
      { status: 500 }
    );
  }
}
