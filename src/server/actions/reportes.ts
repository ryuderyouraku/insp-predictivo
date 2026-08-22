'use server'

import { prisma } from '@/lib/prisma'
import { worstCondicion } from '@/lib/condicion'
import { safeRevalidatePath } from '@/lib/safeRevalidate'
import { requireUser } from '@/lib/session'
import { canCreateReporte, canDeleteReporte, canReadFaja } from '@/lib/permissions'
import { verifyPrintToken } from '@/lib/printToken'
import { parseReporteSlug, reporteMatchesSlugParts } from '@/lib/reporteSlug'
import type { Condicion, Reporte } from '@prisma/client'

export interface LecturaPoleaInput {
  poleaId: string
  tempIzquierda: number
  tempDerecha: number
  fotoIzquierdaUrl: string
  fotoDerechaUrl: string
  condicion: Condicion
  diagnosticoTexto: string
}

export interface CreateReporteInput {
  fajaId: string
  fecha: Date
  especialista: string
  supervisor: string
  numeroAvisoSAP: string
  observacionGeneral?: string
  lecturas: LecturaPoleaInput[]
}

export async function createReporte(input: CreateReporteInput): Promise<Reporte> {
  const user = await requireUser()
  const faja = await prisma.faja.findUniqueOrThrow({ where: { id: input.fajaId } })
  if (!canCreateReporte(user, faja)) {
    throw new Error('No autorizado para crear reportes en esta faja')
  }

  if (input.lecturas.length !== faja.numeroPoleas) {
    throw new Error(`Debes registrar una lectura para cada una de las ${faja.numeroPoleas} poleas de la faja`)
  }
  for (const lectura of input.lecturas) {
    if (!lectura.fotoIzquierdaUrl || !lectura.fotoDerechaUrl) {
      throw new Error('Cada polea requiere las dos fotos de termograma (izquierda y derecha)')
    }
  }
  if (!input.especialista.trim() || !input.supervisor.trim()) {
    throw new Error('Especialista y supervisor son obligatorios')
  }

  const condicionGeneral = worstCondicion(input.lecturas.map((l) => l.condicion))

  const reporte = await prisma.reporte.create({
    data: {
      fajaId: input.fajaId,
      fecha: input.fecha,
      especialista: input.especialista.trim(),
      supervisor: input.supervisor.trim(),
      numeroAvisoSAP: input.numeroAvisoSAP.trim(),
      condicionGeneral,
      observacionGeneral: input.observacionGeneral || 'Equipo sin indicaciones',
      createdByUserId: user.id,
      lecturas: { create: input.lecturas },
    },
  })
  safeRevalidatePath(`/fajas/${faja.tag}`)
  return reporte
}

const REPORTE_INCLUDE = {
  faja: { include: { cliente: true, contratista: true, criterios: true } },
  lecturas: { include: { polea: true }, orderBy: { polea: { numero: 'asc' as const } } },
}

export async function getReporteById(id: string) {
  const user = await requireUser()
  const reporte = await prisma.reporte.findUnique({ where: { id }, include: REPORTE_INCLUDE })
  if (!reporte || !canReadFaja(user, reporte.faja)) return null
  return reporte
}

export async function getReporteBySlug(slug: string) {
  const parsed = parseReporteSlug(slug)
  if (!parsed) return null
  const user = await requireUser()
  const candidatos = await prisma.reporte.findMany({
    where: { faja: { tag: parsed.tag } },
    include: REPORTE_INCLUDE,
    orderBy: { createdAt: 'asc' },
  })
  const reporte = candidatos.find((r) => reporteMatchesSlugParts(parsed, r))
  if (!reporte || !canReadFaja(user, reporte.faja)) return null
  return reporte
}

/** Used only by the unauthenticated Puppeteer print view, gated by the HMAC print token instead of a session. */
export async function getReporteForPrint(id: string, token: string) {
  if (!verifyPrintToken(id, token)) return null
  return prisma.reporte.findUnique({ where: { id }, include: REPORTE_INCLUDE })
}

export type ReporteConDetalle = NonNullable<Awaited<ReturnType<typeof getReporteById>>>

export async function deleteReporte(id: string): Promise<void> {
  const user = await requireUser()
  const reporte = await prisma.reporte.findUniqueOrThrow({ where: { id }, include: { faja: true } })
  if (!canDeleteReporte(user, reporte.faja)) {
    throw new Error('No autorizado para eliminar este reporte')
  }
  await prisma.reporte.delete({ where: { id } })
  safeRevalidatePath(`/fajas/${reporte.faja.tag}`)
}
