import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/* ============================================
 * QuickCash — Auth Guard & Multi-tenant Helper
 * Validación estricta de sesión y aislamiento por tenant
 * ============================================ */

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  role: string;
  tenantId: string;
}

export interface TenantAuthContext {
  tenantId: string;
  user: AuthenticatedUser;
  session: Session;
}

/**
 * Obtiene la autenticación y el tenantId del usuario actual a partir de la sesión de servidor.
 * Retorna null si no hay sesión válida o no tiene tenantId asociado.
 */
export async function getTenantAuth(): Promise<TenantAuthContext | null> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  const user = session.user as any;
  const tenantId = user.tenantId as string | undefined;

  if (!tenantId) {
    return null;
  }

  return {
    tenantId,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      username: user.username ?? null,
      role: user.role ?? 'collector',
      tenantId,
    },
    session,
  };
}

/**
 * Exige autenticación y un tenantId verificado de sesión.
 * Lanza un error si la sesión es inválida o no cuenta con tenantId.
 */
export async function requireTenantAuth(): Promise<TenantAuthContext> {
  const auth = await getTenantAuth();

  if (!auth) {
    throw new Error('No autorizado: Sesión inválida, expirada o sin organización asignada.');
  }

  return auth;
}

/**
 * Wrapper de ejecución con autenticación multi-tenant para Server Actions y servicios.
 * Valida la sesión con getServerSession(authOptions), asegura el tenantId y
 * ejecuta la función proporcionada inyectando tenantId y el contexto autenticado.
 *
 * Ejemplo de uso:
 * ```ts
 * export async function misDatos() {
 *   return withTenantAuth(async (tenantId, { user }) => {
 *     return await db.query.clients.findMany({ where: eq(clients.tenant_id, tenantId) });
 *   });
 * }
 * ```
 */
export async function withTenantAuth<T>(
  action: (tenantId: string, context: TenantAuthContext) => Promise<T>
): Promise<T> {
  const auth = await requireTenantAuth();
  return action(auth.tenantId, auth);
}

/**
 * Helper de orden superior (HOF) para definir Server Actions protegidos por tenant.
 *
 * Ejemplo:
 * ```ts
 * export const crearItem = protectAction(async (tenantId, itemData) => {
 *   ...
 * });
 * ```
 */
export function protectAction<TArgs extends any[], TReturn>(
  action: (tenantId: string, ...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const { tenantId } = await requireTenantAuth();
    return action(tenantId, ...args);
  };
}

/**
 * Exige privilegios de Super Administrador.
 * Lanza un error si la sesión no corresponde a un usuario con rol 'superadmin'.
 */
export async function requireSuperAdminAuth(): Promise<TenantAuthContext> {
  const auth = await requireTenantAuth();
  if (auth.user.role !== 'superadmin' && auth.user.role !== 'super_admin') {
    throw new Error('Acceso denegado: Se requieren privilegios de Super Administrador.');
  }
  return auth;
}

