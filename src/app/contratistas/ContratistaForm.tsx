'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/components/ImageUploader'
import { createContratista } from '@/server/actions/contratistas'

export function ContratistaForm() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      await createContratista({ nombre, logoUrl })
      setNombre('')
      setLogoUrl(undefined)
      setFormKey((k) => k + 1)
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el contratista')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border bg-white p-4">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Nombre del contratista</span>
        <input
          className="w-full rounded border px-3 py-2"
          value={nombre}
          onChange={(event) => {
            setNombre(event.target.value)
            setSuccess(false)
          }}
          required
        />
      </label>
      <ImageUploader key={formKey} folder="insp-predictivo/logos-contratista" value={logoUrl} onUploaded={setLogoUrl} label="Logo" />
      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">Contratista creado correctamente.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Creando...' : 'Crear contratista'}
      </button>
    </form>
  )
}
