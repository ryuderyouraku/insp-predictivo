import { clerkMiddleware, clerkClient, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'

// La vista de impresión la navega Puppeteer sin cookies de sesión (protegida con su propio
// token HMAC, ver printToken.ts) y /api/whatsapp lo llama Meta directamente (se verifica con
// su propia firma) — ninguna de las dos pasa por una sesión de Clerk.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/reportes/print/(.*)', '/api/whatsapp(.*)'])

const isAdminOnly = createRouteMatcher(['/clientes(.*)', '/contratistas(.*)'])
const isAdminOrSupervisorOnly = createRouteMatcher(['/admin(.*)', '/fajas/new'])
const isReporteNewRoute = /^\/fajas\/[^/]+\/reportes\/new/

/**
 * Role isn't in the session token by default, so this reads Postgres directly — the same
 * source of truth `requireUser()` uses — rather than trusting a Clerk publicMetadata snapshot
 * that could lag behind an admin's edit until the user's next sign-in.
 */
async function getRoleForRequest(userId: string): Promise<Role | null> {
  const byClerkId = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } })
  if (byClerkId) return byClerkId.role

  // Not linked yet (this is the user's very first request right after accepting their invite,
  // before any page has run the just-in-time link in session.ts) — fall back to matching by email.
  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) return null
  const byEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { role: true } })
  return byEmail?.role ?? null
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  await auth.protect()
  const { userId } = await auth()
  const deny = () => NextResponse.redirect(new URL('/fajas', req.url))

  if (isAdminOnly(req) || isAdminOrSupervisorOnly(req) || isReporteNewRoute.test(req.nextUrl.pathname)) {
    const role = userId ? await getRoleForRequest(userId) : null

    if (isAdminOnly(req)) {
      if (role !== 'ADMIN') return deny()
    } else if (isAdminOrSupervisorOnly(req)) {
      if (role !== 'ADMIN' && role !== 'SUPERVISOR') return deny()
    } else if (role === 'CLIENTE') {
      return deny()
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
