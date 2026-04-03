/* ============================================
 * QuickCash — Auth Context
 * Gestión de estado de autenticación (SQL Local / NextAuth)
 * ============================================ */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import type { User as AppUser } from '@/types';

interface AuthState {
  appUser: AppUser | null;
  isLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const isLoading = status === 'loading';

  useEffect(() => {
    if (session?.user) {
      // Map session user to AppUser type
      const user = session.user as any;
      setAppUser({
        id: user.id,
        tenant_id: user.tenantId,
        email: user.email || '',
        username: user.username || '', // Incluir username
        full_name: user.name || '',
        role: user.role,
        phone: null,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    } else {
      setAppUser(null);
    }
  }, [session]);

  async function signIn(identifier: string, password: string) {
    const result = await nextAuthSignIn('credentials', {
      identifier,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: 'Credenciales inválidas. Revisa tu usuario/email y contraseña.' };
    }

    return { error: null };
  }

  async function signOut() {
    await nextAuthSignOut({ redirect: true, callbackUrl: '/login' });
    setAppUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ appUser, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
