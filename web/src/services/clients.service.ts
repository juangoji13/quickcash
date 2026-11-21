'use server';

/* ============================================
 * QuickCash — Clients Service
 * CRUD completo de clientes (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { clients, loans, users, payments, collection_routes } from '@/lib/db/schema';
import { eq, or, ilike, desc, and, sql, inArray } from 'drizzle-orm';
import type { Client, ClientWithLoans, RiskStatus } from '@/types';
import { calculateRiskStatus as computeRiskStatus } from '@/lib/utils';

/**
 * Semáforo de Riesgo dinámico (Server Action):
 * - 0 cuotas vencidas: green (verde)
 * - 1-2 cuotas vencidas: yellow (amarillo)
 * - 3+ cuotas vencidas: red (rojo)
 */
export async function calculateRiskStatus(overdueCount: number): Promise<RiskStatus> {
  return computeRiskStatus(overdueCount);
}

/**
 * Obtiene el mapa de riesgo de todos los clientes de un tenant
 */
export async function getClientsRiskMap(tenantId: string): Promise<Map<string, RiskStatus>> {
  try {
    const overdueCounts = await db
      .select({
        clientId: clients.id,
        overdueCount: sql<number>`count(${payments.id})::int`,
      })
      .from(clients)
      .leftJoin(
        loans,
        and(
          eq(loans.client_id, clients.id),
          eq(loans.tenant_id, tenantId),
          inArray(loans.status, ['active', 'defaulted'])
        )
      )
      .leftJoin(
        payments,
        and(
          eq(payments.loan_id, loans.id),
          eq(payments.tenant_id, tenantId),
          sql`${payments.status} != 'paid'`,
          sql`(${payments.status} = 'missed' OR DATE(${payments.due_date}) < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE)`
        )
      )
      .where(eq(clients.tenant_id, tenantId))
      .groupBy(clients.id);

    const riskMap = new Map<string, RiskStatus>();
    for (const row of overdueCounts) {
      riskMap.set(row.clientId, computeRiskStatus(Number(row.overdueCount || 0)));
    }
    return riskMap;
  } catch (err) {
    console.error('Error calculating clients risk map:', err);
    return new Map<string, RiskStatus>();
  }
}

/**
 * Sincroniza el estado de riesgo en la base de datos para persistencia consistente
 */
export async function syncClientsRisk(tenantId: string): Promise<void> {
  try {
    await db.execute(sql`
      WITH overdue_data AS (
        SELECT 
          c.id AS client_id,
          count(p.id) AS overdue_count
        FROM clients c
        LEFT JOIN loans l ON l.client_id = c.id AND l.tenant_id = c.tenant_id AND l.status IN ('active', 'defaulted')
        LEFT JOIN payments p ON p.loan_id = l.id 
          AND p.tenant_id = c.tenant_id 
          AND p.status != 'paid' 
          AND (p.status = 'missed' OR DATE(p.due_date) < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE)
        WHERE c.tenant_id = ${tenantId}
        GROUP BY c.id
      )
      UPDATE clients
      SET risk_status = CASE
        WHEN overdue_data.overdue_count >= 3 THEN 'red'
        WHEN overdue_data.overdue_count >= 1 THEN 'yellow'
        ELSE 'green'
      END
      FROM overdue_data
      WHERE clients.id = overdue_data.client_id AND clients.tenant_id = ${tenantId}
    `);
  } catch (err) {
    console.error('Error syncing clients risk status:', err);
  }
}

