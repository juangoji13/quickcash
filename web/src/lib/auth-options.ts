import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Usuario o Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        // Buscar por email o por username
        const identifier = credentials.identifier.trim();
        const user = await db.query.users.findFirst({
          where: (users, { or, eq }) => or(
            eq(users.email, identifier),
            eq(users.username, identifier),
            // También permitir sin el @ si el usuario lo olvidó
            eq(users.username, identifier.startsWith('@') ? identifier : `@${identifier}`)
          ),
        });

        if (!user) return null;

        if (!user.is_active) {
          throw new Error('Esta cuenta ha sido desactivada. Comunícate con el administrador.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isPasswordValid) return null;

        const userRole = user.role === 'super_admin' ? 'superadmin' : user.role;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.full_name,
          role: userRole,
          tenantId: user.tenant_id,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role === 'super_admin' ? 'superadmin' : (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
        });
        if (!user || !user.is_active) {
          return {} as any; // Invalidar sesión si el usuario no existe o está inactivo
        }
        (session.user as any).id = token.id;
        const normalizedRole = user.role === 'super_admin' ? 'superadmin' : (token.role || user.role);
        (session.user as any).role = normalizedRole;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).username = user.username || token.username;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
