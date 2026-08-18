import type { ReporteConDetalle } from '@/lib/types'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

export function ReportePortada({ reporte }: { reporte: ReporteConDetalle }) {
  const { faja } = reporte
  const style = CONDICION_STYLES[reporte.condicionGeneral]

  return (
    <section className="portada page-break-after flex min-h-[240mm] flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {faja.cliente.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faja.cliente.logoUrl} alt={faja.cliente.nombre} className="h-10" />
          )}
          {faja.contratista.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faja.contratista.logoUrl} alt={faja.contratista.nombre} className="h-10" />
          )}
        </div>
        <p className="text-xs text-gray-400">Generado el {new Date().toLocaleDateString('es-PE')}</p>
      </div>

      <div className="mt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Informe de termografía</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-900">{faja.tag}</h1>
        <p className="mt-1 text-lg text-gray-500">{faja.cliente.nombre}</p>

        <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-gray-200 pt-8 sm:grid-cols-4">
          <Dato label="Fecha monitoreo" value={new Date(reporte.fecha).toLocaleDateString('es-PE')} />
          <Dato label="Componentes" value="Chumaceras" />
          <Dato label="Supervisor" value={reporte.supervisor} />
          <Dato label="Inspector" value={reporte.especialista} />
          <Dato label="Nº Aviso SAP" value={reporte.numeroAvisoSAP} />
          <Dato label="Poleas evaluadas" value={String(reporte.lecturas.length)} />
        </dl>
      </div>

      <div
        className="mt-16 flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ backgroundColor: style.soft, borderColor: style.border }}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: style.text }}>Condición general</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: style.text }}>{CONDICION_LABELS[reporte.condicionGeneral]}</p>
        </div>
        <p className="max-w-md text-sm leading-relaxed" style={{ color: style.text }}>{reporte.observacionGeneral}</p>
      </div>
    </section>
  )
}
