import { describe, it, expect } from 'vitest'
import { resumirReporte } from '../../src/lib/reporteResumen'
import type { ReporteConDetalle } from '../../src/server/actions/reportes'

function lectura(overrides: Partial<{
  numero: number
  tempIzquierda: number
  tempDerecha: number
  condicion: 'BUENO' | 'ACEPTABLE' | 'INSATISFACTORIO' | 'INACEPTABLE'
}>) {
  const numero = overrides.numero ?? 1
  return {
    id: `lectura-${numero}`,
    tempIzquierda: overrides.tempIzquierda ?? 30,
    tempDerecha: overrides.tempDerecha ?? 30,
    condicion: overrides.condicion ?? 'BUENO',
    polea: { numero, tipo: null },
  }
}

function reporte(lecturas: ReturnType<typeof lectura>[]): ReporteConDetalle {
  return { lecturas } as unknown as ReporteConDetalle
}

describe('resumirReporte', () => {
  it('counts the condition distribution across lecturas', () => {
    const resumen = resumirReporte(
      reporte([
        lectura({ numero: 1, condicion: 'BUENO' }),
        lectura({ numero: 2, condicion: 'BUENO' }),
        lectura({ numero: 3, condicion: 'ACEPTABLE' }),
        lectura({ numero: 4, condicion: 'INACEPTABLE' }),
      ])
    )
    expect(resumen.totalPoleas).toBe(4)
    expect(resumen.distribucion).toEqual({ BUENO: 2, ACEPTABLE: 1, INSATISFACTORIO: 0, INACEPTABLE: 1 })
  })

  it('finds the lectura with the highest single-side temperature', () => {
    const resumen = resumirReporte(
      reporte([
        lectura({ numero: 1, tempIzquierda: 40.1, tempDerecha: 55.3 }),
        lectura({ numero: 2, tempIzquierda: 45.2, tempDerecha: 49.4 }),
      ])
    )
    expect(resumen.maxima?.temp).toBe(55.3)
    expect(resumen.maxima?.lectura.polea.numero).toBe(1)
  })

  it('finds the lectura with the highest delta between sides', () => {
    const resumen = resumirReporte(
      reporte([
        lectura({ numero: 1, tempIzquierda: 40.1, tempDerecha: 55.3 }),
        lectura({ numero: 2, tempIzquierda: 50.6, tempDerecha: 51.1 }),
      ])
    )
    expect(resumen.deltaMaxima?.delta).toBe(15.2)
    expect(resumen.deltaMaxima?.lectura.polea.numero).toBe(1)
  })

  it('sorts poleasCriticas by severity, excluding BUENO', () => {
    const resumen = resumirReporte(
      reporte([
        lectura({ numero: 1, condicion: 'ACEPTABLE' }),
        lectura({ numero: 2, condicion: 'BUENO' }),
        lectura({ numero: 3, condicion: 'INACEPTABLE' }),
        lectura({ numero: 4, condicion: 'INSATISFACTORIO' }),
      ])
    )
    expect(resumen.poleasCriticas.map((l) => l.polea.numero)).toEqual([3, 4, 1])
  })

  it('returns null maxima/deltaMaxima and empty poleasCriticas for no lecturas', () => {
    const resumen = resumirReporte(reporte([]))
    expect(resumen.totalPoleas).toBe(0)
    expect(resumen.maxima).toBeNull()
    expect(resumen.deltaMaxima).toBeNull()
    expect(resumen.poleasCriticas).toEqual([])
  })
})
