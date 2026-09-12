import { prisma } from '@/lib/prisma'
import { fajaScopeWhere } from '@/lib/permissions'
import type { ActorUser } from '@/lib/permissions'
import { getHistoricoByFaja } from '@/lib/historico'
import { computeDelta, SEVERITY } from '@/lib/condicion'
import { especialistaLabel } from '@/lib/reporteEspecialista'
import type { Condicion, Prisma } from '@prisma/client'

/**
 * Same generic message for "doesn't exist" and "exists but out of scope" — never reveal
 * which. Returned verbatim to the caller (the bot's system prompt tells the model to relay
 * this literally, not to elaborate on it) so freeform phrasing can't leak which case it is.
 */
function fajaNotFoundMessage(tag: string): string {
  return `No encontré la faja ${tag} o no tienes acceso a ella.`
}

async function findFajaScoped(actor: ActorUser, tag: string) {
  return prisma.faja.findFirst({ where: { tag, ...fajaScopeWhere(actor) } })
}

export interface FajaResumen {
  tag: string
  nombre: string
  area: string
  lugar: string
  numeroPoleas: number
  cliente: string
  contratista: string
  totalReportes: number
  ultimaInspeccion: Date | null
}

export interface ListarFajasResult {
  fajas: FajaResumen[]
}

export interface CriterioResumen {
  nivel: Condicion
  tempMin: number
  tempMax: number
  deltaMin: number
  deltaMax: number
}

export interface PoleaResumen {
  numero: number
  tipo: string | null
}

export interface DetalleFajaData {
  tag: string
  nombre: string
  area: string
  lugar: string
  descripcion: string | null
  numeroPoleas: number
  cliente: string
  contratista: string
  poleas: PoleaResumen[]
  criterios: CriterioResumen[]
}

export type DetalleFajaResult = { error: string } | DetalleFajaData

export interface ReporteResumen {
  fajaTag: string
  fecha: Date
  numeroOT: string
  especialista: string
  supervisor: string
  condicionGeneral: Condicion
  observacionGeneral: string
}

export type ListarReportesResult = { error: string } | { reportes: ReporteResumen[] }

export interface LecturaDetalle {
  numeroPolea: number
  tempIzquierda: number
  tempDerecha: number
  delta: number
  condicion: Condicion
  diagnostico: string
}

export interface ReporteDetalleData {
  fajaTag: string
  fecha: Date
  numeroOT: string
  especialista: string
  supervisor: string
  condicionGeneral: Condicion
  observacionGeneral: string
  lecturas: LecturaDetalle[]
}

export type DetalleReporteResult = { error: string } | { reporte: null; mensaje: string } | { reporte: ReporteDetalleData }

export interface LecturaHistoricaOut {
  fecha: Date
  tempIzquierda: number
  tempDerecha: number
  delta: number
  condicion: Condicion
}

export type HistorialPoleaResult = { error: string } | { fajaTag: string; numeroPolea: number; lecturas: LecturaHistoricaOut[] }

export interface LecturaBusqueda {
  fajaTag: string
  numeroPolea: number
  fecha: Date
  tempIzquierda: number
  tempDerecha: number
  delta: number
  condicion: Condicion
}

export type BuscarLecturasResult = { error: string } | { lecturas: LecturaBusqueda[] }

export async function listarFajas(actor: ActorUser): Promise<ListarFajasResult> {
  const fajas = await prisma.faja.findMany({
    where: fajaScopeWhere(actor),
    select: {
      tag: true,
      nombre: true,
      area: true,
      lugar: true,
      numeroPoleas: true,
      cliente: { select: { nombre: true } },
      contratista: { select: { nombre: true } },
      _count: { select: { reportes: true } },
    },
    orderBy: { tag: 'asc' },
  })

  const ultimas = await Promise.all(
    fajas.map((f) =>
      prisma.reporte.findFirst({
        where: { faja: { tag: f.tag } },
        orderBy: { fecha: 'desc' },
        select: { fecha: true },
      })
    )
  )

  return {
    fajas: fajas.map((f, i) => ({
      tag: f.tag,
      nombre: f.nombre,
      area: f.area,
      lugar: f.lugar,
      numeroPoleas: f.numeroPoleas,
      cliente: f.cliente.nombre,
      contratista: f.contratista.nombre,
      totalReportes: f._count.reportes,
      ultimaInspeccion: ultimas[i]?.fecha ?? null,
    })),
  }
}

