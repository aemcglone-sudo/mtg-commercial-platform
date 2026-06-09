import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findOne } from './db';

interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string | null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username or email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = credentials as Record<string, string>;
        if (!username || !password) return null;

        const user = await findOne<DbUser>(
          `SELECT id, username, email, "passwordHash"
           FROM users
           WHERE username = ? OR email = ?`,
          [username.toLowerCase(), username.toLowerCase()]
        );

        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.username, email: user.email };
      },
    }),
    // Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
    // Apple({ clientId: process.env.APPLE_ID, clientSecret: process.env.APPLE_SECRET }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // Attach userId to the JWT so API routes can read it
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});
