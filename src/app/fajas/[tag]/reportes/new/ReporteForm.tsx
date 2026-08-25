'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Condicion } from '@prisma/client'
import type { FajaConDetalle } from '@/server/actions/fajas'
import { ImageUploader } from '@/components/ImageUploader'
import { createReporte } from '@/server/actions/reportes'
import { analizarTermograma, generarObservacionGeneral } from '@/server/actions/ai'
import { buildDiagnosticoTexto } from '@/lib/diagnosticoTemplate'

interface LecturaFormState {
  tempIzquierda: string
  tempDerecha: string
  fotoIzquierdaUrl?: string
  fotoDerechaUrl?: string
  condicion: Condicion
  diagnosticoTexto: string
  analizando?: boolean
  analisisError?: string
}

const CONDICIONES: Condicion[] = ['BUENO', 'ACEPTABLE', 'INSATISFACTORIO', 'INACEPTABLE']

function isLecturaCompleta(lectura: LecturaFormState): boolean {
  return Boolean(lectura.tempIzquierda && lectura.tempDerecha && lectura.fotoIzquierdaUrl && lectura.fotoDerechaUrl)
}

interface ReporteFormProps {
  faja: FajaConDetalle
  currentUserName: string
  supervisores: { id: string; name: string }[]
}

export function ReporteForm({ faja, currentUserName, supervisores }: ReporteFormProps) {
  const router = useRouter()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [especialista, setEspecialista] = useState(currentUserName)
  const [supervisor, setSupervisor] = useState(supervisores[0]?.name ?? '')
  const [numeroOT, setNumeroOT] = useState('')
  const [observacionGeneral, setObservacionGeneral] = useState('Equipo sin indicaciones')
  const [generandoObservacion, setGenerandoObservacion] = useState(false)
  const [observacionError, setObservacionError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lecturas, setLecturas] = useState<Record<string, LecturaFormState>>(
    Object.fromEntries(
      faja.poleas.map((polea) => [
        polea.id,
        { tempIzquierda: '', tempDerecha: '', condicion: 'BUENO' as Condicion, diagnosticoTexto: '' },
      ])
    )
  )

  const completadas = useMemo(
    () => faja.poleas.filter((polea) => isLecturaCompleta(lecturas[polea.id])).length,
    [faja.poleas, lecturas]
  )

  function updateLectura(poleaId: string, patch: Partial<LecturaFormState>) {
    setLecturas((prev) => {
      const next = { ...prev[poleaId], ...patch }
      const tempIzquierda = Number(next.tempIzquierda)
      const tempDerecha = Number(next.tempDerecha)
      if (next.tempIzquierda && next.tempDerecha && !patch.diagnosticoTexto) {
        const polea = faja.poleas.find((p) => p.id === poleaId)!
        next.diagnosticoTexto = buildDiagnosticoTexto({
          numeroPolea: polea.numero,
          tempIzquierda,
          tempDerecha,
          condicion: next.condicion,
        })
      }
      return { ...prev, [poleaId]: next }
    })
  }

  async function handleAnalizar(poleaId: string) {
    const lectura = lecturas[poleaId]
    if (!lectura.fotoIzquierdaUrl || !lectura.fotoDerechaUrl) return
    const polea = faja.poleas.find((p) => p.id === poleaId)!
    setLecturas((prev) => ({ ...prev, [poleaId]: { ...prev[poleaId], analizando: true, analisisError: undefined } }))
    try {
      const resultado = await analizarTermograma({
        numeroPolea: polea.numero,
        fotoIzquierdaUrl: lectura.fotoIzquierdaUrl,
        fotoDerechaUrl: lectura.fotoDerechaUrl,
        criterios: faja.criterios,
      })
      updateLectura(poleaId, {
        tempIzquierda: String(resultado.tempIzquierda),
        tempDerecha: String(resultado.tempDerecha),
        condicion: resultado.condicion,
        diagnosticoTexto: resultado.diagnosticoTexto,
      })
    } catch (err) {
      setLecturas((prev) => ({
        ...prev,
        [poleaId]: { ...prev[poleaId], analisisError: err instanceof Error ? err.message : 'Error al analizar la imagen' },
      }))
    } finally {
      setLecturas((prev) => ({ ...prev, [poleaId]: { ...prev[poleaId], analizando: false } }))
    }
  }

  async function handleGenerarObservacion() {
    setGenerandoObservacion(true)
    setObservacionError(null)
    try {
      const lecturasCompletas = faja.poleas
        .map((polea) => ({ polea, lectura: lecturas[polea.id] }))
        .filter(({ lectura }) => lectura.tempIzquierda && lectura.tempDerecha)
        .map(({ polea, lectura }) => ({
          numeroPolea: polea.numero,
          tempIzquierda: Number(lectura.tempIzquierda),
          tempDerecha: Number(lectura.tempDerecha),
          condicion: lectura.condicion,
        }))
      const texto = await generarObservacionGeneral({ lecturas: lecturasCompletas })
      setObservacionGeneral(texto)
    } catch (err) {
      setObservacionError(err instanceof Error ? err.message : 'Error al generar la observación')
    } finally {
      setGenerandoObservacion(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createReporte({
        fajaId: faja.id,
        fecha: new Date(fecha),
        especialista,
        supervisor,
        numeroOT,
        observacionGeneral,
        lecturas: faja.poleas.map((polea) => {
          const l = lecturas[polea.id]
          return {
            poleaId: polea.id,
            tempIzquierda: Number(l.tempIzquierda),
            tempDerecha: Number(l.tempDerecha),
            fotoIzquierdaUrl: l.fotoIzquierdaUrl ?? '',
            fotoDerechaUrl: l.fotoDerechaUrl ?? '',
            condicion: l.condicion,
            diagnosticoTexto: l.diagnosticoTexto,
          }
        }),
      })
      router.push(`/fajas/${encodeURIComponent(faja.tag)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el reporte')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-col gap-2 rounded border bg-white/95 p-3 text-sm shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <span className="font-medium text-gray-700">
          Progreso: {completadas} de {faja.poleas.length} poleas completas
        </span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 sm:w-40">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(completadas / faja.poleas.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded border bg-white p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Fecha</span>
          <input type="date" className="w-full rounded border px-3 py-2" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Nº OT</span>
          <input className="w-full rounded border px-3 py-2" value={numeroOT} onChange={(e) => setNumeroOT(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Especialista</span>
          <input className="w-full rounded border px-3 py-2" value={especialista} onChange={(e) => setEspecialista(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Supervisor</span>
          {supervisores.length > 0 ? (
            <select
              className="w-full rounded border px-3 py-2"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              required
            >
              {supervisores.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input className="w-full rounded border px-3 py-2" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} required />
          )}
        </label>
        <label className="sm:col-span-2 text-sm">
          <span className="mb-1 block text-gray-600">Observación general</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <textarea
              className="w-full rounded border px-3 py-2"
              rows={4}
              value={observacionGeneral}
              onChange={(e) => setObservacionGeneral(e.target.value)}
            />
            <button
              type="button"
              onClick={handleGenerarObservacion}
              disabled={generandoObservacion || completadas === 0}
              className="whitespace-nowrap rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generandoObservacion ? 'Generando...' : '✨ Generar con IA'}
            </button>
          </div>
          {completadas === 0 && (
            <span className="mt-1 block text-xs text-gray-400">Completa al menos una polea para poder generarla.</span>
          )}
          {observacionError && <p className="mt-1 text-xs text-red-700">{observacionError}</p>}
        </label>
      </div>

      {faja.poleas.map((polea) => {
        const lectura = lecturas[polea.id]
        const completa = isLecturaCompleta(lectura)
        return (
          <div
            key={polea.id}
            className={`space-y-3 rounded border bg-white p-4 transition ${completa ? 'border-green-300' : ''}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Polea {polea.numero}{polea.tipo ? ` — ${polea.tipo}` : ''}</h3>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${completa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {completa ? '✓ Completo' : 'Pendiente'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Temp. izquierda (°C)</span>
                <input
                  type="number" step="0.1"
                  className="w-full rounded border px-3 py-2"
                  value={lectura.tempIzquierda}
                  onChange={(e) => updateLectura(polea.id, { tempIzquierda: e.target.value })}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Temp. derecha (°C)</span>
                <input
                  type="number" step="0.1"
                  className="w-full rounded border px-3 py-2"
                  value={lectura.tempDerecha}
                  onChange={(e) => updateLectura(polea.id, { tempDerecha: e.target.value })}
                  required
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Condición</span>
              <select
                className="rounded border px-3 py-2"
                value={lectura.condicion}
                onChange={(e) => updateLectura(polea.id, { condicion: e.target.value as Condicion })}
              >
                {CONDICIONES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ImageUploader
                folder={`insp-predictivo/reportes/${faja.tag}`}
                value={lectura.fotoIzquierdaUrl}
                onUploaded={(url) => updateLectura(polea.id, { fotoIzquierdaUrl: url })}
                label="Foto izquierda"
              />
              <ImageUploader
                folder={`insp-predictivo/reportes/${faja.tag}`}
                value={lectura.fotoDerechaUrl}
                onUploaded={(url) => updateLectura(polea.id, { fotoDerechaUrl: url })}
                label="Foto derecha"
              />
            </div>
            {lectura.fotoIzquierdaUrl && lectura.fotoDerechaUrl && (
              <div>
                <button
                  type="button"
                  onClick={() => handleAnalizar(polea.id)}
                  disabled={lectura.analizando}
                  className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lectura.analizando ? 'Analizando termograma...' : '✨ Leer temperatura y diagnóstico con IA'}
                </button>
                {lectura.analisisError && <p className="mt-1 text-xs text-red-700">{lectura.analisisError}</p>}
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Diagnóstico</span>
              <textarea
                className="w-full rounded border px-3 py-2"
                rows={4}
                value={lectura.diagnosticoTexto}
                onChange={(e) => updateLectura(polea.id, { diagnosticoTexto: e.target.value })}
              />
            </label>
          </div>
        )
      })}

      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Guardando...' : 'Guardar reporte'}
      </button>
    </form>
  )
}
