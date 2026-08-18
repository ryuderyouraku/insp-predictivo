import type { CriterioAceptacion } from '@prisma/client'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'

export function CriterioTable({ criterios }: { criterios: CriterioAceptacion[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Nivel</th>
            <th className="px-3 py-2">Rango °C</th>
            <th className="px-3 py-2">Delta °C</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {criterios.map((criterio) => {
            const style = CONDICION_STYLES[criterio.nivel]
            return (
              <tr key={criterio.id} style={{ backgroundColor: style.soft }}>
                <td className="px-3 py-2 font-semibold" style={{ color: style.text }}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: criterio.color }} />
                    {CONDICION_LABELS[criterio.nivel]}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{criterio.tempMin}° – {criterio.tempMax}°C</td>
                <td className="px-3 py-2 text-gray-700">{criterio.deltaMin} – {criterio.deltaMax}°C</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
