'use server'

import { prisma } from '@/lib/prisma'
import { safeRevalidatePath } from '@/lib/safeRevalidate'
import { requireAdmin } from '@/lib/session'
import type { Contratista } from '@prisma/client'

export interface CreateContratistaInput {
  nombre: string
  logoUrl?: string
}

export async function createContratista(input: CreateContratistaInput): Promise<Contratista> {
  await requireAdmin()
  if (!input.nombre.trim()) {
    throw new Error('El nombre del contratista es obligatorio')
  }
  const contratista = await prisma.contratista.create({
    data: { nombre: input.nombre.trim(), logoUrl: input.logoUrl },
  })
  safeRevalidatePath('/contratistas')
  return contratista
}

export async function listContratistas(): Promise<Contratista[]> {
  return prisma.contratista.findMany({ orderBy: { nombre: 'asc' } })
}

export async function deleteContratista(id: string): Promise<void> {
  await requireAdmin()
  const [fajas, usuarios] = await Promise.all([
    prisma.faja.count({ where: { contratistaId: id } }),
    prisma.user.count({ where: { contratistaId: id } }),
  ])
  if (fajas > 0 || usuarios > 0) {
    const partes = []
    if (fajas > 0) partes.push(`${fajas} faja${fajas === 1 ? '' : 's'}`)
    if (usuarios > 0) partes.push(`${usuarios} usuario${usuarios === 1 ? '' : 's'}`)
    throw new Error(`No se puede eliminar: tiene ${partes.join(' y ')} asociados. Reasígnalos primero.`)
  }
  await prisma.contratista.delete({ where: { id } })
  safeRevalidatePath('/contratistas')
}
