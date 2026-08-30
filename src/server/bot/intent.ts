import { generateText, Output, NoObjectGeneratedError, type ModelMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const IntentSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('historial_polea'),
    fajaTag: z.string(),
    numeroPolea: z.number().int(),
    desde: z.string().optional().describe('Fecha ISO YYYY-MM-DD, si el usuario dio un rango'),
    hasta: z.string().optional().describe('Fecha ISO YYYY-MM-DD, si el usuario dio un rango'),
  }),
  z.object({ tipo: z.literal('ultimo_reporte'), fajaTag: z.string() }),
  z.object({ tipo: z.literal('listado_fajas') }),
  z.object({ tipo: z.literal('estado_faja'), fajaTag: z.string() }),
  z.object({
    tipo: z.literal('lectura_en_fecha'),
    fajaTag: z.string(),
    numeroPolea: z.number().int().optional(),
    fecha: z.string().describe('Fecha ISO YYYY-MM-DD'),
  }),
  z.object({ tipo: z.literal('seguimiento_libre') }),
  z.object({ tipo: z.literal('no_reconocido') }),
])

export type Intent = z.infer<typeof IntentSchema>

/** Everything handlers.ts's executeIntent can handle — the 5 data lookups plus no_reconocido's canned menu. Excludes seguimiento_libre, which routes to answerFollowUp instead. */
export type StructuredIntent = Exclude<Intent, { tipo: 'seguimiento_libre' }>

const HOY = () => new Date().toISOString().slice(0, 10)

function buildClassifierSystemPrompt(): string {
  return (
    `Eres el clasificador de intención de un bot de consultas para una app de inspecciones ` +
    `de termografía de fajas transportadoras. Hoy es ${HOY()}.\n\n` +
    `Se te da la conversación completa reciente entre el usuario y el bot, no solo el último mensaje. ` +
    `Trátala como una conversación real: si el último mensaje del usuario no repite el tag de la faja ` +
    `o el número de polea pero se mencionaron antes en la conversación, reutilízalos igual que lo haría ` +
    `una persona siguiendo el hilo. Si nunca se mencionó un tag, ni antes ni ahora, no lo inventes.\n\n` +
    `Clasifica el ÚLTIMO mensaje del usuario en una de estas intenciones:\n` +
    `- historial_polea: pide el historial de temperaturas de una polea específica de una faja (con "fajaTag" y "numeroPolea", opcionalmente un rango de fechas "desde"/"hasta" en ISO YYYY-MM-DD).\n` +
    `- ultimo_reporte: pide el reporte/inspección más reciente de una faja.\n` +
    `- listado_fajas: pide la LISTA de fajas disponibles, SIN mencionar ninguna faja en particular (ej: "qué fajas tengo", "qué puedo consultar").\n` +
    `- estado_faja: menciona una faja concreta (por su tag) y pregunta por su condición/estado/situación actual. Si el mensaje ya incluye un tag de faja, NUNCA es listado_fajas — listado_fajas es solo cuando no se menciona ninguna faja.\n` +
    `- lectura_en_fecha: pide las lecturas de una faja (opcionalmente de una polea específica) en una fecha puntual (campo "fecha" en ISO YYYY-MM-DD).\n` +
    `- seguimiento_libre: es sobre termografía/fajas/poleas/reportes de esta conversación pero NO es una de las consultas ` +
    `de arriba — por ejemplo pide una recomendación, una explicación, una opinión, o hace una pregunta de seguimiento ` +
    `sobre datos ya mostrados antes en la conversación (ej: "dime una recomendación para eso", "eso es grave?", "por qué pasa eso").\n` +
    `- no_reconocido: saludos, o cualquier cosa fuera de estos temas por completo.\n\n` +
    `Ejemplos:\n` +
    `"cuál es el estado de 2730CV002" → estado_faja, fajaTag=2730CV002\n` +
    `"cuál es la condición de la faja 2730CV002" → estado_faja, fajaTag=2730CV002\n` +
    `"como esta la 2730CV002" → estado_faja, fajaTag=2730CV002\n` +
    `"qué fajas tengo" / "qué puedo consultar" → listado_fajas (sin fajaTag)\n` +
    `"último reporte de 2730CV002" → ultimo_reporte, fajaTag=2730CV002\n` +
    `"historial de la polea 3 de 2730CV002" → historial_polea, fajaTag=2730CV002, numeroPolea=3\n` +
    `"dime alguna recomendación para eso" (tras mostrarse un reporte) → seguimiento_libre\n` +
    `"hola" / "gracias" / "qué tal el clima" → no_reconocido\n\n` +
    `El "fajaTag" es el código/tag de la faja tal como se escribió (ej: "2730CV002"), sin inventar ni completar dígitos.\n` +
    `Convierte cualquier fecha relativa ("ayer", "la semana pasada") a fecha absoluta ISO usando la fecha de hoy.`
  )
}

/**
 * Classifies WHAT is being asked and extracts parameters — never generates the answer
 * itself. For the 5 structured intents the reply always comes from a fixed template filled
 * with real Prisma data (see handlers.ts), so that step can never hallucinate a temperature
 * or condición. `seguimiento_libre` is the one exception — routed to `answerFollowUp` instead.
 *
 * `history` is the recent thread messages converted via `toAiMessages` (oldest first,
 * bot replies as "assistant"), so the model can resolve references like "esa faja" or
 * "la polea 6" against what was said earlier in the conversation instead of requiring
 * every message to repeat the fajaTag.
 */
export async function classifyIntent(history: ModelMessage[]): Promise<Intent> {
  try {
    const { output } = await generateText({
      // Direct provider, not the AI Gateway "anthropic/claude-haiku-4.5" slug — the Gateway
      // rejects this model for this account's free tier even with a BYOK key configured.
      model: anthropic('claude-haiku-4-5-20251001'),
      output: Output.object({ schema: IntentSchema }),
      system: buildClassifierSystemPrompt(),
      messages: history,
    })
    return output
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { tipo: 'no_reconocido' }
    }
    throw error
  }
}

function buildFollowUpSystemPrompt(): string {
  return (
    `Eres el asistente de seguimiento de un bot de consultas para una app de inspecciones de termografía ` +
    `de fajas transportadoras. El usuario ya recibió datos reales de la base de datos en mensajes anteriores ` +
    `de esta conversación (tus propios mensajes anteriores). Responde su última pregunta en lenguaje natural ` +
    `— puedes dar recomendaciones, explicaciones o interpretaciones razonables sobre esos datos.\n\n` +
    `Regla estricta: NUNCA inventes ni asumas una temperatura, fecha, condición, número de polea u otro dato ` +
    `técnico que no aparezca literalmente en los mensajes anteriores de esta conversación. Si te falta un dato ` +
    `para responder bien, dilo con honestidad en vez de inventarlo, y sugiere qué debería preguntar para ` +
    `obtenerlo (ej: "estado de <tag>", "historial de la polea <n> de <tag>", "último reporte de <tag>").\n\n` +
    `Responde breve y directo, como en un chat.`
  )
}

/**
 * Free-form response for `seguimiento_libre` — the one place this bot lets an LLM write the
 * actual reply instead of a fixed template. Grounded strictly in `history` (real data already
 * fetched from Prisma by earlier turns) via the system prompt's no-invented-data rule; never
 * queries the database itself, so it can't introduce data the user hasn't already been shown.
 */
export async function answerFollowUp(history: ModelMessage[]): Promise<string> {
  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: buildFollowUpSystemPrompt(),
    messages: history,
  })
  return text
}
