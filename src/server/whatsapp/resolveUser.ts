import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import type { ActorUser } from '@/lib/permissions'

/**
 * Resolves the sender of an inbound WhatsApp message to an ActorUser, or null when the
 * number isn't registered or bot access was revoked. Both cases return the same generic
 * "not registered" message to the user — see src/server/whatsapp handlers — so a rejected
 * number never reveals whether it exists in the system.
 */
export async function resolveActorByPhone(rawPhone: string): Promise<ActorUser | null> {
  const phone = normalizePhone(rawPhone)
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true, contratistaId: true, clienteId: true, whatsappBotEnabled: true },
  })
  if (!user || !user.whatsappBotEnabled) return null
  return { id: user.id, role: user.role, contratistaId: user.contratistaId, clienteId: user.clienteId }
}
