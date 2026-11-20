'use server';

/* ============================================
 * QuickCash — Collection Routes Service
 * CRUD de Rutas de Cobro (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { collection_routes, clients, users, loans, payments, route_closures } from '@/lib/db/schema';
import { eq, and, or, desc, asc, sql, inArray, isNull } from 'drizzle-orm';
import type { CollectionRoute, CollectionRouteWithDetails } from '@/types';

/* ---- GET: Todas las rutas ---- */

export async function getCollectionRoutes(tenantId: string): Promise<CollectionRouteWithDetails[]> {
  try {
    const results = await db.query.collection_routes.findMany({
      where: eq(collection_routes.tenant_id, tenantId),
      with: {
        collector: true,
        clients: true,
      },
      orderBy: [desc(collection_routes.created_at)],
    });

    const routes = results as unknown as CollectionRouteWithDetails[];

    for (const route of routes) {
      if (route.clients && route.clients.length > 0) {
        const clientIds = route.clients.map(c => c.id);

        const activeLoans = await db.query.loans.findMany({
          where: and(
            inArray(loans.client_id, clientIds),
            eq(loans.status, 'active')
          ),
        });

        const loanIds = activeLoans.map(l => l.id);
        
        if (loanIds.length > 0) {
          const todayCollectedResult = await db.select({
            sum: sql<number>`coalesce(sum(${payments.amount_paid}), 0)`
          }).from(payments)
            .where(and(
              inArray(payments.loan_id, loanIds),
              eq(payments.tenant_id, tenantId),
              sql`${payments.amount_paid} > 0`,
              sql`DATE(${payments.paid_date} AT TIME ZONE 'America/Bogota') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
            ));

          route.total_daily_quota = activeLoans.reduce((sum, l) => sum + l.installment_amount, 0);
          route.total_collected_today = Number(todayCollectedResult[0]?.sum || 0);
        } else {
          route.total_daily_quota = 0;
          route.total_collected_today = 0;
        }
      } else {
        route.total_daily_quota = 0;
        route.total_collected_today = 0;
      }
    }

    return routes;
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
}

/* ---- GET: Una ruta ---- */

export async function getRouteById(id: string, tenantId: string): Promise<CollectionRouteWithDetails | null> {
  try {
    const result = await db.query.collection_routes.findFirst({
      where: and(
        eq(collection_routes.id, id),
        eq(collection_routes.tenant_id, tenantId)
      ),
      with: {
        collector: true,
        clients: true,
      },
    });

    if (!result) return null;

    const route = result as unknown as CollectionRouteWithDetails;

    if (route.clients && route.clients.length > 0) {
      const clientIds = route.clients.map((c) => c.id);
      const activeLoans = await db.query.loans.findMany({
        where: and(
          inArray(loans.client_id, clientIds),
          eq(loans.status, 'active')
        ),
      });

      const loanIds = activeLoans.map((l) => l.id);
      if (loanIds.length > 0) {
        const todayCollectedResult = await db.select({
          sum: sql<number>`coalesce(sum(${payments.amount_paid}), 0)`
        }).from(payments)
          .where(and(
            inArray(payments.loan_id, loanIds),
            eq(payments.tenant_id, tenantId),
            sql`${payments.amount_paid} > 0`,
            sql`DATE(${payments.paid_date} AT TIME ZONE 'America/Bogota') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`
          ));

        route.total_daily_quota = activeLoans.reduce((sum, l) => sum + l.installment_amount, 0);
        route.total_collected_today = Number(todayCollectedResult[0]?.sum || 0);
      } else {
        route.total_daily_quota = 0;
        route.total_collected_today = 0;
      }
    } else {
      route.total_daily_quota = 0;
      route.total_collected_today = 0;
    }

    return route;
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  }
}

/* ---- POST: Crear ruta ---- */

export async function createRoute(routeData: any): Promise<{ data: CollectionRoute | null; error?: string }> {
  try {
    const [newRoute] = await db.insert(collection_routes).values({
      tenant_id: routeData.tenant_id,
      name: routeData.name,
      zone: routeData.zone,
      collector_id: routeData.collector_id,
      color: routeData.color || '#3B82F6',
      notes: routeData.notes,
    }).returning();

    return { data: newRoute as unknown as CollectionRoute };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ---- PUT: Actualizar ruta ---- */

export async function updateRoute(
  id: string,
  tenantId: string,
  updates: Partial<CollectionRoute>
): Promise<{ error?: string }> {
  try {
    await db.update(collection_routes)
      .set(updates as any)
      .where(and(
        eq(collection_routes.id, id),
        eq(collection_routes.tenant_id, tenantId)
      ));
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ---- DELETE: Eliminar ruta ---- */

export async function deleteRoute(id: string, tenantId: string): Promise<{ error?: string }> {
  try {
    await db.transaction(async (tx) => {
      // First ensure the route belongs to the tenant
      const route = await tx.query.collection_routes.findFirst({
        where: and(eq(collection_routes.id, id), eq(collection_routes.tenant_id, tenantId))
      });
      if (!route) throw new Error('Ruta no encontrada o acceso denegado');

      await tx.update(clients).set({ route_id: null }).where(eq(clients.route_id, id));
      await tx.delete(collection_routes).where(eq(collection_routes.id, id));
    });
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ---- Assign/Remove clients ---- */

export async function addClientToRoute(clientId: string, routeId: string, tenantId: string): Promise<{ error?: string }> {
  try {
    await db.update(clients)
      .set({ route_id: routeId })
      .where(and(
        eq(clients.id, clientId),
        eq(clients.tenant_id, tenantId)
      ));
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function removeClientFromRoute(clientId: string, tenantId: string): Promise<{ error?: string }> {
  try {
    await db.update(clients)
      .set({ route_id: null })
      .where(and(
        eq(clients.id, clientId),
        eq(clients.tenant_id, tenantId)
      ));
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ---- Get unassigned clients ---- */

export async function getUnassignedClients(tenantId: string): Promise<any[]> {
  try {
    const results = await db.query.clients.findMany({
      where: and(
        eq(clients.tenant_id, tenantId),
        isNull(clients.route_id)
      ),
      orderBy: [clients.full_name],
    });
    return results;
  } catch (error) {
    return [];
  }
}

/* ---- GET: Route Active Checklist ---- */

export async function getRouteActiveChecklist(routeId: string, tenantId: string) {
  try {
    const routeClients = await db.query.clients.findMany({
      where: and(
        eq(clients.route_id, routeId),
        eq(clients.tenant_id, tenantId)
      ),
      with: {
        loans: {
          where: inArray(loans.status, ['active', 'defaulted']),
          with: {
            payments: {
              orderBy: [asc(payments.installment_number)],
            }
          }
        }
      },
    });

    const checklist = routeClients.map((client: any) => {
      const activeLoan = client.loans?.[0];
      if (!activeLoan) return null;

      const loanPayments = activeLoan.payments || [];
      if (loanPayments.length === 0) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Verificar si ya hubo un cobro o novedad registrado HOY para este préstamo (incluyendo sincronizados offline)
      const todayPayment = loanPayments.find((p: any) => {
        if (!p.paid_date) return false;
        const pDate = new Date(p.paid_date);
        pDate.setHours(0, 0, 0, 0);
        return pDate.getTime() === today.getTime() || (p.is_locked && p.status !== 'pending');
      });

      // 2. Si ya se procesó hoy (ej: cobrado o marcado como novedad sincronizado desde offline)
      if (todayPayment && (todayPayment.status === 'paid' || todayPayment.status === 'partial' || todayPayment.status === 'missed')) {
        const paid = (activeLoan.paid_installments || 0) * (activeLoan.installment_amount || 0);
        const remainingBalance = Math.max(0, (activeLoan.total_amount || 0) - paid);

        return {
          client_id: client.id,
          client_name: client.full_name,
          document_id: client.document_id,
          phone: client.phone || null,
          address: client.address || null,
          risk_status: client.risk_status,
          loan_id: activeLoan.id,
          payment_id: todayPayment.id,
          expectedQuota: todayPayment.amount_due,
          amount_paid: todayPayment.amount_paid || 0,
          balance: remainingBalance,
          dueDate: todayPayment.due_date ? new Date(todayPayment.due_date).toISOString().split('T')[0] : '',
          installment_number: todayPayment.installment_number,
          paid: todayPayment.status === 'paid' || todayPayment.status === 'partial',
          status: todayPayment.status,
          is_paid_today: true,
          latitude: todayPayment.latitude ?? null,
          longitude: todayPayment.longitude ?? null,
        };
      }

      // 3. Si no ha sido cobrado hoy, buscar la primera cuota pendiente o vencida por cobrar
      const pendingPayment = loanPayments.find((p: any) =>
        !p.is_locked && ['pending', 'partial', 'missed', 'grace'].includes(p.status)
      );

      if (!pendingPayment) return null;

      const dueDate = new Date(pendingPayment.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // Si la cuota futura aún no vence y está al día, no se cobra hoy
      if (['pending', 'grace'].includes(pendingPayment.status) && dueDate > today) {
        return null;
      }

      const paid = (activeLoan.paid_installments || 0) * (activeLoan.installment_amount || 0);
      const remainingBalance = Math.max(0, (activeLoan.total_amount || 0) - paid);

      return {
        client_id: client.id,
        client_name: client.full_name,
        document_id: client.document_id,
        phone: client.phone || null,
        address: client.address || null,
        risk_status: client.risk_status,
        loan_id: activeLoan.id,
        payment_id: pendingPayment.id,
        expectedQuota: pendingPayment.amount_due,
        amount_paid: 0,
        balance: remainingBalance,
        dueDate: pendingPayment.due_date ? new Date(pendingPayment.due_date).toISOString().split('T')[0] : '',
        installment_number: pendingPayment.installment_number,
        paid: false,
        status: pendingPayment.status,
        is_paid_today: false,
        latitude: pendingPayment.latitude ?? null,
        longitude: pendingPayment.longitude ?? null,
      };
    }).filter(Boolean);

    return checklist;
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return [];
  }
}

/* ---- POST: Cierre de ruta ---- */

export async function closeRouteRecord(
  tenantId: string,
  routeId: string,
  collectorId: string,
  totalCollected: number,
  totalExpected: number,
  effectiveDate?: Date | string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // Validate collector exists or resolve from route
      let finalCollectorId = collectorId;
      if (!finalCollectorId && routeId) {
        const route = await tx.query.collection_routes.findFirst({
          where: and(
            eq(collection_routes.id, routeId),
            eq(collection_routes.tenant_id, tenantId)
          ),
        });
        if (route?.collector_id) {
          finalCollectorId = route.collector_id;
        }
      }

      if (!finalCollectorId) {
        throw new Error('No se puede cerrar la ruta sin un cobrador asignado');
      }

      // 1. Determinar fecha efectiva de conciliación respetando la fecha de cobro
      const targetDate = effectiveDate ? new Date(effectiveDate) : new Date();
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // 2. Obtener clientes y préstamos de esta ruta
      let loanIds: string[] = [];
      if (routeId) {
        const routeClients = await tx.query.clients.findMany({
          where: and(eq(clients.route_id, routeId), eq(clients.tenant_id, tenantId)),
          columns: { id: true },
        });
        const clientIds = routeClients.map((c) => c.id);
        if (clientIds.length > 0) {
          const activeLoans = await tx.query.loans.findMany({
            where: and(
              inArray(loans.client_id, clientIds),
              inArray(loans.status, ['active', 'defaulted', 'completed'])
            ),
            columns: { id: true },
          });
          loanIds = activeLoans.map((l) => l.id);
        }
      }

      // 3. Conciliación financiera contra base de datos (incluyendo pagos sincronizados offline)
      let reconciledCollected = 0;
      let totalVisits = 0;
      let reconciledExpected = 0;

      if (loanIds.length > 0) {
        // Recaudo efectivo: pagos cuyo paid_date corresponde a la fecha de cobro
        const collectionRes = await tx
          .select({
            sum: sql<number>`coalesce(sum(${payments.amount_paid}), 0)`,
          })
          .from(payments)
          .where(
            and(
              inArray(payments.loan_id, loanIds),
              eq(payments.tenant_id, tenantId),
              sql`${payments.amount_paid} > 0`,
              sql`DATE(${payments.paid_date} AT TIME ZONE 'America/Bogota') = ${targetDateStr}::DATE`
            )
          );

        reconciledCollected = Number(collectionRes[0]?.sum || 0);

        // Visitas efectivas: pagos con monto recaudado > 0 o registrados como novedad (missed) en esa fecha
        const visitsRes = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(payments)
          .where(
            and(
              inArray(payments.loan_id, loanIds),
              eq(payments.tenant_id, tenantId),
              or(
                and(
                  sql`${payments.amount_paid} > 0`,
                  sql`DATE(${payments.paid_date} AT TIME ZONE 'America/Bogota') = ${targetDateStr}::DATE`
                ),
                and(
                  eq(payments.status, 'missed'),
                  sql`DATE(coalesce(${payments.paid_date}, ${payments.created_at}) AT TIME ZONE 'America/Bogota') = ${targetDateStr}::DATE`
                )
              )
            )
          );

        totalVisits = Number(visitsRes[0]?.count || 0);

        // Cuotas esperadas en esa fecha para los créditos de la ruta
        const expectedRes = await tx
          .select({
            sum: sql<number>`coalesce(sum(${payments.amount_due}), 0)`,
          })
          .from(payments)
          .where(
            and(
              inArray(payments.loan_id, loanIds),
              eq(payments.tenant_id, tenantId),
              sql`DATE(${payments.due_date} AT TIME ZONE 'America/Bogota') = ${targetDateStr}::DATE`
            )
          );

        reconciledExpected = Number(expectedRes[0]?.sum || 0);
      }

      // El total recaudado final respeta la suma real en DB proveniente de sincronizaciones
      // o el parámetro enviado, tomando el monto mayor para no perder transacciones sincronizadas
      const finalTotalCollected = Math.max(Number(totalCollected || 0), reconciledCollected);
      const finalTotalExpected = Number(totalExpected || 0) > 0 ? Number(totalExpected) : reconciledExpected;

      const [newClosure] = await tx
        .insert(route_closures)
        .values({
          tenant_id: tenantId,
          collector_id: finalCollectorId,
          total_collected: finalTotalCollected,
          total_expected: finalTotalExpected,
          total_visits: totalVisits,
          status: 'closed',
          closure_date: targetDate,
        })
        .returning();

      return { success: true, data: newClosure };
    });
  } catch (err: any) {
    console.error('Error closing route record:', err);
    return { success: false, error: err.message };
  }
}

/* ---- GET: Cierres y arqueos de ruta ---- */

export interface RouteClosureDetail {
  id: string;
  tenant_id: string;
  collector_id: string;
  collector_name: string;
  collector_username: string;
  closure_date: string;
  total_expected: number;
  total_collected: number;
  total_visits: number;
  status: 'open' | 'closed' | 'verified' | string;
  notes?: string | null;
  effectiveness_rate: number;
  created_at: string;
}

export async function getRouteClosures(
  tenantId: string,
  routeId?: string
): Promise<RouteClosureDetail[]> {
  try {
    let targetCollectorId: string | undefined;

    if (routeId) {
      const route = await db.query.collection_routes.findFirst({
        where: and(
          eq(collection_routes.id, routeId),
          eq(collection_routes.tenant_id, tenantId)
        ),
      });
      if (route?.collector_id) {
        targetCollectorId = route.collector_id;
      }
    }

    const conditions = [eq(route_closures.tenant_id, tenantId)];
    if (targetCollectorId) {
      conditions.push(eq(route_closures.collector_id, targetCollectorId));
    }

    const closures = await db.query.route_closures.findMany({
      where: and(...conditions),
      with: {
        collector: true,
      },
      orderBy: [desc(route_closures.closure_date), desc(route_closures.created_at)],
    });

    return closures.map((c: any) => {
      const expected = Number(c.total_expected || 0);
      const collected = Number(c.total_collected || 0);
      const rate = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 100;

      return {
        id: c.id,
        tenant_id: c.tenant_id,
        collector_id: c.collector_id,
        collector_name: c.collector?.full_name || 'Cobrador Desconocido',
        collector_username: c.collector?.username || '',
        closure_date: c.closure_date ? new Date(c.closure_date).toISOString() : new Date().toISOString(),
        total_expected: expected,
        total_collected: collected,
        total_visits: Number(c.total_visits || 0),
        status: (c.status as string) || 'closed',
        notes: c.notes || null,
        effectiveness_rate: rate,
        created_at: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('Error fetching route closures:', err);
    return [];
  }
}

/* ---- POST / PUT: Verificar y conciliar arqueo de ruta ---- */

export async function verifyRouteClosure(
  closureId: string,
  tenantId: string,
  verifiedAmount: number,
  notes?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Validar que el cierre exista y pertenezca al tenantId
    const existing = await db.query.route_closures.findFirst({
      where: and(
        eq(route_closures.id, closureId),
        eq(route_closures.tenant_id, tenantId)
      ),
    });

    if (!existing) {
      return { success: false, error: 'Cierre de ruta no encontrado o no pertenece a este negocio' };
    }

    // 2. Actualizar estado a 'verified', ajustar monto verificado físico y registrar notas
    const updatedNotes = notes
      ? (existing.notes ? `${existing.notes} | Conciliación: ${notes}` : notes)
      : existing.notes;

    const [updated] = await db
      .update(route_closures)
      .set({
        status: 'verified',
        total_collected: Number(verifiedAmount),
        notes: updatedNotes,
      })
      .where(
        and(
          eq(route_closures.id, closureId),
          eq(route_closures.tenant_id, tenantId)
        )
      )
      .returning();

    return { success: true, data: updated };
  } catch (err: any) {
    console.error('Error verifying route closure:', err);
    return { success: false, error: err.message };
  }
}

