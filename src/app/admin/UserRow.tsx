'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteUser,
  resetUserPassword,
  updateUser,
  toggleWhatsappBotAccess,
  resendInvite,
  type SafeUser,
} from '@/server/actions/users'
import type { Cliente, Contratista, Role } from '@prisma/client'

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  INSPECTOR: 'Inspector',
  CLIENTE: 'Cliente',
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-blue-100 text-blue-700',
  SUPERVISOR: 'bg-purple-100 text-purple-700',
  INSPECTOR: 'bg-amber-100 text-amber-700',
  CLIENTE: 'bg-gray-100 text-gray-600',
}

interface UserRowProps {
  user: SafeUser
  isSelf: boolean
  actorRole: Role
  contratistas: Contratista[]
  clientes: Cliente[]
}

export function UserRow({ user, isSelf, actorRole, contratistas, clientes }: UserRowProps) {
  const router = useRouter()
  const assignableRoles: Role[] = actorRole === 'ADMIN' ? ['ADMIN', 'SUPERVISOR', 'INSPECTOR', 'CLIENTE'] : ['SUPERVISOR', 'INSPECTOR']

  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [role, setRole] = useState<Role>(user.role)
  const [contratistaId, setContratistaId] = useState(user.contratistaId ?? contratistas[0]?.id ?? '')
  const [clienteId, setClienteId] = useState(user.clienteId ?? clientes[0]?.id ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const needsContratista = actorRole === 'ADMIN' && (role === 'SUPERVISOR' || role === 'INSPECTOR')
  const needsCliente = role === 'CLIENTE'

  async function handleSaveEdit() {
    setError(null)
    setBusy(true)
    try {
      await updateUser(user.id, {
        name,
        email,
        role,
        contratistaId: needsContratista ? contratistaId : undefined,
        clienteId: needsCliente ? clienteId : undefined,
        phone: phone.trim() || undefined,
      })
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleBot() {
    setError(null)
    setBusy(true)
    try {
      await toggleWhatsappBotAccess(user.id, !user.whatsappBotEnabled)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el acceso al bot')
    } finally {
      setBusy(false)
    }
  }

  async function handleResendInvite() {
    setError(null)
    setBusy(true)
    try {
      await resendInvite(user.id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reenviar la invitación')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    setError(null)
    setBusy(true)
    try {
      await resetUserPassword(user.id, newPassword)
      setNewPassword('')
      setResetting(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al resetear contraseña')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setBusy(true)
    try {
      await deleteUser(user.id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <tr className="border-b align-top">
        <td className="px-4 py-3" colSpan={5}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
            <input className="rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded border px-2 py-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="rounded border px-2 py-1"
              placeholder="Teléfono, ej: +51987654321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select className="rounded border px-2 py-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {needsContratista && (
              <select className="rounded border px-2 py-1" value={contratistaId} onChange={(e) => setContratistaId(e.target.value)}>
                {contratistas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
            {needsCliente && (
              <select className="rounded border px-2 py-1" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={busy}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Guardar
              </button>
              <button onClick={() => setEditing(false)} className="rounded border px-3 py-1.5 text-sm">
                Cancelar
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </td>
      </tr>
    )
  }

  const asignacion = user.contratista?.nombre ?? user.cliente?.nombre ?? '—'

  return (
    <tr className="border-b">
      <td className="px-4 py-3">{user.name}</td>
      <td className="px-4 py-3">
        {user.email}
        {user.phone && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span>{user.phone}</span>
            {user.mustSetPassword ? (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700">
                Pendiente de activar
              </span>
            ) : (
              <button
                onClick={handleToggleBot}
                disabled={busy}
                className={`rounded-full px-2 py-0.5 font-medium disabled:opacity-50 ${
                  user.whatsappBotEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {user.whatsappBotEnabled ? 'Bot activo' : 'Bot desactivado'}
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.role]}`}>
          {ROLE_LABELS[user.role]}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500">{asignacion}</td>
      <td className="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString('es-PE')}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => setEditing(true)} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
            Editar
          </button>
          <button onClick={() => setResetting((v) => !v)} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">
            Resetear contraseña
          </button>
          {user.phone && user.mustSetPassword && (
            <button
              onClick={handleResendInvite}
              disabled={busy}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Reenviar invitación
            </button>
          )}
          {!isSelf && (
            <button
              onClick={() => setConfirmingDelete((v) => !v)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
        </div>
        {resetting && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <input
              type="password"
              placeholder="Nueva contraseña"
              className="rounded border px-2 py-1 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <button
              onClick={handleResetPassword}
              disabled={busy || newPassword.length < 8}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        )}
        {confirmingDelete && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm text-red-700">
            <span>¿Eliminar a {user.name}?</span>
            <button onClick={handleDelete} disabled={busy} className="rounded bg-red-600 px-3 py-1.5 text-white disabled:opacity-50">
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="rounded border px-3 py-1.5">
              Cancelar
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-right text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  )
}
