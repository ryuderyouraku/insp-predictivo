import { generateText, isStepCount, type ModelMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { ActorUser } from '@/lib/permissions'
import { buildBotTools } from './tools'

const HOY = () => new Date().toISOString().slice(0, 10)

function buildSystemPrompt(): string {
  return (
    `Eres el asistente de chat de una app de inspecciones de termografía de fajas transportadoras. ` +
    `Hoy es ${HOY()}. Conversas por Telegram/WhatsApp con un usuario que ya tiene una cuenta vinculada.\n\n` +
    `Tienes herramientas de solo lectura para consultar la base de datos real de fajas, reportes, ` +
    `lecturas y criterios de aceptación — todas ya filtradas al alcance del usuario (su contratista o cliente), ` +
    `así que solo verás lo que él puede ver. Úsalas todas las veces que necesites, incluso combinadas, ` +
    `para responder cualquier pregunta sobre sus fajas, reportes o poleas.\n\n` +
    `Reglas estrictas:\n` +
    `- Todo dato concreto (tag, temperatura, fecha, condición, OT, especialista, criterio) debe salir ` +
    `literalmente de una herramienta. Nunca inventes, redondees ni completes un dato que la herramienta ` +
    `no devolvió.\n` +
    `- Si una herramienta devuelve un campo "error", transmítelo tal cual, sin agregar ni suavizar nada ` +
    `(por ejemplo, nunca aclares si el motivo fue que no existe o que no tiene acceso — el mensaje ya está ` +
    `redactado a propósito para no revelarlo).\n` +
    `- Si no encontraste el dato que te piden, dilo con honestidad y sugiere qué preguntar en vez de inventarlo.\n` +
    `- Sí puedes interpretar los datos y dar recomendaciones técnicas de termografía industrial (por ejemplo ` +
    `si una condición es grave, o qué revisar), dejando claro cuándo hablas del dato y cuándo es tu recomendación.\n` +
    `- Si te preguntan algo totalmente ajeno a fajas/reportes/termografía (clima, noticias, etc.), dilo brevemente ` +
    `y con amabilidad, indicando qué sí puedes consultar.\n` +
    `- Responde breve y directo, como en un chat. Sin markdown pesado (nada de encabezados ni tablas).`
  )
}

/**
 * Single entry point for the bot's replies. Replaces the old classify→template pipeline:
 * instead of a closed set of recognized intents, the model freely decides which read-only
 * tools to call (see tools.ts) and writes the reply itself, but every concrete fact must come
 * from a tool result — never invented. `history` is the recent thread (oldest first, bot
 * replies as "assistant"), so references like "esa faja" resolve against prior turns.
 */
export async function answerQuery(actor: ActorUser, history: ModelMessage[]): Promise<string> {
  const { text } = await generateText({
    // Direct provider, not the AI Gateway "anthropic/claude-haiku-4.5" slug — the Gateway
    // rejects this model for this account's free tier even with a BYOK key configured.
    model: anthropic('claude-haiku-4-5-20251001'),
    system: buildSystemPrompt(),
    messages: history,
    tools: buildBotTools(actor),
    stopWhen: isStepCount(8),
  })

  return text.trim() || 'No pude generar una respuesta esta vez. ¿Puedes reformular tu pregunta?'
}
