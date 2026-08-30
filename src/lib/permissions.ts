import type { Prisma, Role } from '@prisma/client'

export interface ActorUser {
  id: string
  role: Role
  contratistaId: string | null
  clienteId: string | null
}

interface FajaScope {
  contratistaId: string
  clienteId: string
}

const STAFF_ROLES: Role[] = ['SUPERVISOR', 'INSPECTOR']

function isContratistaStaff(user: ActorUser): boolean {
  return STAFF_ROLES.includes(user.role)
}

/** Prisma `where` fragment that limits a Faja query to what `user` is allowed to see. */
export function fajaScopeWhere(user: ActorUser): Prisma.FajaWhereInput {
  if (user.role === 'ADMIN') return {}
  if (isContratistaStaff(user)) return { contratistaId: user.contratistaId ?? '__none__' }
  return { clienteId: user.clienteId ?? '__none__' }
}

export function canReadFaja(user: ActorUser, faja: FajaScope): boolean {
  if (user.role === 'ADMIN') return true
  if (isContratistaStaff(user)) return faja.contratistaId === user.contratistaId
  return faja.clienteId === user.clienteId
}

/** Create/edit/delete the Faja itself (config, criterios, poleas, imágenes). */
export function canManageFaja(user: ActorUser, faja: FajaScope): boolean {
  if (user.role === 'ADMIN') return true
  return user.role === 'SUPERVISOR' && faja.contratistaId === user.contratistaId
}

export function canCreateFaja(user: ActorUser): boolean {
  return user.role === 'ADMIN' || user.role === 'SUPERVISOR'
}

/** Create a Reporte (inspección) on an existing Faja. */
export function canCreateReporte(user: ActorUser, faja: FajaScope): boolean {
  if (user.role === 'ADMIN') return true
  return isContratistaStaff(user) && faja.contratistaId === user.contratistaId
}

export function canDeleteReporte(user: ActorUser, faja: FajaScope): boolean {
  return canManageFaja(user, faja)
}

/** Whether `actor` may create/edit/reset/delete the `target` user account. */
export function canManageUser(actor: ActorUser, target: { role: Role; contratistaId: string | null }): boolean {
  if (actor.role === 'ADMIN') return true
  if (actor.role !== 'SUPERVISOR') return false
  if (target.role === 'ADMIN' || target.role === 'CLIENTE') return false
  return target.contratistaId === actor.contratistaId
}

/** Whether `actor` may assign `role` to a user they manage (used on create/update). */
export function canAssignRole(actor: ActorUser, role: Role): boolean {
  if (actor.role === 'ADMIN') return true
  return actor.role === 'SUPERVISOR' && STAFF_ROLES.includes(role)
}

/** Throws unless `actor` may manage other users at all (create/edit/bot access/etc). */
export function assertManager(actor: ActorUser): void {
  if (actor.role !== 'ADMIN' && actor.role !== 'SUPERVISOR') {
    throw new Error('No autorizado: se requiere rol de administrador o supervisor')
  }
}