export async function getClients(tenantId: string): Promise<Client[]> {
  try {
    const [riskMap, results] = await Promise.all([
      getClientsRiskMap(tenantId),
      db.query.clients.findMany({
        where: eq(clients.tenant_id, tenantId),
        orderBy: [desc(clients.created_at)],
      }),
    ]);

    return results.map((c) => ({
      ...c,
      risk_status: riskMap.get(c.id) || (c.risk_status as RiskStatus) || 'green',
    })) as unknown as Client[];
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

export async function getClientById(id: string, tenantId: string): Promise<ClientWithLoans | null> {
  try {
    const result = await db.query.clients.findFirst({
      where: and(
        eq(clients.id, id),
        eq(clients.tenant_id, tenantId)
      ),
      with: {
        loans: true,
        collector: true,
      },
    });

    if (!result) return null;

    // Calcular cuotas vencidas para este cliente
    const overdueRes = await db
      .select({
        count: sql<number>`count(${payments.id})::int`,
      })
      .from(loans)
      .innerJoin(
        payments,
        and(
          eq(payments.loan_id, loans.id),
          eq(payments.tenant_id, tenantId),
          sql`${payments.status} != 'paid'`,
          sql`(${payments.status} = 'missed' OR DATE(${payments.due_date}) < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE)`
        )
      )
      .where(
        and(
          eq(loans.client_id, id),
          eq(loans.tenant_id, tenantId),
          inArray(loans.status, ['active', 'defaulted'])
        )
      );

    const overdueCount = Number(overdueRes[0]?.count || 0);
    const dynamicRisk = computeRiskStatus(overdueCount);

    return {
      ...result,
      risk_status: dynamicRisk,
    } as unknown as ClientWithLoans;
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
}

export async function createClient(
  clientData: any
): Promise<{ data: Client | null; error?: string }> {
  try {
    const [newClient] = await db.insert(clients).values({
      full_name: clientData.full_name,
      tenant_id: clientData.tenant_id,
      collector_id: clientData.collector_id,
      document_id: clientData.document_id,
      phone: clientData.phone,
      address: clientData.address,
      latitude: clientData.latitude,
      longitude: clientData.longitude,
      risk_status: 'green',
    }).returning();

    return { data: newClient as unknown as Client };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateClient(
  id: string,
  tenantId: string,
  updates: Partial<Client>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { id: _id, tenant_id: _tenantId, ...safeUpdates } = updates as any;

    await db.update(clients)
      .set(safeUpdates)
      .where(
        and(
          eq(clients.id, id),
          eq(clients.tenant_id, tenantId)
        )
      );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteClient(id: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Obtener cliente y verificar pertenencia al tenant
      const client = await tx.query.clients.findFirst({
        where: and(eq(clients.id, id), eq(clients.tenant_id, tenantId)),
      });

      if (!client) {
        return { success: false, error: 'Cliente no encontrado o no pertenece a tu cuenta.' };
      }

      // 2. Localizar todos los préstamos vinculados al cliente
      const clientLoans = await tx
        .select({ id: loans.id })
        .from(loans)
        .where(and(eq(loans.client_id, id), eq(loans.tenant_id, tenantId)));

      if (clientLoans.length > 0) {
        const loanIds = clientLoans.map((l) => l.id);

        // Eliminar pagos asociados a todos los préstamos del cliente
        await tx.delete(payments).where(inArray(payments.loan_id, loanIds));

        // Eliminar préstamos asociados
        await tx.delete(loans).where(inArray(loans.id, loanIds));
      }

      // 3. Eliminar el registro del cliente
      await tx.delete(clients).where(
        and(
          eq(clients.id, id),
          eq(clients.tenant_id, tenantId)
        )
      );

      return { success: true };
    });
  } catch (err: any) {
    console.error('Error al eliminar cliente:', err);
    return { success: false, error: err.message || 'Error al eliminar cliente' };
  }
}

export async function searchClients(query: string, tenantId: string): Promise<Client[]> {
  try {
    const [riskMap, results] = await Promise.all([
      getClientsRiskMap(tenantId),
      db.query.clients.findMany({
        where: and(
          eq(clients.tenant_id, tenantId),
          or(
            ilike(clients.full_name, `%${query}%`),
            ilike(clients.document_id, `%${query}%`),
            ilike(clients.phone, `%${query}%`)
          )
        ),
        orderBy: [clients.full_name],
      }),
    ]);

    return results.map((c) => ({
      ...c,
      risk_status: riskMap.get(c.id) || (c.risk_status as RiskStatus) || 'green',
    })) as unknown as Client[];
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
}

/**
 * Reasigna un cliente a otro cobrador de forma atómica.
 * Actualiza:
 * 1. clients.collector_id y clients.route_id
 * 2. loans.collector_id para todos los préstamos activos del cliente
 * 3. payments.collector_id para todas las cuotas pendientes no bloqueadas
 */
export async function reassignClientCollector(
  clientId: string,
  newCollectorId: string,
  tenantId: string,
  newRouteId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Validar cliente en tenant
      const client = await tx.query.clients.findFirst({
        where: and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)),
      });
      if (!client) {
        return { success: false, error: 'Cliente no encontrado o no pertenece a tu cuenta.' };
      }

      // 2. Validar cobrador destino
      const targetCollector = await tx.query.users.findFirst({
        where: and(eq(users.id, newCollectorId), eq(users.tenant_id, tenantId)),
      });
      if (!targetCollector) {
        return { success: false, error: 'El cobrador seleccionado no existe o no pertenece a tu equipo.' };
      }

      // 3. Determinar ruta destino
      let targetRouteId = newRouteId;
      if (targetRouteId === undefined) {
        const collectorRoute = await tx.query.collection_routes.findFirst({
          where: and(
            eq(collection_routes.tenant_id, tenantId),
            eq(collection_routes.collector_id, newCollectorId)
          ),
        });
        targetRouteId = collectorRoute ? collectorRoute.id : (client.route_id || null);
      }

      // 4. Actualizar cliente
      await tx.update(clients)
        .set({
          collector_id: newCollectorId,
          route_id: targetRouteId || null,
          updated_at: new Date(),
        })
        .where(and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)));

      // 5. Localizar préstamos activos del cliente
      const activeLoans = await tx
        .select({ id: loans.id })
        .from(loans)
        .where(
          and(
            eq(loans.client_id, clientId),
            eq(loans.tenant_id, tenantId),
            eq(loans.status, 'active')
          )
        );

      if (activeLoans.length > 0) {
        const loanIds = activeLoans.map((l) => l.id);

        // Actualizar cobrador en préstamos activos
        await tx.update(loans)
          .set({
            collector_id: newCollectorId,
            updated_at: new Date(),
          })
          .where(inArray(loans.id, loanIds));

        // Actualizar cobrador en cuotas pendientes y desbloqueadas
        await tx.update(payments)
          .set({
            collector_id: newCollectorId,
          })
          .where(
            and(
              inArray(payments.loan_id, loanIds),
              eq(payments.tenant_id, tenantId),
              eq(payments.is_locked, false),
              sql`${payments.status} != 'paid'`
            )
          );
      }

      return { success: true };
    });
  } catch (err: any) {
    console.error('Error al reasignar cobrador del cliente:', err);
    return { success: false, error: err.message || 'Error inesperado al reasignar cobrador' };
  }
}

