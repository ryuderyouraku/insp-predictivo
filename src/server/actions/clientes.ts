'use server'

import { prisma } from '@/lib/prisma'
import { safeRevalidatePath } from '@/lib/safeRevalidate'
import { requireAdmin } from '@/lib/session'
import type { Cliente } from '@prisma/client'

export interface CreateClienteInput {
  nombre: string
  logoUrl?: string
}

export async function createCliente(input: CreateClienteInput): Promise<Cliente> {
  await requireAdmin()
  if (!input.nombre.trim()) {
    throw new Error('El nombre del cliente es obligatorio')
  }
  const cliente = await prisma.cliente.create({
    data: { nombre: input.nombre.trim(), logoUrl: input.logoUrl },
  })
  safeRevalidatePath('/clientes')
  return cliente
}

export async function listClientes(): Promise<Cliente[]> {
  return prisma.cliente.findMany({ orderBy: { nombre: 'asc' } })
}

export async function deleteCliente(id: string): Promise<void> {
  await requireAdmin()
  const [fajas, usuarios] = await Promise.all([
    prisma.faja.count({ where: { clienteId: id } }),
    prisma.user.count({ where: { clienteId: id } }),
  ])
  if (fajas > 0 || usuarios > 0) {
    const partes = []
    if (fajas > 0) partes.push(`${fajas} faja${fajas === 1 ? '' : 's'}`)
    if (usuarios > 0) partes.push(`${usuarios} usuario${usuarios === 1 ? '' : 's'}`)
    throw new Error(`No se puede eliminar: tiene ${partes.join(' y ')} asociados. Reasígnalos primero.`)
  }
  await prisma.cliente.delete({ where: { id } })
  safeRevalidatePath('/clientes')
}
