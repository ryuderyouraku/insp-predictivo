'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { canAssignRole, canManageUser } from '@/lib/permissions'
import type { ActorUser } from '@/lib/permissions'
import { safeRevalidatePath } from '@/lib/safeRevalidate'
import { normalizePhone, isValidPhone } from '@/lib/phone'
import { createPasswordSetToken } from '@/lib/passwordSetToken'
import { sendInviteWhatsApp, sendWelcomeWhatsApp } from '@/lib/whatsapp'
import type { Role, User } from '@prisma/client'

export type SafeUser = Omit<User, 'passwordHash'> & {
  contratista: { nombre: string } | null
  cliente: { nombre: string } | null
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  contratistaId: true,
  clienteId: true,
  createdAt: true,
  phone: true,
  mustSetPassword: true,
  whatsappBotEnabled: true,
  contratista: { select: { nombre: true } },
  cliente: { select: { nombre: true } },
} as const

/** Normalizes+validates an optional phone input; returns null for an empty/absent value. */
function resolvePhone(input: string | undefined): string | null {
  if (!input || !input.trim()) return null
  const phone = normalizePhone(input)
  if (!isValidPhone(phone)) throw new Error('El teléfono debe estar en formato internacional, ej: +51987654321')
  return phone
}

function assertManager(actor: ActorUser) {
  if (actor.role !== 'ADMIN' && actor.role !== 'SUPERVISOR') {
    throw new Error('No autorizado: se requiere rol de administrador o supervisor')
  }
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
  password: string
  role: Role
  contratistaId?: string
  clienteId?: string
  phone?: string
}

export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const actor = await requireUser()
  assertManager(actor)
  if (!canAssignRole(actor, input.role)) {
    throw new Error('No autorizado para asignar ese rol')
  }

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) throw new Error('El nombre es obligatorio')
  if (!email) throw new Error('El email es obligatorio')
  if (input.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')

  const scope = resolveScope(actor, input.role, input)
  const phone = resolvePhone(input.phone)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error(`Ya existe un usuario con el email ${email}`)
  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } })
    if (existingPhone) throw new Error(`Ya existe un usuario con el teléfono ${phone}`)
  }

  const passwordHash = await bcrypt.hash(input.password, 10)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: input.role,
      ...scope,
      phone,
      mustSetPassword: phone !== null,
      whatsappBotEnabled: phone !== null,
    },
    select: USER_SELECT,
  })

  if (phone) {
    const token = await createPasswordSetToken(user.id)
    await sendInviteWhatsApp({ name: user.name, phone }, token)
  }

  safeRevalidatePath('/admin')
  return user
}

export interface UpdateUserInput {
  name: string
  email: string
  role: Role
  contratistaId?: string
  clienteId?: string
  phone?: string
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<SafeUser> {
  const actor = await requireUser()
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
  const phone = resolvePhone(input.phone)
  if (phone && phone !== target.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } })
    if (existingPhone) throw new Error(`Ya existe un usuario con el teléfono ${phone}`)
  }

  const phoneJustAdded = phone !== null && target.phone === null

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role: input.role,
      ...scope,
      phone,
      whatsappBotEnabled: phone === null ? false : phoneJustAdded ? true : target.whatsappBotEnabled,
    },
    select: USER_SELECT,
  })

  if (phoneJustAdded && phone) {
    if (target.mustSetPassword) {
      const token = await createPasswordSetToken(userId)
      await sendInviteWhatsApp({ name: user.name, phone }, token)
    } else {
      await sendWelcomeWhatsApp({ name: user.name, phone })
    }
  }

  safeRevalidatePath('/admin')
  return user
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  const actor = await requireUser()
  assertManager(actor)
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
  if (newPassword.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustSetPassword: false } })
  safeRevalidatePath('/admin')
}

/** Grants/revokes bot access without touching the phone number itself. */
export async function toggleWhatsappBotAccess(userId: string, enabled: boolean): Promise<void> {
  const actor = await requireUser()
  assertManager(actor)
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
  if (enabled && !target.phone) throw new Error('Este usuario no tiene un teléfono registrado')
  await prisma.user.update({ where: { id: userId }, data: { whatsappBotEnabled: enabled } })
  safeRevalidatePath('/admin')
}

/** Re-sends the WhatsApp invite with a fresh token — for users still pending activation. */
export async function resendInvite(userId: string): Promise<void> {
  const actor = await requireUser()
  assertManager(actor)
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
  if (!target.phone) throw new Error('Este usuario no tiene un teléfono registrado')
  if (!target.mustSetPassword) throw new Error('Este usuario ya activó su cuenta')
  const token = await createPasswordSetToken(userId)
  await sendInviteWhatsApp({ name: target.name, phone: target.phone }, token)
}

export async function deleteUser(userId: string): Promise<void> {
  const actor = await requireUser()
  assertManager(actor)
  if (actor.id === userId) {
    throw new Error('No puedes eliminar tu propia cuenta')
  }
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!canManageUser(actor, target)) throw new Error('No autorizado para eliminar este usuario')
  await prisma.user.delete({ where: { id: userId } })
  safeRevalidatePath('/admin')
}
