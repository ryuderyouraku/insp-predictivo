import { after } from 'next/server'
import { toAiMessages } from 'chat/ai'
import { getTelegramBot } from '@/lib/telegram'
import { resolveActorByTelegramId } from '@/server/bot/resolveUser'
import { answerQuery } from '@/server/bot/agent'
import { linkByUsername } from '@/server/bot/link'

const HISTORY_LIMIT = 12

export const runtime = 'nodejs'

let handlersRegistered = false

async function ensureBot() {
  const bot = await getTelegramBot()
  if (!bot) return null
  if (!handlersRegistered) {
    handlersRegistered = true
    bot.onDirectMessage(async (thread, message) => {
      const telegramUserId = message.author.userId

      const actor = await resolveActorByTelegramId(telegramUserId)
      if (actor) {
        try {
          const { messages } = await thread.adapter.fetchMessages(thread.id, { limit: HISTORY_LIMIT })
          const history = await toAiMessages(messages)
          const reply = await answerQuery(actor, history)
          await thread.post(reply)
        } catch (error) {
          console.error('[telegram] Error procesando mensaje', error)
          await thread.post('Tuve un problema para procesar tu consulta. Intenta de nuevo en unos minutos.')
        }
        return
      }

      // message.raw is Telegram's own Message payload — its .from.username is the real
      // @username (undefined if unset), unlike message.author.userName which falls back to
      // the sender's first name and would let anyone with a matching name hijack a link.
      const rawUsername = (message.raw as { from?: { username?: string } }).from?.username
      const linked = await linkByUsername(telegramUserId, rawUsername)
      if (linked.ok) {
        await thread.post(`Listo ${linked.name}, ya puedes consultarme. Ej: "estado de 2730CV002".`)
        return
      }

      await thread.post(
        rawUsername
          ? 'Tu cuenta no está vinculada. Pídele a tu administrador que registre tu usuario de Telegram en el panel.'
          : 'Tu cuenta no está vinculada, y tu perfil de Telegram no tiene un @usuario configurado. Configura uno en Ajustes de Telegram y pídele a tu administrador que lo registre en el panel.'
      )
    })
  }
  return bot
}

/**
 * Health check — also what actually starts long-polling in local dev: hitting this route
 * loads the module and triggers getTelegramBot()'s bot.initialize() call, which is what
 * kicks off polling when the adapter's 'auto' mode resolves to it. Doesn't forward to
 * bot.webhooks.telegram since that expects a real Telegram update body, not a bare GET.
 */
export async function GET() {
  const bot = await ensureBot()
  if (!bot) return new Response('Telegram no configurado', { status: 503 })
  const { runtimeMode } = bot.getAdapter('telegram')
  return new Response(`Telegram bot activo (modo: ${runtimeMode})`)
}

export async function POST(request: Request) {
  const bot = await ensureBot()
  if (!bot) return new Response('Telegram no configurado', { status: 503 })
  return bot.webhooks.telegram(request, { waitUntil: after })
}
