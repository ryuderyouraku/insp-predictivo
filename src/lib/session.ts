import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import type { ActorUser } from './permissions'

const ACTOR_SELECT = {
  id: true,
  role: true,
  contratistaId: true,
  clienteId: true,
} as const

/**
 * Reads role/contratistaId/clienteId from Postgres (not Clerk's publicMetadata), so an admin
 * editing someone's role/contratista takes effect immediately instead of waiting for a token
 * refresh. On a user's first request after accepting their invite, links their Clerk account to
 * the User row an admin already created for them, matched by email (just-in-time) — nobody
 * without a row created by an admin can gain access this way: an unmatched email returns null and
 * every caller fails closed.
 */
export async function getCurrentUser(): Promise<ActorUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const existing = await prisma.user.findUnique({ where: { clerkId: userId }, select: ACTOR_SELECT })
  if (existing) return existing

  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) return null

  const linked = await prisma.user.updateMany({
    where: { email: email.toLowerCase(), clerkId: null },
    data: { clerkId: userId },
  })
  if (linked.count === 0) return null

  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: ACTOR_SELECT })
  // Refresh Clerk's publicMetadata in case an admin changed the role while the invite was
  // still pending — the invitation's publicMetadata snapshot could otherwise be stale.
  if (user) await clerk.users.updateUser(userId, { publicMetadata: { role: user.role } })
  return user
}

export async function requireUser(): Promise<ActorUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('No autorizado: inicia sesión')
  return user
}

export async function requireAdmin(): Promise<ActorUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    throw new Error('No autorizado: se requiere rol de administrador')
  }
  return user
}
