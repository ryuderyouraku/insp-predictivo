'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUser } from '@/server/actions/users'
import type { Cliente, Contratista, Role } from '@prisma/client'

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  INSPECTOR: 'Inspector',
  CLIENTE: 'Cliente',
}

interface CreateUserFormProps {
  actorRole: Role
  contratistas: Contratista[]
  clientes: Cliente[]
}

export function CreateUserForm({ actorRole, contratistas, clientes }: CreateUserFormProps) {
  const router = useRouter()
  const assignableRoles: Role[] = useMemo(
    () => (actorRole === 'ADMIN' ? ['ADMIN', 'SUPERVISOR', 'INSPECTOR', 'CLIENTE'] : ['SUPERVISOR', 'INSPECTOR']),
    [actorRole]
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>(assignableRoles[0])
  const [contratistaId, setContratistaId] = useState(contratistas[0]?.id ?? '')
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const needsContratista = actorRole === 'ADMIN' && (role === 'SUPERVISOR' || role === 'INSPECTOR')
  const needsCliente = role === 'CLIENTE'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      await createUser({
        name,
        email,
        password,
        role,
        contratistaId: needsContratista ? contratistaId : undefined,
        clienteId: needsCliente ? clienteId : undefined,
        phone: phone.trim() || undefined,
      })
      setName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setRole(assignableRoles[0])
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">Nueva cuenta</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Nombre</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Email</span>
          <input
            type="email"
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Contraseña</span>
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
          <span className="mb-1 block text-gray-600">Teléfono (WhatsApp, opcional)</span>
          <input
            type="tel"
            placeholder="+51987654321"
            className="w-full rounded border px-3 py-2"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <span className="mt-1 block text-xs text-gray-400">
            Si lo completas, le mandamos un WhatsApp para que cree su propia contraseña.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Rol</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
        {needsContratista && (
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Contratista</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={contratistaId}
              onChange={(event) => setContratistaId(event.target.value)}
              required
            >
              {contratistas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
        )}
        {needsCliente && (
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Cliente</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              required
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Cuenta creada correctamente.
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submitting ? 'Creando...' : 'Crear cuenta'}
      </button>
    </form>
  )
}
