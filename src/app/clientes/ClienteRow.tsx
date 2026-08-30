'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCliente } from '@/server/actions/clientes'
import type { Cliente } from '@prisma/client'

export function ClienteRow({ cliente }: { cliente: Cliente }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setBusy(true)
    const result = await deleteCliente(cliente.id)
    if (result.ok) {
      router.refresh()
      return
    }
    setError(result.error)
    setBusy(false)
    setConfirming(false)
  }

  return (
    <li className="rounded border bg-white p-3">
      <div className="flex items-center gap-3">
        {cliente.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cliente.logoUrl} alt={cliente.nombre} className="h-10 w-10 object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
            Sin logo
          </div>
        )}
        <span className="flex-1">{cliente.nombre}</span>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">¿Eliminar?</span>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              Sí
            </button>
            <button onClick={() => setConfirming(false)} className="rounded border px-2 py-1 text-xs">
              Cancelar
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  )
}
