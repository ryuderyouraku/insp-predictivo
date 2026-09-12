import { prisma } from '@/lib/prisma'
import type { ActorUser } from '@/lib/permissions'

/**
 * Resolves the sender of an inbound Telegram message to an ActorUser, or null when that
 * Telegram account hasn't been linked to a User yet (see src/server/bot/link.ts). Linking
 * only happens after an admin issues a one-time code, so a set telegramUserId already
 * implies access was granted.
 */
export async function resolveActorByTelegramId(telegramUserId: string): Promise<ActorUser | null> {
  const user = await prisma.user.findUnique({
    where: { telegramUserId },
    select: { id: true, role: true, contratistaId: true, clienteId: true },
  })
  if (!user) return null
  return { id: user.id, role: user.role, contratistaId: user.contratistaId, clienteId: user.clienteId }
}
