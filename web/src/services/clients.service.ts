/* ============================================
 * QuickCash — Clients Service
 * CRUD completo de clientes
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { Client, ClientWithLoans } from '@/types';

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
  return data || [];
}

export async function getClientById(id: string): Promise<ClientWithLoans | null> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      loans (*),
      collector:users!clients_collector_id_fkey (id, full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }
  return data as ClientWithLoans;
}

export async function createClient(
  client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'risk_status'>
): Promise<{ data: Client | null; error?: string }> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function updateClient(
  id: string,
  updates: Partial<Client>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteClient(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .or(`full_name.ilike.%${query}%,document_id.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('full_name');

  if (error) {
    console.error('Error searching clients:', error);
    return [];
  }
  return data || [];
}
