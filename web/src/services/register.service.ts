'use server';

/* ============================================
 * QuickCash — Register Service
 * Auto-registro de nuevos prestamistas y creación de Tenant
 * ============================================ */

import { db } from '@/lib/db';
import { tenants, users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import type { RegisterLenderInput } from '@/types';

export interface RegisterResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    username: string | null;
    fullName: string | null;
    tenantId: string;
  };
  tenant?: {
    id: string;
    name: string;
    currency: string;
  };
}

/**
 * Registra un nuevo prestamista (organización/tenant independiente y usuario admin).
 * Crea el tenant con moneda fija COP y el usuario admin asociado con password hasheado.
 */
export async function registerLender(
  input: RegisterLenderInput
): Promise<RegisterResult> {
  try {
    const { businessName, fullName, username, email, password, phone } = input;

    // 1. Validaciones básicas de campos obligatorios
    if (!businessName || !businessName.trim()) {
      return { success: false, error: 'El nombre del negocio es obligatorio.' };
    }
    if (!fullName || !fullName.trim()) {
      return { success: false, error: 'El nombre completo es obligatorio.' };
    }
    if (!username || !username.trim()) {
      return { success: false, error: 'El nombre de usuario es obligatorio.' };
    }
    if (!email || !email.trim()) {
      return { success: false, error: 'El correo electrónico es obligatorio.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    // 2. Normalizar datos
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUser = username.trim();
    const formattedUsername = trimmedUser.startsWith('@') ? trimmedUser : `@${trimmedUser}`;
    const rawUsername = formattedUsername.substring(1);

    // 3. Validar duplicados de email o username
    const existingUser = await db.query.users.findFirst({
      where: (u, { or, eq }) => or(
        eq(u.email, normalizedEmail),
        eq(u.username, formattedUsername),
        eq(u.username, rawUsername)
      ),
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === normalizedEmail) {
        return {
          success: false,
          error: 'El correo electrónico ya se encuentra registrado. Inicia sesión o usa otro.',
        };
      }
      return {
        success: false,
        error: 'El nombre de usuario (@handle) ya está en uso. Por favor elige otro.',
      };
    }

    // 4. Crear nuevo Tenant (organización) con moneda 'COP' fija
    const [newTenant] = await db.insert(tenants).values({
      name: businessName.trim(),
      currency: 'COP',
      non_working_days: ['sunday'],
      holidays: [],
    }).returning();

    // 5. Hashear contraseña con bcryptjs
    const password_hash = await bcrypt.hash(password, 10);

    // 6. Crear el usuario Administrador del nuevo Tenant
    const [newUser] = await db.insert(users).values({
      tenant_id: newTenant.id,
      email: normalizedEmail,
      username: formattedUsername,
      password_hash,
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      role: 'admin',
      is_active: true,
    }).returning();

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.full_name,
        tenantId: newTenant.id,
      },
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        currency: newTenant.currency,
      },
    };
  } catch (error: any) {
    console.error('Error in registerLender:', error);
    return {
      success: false,
      error: error.message || 'Ocurrió un error inesperado al procesar el registro.',
    };
  }
}
