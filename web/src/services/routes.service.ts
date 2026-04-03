/* ============================================
 * QuickCash — Route Closures Service
 * Cierres de caja y jornada
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { RouteClosureRecord } from '@/types';

export async function getRouteClosures(filters?: {
  collectorId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<RouteClosureRecord[]> {
  let query = supabase
    .from('route_closures')
    .select('*, collector:users!route_closures_collector_id_fkey (id, full_name)')
    .order('closure_date', { ascending: false });

  if (filters?.collectorId) {
    query = query.eq('collector_id', filters.collectorId);
  }
  if (filters?.dateFrom) {
    query = query.gte('closure_date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('closure_date', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching closures:', error);
    return [];
  }
  return (data || []) as RouteClosureRecord[];
}

export async function getTodayClosure(collectorId: string): Promise<RouteClosureRecord | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('route_closures')
    .select('*')
    .eq('collector_id', collectorId)
    .eq('closure_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today closure:', error);
    return null;
  }
  return data;
}

export async function createClosure(
  closure: Pick<RouteClosureRecord, 'tenant_id' | 'collector_id'>
): Promise<{ data: RouteClosureRecord | null; error?: string }> {
  const { data, error } = await supabase
    .from('route_closures')
    .insert({
      ...closure,
      closure_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function closeClosure(
  id: string,
  totals: { total_collected: number; total_expected: number; total_visits: number }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('route_closures')
    .update({ ...totals, status: 'closed' })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
