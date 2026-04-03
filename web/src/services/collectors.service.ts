/* ============================================
 * QuickCash — Collectors Service
 * Gestión de cobradores e invitaciones
 * ============================================ */

import { supabase } from '@/lib/supabase/client';
import type { User, Invitation } from '@/types';

export async function getCollectors(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('role', ['collector', 'admin'])
    .order('full_name');

  if (error) {
    console.error('Error fetching collectors:', error);
    return [];
  }
  return data || [];
}

export async function updateCollector(
  id: string,
  updates: Partial<Pick<User, 'full_name' | 'phone' | 'is_active'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/* ---- Invitaciones ---- */

export async function getInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
  return data || [];
}

export async function createInvitation(
  invitation: Pick<Invitation, 'tenant_id' | 'email' | 'role' | 'invited_by'>
): Promise<{ data: Invitation | null; error?: string }> {
  const { data, error } = await supabase
    .from('invitations')
    .insert(invitation)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function deleteInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
