'use server';

/* ============================================
 * QuickCash — Collection Routes Service
 * CRUD de Rutas de Cobro (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { collection_routes, clients, users, loans, payments } from '@/lib/db/schema';
import { eq, and, desc, asc, sql, inArray, isNull } from 'drizzle-orm';
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
            sum: sql<number>`sum(${payments.amount_paid})`
          }).from(payments)
            .where(and(
              inArray(payments.loan_id, loanIds),
              eq(payments.status, 'paid'),
              sql`DATE(${payments.paid_date}) = CURRENT_DATE`
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
    return result as unknown as CollectionRouteWithDetails;
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
          where: eq(loans.status, 'active'),
          with: {
            payments: {
              where: and(
                eq(payments.is_locked, false),
                inArray(payments.status, ['pending', 'partial', 'missed', 'grace'])
              ),
              orderBy: [asc(payments.installment_number)],
            }
          }
        }
      },
    });

    const checklist = routeClients.map((client: any) => {
      const activeLoan = client.loans?.[0];
      if (!activeLoan) return null;

      const targetPayment = activeLoan.payments?.[0];
      if (!targetPayment) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(targetPayment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      if (['pending', 'grace'].includes(targetPayment.status) && dueDate > today) {
        return null; 
      }

      return {
        client_id: client.id,
        client_name: client.full_name,
        document_id: client.document_id,
        risk_status: client.risk_status,
        loan_id: activeLoan.id,
        payment_id: targetPayment.id,
        expectedQuota: targetPayment.amount_due,
        dueDate: targetPayment.due_date.toISOString().split('T')[0],
        installment_number: targetPayment.installment_number
      };
    }).filter(Boolean);

    return checklist;
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return [];
  }
}