export async function detalleFaja(actor: ActorUser, tag: string): Promise<DetalleFajaResult> {
  const faja = await prisma.faja.findFirst({
    where: { tag, ...fajaScopeWhere(actor) },
    include: {
      cliente: { select: { nombre: true } },
      contratista: { select: { nombre: true } },
      criterios: { orderBy: { nivel: 'asc' } },
      poleas: { orderBy: { numero: 'asc' }, select: { numero: true, tipo: true } },
    },
  })
  if (!faja) return { error: fajaNotFoundMessage(tag) }

  return {
    tag: faja.tag,
    nombre: faja.nombre,
    area: faja.area,
    lugar: faja.lugar,
    descripcion: faja.descripcion,
    numeroPoleas: faja.numeroPoleas,
    cliente: faja.cliente.nombre,
    contratista: faja.contratista.nombre,
    poleas: faja.poleas,
    criterios: faja.criterios.map((c) => ({
      nivel: c.nivel,
      tempMin: c.tempMin,
      tempMax: c.tempMax,
      deltaMin: c.deltaMin,
      deltaMax: c.deltaMax,
    })),
  }
}

export interface ListarReportesInput {
  tag?: string
  desde?: string
  hasta?: string
  condicion?: Condicion
}

export async function listarReportes(actor: ActorUser, input: ListarReportesInput): Promise<ListarReportesResult> {
  if (input.tag) {
    const faja = await findFajaScoped(actor, input.tag)
    if (!faja) return { error: fajaNotFoundMessage(input.tag) }
  }

  const reportes = await prisma.reporte.findMany({
    where: {
      faja: { ...fajaScopeWhere(actor), ...(input.tag ? { tag: input.tag } : {}) },
      ...(input.desde || input.hasta
        ? { fecha: { gte: input.desde ? startOfDay(input.desde) : undefined, lte: input.hasta ? endOfDay(input.hasta) : undefined } }
        : {}),
      ...(input.condicion ? { condicionGeneral: input.condicion } : {}),
    },
    include: { faja: { select: { tag: true } }, especialistas: { select: { name: true } } },
    orderBy: { fecha: 'desc' },
    take: 20,
  })

  return {
    reportes: reportes.map((r) => ({
      fajaTag: r.faja.tag,
      fecha: r.fecha,
      numeroOT: r.numeroOT,
      especialista: especialistaLabel(r),
      supervisor: r.supervisor,
      condicionGeneral: r.condicionGeneral,
      observacionGeneral: r.observacionGeneral,
    })),
  }
}

export interface DetalleReporteInput {
  tag: string
  fecha?: string
}

export async function detalleReporte(actor: ActorUser, input: DetalleReporteInput): Promise<DetalleReporteResult> {
  const faja = await findFajaScoped(actor, input.tag)
  if (!faja) return { error: fajaNotFoundMessage(input.tag) }

  const reporte = await prisma.reporte.findFirst({
    where: {
      fajaId: faja.id,
      ...(input.fecha ? { fecha: { gte: startOfDay(input.fecha), lte: endOfDay(input.fecha) } } : {}),
    },
    orderBy: { fecha: 'desc' },
    include: {
      lecturas: { include: { polea: true }, orderBy: { polea: { numero: 'asc' } } },
      especialistas: { select: { name: true } },
    },
  })
  if (!reporte) {
    return {
      reporte: null,
      mensaje: input.fecha
        ? `No encontré lecturas de ${faja.tag} en la fecha ${input.fecha}.`
        : `${faja.tag} todavía no tiene reportes registrados.`,
    }
  }

  return {
    reporte: {
      fajaTag: faja.tag,
      fecha: reporte.fecha,
      numeroOT: reporte.numeroOT,
      especialista: especialistaLabel(reporte),
      supervisor: reporte.supervisor,
      condicionGeneral: reporte.condicionGeneral,
      observacionGeneral: reporte.observacionGeneral,
      lecturas: reporte.lecturas.map((l) => ({
        numeroPolea: l.polea.numero,
        tempIzquierda: l.tempIzquierda,
        tempDerecha: l.tempDerecha,
        delta: computeDelta(l.tempIzquierda, l.tempDerecha),
        condicion: l.condicion,
        diagnostico: l.diagnosticoTexto,
      })),
    },
  }
}

