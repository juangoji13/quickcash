'use server';

/* ============================================
 * QuickCash — Collectors Service
 * Gestión de cobradores e invitaciones (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { users, invitations } from '@/lib/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import type { User, Invitation } from '@/types';

export async function getCollectors(): Promise<User[]> {
  try {
    const results = await db.query.users.findMany({
      where: inArray(users.role, ['collector', 'admin']),
      orderBy: [users.full_name],
    });
    return results as unknown as User[];
  } catch (error) {
    console.error('Error fetching collectors:', error);
    return [];
  }
}

export async function updateCollector(
  id: string,
  updates: Partial<Pick<User, 'full_name' | 'phone' | 'is_active'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(users)
      .set(updates as any)
      .where(eq(users.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ---- Invitaciones ---- */

export async function getInvitations(): Promise<Invitation[]> {
  try {
    const results = await db.query.invitations.findMany({
      orderBy: [desc(invitations.created_at)],
    });
    return results as unknown as Invitation[];
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
}

export async function createInvitation(
  invitationData: any
): Promise<{ data: Invitation | null; error?: string }> {
  try {
    // Default expiry 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [newInvitation] = await db.insert(invitations).values({
      tenant_id: invitationData.tenant_id,
      email: invitationData.email,
      role: invitationData.role,
      invited_by: invitationData.invited_by,
      status: 'pending',
      expires_at: expiresAt,
    }).returning();

    return { data: newInvitation as unknown as Invitation };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(invitations).where(eq(invitations.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
