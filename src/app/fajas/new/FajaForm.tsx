'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Cliente, Contratista } from '@prisma/client'
import { ImageUploader } from '@/components/ImageUploader'
import { createFaja } from '@/server/actions/fajas'
import { computeTag } from '@/lib/tag'
import { DEFAULT_CRITERIOS, type CriterioValores } from '@/lib/criterios'

const NIVEL_LABELS: Record<CriterioValores['nivel'], string> = {
  BUENO: 'Bueno',
  ACEPTABLE: 'Aceptable',
  INSATISFACTORIO: 'Insatisfactorio',
  INACEPTABLE: 'Inaceptable',
}

interface FajaFormProps {
  clientes: Cliente[]
  contratistas: Contratista[]
  lockedContratista?: Contratista
}

export function FajaForm({ clientes, contratistas, lockedContratista }: FajaFormProps) {
  const router = useRouter()
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '')
  const [contratistaId, setContratistaId] = useState(lockedContratista?.id ?? contratistas[0]?.id ?? '')
  const [area, setArea] = useState('')
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [numeroPoleas, setNumeroPoleas] = useState(5)
  const [esquemaUrl, setEsquemaUrl] = useState<string>()
  const [criterios, setCriterios] = useState<CriterioValores[]>(() => DEFAULT_CRITERIOS.map((c) => ({ ...c })))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tagPreview = useMemo(() => (area && nombre ? computeTag(area, nombre) : ''), [area, nombre])

  function updateCriterio(nivel: CriterioValores['nivel'], patch: Partial<CriterioValores>) {
    setCriterios((prev) => prev.map((c) => (c.nivel === nivel ? { ...c, ...patch } : c)))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const faja = await createFaja({
        clienteId,
        contratistaId,
        area,
        nombre,
        lugar,
        descripcion: descripcion || undefined,
        numeroPoleas,
        esquemaUrl,
        criterios,
      })
      router.push(`/fajas/${encodeURIComponent(faja.tag)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la faja')
      setSubmitting(false)
    }
  }

  if (clientes.length === 0 || (!lockedContratista && contratistas.length === 0)) {
    return (
      <p className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
        Primero debes crear al menos un{' '}
        <a href="/clientes" className="underline">cliente</a> y un{' '}
        <a href="/contratistas" className="underline">contratista</a>.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Cliente</span>
          <select className="w-full rounded border px-3 py-2" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Contratista</span>
          {lockedContratista ? (
            <p className="w-full rounded border bg-gray-50 px-3 py-2 text-gray-600">{lockedContratista.nombre}</p>
          ) : (
            <select className="w-full rounded border px-3 py-2" value={contratistaId} onChange={(e) => setContratistaId(e.target.value)} required>
              {contratistas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Área</span>
          <input className="w-full rounded border px-3 py-2" value={area} onChange={(e) => setArea(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Nombre</span>
          <input className="w-full rounded border px-3 py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
      </div>
      {tagPreview && (
        <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Tag de la faja: <strong>{tagPreview}</strong>
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Lugar</span>
        <input className="w-full rounded border px-3 py-2" value={lugar} onChange={(e) => setLugar(e.target.value)} required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Descripción (opcional)</span>
        <input className="w-full rounded border px-3 py-2" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Número de poleas
        <input
          type="number"
          min={1}
          className="mt-1 w-full rounded border px-3 py-2"
          value={numeroPoleas}
          onChange={(e) => setNumeroPoleas(Number(e.target.value))}
          required
        />
        <span className="mt-1 block text-xs font-normal text-gray-500">
          Se crearán {numeroPoleas} polea(s), cada una con chumacera izquierda y derecha.
        </span>
      </label>
      <ImageUploader folder="insp-predictivo/esquemas" value={esquemaUrl} onUploaded={setEsquemaUrl} label="Esquema de ubicación de poleas" />

      <div>
        <span className="mb-1 block text-sm font-medium">Criterios de aceptación</span>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-2 py-1">Nivel</th>
                <th className="px-2 py-1">Temp min (°C)</th>
                <th className="px-2 py-1">Temp max (°C)</th>
                <th className="px-2 py-1">Delta min (°C)</th>
                <th className="px-2 py-1">Delta max (°C)</th>
              </tr>
            </thead>
            <tbody>
              {criterios.map((c) => (
                <tr key={c.nivel}>
                  <td className="px-2 py-1 font-medium">{NIVEL_LABELS[c.nivel]}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number" step="0.1"
                      className="w-24 rounded border px-2 py-1"
                      value={c.tempMin}
                      onChange={(e) => updateCriterio(c.nivel, { tempMin: Number(e.target.value) })}
                      required
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number" step="0.1"
                      className="w-24 rounded border px-2 py-1"
                      value={c.tempMax}
                      onChange={(e) => updateCriterio(c.nivel, { tempMax: Number(e.target.value) })}
                      required
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number" step="0.1"
                      className="w-24 rounded border px-2 py-1"
                      value={c.deltaMin}
                      onChange={(e) => updateCriterio(c.nivel, { deltaMin: Number(e.target.value) })}
                      required
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number" step="0.1"
                      className="w-24 rounded border px-2 py-1"
                      value={c.deltaMax}
                      onChange={(e) => updateCriterio(c.nivel, { deltaMax: Number(e.target.value) })}
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Creando faja...' : 'Crear faja'}
      </button>
    </form>
  )
}
