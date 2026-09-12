import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { setActor, ADMIN_ACTOR, supervisorActor } from '../helpers/actor'
import { linkByUsername } from '../../src/server/bot/link'

vi.mock('@/lib/whatsapp', () => ({ sendWelcomeWhatsApp: vi.fn() }))

const createInvitation = vi.fn().mockResolvedValue(undefined)
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    invitations: { createInvitation: (...args: unknown[]) => createInvitation(...args) },
    users: { updateUser: vi.fn(), deleteUser: vi.fn() },
  }),
}))

const { createUser, updateUser } = await import('../../src/server/actions/users')
const { unlinkTelegram } = await import('../../src/server/actions/telegram')
// Dynamic imports so they resolve strictly after the vi.mock calls above are hoisted.

const EMAIL_PREFIX = 'telegram-link-test-'

async function makeUser(suffix: string, telegramUsername?: string) {
  const result = await createUser({
    name: `Telegram ${suffix}`,
    email: `${EMAIL_PREFIX}${suffix}@example.com`,
    role: 'ADMIN',
    telegramUsername,
  })
  if (!result.ok) throw new Error(result.error)
  return result.user
}

describe('Telegram bot linking', () => {
  beforeEach(() => setActor(ADMIN_ACTOR))

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } })
  })

  it('a message from a registered @username auto-links the account', async () => {
    const user = await makeUser('valid', 'Nelson_LQ')

    const result = await linkByUsername('tg-user-1', 'nelson_lq')
    expect(result).toEqual({ ok: true, name: user.name })

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.telegramUserId).toBe('tg-user-1')
  })

  it('is case-insensitive when matching the username', async () => {
    const user = await makeUser('case', 'nelson_lq')
    const result = await linkByUsername('tg-user-2', 'NELSON_LQ')
    expect(result).toEqual({ ok: true, name: user.name })
  })

  it('rejects an unregistered username', async () => {
    const result = await linkByUsername('tg-user-3', 'nobody_registered')
    expect(result).toEqual({ ok: false })
  })

  it('rejects when the sender has no Telegram @username set', async () => {
    await makeUser('nousername', 'has_a_username')
    const result = await linkByUsername('tg-user-4', undefined)
    expect(result).toEqual({ ok: false })
  })

  it('does not relink (or hijack) an account whose username is already claimed by a linked user', async () => {
    const user = await makeUser('already-linked', 'shared_handle')
    await linkByUsername('tg-user-original', 'shared_handle')

    const hijackAttempt = await linkByUsername('tg-user-attacker', 'shared_handle')
    expect(hijackAttempt).toEqual({ ok: false })

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.telegramUserId).toBe('tg-user-original')
  })

  it('createUser rejects a duplicate Telegram username', async () => {
    await makeUser('dup-a', 'duplicate_handle')
    await expect(makeUser('dup-b', 'duplicate_handle')).rejects.toThrow('usuario de Telegram')
  })

  it('createUser rejects an invalid Telegram username format', async () => {
    await expect(makeUser('bad-format', 'ab')).rejects.toThrow('usuario de Telegram')
  })

  it('updateUser can register a Telegram username after creation', async () => {
    const user = await makeUser('register-later')
    const result = await updateUser(user.id, { name: user.name, email: user.email, role: user.role, telegramUsername: '@late_handle' })
    if (!result.ok) throw new Error(result.error)
    expect(result.user.telegramUsername).toBe('late_handle')
  })

  it('a supervisor cannot register a Telegram username for a user outside their contratista', async () => {
    const user = await makeUser('scoped')
    setActor(supervisorActor('nonexistent-contratista'))
    const result = await updateUser(user.id, { name: user.name, email: user.email, role: user.role, telegramUsername: 'someone' })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('No autorizado') })
  })

  it('unlinkTelegram clears both the linked account and the registered username', async () => {
    const user = await makeUser('unlink', 'to_unlink')
    await linkByUsername('tg-user-5', 'to_unlink')

    await unlinkTelegram(user.id)
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.telegramUserId).toBeNull()
    expect(fresh.telegramUsername).toBeNull()
  })
})
