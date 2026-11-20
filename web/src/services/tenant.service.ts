'use server';

/* ============================================
 * QuickCash — Tenant & Settings Service
 * CRUD, configuración del tenant y perfil de usuario (SQL Local / Drizzle)
 * ============================================ */

import { db } from '@/lib/db';
import { tenants, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Tenant, TenantSettings } from '@/types';

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  try {
    const result = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    return result as unknown as Tenant;
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
}

export async function updateTenant(
  tenantId: string,
  updates: {
    name?: string;
    non_working_days?: string[];
    holidays?: string[];
    settings?: TenantSettings;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const dataToUpdate: Record<string, any> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) dataToUpdate.name = updates.name.trim();
    if (updates.non_working_days !== undefined) dataToUpdate.non_working_days = updates.non_working_days;
    if (updates.holidays !== undefined) dataToUpdate.holidays = updates.holidays;
    if (updates.settings !== undefined) dataToUpdate.settings = updates.settings;

    await db.update(tenants)
      .set(dataToUpdate)
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (err: any) {
    console.error('Error updating tenant:', err);
    return { success: false, error: err.message || 'Error al actualizar configuración' };
  }
}

export async function getUserProfile(userId: string): Promise<{
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
} | null> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  data: { fullName: string; phone?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(users)
      .set({
        full_name: data.fullName.trim(),
        phone: data.phone?.trim() || null,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (err: any) {
    console.error('Error updating profile:', err);
    return { success: false, error: err.message || 'Error al actualizar perfil' };
  }
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Por favor diligencia ambas contraseñas' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'La contraseña actual no coincide' };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await db.update(users)
      .set({
        password_hash: newHash,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (err: any) {
    console.error('Error changing password:', err);
    return { success: false, error: err.message || 'Error al cambiar la contraseña' };
  }
}
