'use server';

/* ============================================
 * QuickCash — Tenant Service
 * CRUD y configuración del tenant (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Tenant } from '@/types';

export async function getTenant(): Promise<Tenant | null> {
  try {
    const result = await db.query.tenants.findFirst();
    return result as unknown as Tenant;
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Pick<Tenant, 'name' | 'currency' | 'non_working_days' | 'holidays'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(tenants)
      .set(updates as any)
      .where(eq(tenants.id, tenantId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
