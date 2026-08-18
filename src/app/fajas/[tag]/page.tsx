import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFajaByTag, countReportesByFaja } from '@/server/actions/fajas'
import { getHistoricoByFaja } from '@/lib/historico'
import { requireUser } from '@/lib/session'
import { canCreateReporte, canManageFaja } from '@/lib/permissions'
import { PoleaTipoEditor } from './PoleaTipoEditor'
import { CriteriosSection } from './CriteriosSection'
import { DeleteFajaButton } from './DeleteFajaButton'
import { FajaImagenesEditor } from './FajaImagenesEditor'
import { CriterioTable } from '@/components/CriterioTable'
import { HistoricoTable } from '@/components/HistoricoTable'
import { TrendChart } from '@/components/TrendChart'
import { CondicionBadge } from '@/components/CondicionBadge'

export default async function FajaDetailPage({ params }: { params: { tag: string } }) {
  const user = await requireUser()
  const faja = await getFajaByTag(params.tag)
  if (!faja) notFound()
  const reportesCount = await countReportesByFaja(faja.id)
  const historico = await getHistoricoByFaja(faja.id)
  const canManage = canManageFaja(user, faja)
  const canReport = canCreateReporte(user, faja)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/fajas" className="text-sm text-gray-500 hover:text-blue-700">← Volver a fajas</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{faja.tag}</h1>
          <p className="text-sm text-gray-500">{faja.cliente.nombre} · {faja.lugar} · {faja.numeroPoleas} polea(s)</p>
        </div>
        {canReport && (
          <Link
            href={`/fajas/${encodeURIComponent(faja.tag)}/reportes/new`}
            className="rounded bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
          >
            + Crear reporte
          </Link>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-medium">Imágenes de referencia</h2>
        {canManage ? (
          <FajaImagenesEditor fajaId={faja.id} esquemaUrl={faja.esquemaUrl} />
        ) : (
          faja.esquemaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faja.esquemaUrl} alt="Esquema de poleas" className="max-w-full rounded border" />
          )
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Poleas</h2>
        <div className="space-y-1 rounded border bg-white p-3">
          {canManage
            ? faja.poleas.map((polea) => <PoleaTipoEditor key={polea.id} polea={polea} />)
            : faja.poleas.map((polea) => (
                <p key={polea.id} className="text-sm text-gray-600">
                  Polea {polea.numero}{polea.tipo ? ` — ${polea.tipo}` : ''}
                </p>
              ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Criterios de aceptación</h2>
        {canManage ? (
          <CriteriosSection criterios={faja.criterios} locked={faja.reportes.length > 0} />
        ) : (
          <CriterioTable criterios={faja.criterios} />
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Reportes</h2>
        {faja.reportes.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-center text-sm text-gray-500">
            Todavía no hay reportes para esta faja.{' '}
            {canReport && (
              <Link href={`/fajas/${encodeURIComponent(faja.tag)}/reportes/new`} className="font-medium text-blue-700 hover:underline">
                Crear el primero →
              </Link>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {faja.reportes.map((reporte) => (
              <li key={reporte.id}>
                <Link
                  href={`/reportes/${reporte.id}`}
                  className="flex items-center justify-between rounded border bg-white p-3 transition hover:border-blue-400 hover:shadow-sm"
                >
                  <span>{new Date(reporte.fecha).toLocaleDateString('es-PE')} — {reporte.especialista}</span>
                  <CondicionBadge condicion={reporte.condicionGeneral} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {faja.reportes.length > 0 && (
        <>
          <section>
            <h2 className="mb-2 font-medium">Histórico de temperatura</h2>
            <HistoricoTable historico={historico} />
          </section>

          <section>
            <h2 className="mb-2 font-medium">Tendencias</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {historico.map((polea) => (
                <TrendChart key={polea.poleaId} polea={polea} criterios={faja.criterios} />
              ))}
            </div>
          </section>
        </>
      )}

      {canManage && <DeleteFajaButton fajaId={faja.id} reportesCount={reportesCount} />}
    </main>
  )
}
