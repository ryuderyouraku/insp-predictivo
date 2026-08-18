import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '../../src/lib/prisma'
import {
  createPasswordSetToken,
  findValidPasswordSetToken,
  consumePasswordSetToken,
} from '../../src/lib/passwordSetToken'

async function makeUser() {
  return prisma.user.create({
    data: {
      name: 'Token Test User',
      email: `token-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: '',
      role: 'SUPERVISOR',
      mustSetPassword: true,
    },
  })
}

describe('passwordSetToken', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'token-test-' } } })
    await prisma.$disconnect()
  })

  it('creates a token that validates for the right user and consumes it exactly once', async () => {
    const user = await makeUser()
    const token = await createPasswordSetToken(user.id)

    const status = await findValidPasswordSetToken(token)
    expect(status?.userId).toBe(user.id)

    const newHash = await bcrypt.hash('newpassword123', 10)
    const ok = await consumePasswordSetToken(token, newHash)
    expect(ok).toBe(true)

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(updated.mustSetPassword).toBe(false)
    expect(updated.passwordHash).toBe(newHash)

    // second use of the same token must fail
    const secondTry = await consumePasswordSetToken(token, newHash)
    expect(secondTry).toBe(false)
    expect(await findValidPasswordSetToken(token)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const user = await makeUser()
    const token = await createPasswordSetToken(user.id)
    await prisma.passwordSetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    expect(await findValidPasswordSetToken(token)).toBeNull()
    expect(await consumePasswordSetToken(token, 'irrelevant')).toBe(false)
  })

  it('rejects an unknown token', async () => {
    expect(await findValidPasswordSetToken('not-a-real-token')).toBeNull()
  })
})
