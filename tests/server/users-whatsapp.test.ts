import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { setActor, ADMIN_ACTOR, supervisorActor } from '../helpers/actor'

const sendWelcomeWhatsApp = vi.fn()
vi.mock('@/lib/whatsapp', () => ({
  sendWelcomeWhatsApp: (...args: unknown[]) => sendWelcomeWhatsApp(...args),
}))

const createInvitation = vi.fn().mockResolvedValue(undefined)
const updateClerkUser = vi.fn().mockResolvedValue(undefined)
const deleteClerkUser = vi.fn().mockResolvedValue(undefined)
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    invitations: { createInvitation: (...args: unknown[]) => createInvitation(...args) },
    users: {
      updateUser: (...args: unknown[]) => updateClerkUser(...args),
      deleteUser: (...args: unknown[]) => deleteClerkUser(...args),
    },
  }),
}))

const { createUser, updateUser, toggleWhatsappBotAccess, resendInvite, deleteUser } = await import(
  '../../src/server/actions/users'
)
// Dynamic import (rather than a static one) so it resolves strictly after the vi.mock
// calls above have been hoisted and registered — avoids relying on Vitest's hoisting order.

const EMAIL_PREFIX = 'whatsapp-test-'

describe('users + Clerk invite / WhatsApp bot access', () => {
  beforeEach(() => {
    setActor(ADMIN_ACTOR)
    sendWelcomeWhatsApp.mockClear()
    createInvitation.mockClear()
    updateClerkUser.mockClear()
    deleteClerkUser.mockClear()
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } })
  })

  it('createUser sends a Clerk invitation and starts unlinked', async () => {
    const email = `${EMAIL_PREFIX}invite@example.com`
    const user = await createUser({ name: 'Nuevo', email, role: 'ADMIN' })

    expect(user.clerkId).toBeNull()
    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(createInvitation.mock.calls[0][0]).toMatchObject({
      emailAddress: email,
      publicMetadata: { role: 'ADMIN' },
    })
  })

  it('createUser with a phone enables the bot and sends a welcome message', async () => {
    const email = `${EMAIL_PREFIX}phone@example.com`
    const user = await createUser({ name: 'Con Tel', email, role: 'ADMIN', phone: '+51987000001' })

    expect(user.whatsappBotEnabled).toBe(true)
    expect(sendWelcomeWhatsApp).toHaveBeenCalledTimes(1)
    expect(sendWelcomeWhatsApp.mock.calls[0][0]).toMatchObject({ phone: '+51987000001' })
  })

  it('createUser without a phone does not touch the bot', async () => {
    const email = `${EMAIL_PREFIX}no-phone@example.com`
    const user = await createUser({ name: 'Sin Tel', email, role: 'ADMIN' })

    expect(user.whatsappBotEnabled).toBe(false)
    expect(sendWelcomeWhatsApp).not.toHaveBeenCalled()
  })

  it('updateUser adding a phone sends a welcome message', async () => {
    const email = `${EMAIL_PREFIX}welcome@example.com`
    const user = await createUser({ name: 'Activo', email, role: 'ADMIN' })

    const updated = await updateUser(user.id, { name: user.name, email: user.email, role: user.role, phone: '+51987000002' })

    expect(updated.whatsappBotEnabled).toBe(true)
    expect(sendWelcomeWhatsApp).toHaveBeenCalledTimes(1)
  })

  it('updateUser removing the phone turns off bot access', async () => {
    const email = `${EMAIL_PREFIX}remove@example.com`
    const user = await createUser({ name: 'Con Tel', email, role: 'ADMIN', phone: '+51987000003' })
    expect(user.whatsappBotEnabled).toBe(true)

    const updated = await updateUser(user.id, { name: user.name, email: user.email, role: user.role })
    expect(updated.phone).toBeNull()
    expect(updated.whatsappBotEnabled).toBe(false)
  })

  it('updateUser only pushes the role to Clerk once the user has linked (clerkId set)', async () => {
    const email = `${EMAIL_PREFIX}unlinked-role@example.com`
    const user = await createUser({ name: 'Sin Vincular', email, role: 'ADMIN' })

    await updateUser(user.id, { name: user.name, email: user.email, role: 'ADMIN' })
    expect(updateClerkUser).not.toHaveBeenCalled()

    await prisma.user.update({ where: { id: user.id }, data: { clerkId: 'clerk_test_123' } })
    await updateUser(user.id, { name: user.name, email: user.email, role: 'ADMIN' })
    expect(updateClerkUser).toHaveBeenCalledWith('clerk_test_123', { publicMetadata: { role: 'ADMIN' } })
  })

  it('toggleWhatsappBotAccess rejects enabling access for a user without a phone', async () => {
    const email = `${EMAIL_PREFIX}toggle-nophone@example.com`
    const user = await createUser({ name: 'Sin Tel 2', email, role: 'ADMIN' })
    await expect(toggleWhatsappBotAccess(user.id, true)).rejects.toThrow('teléfono')
  })

  it('toggleWhatsappBotAccess lets an admin revoke and re-grant access', async () => {
    const email = `${EMAIL_PREFIX}toggle@example.com`
    const user = await createUser({ name: 'Toggle', email, role: 'ADMIN', phone: '+51987000004' })
    expect(user.whatsappBotEnabled).toBe(true)

    await toggleWhatsappBotAccess(user.id, false)
    let fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.whatsappBotEnabled).toBe(false)

    await toggleWhatsappBotAccess(user.id, true)
    fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.whatsappBotEnabled).toBe(true)
  })

  it('resendInvite only works while the account is still unlinked', async () => {
    const email = `${EMAIL_PREFIX}resend@example.com`
    const pending = await createUser({ name: 'Pendiente', email, role: 'ADMIN' })
    createInvitation.mockClear()

    await resendInvite(pending.id)
    expect(createInvitation).toHaveBeenCalledTimes(1)

    await prisma.user.update({ where: { id: pending.id }, data: { clerkId: 'clerk_test_456' } })
    await expect(resendInvite(pending.id)).rejects.toThrow('ya activó')
  })

  it('deleteUser also deletes the Clerk account once linked', async () => {
    const email = `${EMAIL_PREFIX}delete@example.com`
    const user = await createUser({ name: 'A Borrar', email, role: 'ADMIN' })
    await prisma.user.update({ where: { id: user.id }, data: { clerkId: 'clerk_test_789' } })

    await deleteUser(user.id)
    expect(deleteClerkUser).toHaveBeenCalledWith('clerk_test_789')
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
  })

  it('a supervisor cannot manage a phone/bot access for an ADMIN target', async () => {
    const email = `${EMAIL_PREFIX}scoped-admin@example.com`
    const admin = await createUser({ name: 'Otro Admin', email, role: 'ADMIN', phone: '+51987000006' })

    setActor(supervisorActor('nonexistent-contratista'))
    await expect(toggleWhatsappBotAccess(admin.id, false)).rejects.toThrow('No autorizado')
  })
})
