import type { Condicion } from '@prisma/client'
import type { ReporteResumen } from '@/lib/reporteResumen'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'

const ORDEN: Condicion[] = ['BUENO', 'ACEPTABLE', 'INSATISFACTORIO', 'INACEPTABLE']

function Metrica({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export function ReporteSummaryCards({ resumen }: { resumen: ReporteResumen }) {
  const { totalPoleas, distribucion, maxima, deltaMaxima } = resumen

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metrica label="Poleas evaluadas" value={String(totalPoleas)} />
      <Metrica
        label="Temperatura máxima"
        value={maxima ? `${maxima.temp}°C` : '—'}
        sub={maxima ? `Polea ${maxima.lectura.polea.numero}` : undefined}
      />
      <Metrica
        label="Delta máximo"
        value={deltaMaxima ? `${deltaMaxima.delta}°C` : '—'}
        sub={deltaMaxima ? `Polea ${deltaMaxima.lectura.polea.numero}` : undefined}
      />
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Distribución</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100">
          {ORDEN.map((condicion) => {
            const count = distribucion[condicion]
            if (count === 0 || totalPoleas === 0) return null
            return (
              <div
                key={condicion}
                style={{ backgroundColor: CONDICION_STYLES[condicion].solid, width: `${(count / totalPoleas) * 100}%` }}
                title={`${CONDICION_LABELS[condicion]}: ${count}`}
              />
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
          {ORDEN.filter((c) => distribucion[c] > 0).map((condicion) => (
            <span key={condicion} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CONDICION_STYLES[condicion].solid }} />
              {distribucion[condicion]} {CONDICION_LABELS[condicion]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
