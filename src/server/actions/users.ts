'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { canAssignRole, canManageUser, assertManager } from '@/lib/permissions'
import type { ActorUser } from '@/lib/permissions'
import { safeRevalidatePath } from '@/lib/safeRevalidate'
import { normalizeTelegramUsername, isValidTelegramUsername } from '@/lib/telegramUsername'
import type { Role, User } from '@prisma/client'

export type SafeUser = Omit<User, 'phone' | 'whatsappBotEnabled'> & {
  contratista: { nombre: string } | null
  cliente: { nombre: string } | null
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  clerkId: true,
  role: true,
  contratistaId: true,
  clienteId: true,
  createdAt: true,
  telegramUserId: true,
  telegramUsername: true,
  contratista: { select: { nombre: true } },
  cliente: { select: { nombre: true } },
} as const

/** Normalizes+validates an optional Telegram @username input; returns null for an empty/absent value. */
function resolveTelegramUsername(input: string | undefined): string | null {
  if (!input || !input.trim()) return null
  const username = normalizeTelegramUsername(input)
  if (!isValidTelegramUsername(username)) {
    throw new Error('El usuario de Telegram debe tener entre 5 y 32 caracteres (letras, números y guion bajo)')
  }
  return username
}

/** Derives the contratistaId/clienteId a user of `role` should have, trusting the actor's own scope over client input. */
function resolveScope(
  actor: ActorUser,
  role: Role,
  input: { contratistaId?: string; clienteId?: string }
): { contratistaId: string | null; clienteId: string | null } {
  if (role === 'ADMIN') return { contratistaId: null, clienteId: null }

  if (role === 'CLIENTE') {
    if (!input.clienteId) throw new Error('Debes seleccionar un cliente para este rol')
    return { contratistaId: null, clienteId: input.clienteId }
  }

  // SUPERVISOR / INSPECTOR: a supervisor can only staff their own contratista.
  const contratistaId = actor.role === 'SUPERVISOR' ? actor.contratistaId : input.contratistaId
  if (!contratistaId) throw new Error('Debes seleccionar una contratista para este rol')
  return { contratistaId, clienteId: null }
}

