import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@prisma/client'

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: Role
  contratistaId: string | null
  clienteId: string | null
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null
  if (user.mustSetPassword) return null
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    contratistaId: user.contratistaId,
    clienteId: user.clienteId,
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        return verifyCredentials(credentials.email, credentials.password)
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthenticatedUser
        token.id = authUser.id
        token.role = authUser.role
        token.contratistaId = authUser.contratistaId
        token.clienteId = authUser.clienteId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.contratistaId = token.contratistaId
        session.user.clienteId = token.clienteId
      }
      return session
    },
  },
}
