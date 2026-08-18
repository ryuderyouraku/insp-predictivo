import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/lib/session'
import { canManageFaja } from '@/lib/permissions'
import { getReporteById } from '@/server/actions/reportes'
import { resumirReporte } from '@/lib/reporteResumen'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'
import { ReporteInfoCard } from '@/components/reporte/ReporteInfoCard'
import { ReporteSummaryCards } from '@/components/reporte/ReporteSummaryCards'
import { PoleasResumenTable } from '@/components/reporte/PoleasResumenTable'
import { CriterioTable } from '@/components/CriterioTable'
import { PoleaDiagnosticoBlock } from '@/components/PoleaDiagnosticoBlock'
import { DeleteReporteButton } from './DeleteReporteButton'

export default async function ReporteDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser()

  const reporte = await getReporteById(params.id)
  if (!reporte) notFound()
  const canDelete = canManageFaja(user, reporte.faja)
  const resumen = resumirReporte(reporte)
  const condStyle = CONDICION_STYLES[reporte.condicionGeneral]

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href={`/fajas/${encodeURIComponent(reporte.faja.tag)}`} className="text-sm text-gray-500 hover:text-blue-700">
          ← Volver a {reporte.faja.tag}
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Reporte {reporte.faja.tag}</h1>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: condStyle.soft, color: condStyle.text, border: `1px solid ${condStyle.border}` }}
            >
              {CONDICION_LABELS[reporte.condicionGeneral]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {new Date(reporte.fecha).toLocaleDateString('es-PE')} · {reporte.especialista}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/reportes/${reporte.id}/pdf`}
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Descargar PDF
          </a>
          {canDelete && <DeleteReporteButton reporteId={reporte.id} fajaTag={reporte.faja.tag} />}
        </div>
      </div>

      <ReporteInfoCard reporte={reporte} />

      <div
        className="rounded-lg border p-4 text-sm leading-relaxed"
        style={{ backgroundColor: condStyle.soft, borderColor: condStyle.border, color: condStyle.text }}
      >
        {reporte.observacionGeneral}
      </div>

      <ReporteSummaryCards resumen={resumen} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Resumen de poleas</h2>
        <PoleasResumenTable lecturas={reporte.lecturas} variant="web" />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reporte.faja.esquemaUrl && (
          <details className="rounded-lg border border-gray-200 bg-white p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">Esquema de poleas</summary>
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reporte.faja.esquemaUrl} alt="Esquema de poleas" className="max-w-full rounded border border-gray-200" />
            </div>
          </details>
        )}
        <details className="rounded-lg border border-gray-200 bg-white p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">Criterios de aceptación</summary>
          <div className="mt-3">
            <CriterioTable criterios={reporte.faja.criterios} />
          </div>
        </details>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Diagnóstico por polea</h2>
        {reporte.lecturas.map((lectura) => (
          <PoleaDiagnosticoBlock key={lectura.id} lectura={lectura} variant="web" />
        ))}
      </section>
    </main>
  )
}
