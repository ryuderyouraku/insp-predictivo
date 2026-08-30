import { toAiMessages } from 'chat/ai'
import { getBot } from '@/lib/whatsapp'
import { resolveActorByPhone } from '@/server/bot/resolveUser'
import { classifyIntent, answerFollowUp } from '@/server/bot/intent'
import { executeIntent } from '@/server/bot/handlers'

export const runtime = 'nodejs'

const HISTORY_LIMIT = 12

let handlersRegistered = false

async function ensureBot() {
  const bot = await getBot()
  if (!bot) return null
  if (!handlersRegistered) {
    handlersRegistered = true
    bot.onDirectMessage(async (thread, message) => {
      const actor = await resolveActorByPhone(message.author.userId)
      if (!actor) {
        await thread.post('Este número no está registrado o no tiene acceso al bot. Contacta a tu administrador.')
        return
      }
      try {
        const { messages } = await thread.adapter.fetchMessages(thread.id, { limit: HISTORY_LIMIT })
        const history = await toAiMessages(messages)
        const intent = await classifyIntent(history)
        const reply = intent.tipo === 'seguimiento_libre' ? await answerFollowUp(history) : await executeIntent(actor, intent)
        await thread.post(reply)
      } catch (error) {
        console.error('[whatsapp] Error procesando mensaje', error)
        await thread.post('Tuve un problema para procesar tu consulta. Intenta de nuevo en unos minutos.')
      }
    })
  }
  return bot
}

export async function GET(request: Request) {
  const bot = await ensureBot()
  if (!bot) return new Response('WhatsApp no configurado', { status: 503 })
  return bot.webhooks.whatsapp(request)
}

export async function POST(request: Request) {
  const bot = await ensureBot()
  if (!bot) return new Response('WhatsApp no configurado', { status: 503 })
  return bot.webhooks.whatsapp(request)
}
