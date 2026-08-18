import type { ReporteConDetalle } from '@/lib/types'
import { CONDICION_LABELS, CONDICION_STYLES, computeDelta } from '@/lib/condicion'

type Lectura = ReporteConDetalle['lecturas'][number]

export function PoleaDiagnosticoBlock({
  lectura,
  variant = 'web',
}: {
  lectura: Lectura
  variant?: 'web' | 'print'
}) {
  const style = CONDICION_STYLES[lectura.condicion]
  const numero = String(lectura.polea.numero).padStart(2, '0')
  const delta = computeDelta(lectura.tempIzquierda, lectura.tempDerecha)

  return (
    <div
      id={`polea-${lectura.polea.numero}`}
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white ${variant === 'print' ? 'avoid-break' : 'scroll-mt-24'}`}
      style={{ borderLeft: `4px solid ${style.solid}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Polea {numero}
          {lectura.polea.tipo && <span className="font-normal text-gray-500"> — {lectura.polea.tipo}</span>}
        </h3>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: style.soft, color: style.text, border: `1px solid ${style.border}` }}
        >
          {CONDICION_LABELS[lectura.condicion]}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
        <span>Izquierda <strong className="text-gray-900">{lectura.tempIzquierda}°C</strong></span>
        <span>Derecha <strong className="text-gray-900">{lectura.tempDerecha}°C</strong></span>
        <span>Delta <strong className="text-gray-900">{delta}°C</strong></span>
      </div>

      <div className={`grid grid-cols-1 gap-4 p-4 ${variant === 'print' ? '' : 'sm:grid-cols-2'}`}>
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{lectura.diagnosticoTexto}</p>
        <div className="grid grid-cols-2 gap-3">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lectura.fotoIzquierdaUrl} alt="Termograma izquierda" className="w-full rounded-md border border-gray-200" />
            <figcaption className="mt-1 text-center text-xs text-gray-500">Izquierda — {lectura.tempIzquierda}°C</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lectura.fotoDerechaUrl} alt="Termograma derecha" className="w-full rounded-md border border-gray-200" />
            <figcaption className="mt-1 text-center text-xs text-gray-500">Derecha — {lectura.tempDerecha}°C</figcaption>
          </figure>
        </div>
      </div>
    </div>
  )
}
