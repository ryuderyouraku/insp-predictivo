import { notFound } from 'next/navigation'
import { getReporteForPrint } from '@/server/actions/reportes'
import { getHistoricoByFaja } from '@/lib/historico'
import { resumirReporte } from '@/lib/reporteResumen'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'
import { ReportePortada } from '@/components/reporte/ReportePortada'
import { ReporteSummaryCards } from '@/components/reporte/ReporteSummaryCards'
import { PoleasResumenTable } from '@/components/reporte/PoleasResumenTable'
import { CriterioTable } from '@/components/CriterioTable'
import { PoleaDiagnosticoBlock } from '@/components/PoleaDiagnosticoBlock'
import { HistoricoTable } from '@/components/HistoricoTable'
import { TrendChart } from '@/components/TrendChart'
import './print.css'

export default async function ReportePrintPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string }
}) {
  if (!searchParams.token) notFound()

  const reporte = await getReporteForPrint(params.id, searchParams.token)
  if (!reporte) notFound()
  const historico = await getHistoricoByFaja(reporte.fajaId)
  const resumen = resumirReporte(reporte)

  return (
    <main className="reporte-print mx-auto max-w-3xl p-6">
      <ReportePortada reporte={reporte} />

      <section className="page-break-after space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
        <ReporteSummaryCards resumen={resumen} />

        {resumen.poleasCriticas.length > 0 && (
          <div className="avoid-break space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Poleas que requieren atención</h3>
            <ul className="space-y-1">
              {resumen.poleasCriticas.map((lectura) => {
                const style = CONDICION_STYLES[lectura.condicion]
                return (
                  <li
                    key={lectura.id}
                    className="rounded border px-3 py-2 text-sm"
                    style={{ backgroundColor: style.soft, borderColor: style.border, color: style.text }}
                  >
                    <strong>Polea {lectura.polea.numero}</strong> — {CONDICION_LABELS[lectura.condicion]}
                    {lectura.polea.tipo ? ` (${lectura.polea.tipo})` : ''}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="avoid-break">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Detalle por polea</h3>
          <PoleasResumenTable lecturas={reporte.lecturas} variant="print" />
        </div>
      </section>

      <section className="page-break-after space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Criterios de aceptación</h2>
        <CriterioTable criterios={reporte.faja.criterios} />
        {reporte.faja.esquemaUrl && (
          <>
            <h3 className="text-sm font-semibold text-gray-900">Esquema de poleas</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reporte.faja.esquemaUrl} alt="Esquema de poleas" className="max-w-full rounded border border-gray-200" />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Diagnóstico por polea</h2>
        {reporte.lecturas.map((lectura) => (
          <PoleaDiagnosticoBlock key={lectura.id} lectura={lectura} variant="print" />
        ))}
      </section>

      <section className="historico-section page-break-before space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Histórico de temperatura</h2>
        <HistoricoTable historico={historico} />
        <div className="grid grid-cols-2 gap-4">
          {historico.map((polea) => (
            <div key={polea.poleaId} className="avoid-break">
              <TrendChart polea={polea} criterios={reporte.faja.criterios} />
            </div>
          ))}
        </div>
      </section>

      <div id="print-ready" data-ready="true" />
    </main>
  )
}
