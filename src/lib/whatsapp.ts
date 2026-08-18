import type { Chat } from 'chat'
import type { WhatsAppAdapter } from '@chat-adapter/whatsapp'
import type { User } from '@prisma/client'

type Bot = Chat<{ whatsapp: WhatsAppAdapter }>

let botInstance: Bot | null = null
let botInitPromise: Promise<Bot> | null = null

function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_APP_SECRET &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_VERIFY_TOKEN
  )
}

/**
 * Lazily builds the Chat SDK singleton. Dynamic imports + the config check keep the rest
 * of the app (admin UI, tests) working when WhatsApp Business credentials aren't set up yet —
 * see docs/superpowers/specs/2026-08-10-whatsapp-bot-design.md for the external prerequisite.
 */
export async function getBot(): Promise<Bot | null> {
  if (!isWhatsAppConfigured()) return null
  if (botInstance) return botInstance
  if (!botInitPromise) {
    botInitPromise = (async () => {
      const [{ Chat }, { createWhatsAppAdapter }, { createPostgresState }] = await Promise.all([
        import('chat'),
        import('@chat-adapter/whatsapp'),
        import('@chat-adapter/state-pg'),
      ])
      const bot = new Chat({
        userName: 'pdm-app',
        adapters: { whatsapp: createWhatsAppAdapter() },
        state: createPostgresState(),
      })
      await bot.initialize()
      botInstance = bot
      return bot
    })()
  }
  return botInitPromise
}

async function sendNotifyTemplate(phone: string, bodyText: string): Promise<void> {
  const templateName = process.env.WHATSAPP_NOTIFY_TEMPLATE_NAME
  const bot = await getBot()
  if (!bot || !templateName) {
    console.warn(`[whatsapp] No configurado (faltan credenciales o WHATSAPP_NOTIFY_TEMPLATE_NAME); se omitió el envío a ${phone}`)
    return
  }
  const adapter = bot.getAdapter('whatsapp')
  const waId = phone.replace(/^\+/, '')
  const threadId = await adapter.openDM(waId)
  await adapter.sendTemplate(threadId, {
    name: templateName,
    language: process.env.WHATSAPP_NOTIFY_TEMPLATE_LANGUAGE ?? 'es',
    components: [{ type: 'body', parameters: [{ type: 'text', text: bodyText }] }],
  })
}

export async function sendInviteWhatsApp(user: Pick<User, 'name' | 'phone'>, token: string): Promise<void> {
  if (!user.phone) return
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  const link = `${baseUrl}/set-password?token=${token}`
  await sendNotifyTemplate(
    user.phone,
    `Hola ${user.name}, fuiste invitado a Termografía. Crea tu contraseña aquí: ${link}`
  )
}

export async function sendWelcomeWhatsApp(user: Pick<User, 'name' | 'phone'>): Promise<void> {
  if (!user.phone) return
  await sendNotifyTemplate(
    user.phone,
    `Hola ${user.name}, ya tienes acceso al asistente de WhatsApp de Termografía. Escríbenos cuando quieras consultar tus reportes.`
  )
}
