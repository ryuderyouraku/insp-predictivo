'use server'

import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { assertManager, canManageUser } from '@/lib/permissions'
import { safeRevalidatePath } from '@/lib/safeRevalidate'

/**
 * Revokes Telegram bot access by clearing both the linked account and the registered
 * @username. Clearing only telegramUserId wouldn't actually revoke anything — the next
 * message from that Telegram account would just auto-relink via the still-registered
 * username (see src/server/bot/link.ts).
 */
export async function unlinkTelegram(userId: string): Promise<void> {
  const actor = await requireUser()
  assertManager(actor)
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!canManageUser(actor, target)) throw new Error('No autorizado para editar este usuario')
  await prisma.user.update({ where: { id: userId }, data: { telegramUserId: null, telegramUsername: null } })
  safeRevalidatePath('/admin')
}