export interface HistorialPoleaInput {
  tag: string
  numeroPolea: number
  desde?: string
  hasta?: string
}

export async function historialPolea(actor: ActorUser, input: HistorialPoleaInput): Promise<HistorialPoleaResult> {
  const faja = await findFajaScoped(actor, input.tag)
  if (!faja) return { error: fajaNotFoundMessage(input.tag) }

  const historico = await getHistoricoByFaja(faja.id)
  const polea = historico.find((p) => p.numero === input.numeroPolea)
  if (!polea) return { error: `La faja ${faja.tag} no tiene una polea número ${input.numeroPolea}.` }

  let lecturas = polea.lecturas
  if (input.desde) lecturas = lecturas.filter((l) => l.fecha >= startOfDay(input.desde!))
  if (input.hasta) lecturas = lecturas.filter((l) => l.fecha <= endOfDay(input.hasta!))

  return {
    fajaTag: faja.tag,
    numeroPolea: input.numeroPolea,
    lecturas: [...lecturas].reverse().map((l) => ({
      fecha: l.fecha,
      tempIzquierda: l.tempIzquierda,
      tempDerecha: l.tempDerecha,
      delta: l.delta,
      condicion: l.condicion,
    })),
  }
}

export interface BuscarLecturasInput {
  tag?: string
  numeroPolea?: number
  desde?: string
  hasta?: string
  condicionMinima?: Condicion
  tempMinima?: number
  limite?: number
}

export async function buscarLecturas(actor: ActorUser, input: BuscarLecturasInput): Promise<BuscarLecturasResult> {
  if (input.tag) {
    const faja = await findFajaScoped(actor, input.tag)
    if (!faja) return { error: fajaNotFoundMessage(input.tag) }
  }

  const condicionesPermitidas = input.condicionMinima
    ? (Object.keys(SEVERITY) as Condicion[]).filter((c) => SEVERITY[c] >= SEVERITY[input.condicionMinima!])
    : undefined

  const where: Prisma.LecturaPoleaWhereInput = {
    reporte: {
      faja: { ...fajaScopeWhere(actor), ...(input.tag ? { tag: input.tag } : {}) },
      ...(input.desde || input.hasta
        ? { fecha: { gte: input.desde ? startOfDay(input.desde) : undefined, lte: input.hasta ? endOfDay(input.hasta) : undefined } }
        : {}),
    },
    ...(input.numeroPolea !== undefined ? { polea: { numero: input.numeroPolea } } : {}),
    ...(condicionesPermitidas ? { condicion: { in: condicionesPermitidas } } : {}),
    ...(input.tempMinima !== undefined
      ? { OR: [{ tempIzquierda: { gte: input.tempMinima } }, { tempDerecha: { gte: input.tempMinima } }] }
      : {}),
  }

  const lecturas = await prisma.lecturaPolea.findMany({
    where,
    include: { polea: true, reporte: { include: { faja: { select: { tag: true } } } } },
    orderBy: { reporte: { fecha: 'desc' } },
    take: Math.min(input.limite ?? 20, 50),
  })

  return {
    lecturas: lecturas.map((l) => ({
      fajaTag: l.reporte.faja.tag,
      numeroPolea: l.polea.numero,
      fecha: l.reporte.fecha,
      tempIzquierda: l.tempIzquierda,
      tempDerecha: l.tempDerecha,
      delta: computeDelta(l.tempIzquierda, l.tempDerecha),
      condicion: l.condicion,
    })),
  }
}

function startOfDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function endOfDay(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`)
}
