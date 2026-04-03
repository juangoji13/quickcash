/* ============================================
 * QuickCash — Collection Routes Service
 * CRUD de Rutas de Cobro
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { CollectionRoute, CollectionRouteWithDetails } from '@/types';

/* ---- GET: Todas las rutas del tenant ---- */

export async function getCollectionRoutes(): Promise<CollectionRouteWithDetails[]> {
  const { data, error } = await supabase
    .from('collection_routes')
    .select(`
      *,
      collector:users!collection_routes_collector_id_fkey (id, full_name, email, phone),
      clients (id, full_name, document_id, phone, risk_status, route_id)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching routes:', error);
    return [];
  }

  // Enrich with quota info
  const routes = (data || []) as CollectionRouteWithDetails[];

  // For each route, calculate totals from active loans of its clients
  for (const route of routes) {
    if (route.clients && route.clients.length > 0) {
      const clientIds = route.clients.map(c => c.id);

      const { data: loans } = await supabase
        .from('loans')
        .select('installment_amount, client_id')
        .in('client_id', clientIds)
        .eq('status', 'active');

      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount_paid')
        .in('loan_id', (loans || []).map((l: { installment_amount: number; client_id: string }) => l.client_id))
        .eq('status', 'paid')
        .gte('paid_date', new Date().toISOString().split('T')[0]);

      route.total_daily_quota = (loans || []).reduce((sum: number, l: { installment_amount: number }) => sum + l.installment_amount, 0);
      route.total_collected_today = (todayPayments || []).reduce((sum: number, p: { amount_paid: number }) => sum + p.amount_paid, 0);
    } else {
      route.total_daily_quota = 0;
      route.total_collected_today = 0;
    }
  }

  return routes;
}

/* ---- GET: Una ruta por ID ---- */

export async function getRouteById(id: string): Promise<CollectionRouteWithDetails | null> {
  const { data, error } = await supabase
    .from('collection_routes')
    .select(`
      *,
      collector:users!collection_routes_collector_id_fkey (id, full_name, email, phone),
      clients (id, full_name, document_id, phone, address, risk_status, route_id)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching route:', error);
    return null;
  }
  return data as CollectionRouteWithDetails;
}

/* ---- POST: Crear ruta ---- */

export async function createRoute(route: {
  tenant_id: string;
  name: string;
  zone?: string;
  collector_id?: string;
  color?: string;
  notes?: string;
}): Promise<{ data: CollectionRoute | null; error?: string }> {
  const { data, error } = await supabase
    .from('collection_routes')
    .insert(route)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as CollectionRoute };
}

/* ---- PUT: Actualizar ruta ---- */

export async function updateRoute(
  id: string,
  updates: Partial<Pick<CollectionRoute, 'name' | 'zone' | 'collector_id' | 'color' | 'is_active' | 'notes'>>
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('collection_routes')
    .update(updates)
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

/* ---- DELETE: Eliminar ruta ---- */

export async function deleteRoute(id: string): Promise<{ error?: string }> {
  // First, unassign all clients from this route
  await supabase
    .from('clients')
    .update({ route_id: null })
    .eq('route_id', id);

  const { error } = await supabase
    .from('collection_routes')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

/* ---- Assign/Remove clients ---- */

export async function addClientToRoute(clientId: string, routeId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('clients')
    .update({ route_id: routeId })
    .eq('id', clientId);

  if (error) return { error: error.message };
  return {};
}

export async function removeClientFromRoute(clientId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('clients')
    .update({ route_id: null })
    .eq('id', clientId);

  if (error) return { error: error.message };
  return {};
}

/* ---- Get unassigned clients ---- */

export async function getUnassignedClients(): Promise<{ id: string; full_name: string; document_id: string; phone: string | null }[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, document_id, phone')
    .is('route_id', null)
    .order('full_name');

  if (error) {
    console.error('Error fetching unassigned clients:', error);
    return [];
  }
  return data || [];
}

/* ---- GET: Route Active Checklist ---- */

export async function getRouteActiveChecklist(routeId: string) {
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id, full_name, document_id, risk_status,
      loans (
        id, status, installment_amount, total_amount,
        payments ( id, amount_due, status, due_date, is_locked, installment_number )
      )
    `)
    .eq('route_id', routeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching checklist:', error);
    return [];
  }

  const checklist = (clients || []).map((client: any) => {
    // Buscar préstamo activo
    const activeLoan = client.loans?.find((l: any) => l.status === 'active');
    if (!activeLoan) return null;

    // Obtener la cuota pendiente más antigua
    const pendingPayments = (activeLoan.payments || [])
      .filter((p: any) => !p.is_locked && ['pending', 'partial', 'missed', 'grace'].includes(p.status))
      .sort((a: any, b: any) => a.installment_number - b.installment_number);

    const targetPayment = pendingPayments[0];
    if (!targetPayment) return null; // Préstamo no tiene cuotas pendientes pero sigue activo temporalmente

    // Excluir si es una cuota futura que aún no se debe pagar
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(targetPayment.due_date + 'T12:00:00');
    dueDate.setHours(0, 0, 0, 0);
    
    if (['pending', 'grace'].includes(targetPayment.status) && dueDate > today) {
      return null; // Aún no corresponde cobrarla hoy
    }

    return {
      client_id: client.id,
      client_name: client.full_name,
      document_id: client.document_id,
      risk_status: client.risk_status,
      loan_id: activeLoan.id,
      payment_id: targetPayment.id,
      expectedQuota: targetPayment.amount_due,
      dueDate: targetPayment.due_date,
      installment_number: targetPayment.installment_number
    };
  }).filter(Boolean);

  return checklist;
}
