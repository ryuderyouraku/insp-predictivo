import { prisma } from '@/lib/prisma'

export type LinkByUsernameResult = { ok: true; name: string } | { ok: false }

/**
 * Attempts to auto-link an inbound Telegram sender to a User by matching their Telegram
 * @username against one an admin registered in /admin. Telegram bots can't message a user
 * first, so there's no explicit "link" command — this runs on every message from a
 * telegramUserId that doesn't resolve to a User yet (see src/app/api/telegram/route.ts).
 * `rawUsername` must come from the raw Telegram payload (`from.username`), not the chat
 * SDK's normalized `author.userName` — that field falls back to the sender's first name
 * when they have no @username set, which would make this match on the wrong thing.
 */
export async function linkByUsername(telegramUserId: string, rawUsername: string | undefined): Promise<LinkByUsernameResult> {
  if (!rawUsername) return { ok: false }
  const target = await prisma.user.findUnique({ where: { telegramUsername: rawUsername.toLowerCase() } })
  if (!target || target.telegramUserId) return { ok: false }
  const updated = await prisma.user.update({ where: { id: target.id }, data: { telegramUserId } })
  return { ok: true, name: updated.name }
}
