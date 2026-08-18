import type { Condicion } from '@prisma/client'
import type { ReporteConDetalle } from '@/server/actions/reportes'
import { computeDelta, SEVERITY } from './condicion'

type Lectura = ReporteConDetalle['lecturas'][number]

export interface ReporteResumen {
  totalPoleas: number
  distribucion: Record<Condicion, number>
  maxima: { lectura: Lectura; temp: number } | null
  deltaMaxima: { lectura: Lectura; delta: number } | null
  poleasCriticas: Lectura[]
}

export function resumirReporte(reporte: ReporteConDetalle): ReporteResumen {
  const lecturas = reporte.lecturas

  const distribucion: Record<Condicion, number> = {
    BUENO: 0,
    ACEPTABLE: 0,
    INSATISFACTORIO: 0,
    INACEPTABLE: 0,
  }

  let maxima: ReporteResumen['maxima'] = null
  let deltaMaxima: ReporteResumen['deltaMaxima'] = null

  for (const lectura of lecturas) {
    distribucion[lectura.condicion]++

    const temp = Math.max(lectura.tempIzquierda, lectura.tempDerecha)
    if (!maxima || temp > maxima.temp) {
      maxima = { lectura, temp }
    }

    const delta = computeDelta(lectura.tempIzquierda, lectura.tempDerecha)
    if (!deltaMaxima || delta > deltaMaxima.delta) {
      deltaMaxima = { lectura, delta }
    }
  }

  const poleasCriticas = lecturas
    .filter((l) => l.condicion !== 'BUENO')
    .sort((a, b) => SEVERITY[b.condicion] - SEVERITY[a.condicion])

  return {
    totalPoleas: lecturas.length,
    distribucion,
    maxima,
    deltaMaxima,
    poleasCriticas,
  }
}
