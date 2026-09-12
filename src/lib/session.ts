import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
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

/**
 * Redirects instead of throwing: without a session (or one that briefly hasn't finished
 * syncing right after an OAuth redirect), the right move is to send the visitor back to
 * `/sign-in`, not crash the page with an uncaught error.
 *
 * A signed-in Clerk user with no matching Postgres row (nobody created their account yet,
 * or they authenticated with a different email than the one an admin registered) is sent to
 * `/cuenta-no-autorizada` instead of `/sign-in` — sending them back to `/sign-in` would bounce
 * forever, since Clerk's <SignIn> immediately redirects an already-authenticated visitor back
 * into the app via `signInFallbackRedirectUrl`, which fails this same check again.
 */
export async function requireUser(): Promise<ActorUser> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await getCurrentUser()
  if (!user) redirect('/cuenta-no-autorizada')
  return user
}

/**
 * Only reachable by an already-signed-in user whose role doesn't qualify — `proxy.ts` blocks
 * this at the route level for normal navigation, so this is a defense-in-depth fallback.
 * Redirects to `/fajas` (same as `proxy.ts`'s `deny()`) instead of `/sign-in`, since the user
 * is authenticated, just not authorized.
 */
export async function requireAdmin(): Promise<ActorUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    redirect('/fajas')
  }
  return user
}
