import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { setActor, ADMIN_ACTOR, supervisorActor } from '../helpers/actor'

const sendInviteWhatsApp = vi.fn()
const sendWelcomeWhatsApp = vi.fn()
vi.mock('@/lib/whatsapp', () => ({
  sendInviteWhatsApp: (...args: unknown[]) => sendInviteWhatsApp(...args),
  sendWelcomeWhatsApp: (...args: unknown[]) => sendWelcomeWhatsApp(...args),
}))

const { createUser, updateUser, toggleWhatsappBotAccess, resendInvite } = await import(
  '../../src/server/actions/users'
)
// Dynamic import (rather than a static one) so it resolves strictly after the vi.mock
// call above has been hoisted and registered — avoids relying on Vitest's hoisting order.

const EMAIL_PREFIX = 'whatsapp-test-'

describe('users + WhatsApp invite/bot access', () => {
  beforeEach(() => {
    setActor(ADMIN_ACTOR)
    sendInviteWhatsApp.mockClear()
    sendWelcomeWhatsApp.mockClear()
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } })
  })

  it('createUser with a phone sends an invite and marks the account pending', async () => {
    const email = `${EMAIL_PREFIX}invite@example.com`
    const user = await createUser({
      name: 'Nuevo',
      email,
      password: 'password123',
      role: 'ADMIN',
      phone: '+51987000001',
    })

    expect(user.mustSetPassword).toBe(true)
    expect(user.whatsappBotEnabled).toBe(true)
    expect(sendInviteWhatsApp).toHaveBeenCalledTimes(1)
    expect(sendInviteWhatsApp.mock.calls[0][0]).toMatchObject({ phone: '+51987000001' })

    const token = await prisma.passwordSetToken.findFirst({ where: { userId: user.id } })
    expect(token).not.toBeNull()
  })

  it('createUser without a phone behaves as before (no invite)', async () => {
    const email = `${EMAIL_PREFIX}no-phone@example.com`
    const user = await createUser({ name: 'Sin Tel', email, password: 'password123', role: 'ADMIN' })

    expect(user.mustSetPassword).toBe(false)
    expect(user.whatsappBotEnabled).toBe(false)
    expect(sendInviteWhatsApp).not.toHaveBeenCalled()
  })

  it('updateUser adding a phone to an already-active user sends a welcome message, not an invite', async () => {
    const email = `${EMAIL_PREFIX}welcome@example.com`
    const user = await createUser({ name: 'Activo', email, password: 'password123', role: 'ADMIN' })
    expect(user.mustSetPassword).toBe(false)

    const updated = await updateUser(user.id, {
      name: user.name,
      email: user.email,
      role: user.role,
      phone: '+51987000002',
    })

    expect(updated.mustSetPassword).toBe(false)
    expect(updated.whatsappBotEnabled).toBe(true)
    expect(sendWelcomeWhatsApp).toHaveBeenCalledTimes(1)
    expect(sendInviteWhatsApp).not.toHaveBeenCalled()
  })

  it('updateUser removing the phone turns off bot access', async () => {
    const email = `${EMAIL_PREFIX}remove@example.com`
    const user = await createUser({
      name: 'Con Tel',
      email,
      password: 'password123',
      role: 'ADMIN',
      phone: '+51987000003',
    })
    expect(user.whatsappBotEnabled).toBe(true)

    const updated = await updateUser(user.id, { name: user.name, email: user.email, role: user.role })
    expect(updated.phone).toBeNull()
    expect(updated.whatsappBotEnabled).toBe(false)
  })

  it('toggleWhatsappBotAccess rejects enabling access for a user without a phone', async () => {
    const email = `${EMAIL_PREFIX}toggle-nophone@example.com`
    const user = await createUser({ name: 'Sin Tel 2', email, password: 'password123', role: 'ADMIN' })
    await expect(toggleWhatsappBotAccess(user.id, true)).rejects.toThrow('teléfono')
  })

  it('toggleWhatsappBotAccess lets an admin revoke and re-grant access', async () => {
    const email = `${EMAIL_PREFIX}toggle@example.com`
    const user = await createUser({
      name: 'Toggle',
      email,
      password: 'password123',
      role: 'ADMIN',
      phone: '+51987000004',
    })
    expect(user.whatsappBotEnabled).toBe(true)

    await toggleWhatsappBotAccess(user.id, false)
    let fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.whatsappBotEnabled).toBe(false)

    await toggleWhatsappBotAccess(user.id, true)
    fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.whatsappBotEnabled).toBe(true)
  })

  it('resendInvite only works while the account is still pending activation', async () => {
    const email = `${EMAIL_PREFIX}resend@example.com`
    const pending = await createUser({
      name: 'Pendiente',
      email,
      password: 'password123',
      role: 'ADMIN',
      phone: '+51987000005',
    })
    sendInviteWhatsApp.mockClear()

    await resendInvite(pending.id)
    expect(sendInviteWhatsApp).toHaveBeenCalledTimes(1)

    const activeEmail = `${EMAIL_PREFIX}resend-active@example.com`
    const active = await createUser({ name: 'Activo 2', email: activeEmail, password: 'password123', role: 'ADMIN' })
    // Give the already-active user a phone via the "welcome" path (updateUser), so it has a
    // phone but mustSetPassword stays false — the case resendInvite should still reject.
    await updateUser(active.id, { name: active.name, email: active.email, role: active.role, phone: '+51987000099' })
    await expect(resendInvite(active.id)).rejects.toThrow('ya activó')
  })

  it('a supervisor cannot manage a phone/bot access for an ADMIN target', async () => {
    const email = `${EMAIL_PREFIX}scoped-admin@example.com`
    const admin = await createUser({
      name: 'Otro Admin',
      email,
      password: 'password123',
      role: 'ADMIN',
      phone: '+51987000006',
    })

    setActor(supervisorActor('nonexistent-contratista'))
    await expect(toggleWhatsappBotAccess(admin.id, false)).rejects.toThrow('No autorizado')
  })
})
