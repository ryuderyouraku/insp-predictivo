import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '../../src/lib/prisma'

describe('prisma connection', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('can create and delete a User row', async () => {
    const user = await prisma.user.create({
      data: { name: 'Smoke Test', email: 'smoke-test@example.com', role: 'SUPERVISOR' },
    })
    expect(user.id).toBeDefined()
    await prisma.user.delete({ where: { id: user.id } })
  })
})
