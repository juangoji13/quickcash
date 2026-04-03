/* ============================================
 * QuickCash — Tenant Service
 * CRUD y configuración del tenant
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { Tenant } from '@/types';

export async function getTenant(): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
  return data;
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Pick<Tenant, 'name' | 'currency' | 'non_working_days' | 'holidays'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenantId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
