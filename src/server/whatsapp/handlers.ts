import { prisma } from '@/lib/prisma'
import { fajaScopeWhere } from '@/lib/permissions'
import type { ActorUser } from '@/lib/permissions'
import { getHistoricoByFaja } from '@/lib/historico'
import { CONDICION_LABELS, computeDelta } from '@/lib/condicion'
import type { Intent } from './intent'

const fmtFecha = (d: Date) => d.toLocaleDateString('es-PE')

function startOfDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function endOfDay(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`)
}

/** Same generic message for "doesn't exist" and "exists but out of scope" — never reveal which. */
function fajaNotFoundMessage(tag: string): string {
  return `No encontré la faja ${tag} o no tienes acceso a ella.`
}

async function findFajaScoped(actor: ActorUser, tag: string) {
  return prisma.faja.findFirst({ where: { tag, ...fajaScopeWhere(actor) } })
}

async function listadoFajas(actor: ActorUser): Promise<string> {
  const fajas = await prisma.faja.findMany({
    where: fajaScopeWhere(actor),
    select: { tag: true, lugar: true },
    orderBy: { tag: 'asc' },
  })
  if (fajas.length === 0) return 'No tienes fajas asignadas todavía.'
  return `📋 Fajas disponibles:\n${fajas.map((f) => `• ${f.tag} — ${f.lugar}`).join('\n')}`
}

async function estadoFaja(actor: ActorUser, tag: string): Promise<string> {
  const faja = await findFajaScoped(actor, tag)
  if (!faja) return fajaNotFoundMessage(tag)

  const reporte = await prisma.reporte.findFirst({ where: { fajaId: faja.id }, orderBy: { fecha: 'desc' } })
  if (!reporte) return `${faja.tag} todavía no tiene reportes registrados.`

  return (
    `📍 ${faja.tag} — ${faja.lugar}\n` +
    `Última inspección: ${fmtFecha(reporte.fecha)}\n` +
    `Condición general: ${CONDICION_LABELS[reporte.condicionGeneral]}\n` +
    reporte.observacionGeneral
  )
}

async function ultimoReporte(actor: ActorUser, tag: string): Promise<string> {
  const faja = await findFajaScoped(actor, tag)
  if (!faja) return fajaNotFoundMessage(tag)

  const reporte = await prisma.reporte.findFirst({
    where: { fajaId: faja.id },
    orderBy: { fecha: 'desc' },
    include: { lecturas: { include: { polea: true }, orderBy: { polea: { numero: 'asc' } } } },
  })
  if (!reporte) return `${faja.tag} todavía no tiene reportes registrados.`

  const lines = reporte.lecturas.map((l) => {
    const delta = computeDelta(l.tempIzquierda, l.tempDerecha)
    return `Polea ${l.polea.numero}: Izq ${l.tempIzquierda}°C / Der ${l.tempDerecha}°C (Δ${delta}) — ${CONDICION_LABELS[l.condicion]}`
  })
  return (
    `📄 Último reporte ${faja.tag} — ${fmtFecha(reporte.fecha)}\n` +
    `Condición general: ${CONDICION_LABELS[reporte.condicionGeneral]}\n\n${lines.join('\n')}`
  )
}

async function historialPolea(
  actor: ActorUser,
  intent: Extract<Intent, { tipo: 'historial_polea' }>
): Promise<string> {
  const faja = await findFajaScoped(actor, intent.fajaTag)
  if (!faja) return fajaNotFoundMessage(intent.fajaTag)

  const historico = await getHistoricoByFaja(faja.id)
  const polea = historico.find((p) => p.numero === intent.numeroPolea)
  if (!polea) return `La faja ${faja.tag} no tiene una polea número ${intent.numeroPolea}.`

  let lecturas = polea.lecturas
  if (intent.desde) lecturas = lecturas.filter((l) => l.fecha >= startOfDay(intent.desde!))
  if (intent.hasta) lecturas = lecturas.filter((l) => l.fecha <= endOfDay(intent.hasta!))
  if (lecturas.length === 0) {
    return `No hay lecturas registradas para la polea ${intent.numeroPolea} de ${faja.tag} en ese rango.`
  }

  const lines = [...lecturas]
    .reverse()
    .map((l) => `${fmtFecha(l.fecha)} — Izq ${l.tempIzquierda}°C / Der ${l.tempDerecha}°C — ${CONDICION_LABELS[l.condicion]}`)
  return `📊 Historial polea ${intent.numeroPolea} — ${faja.tag}\n${lines.join('\n')}`
}

async function lecturaEnFecha(
  actor: ActorUser,
  intent: Extract<Intent, { tipo: 'lectura_en_fecha' }>
): Promise<string> {
  const faja = await findFajaScoped(actor, intent.fajaTag)
  if (!faja) return fajaNotFoundMessage(intent.fajaTag)

  const reporte = await prisma.reporte.findFirst({
    where: { fajaId: faja.id, fecha: { gte: startOfDay(intent.fecha), lte: endOfDay(intent.fecha) } },
    include: { lecturas: { include: { polea: true }, orderBy: { polea: { numero: 'asc' } } } },
  })
  if (!reporte) return `No encontré lecturas de ${faja.tag} en la fecha ${intent.fecha}.`

  const lecturas =
    intent.numeroPolea === undefined
      ? reporte.lecturas
      : reporte.lecturas.filter((l) => l.polea.numero === intent.numeroPolea)
  if (lecturas.length === 0) {
    return `No hay datos de la polea ${intent.numeroPolea} de ${faja.tag} en esa fecha.`
  }

  const lines = lecturas.map(
    (l) => `Polea ${l.polea.numero}: Izq ${l.tempIzquierda}°C / Der ${l.tempDerecha}°C — ${CONDICION_LABELS[l.condicion]}`
  )
  return `🗓️ ${faja.tag} — ${fmtFecha(reporte.fecha)}\n${lines.join('\n')}`
}

function noReconocido(): string {
  return [
    'No entendí tu mensaje 🤔 Puedo ayudarte con:',
    '• "estado de 2730CV002" — condición actual de una faja',
    '• "último reporte de 2730CV002" — última inspección',
    '• "historial de la polea 3 de 2730CV002" — histórico de temperaturas',
    '• "lecturas del 2026-07-12 en 2730CV002" — lecturas de una fecha',
    '• "qué fajas tengo" — lista tus fajas',
  ].join('\n')
}

export async function executeIntent(actor: ActorUser, intent: Intent): Promise<string> {
  switch (intent.tipo) {
    case 'listado_fajas':
      return listadoFajas(actor)
    case 'estado_faja':
      return estadoFaja(actor, intent.fajaTag)
    case 'ultimo_reporte':
      return ultimoReporte(actor, intent.fajaTag)
    case 'historial_polea':
      return historialPolea(actor, intent)
    case 'lectura_en_fecha':
      return lecturaEnFecha(actor, intent)
    case 'no_reconocido':
      return noReconocido()
  }
}