/** Names only, for populating the "supervisor" select on the reporte form — any authenticated user may call this. */
export async function listSupervisoresDeContratista(contratistaId: string): Promise<{ id: string; name: string }[]> {
  await requireUser()
  return prisma.user.findMany({
    where: { contratistaId, role: 'SUPERVISOR' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function listUsers(): Promise<SafeUser[]> {
  const actor = await requireUser()
  assertManager(actor)
  const where = actor.role === 'ADMIN' ? {} : { contratistaId: actor.contratistaId ?? '__none__' }
  return prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'asc' } })
}

export interface CreateUserInput {
  name: string
  email: string
  role: Role
  contratistaId?: string
  clienteId?: string
  telegramUsername?: string
}

export type CreateUserResult =
  | { ok: true; user: SafeUser; inviteWarning?: string }
  | { ok: false; error: string }

/**
 * Returns a result object instead of throwing — Next.js redacts thrown Server Action errors to
 * a generic digest-only message ("Minified React error #441") in production, so validation
 * errors need to travel back as data, same as deleteCliente/deleteContratista.
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const actor = await requireUser()
  try {
    assertManager(actor)
    if (!canAssignRole(actor, input.role)) {
      throw new Error('No autorizado para asignar ese rol')
    }

    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    if (!name) throw new Error('El nombre es obligatorio')
    if (!email) throw new Error('El email es obligatorio')

    const scope = resolveScope(actor, input.role, input)
    const telegramUsername = resolveTelegramUsername(input.telegramUsername)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new Error(`Ya existe un usuario con el email ${email}`)
    if (telegramUsername) {
      const existingTelegram = await prisma.user.findUnique({ where: { telegramUsername } })
      if (existingTelegram) throw new Error(`Ya existe un usuario con el usuario de Telegram @${telegramUsername}`)
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: input.role,
        ...scope,
        telegramUsername,
      },
      select: USER_SELECT,
    })

    // The email may already belong to a Clerk user (e.g. they signed in with Google before an
    // admin registered them here) — Clerk then refuses to create an invitation for it. That's
    // fine: the row above is enough for the just-in-time link in getCurrentUser() to pick up on
    // their next sign-in, so don't fail the whole action over the invite email.
    let inviteWarning: string | undefined
    const clerk = await clerkClient()
    try {
      await clerk.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { role: input.role },
        redirectUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/sign-in`,
      })
    } catch {
      inviteWarning =
        'Cuenta creada, pero no se pudo enviar la invitación por email (es posible que ya tenga una cuenta de Google registrada). Puede iniciar sesión directamente en /sign-in con ese mismo correo.'
    }

    safeRevalidatePath('/admin')
    return { ok: true, user, inviteWarning }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al crear el usuario' }
  }
}

export interface UpdateUserInput {
  name: string
  email: string
  role: Role
  contratistaId?: string
  clienteId?: string
  telegramUsername?: string
}

export type UpdateUserResult = { ok: true; user: SafeUser } | { ok: false; error: string }

/** Returns a result object instead of throwing — see createUser's comment for why. */
export async function updateUser(userId: string, input: UpdateUserInput): Promise<UpdateUserResult> {
  const actor = await requireUser()
  try {
    assertManager(actor)
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
    if (!canAssignRole(actor, input.role)) throw new Error('No autorizado para asignar ese rol')

    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    if (!name) throw new Error('El nombre es obligatorio')
    if (!email) throw new Error('El email es obligatorio')
    if (actor.role === 'ADMIN' && actor.id === userId && input.role !== 'ADMIN') {
      throw new Error('No puedes quitarte tu propio rol de administrador')
    }

    const scope = resolveScope(actor, input.role, input)
    const telegramUsername = resolveTelegramUsername(input.telegramUsername)
    if (telegramUsername && telegramUsername !== target.telegramUsername) {
      const existingTelegram = await prisma.user.findUnique({ where: { telegramUsername } })
      if (existingTelegram) throw new Error(`Ya existe un usuario con el usuario de Telegram @${telegramUsername}`)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role: input.role,
        ...scope,
        telegramUsername,
      },
      select: USER_SELECT,
    })

    if (target.clerkId) {
      const clerk = await clerkClient()
      await clerk.users.updateUser(target.clerkId, { publicMetadata: { role: input.role } })
    }

    safeRevalidatePath('/admin')
    return { ok: true, user }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al actualizar el usuario' }
  }
}

export type UserActionResult = { ok: true } | { ok: false; error: string }

/** Re-sends the Clerk invite — for users who haven't accepted it yet (clerkId still null). */
export async function resendInvite(userId: string): Promise<UserActionResult> {
  const actor = await requireUser()
  try {
    assertManager(actor)
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
    if (target.clerkId) throw new Error('Este usuario ya activó su cuenta')
    const clerk = await clerkClient()
    try {
      await clerk.invitations.createInvitation({
        emailAddress: target.email,
        publicMetadata: { role: target.role },
        redirectUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/sign-in`,
      })
    } catch {
      throw new Error(
        'No se pudo reenviar la invitación (es posible que ya tenga una cuenta de Google registrada). Puede iniciar sesión directamente en /sign-in con ese mismo correo.'
      )
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al reenviar la invitación' }
  }
}

export async function deleteUser(userId: string): Promise<UserActionResult> {
  const actor = await requireUser()
  try {
    assertManager(actor)
    if (actor.id === userId) {
      throw new Error('No puedes eliminar tu propia cuenta')
    }
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!canManageUser(actor, target)) throw new Error('No autorizado para eliminar este usuario')
    await prisma.user.delete({ where: { id: userId } })
    if (target.clerkId) {
      const clerk = await clerkClient()
      await clerk.users.deleteUser(target.clerkId).catch(() => {})
    }
    safeRevalidatePath('/admin')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al eliminar el usuario' }
  }
}
