import type { PoleaHistorico } from '@/lib/historico'
import { CONDICION_STYLES } from '@/lib/condicion'

export function HistoricoTable({ historico }: { historico: PoleaHistorico[] }) {
  const fechas = Array.from(
    new Set(historico.flatMap((polea) => polea.lecturas.map((l) => l.fecha.getTime())))
  )
    .sort((a, b) => a - b)
    .map((t) => new Date(t))

  if (fechas.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no hay lecturas registradas.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="sticky left-0 bg-gray-50 px-3 py-2">Polea</th>
            {fechas.map((fecha) => (
              <th key={fecha.getTime()} className="whitespace-nowrap px-3 py-2">
                {fecha.toLocaleDateString('es-PE')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {historico.map((polea) => {
            const porFecha = new Map(polea.lecturas.map((l) => [l.fecha.getTime(), l]))
            return (
              <tr key={polea.poleaId}>
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900">
                  P{polea.numero}
                  {polea.tipo && <span className="block text-xs font-normal text-gray-500">{polea.tipo}</span>}
                </td>
                {fechas.map((fecha) => {
                  const lectura = porFecha.get(fecha.getTime())
                  if (!lectura) {
                    return <td key={fecha.getTime()} className="px-3 py-2 text-center text-gray-300">—</td>
                  }
                  const style = CONDICION_STYLES[lectura.condicion]
                  return (
                    <td key={fecha.getTime()} className="px-3 py-2" style={{ backgroundColor: style.soft }}>
                      <span style={{ color: style.text }} className="whitespace-nowrap font-medium">
                        {lectura.tempIzquierda}° / {lectura.tempDerecha}°
                      </span>
                      <span className="ml-1 whitespace-nowrap text-xs text-gray-500">Δ{lectura.delta}</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
