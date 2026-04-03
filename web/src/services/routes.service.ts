'use server';

/* ============================================
 * QuickCash — Route Closures Service
 * Cierres de caja y jornada (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { route_closures, users } from '@/lib/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type { RouteClosureRecord } from '@/types';

export async function getRouteClosures(filters?: {
  collectorId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<RouteClosureRecord[]> {
  try {
    const results = await db.query.route_closures.findMany({
      with: {
        collector: true,
      },
      where: (closures) => {
        const conditions = [];
        if (filters?.collectorId) conditions.push(eq(closures.collector_id, filters.collectorId));
        if (filters?.dateFrom) conditions.push(gte(closures.closure_date, new Date(filters.dateFrom)));
        if (filters?.dateTo) conditions.push(lte(closures.closure_date, new Date(filters.dateTo)));
        return conditions.length > 0 ? and(...conditions) : undefined;
      },
      orderBy: [desc(route_closures.closure_date)],
    });

    return results as unknown as RouteClosureRecord[];
  } catch (error) {
    console.error('Error fetching closures:', error);
    return [];
  }
}

export async function getTodayClosure(collectorId: string): Promise<RouteClosureRecord | null> {
  try {
    const result = await db.query.route_closures.findFirst({
      where: and(
        eq(route_closures.collector_id, collectorId),
        sql`DATE(${route_closures.closure_date}) = CURRENT_DATE`
      ),
    });
    return result as unknown as RouteClosureRecord;
  } catch (error) {
    console.error('Error fetching today closure:', error);
    return null;
  }
}

export async function createClosure(
  closureData: any
): Promise<{ data: RouteClosureRecord | null; error?: string }> {
  try {
    const [newClosure] = await db.insert(route_closures).values({
      tenant_id: closureData.tenant_id,
      collector_id: closureData.collector_id,
      status: 'open',
    }).returning();

    return { data: newClosure as unknown as RouteClosureRecord };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function closeClosure(
  id: string,
  totals: { total_collected: number; total_expected: number; total_visits: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(route_closures)
      .set({
        ...totals,
        status: 'closed',
      })
      .where(eq(route_closures.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
