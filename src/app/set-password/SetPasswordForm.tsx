'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitNewPassword } from '@/server/actions/passwordSetToken'

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setSubmitting(true)
    try {
      await submitNewPassword(token, password)
      setDone(true)
      setTimeout(() => router.push('/login'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
        Contraseña creada. Redirigiendo al inicio de sesión...
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Contraseña nueva</span>
        <input
          type="password"
          className="w-full rounded border px-3 py-2"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Confirmar contraseña</span>
        <input
          type="password"
          className="w-full rounded border px-3 py-2"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          minLength={8}
          required
        />
      </label>
      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Guardando...' : 'Crear contraseña'}
      </button>
    </form>
  )
}
