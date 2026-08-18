import { randomBytes, createHash } from 'node:crypto'
import { prisma } from './prisma'

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000 // 48h

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Generates a random token, stores its hash, and returns the token in clear — only time it's readable. */
export async function createPasswordSetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await prisma.passwordSetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })
  return token
}

export interface ValidPasswordSetToken {
  userId: string
  userName: string
}

/** Read-only check used to render /set-password before the user submits a new password. */
export async function findValidPasswordSetToken(token: string): Promise<ValidPasswordSetToken | null> {
  const record = await prisma.passwordSetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { name: true } } },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) return null
  return { userId: record.userId, userName: record.user.name }
}

/** Validates the token, sets the new password hash, and marks the token used — all in one transaction. */
export async function consumePasswordSetToken(token: string, passwordHash: string): Promise<boolean> {
  const tokenHash = hashToken(token)
  return prisma.$transaction(async (tx) => {
    const record = await tx.passwordSetToken.findUnique({ where: { tokenHash } })
    if (!record || record.usedAt || record.expiresAt < new Date()) return false

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustSetPassword: false },
    })
    await tx.passwordSetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
    return true
  })
}
