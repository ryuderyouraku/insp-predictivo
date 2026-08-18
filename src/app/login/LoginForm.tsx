'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Email o contraseña incorrectos')
      return
    }
    router.push(searchParams.get('callbackUrl') ?? '/fajas')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        placeholder="Email"
        className="w-full rounded border px-3 py-2"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        className="w-full rounded border px-3 py-2"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="w-full rounded bg-blue-600 px-3 py-2 text-white">
        Entrar
      </button>
      <p className="text-center text-xs text-gray-500">
        ¿Recibiste una invitación por WhatsApp? Usa el enlace para crear tu contraseña.
      </p>
    </form>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  )
}
