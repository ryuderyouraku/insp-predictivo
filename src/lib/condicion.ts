import type { Condicion } from '@prisma/client'

export const SEVERITY: Record<Condicion, number> = {
  BUENO: 0,
  ACEPTABLE: 1,
  INSATISFACTORIO: 2,
  INACEPTABLE: 3,
}

export const CONDICION_COLORS: Record<Condicion, string> = {
  BUENO: '#10b981',
  ACEPTABLE: '#f59e0b',
  INSATISFACTORIO: '#ea580c',
  INACEPTABLE: '#dc2626',
}

export const CONDICION_LABELS: Record<Condicion, string> = {
  BUENO: 'Bueno',
  ACEPTABLE: 'Aceptable',
  INSATISFACTORIO: 'Insatisfactorio',
  INACEPTABLE: 'Inaceptable',
}

interface CondicionStyle {
  solid: string
  soft: string
  border: string
  text: string
}

export const CONDICION_STYLES: Record<Condicion, CondicionStyle> = {
  BUENO: { solid: '#10b981', soft: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  ACEPTABLE: { solid: '#f59e0b', soft: '#fffbeb', border: '#fde68a', text: '#b45309' },
  INSATISFACTORIO: { solid: '#ea580c', soft: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  INACEPTABLE: { solid: '#dc2626', soft: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
}

export function computeDelta(tempIzquierda: number, tempDerecha: number): number {
  return Math.round(Math.abs(tempIzquierda - tempDerecha) * 10) / 10
}

export function worstCondicion(condiciones: Condicion[]): Condicion {
  if (condiciones.length === 0) {
    throw new Error('worstCondicion requires at least one condicion')
  }
  return condiciones.reduce((worst, current) =>
    SEVERITY[current] > SEVERITY[worst] ? current : worst
  )
}
