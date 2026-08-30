import type { Chat } from 'chat'
import type { TelegramAdapter } from '@chat-adapter/telegram'

type Bot = Chat<{ telegram: TelegramAdapter }>

let botInstance: Bot | null = null
let botInitPromise: Promise<Bot> | null = null

function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

/**
 * Lazily builds the Chat SDK singleton for Telegram. `mode: 'auto'` picks long-polling in
 * local dev (no public URL needed) and webhooks on Vercel — see @chat-adapter/telegram docs.
 * Dynamic imports + the config check keep the rest of the app working when
 * TELEGRAM_BOT_TOKEN isn't set yet.
 */
export async function getTelegramBot(): Promise<Bot | null> {
  if (!isTelegramConfigured()) return null
  if (botInstance) return botInstance
  if (!botInitPromise) {
    botInitPromise = (async () => {
      const [{ Chat }, { createTelegramAdapter }, { createPostgresState }] = await Promise.all([
        import('chat'),
        import('@chat-adapter/telegram'),
        import('@chat-adapter/state-pg'),
      ])
      const bot = new Chat({
        userName: 'pdm-app',
        adapters: { telegram: createTelegramAdapter({ mode: 'auto' }) },
        state: createPostgresState(),
      })
      await bot.initialize()
      botInstance = bot
      return bot
    })()
  }
  return botInitPromise
}
