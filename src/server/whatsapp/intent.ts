import { generateText, Output, NoObjectGeneratedError } from 'ai'
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
  z.object({ tipo: z.literal('no_reconocido') }),
])

export type Intent = z.infer<typeof IntentSchema>

const HOY = () => new Date().toISOString().slice(0, 10)

/**
 * Classifies WHAT is being asked and extracts parameters — never generates the answer
 * itself. The reply always comes from a fixed template filled with real Prisma data
 * (see handlers.ts), so this step can never hallucinate a temperature or condición.
 */
export async function classifyIntent(text: string): Promise<Intent> {
  try {
    const { output } = await generateText({
      model: 'anthropic/claude-sonnet-5',
      output: Output.object({ schema: IntentSchema }),
      messages: [
        {
          role: 'user',
          content:
            `Eres el clasificador de intención de un bot de WhatsApp para una app de inspecciones ` +
            `de termografía de fajas transportadoras. Hoy es ${HOY()}.\n\n` +
            `Clasifica el siguiente mensaje de un usuario en una de estas intenciones:\n` +
            `- historial_polea: pide el historial de temperaturas de una polea específica de una faja (con "fajaTag" y "numeroPolea", opcionalmente un rango de fechas "desde"/"hasta" en ISO YYYY-MM-DD).\n` +
            `- ultimo_reporte: pide el reporte/inspección más reciente de una faja.\n` +
            `- listado_fajas: pide qué fajas tiene disponibles o puede consultar.\n` +
            `- estado_faja: pregunta por la condición/estado general actual de una faja.\n` +
            `- lectura_en_fecha: pide las lecturas de una faja (opcionalmente de una polea específica) en una fecha puntual (campo "fecha" en ISO YYYY-MM-DD).\n` +
            `- no_reconocido: cualquier otra cosa, incluyendo saludos o preguntas fuera de estos temas.\n\n` +
            `El "fajaTag" es el código/tag de la faja tal como lo escribió el usuario (ej: "2730CV002"), sin inventar ni completar dígitos que no dijo.\n` +
            `Convierte cualquier fecha relativa ("ayer", "la semana pasada") a fecha absoluta ISO usando la fecha de hoy.\n\n` +
            `Mensaje del usuario: "${text}"`,
        },
      ],
    })
    return output
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { tipo: 'no_reconocido' }
    }
    throw error
  }
}
