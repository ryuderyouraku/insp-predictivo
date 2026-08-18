import type { ReporteConDetalle } from '@/lib/types'
import { CONDICION_LABELS, CONDICION_STYLES, computeDelta } from '@/lib/condicion'

export function PoleasResumenTable({
  lecturas,
  variant = 'web',
}: {
  lecturas: ReporteConDetalle['lecturas']
  variant?: 'web' | 'print'
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Polea</th>
            <th className="px-3 py-2">Izquierda °C</th>
            <th className="px-3 py-2">Derecha °C</th>
            <th className="px-3 py-2">Delta °C</th>
            <th className="px-3 py-2">Condición</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lecturas.map((lectura) => {
            const style = CONDICION_STYLES[lectura.condicion]
            const delta = computeDelta(lectura.tempIzquierda, lectura.tempDerecha)
            const numero = `Polea ${String(lectura.polea.numero).padStart(2, '0')}${lectura.polea.tipo ? ` — ${lectura.polea.tipo}` : ''}`
            return (
              <tr key={lectura.id}>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {variant === 'web' ? (
                    <a href={`#polea-${lectura.polea.numero}`} className="hover:underline hover:decoration-blue-600">
                      {numero}
                    </a>
                  ) : (
                    numero
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{lectura.tempIzquierda}</td>
                <td className="px-3 py-2 text-gray-700">{lectura.tempDerecha}</td>
                <td className="px-3 py-2 text-gray-700">{delta}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: style.soft, color: style.text, border: `1px solid ${style.border}` }}
                  >
                    {CONDICION_LABELS[lectura.condicion]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
