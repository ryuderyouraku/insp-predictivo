import type { ReporteConDetalle } from '@/lib/types'

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

export function ReporteInfoCard({ reporte }: { reporte: ReporteConDetalle }) {
  const { faja } = reporte
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Campo label="Cliente" value={faja.cliente.nombre} />
        <Campo label="Lugar" value={faja.lugar} />
        <Campo label="Fecha monitoreo" value={new Date(reporte.fecha).toLocaleDateString('es-PE')} />
        <Campo label="Sistema" value={faja.tag} />
        <Campo label="Supervisor" value={reporte.supervisor} />
        <Campo label="Componentes" value="Chumaceras" />
        <Campo label="Especialista" value={reporte.especialista} />
        <Campo label="Nº Aviso SAP" value={reporte.numeroAvisoSAP} />
      </dl>
    </div>
  )
}
