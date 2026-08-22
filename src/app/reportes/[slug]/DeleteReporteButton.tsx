'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteReporte } from '@/server/actions/reportes'

export function DeleteReporteButton({ reporteId, fajaTag }: { reporteId: string; fajaTag: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="rounded border border-red-600 px-3 py-2 text-red-600">
        Eliminar reporte
      </button>
    )
  }

  return (
    <div className="rounded border border-red-600 bg-red-50 p-3">
      <p className="text-sm text-red-700">¿Confirmas que quieres eliminar este reporte?</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            await deleteReporte(reporteId)
            router.push(`/fajas/${encodeURIComponent(fajaTag)}`)
          }}
          className="rounded bg-red-600 px-3 py-2 text-white"
        >
          Sí, eliminar
        </button>
        <button onClick={() => setConfirming(false)} className="rounded border px-3 py-2">Cancelar</button>
      </div>
    </div>
  )
}
