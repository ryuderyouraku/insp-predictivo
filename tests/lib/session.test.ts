import { describe, it, expect, afterEach, vi } from 'vitest'
import { prisma } from '../../src/lib/prisma'

// tests/setup.ts mocks @/lib/session globally so every other test can act as any actor
// without a real Clerk session — undo that here, since this file tests the real
// just-in-time linking logic that mock replaces.
vi.unmock('@/lib/session')

const getClerkUser = vi.fn()
const updateClerkUser = vi.fn().mockResolvedValue(undefined)
const authMock = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  clerkClient: async () => ({
    users: {
      getUser: (...args: unknown[]) => getClerkUser(...args),
      updateUser: (...args: unknown[]) => updateClerkUser(...args),
    },
  }),
}))

const { getCurrentUser } = await import('../../src/lib/session')

const EMAIL_PREFIX = 'session-test-'

describe('getCurrentUser (Clerk just-in-time link)', () => {
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } })
    getClerkUser.mockReset()
    updateClerkUser.mockClear()
    authMock.mockReset()
  })

  it('returns null when nobody is signed in', async () => {
    authMock.mockResolvedValue({ userId: null })
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the actor directly once already linked by clerkId, without calling the Clerk API', async () => {
    const user = await prisma.user.create({
      data: { name: 'Linked', email: `${EMAIL_PREFIX}linked@example.com`, role: 'ADMIN', clerkId: 'clerk_linked_1' },
    })
    authMock.mockResolvedValue({ userId: 'clerk_linked_1' })

    const actor = await getCurrentUser()
    expect(actor).toMatchObject({ id: user.id, role: 'ADMIN' })
    expect(getClerkUser).not.toHaveBeenCalled()
  })

  it('links a pre-created row by email on first sign-in and mirrors the role to publicMetadata', async () => {
    const email = `${EMAIL_PREFIX}jit@example.com`
    const user = await prisma.user.create({ data: { name: 'Pendiente', email, role: 'SUPERVISOR' } })
    authMock.mockResolvedValue({ userId: 'clerk_new_1' })
    getClerkUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: email },
      emailAddresses: [{ emailAddress: email }],
    })

    const actor = await getCurrentUser()
    expect(actor).toMatchObject({ id: user.id, role: 'SUPERVISOR' })
    expect(updateClerkUser).toHaveBeenCalledWith('clerk_new_1', { publicMetadata: { role: 'SUPERVISOR' } })

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.clerkId).toBe('clerk_new_1')
  })

  it('fails closed for a Clerk account with no matching local row', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_orphan_1' })
    getClerkUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: `${EMAIL_PREFIX}nobody@example.com` },
      emailAddresses: [{ emailAddress: `${EMAIL_PREFIX}nobody@example.com` }],
    })

    expect(await getCurrentUser()).toBeNull()
  })

  it('matches email case-insensitively against the lowercase-stored row', async () => {
    const email = `${EMAIL_PREFIX}case@example.com`
    const user = await prisma.user.create({ data: { name: 'Case', email, role: 'INSPECTOR' } })
    authMock.mockResolvedValue({ userId: 'clerk_case_1' })
    getClerkUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: email.toUpperCase() },
      emailAddresses: [{ emailAddress: email.toUpperCase() }],
    })

    const actor = await getCurrentUser()
    expect(actor).toMatchObject({ id: user.id, role: 'INSPECTOR' })
  })
})
