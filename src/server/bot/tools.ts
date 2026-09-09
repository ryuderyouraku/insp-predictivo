import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { ActorUser } from '@/lib/permissions'
import {
  listarFajas,
  detalleFaja,
  listarReportes,
  detalleReporte,
  historialPolea,
  buscarLecturas,
} from './queries'

const CondicionEnum = z.enum(['BUENO', 'ACEPTABLE', 'INSATISFACTORIO', 'INACEPTABLE'])

/**
 * Read-only tools for the chat bot, all scoped to `actor` via closures so the model never
 * chooses whose data it queries — the same `fajaScopeWhere` used everywhere else in the app
 * enforces ADMIN/SUPERVISOR/INSPECTOR/CLIENTE visibility inside each queries.ts function.
 */
export function buildBotTools(actor: ActorUser): ToolSet {
  return {
    listarFajas: tool({
      description: 'Lista las fajas transportadoras a las que el usuario tiene acceso, con su cliente, contratista y fecha de última inspección.',
      inputSchema: z.object({}),
      execute: async () => listarFajas(actor),
    }),
    detalleFaja: tool({
      description: 'Ficha completa de una faja: datos generales, número de poleas, y sus criterios de aceptación de temperatura/delta por nivel (BUENO/ACEPTABLE/INSATISFACTORIO/INACEPTABLE).',
      inputSchema: z.object({ tag: z.string().describe('Tag/código de la faja, ej: 2730CV002') }),
      execute: async ({ tag }) => detalleFaja(actor, tag),
    }),
    listarReportes: tool({
      description: 'Lista los reportes (inspecciones) de una faja o de todas las fajas del usuario, con fecha, OT, especialista y condición general. Útil para "cuándo fue la última/anterior inspección" o para filtrar por rango de fechas o condición.',
      inputSchema: z.object({
        tag: z.string().optional().describe('Tag de la faja; si se omite, busca en todas las fajas del usuario'),
        desde: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
        hasta: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
        condicion: CondicionEnum.optional().describe('Filtra por condición general exacta del reporte'),
      }),
      execute: async (input) => listarReportes(actor, input),
    }),
    detalleReporte: tool({
      description: 'Detalle de un reporte específico de una faja (el más reciente si no se da fecha), con las lecturas de temperatura de cada polea, su delta, condición y diagnóstico.',
      inputSchema: z.object({
        tag: z.string().describe('Tag/código de la faja'),
        fecha: z.string().optional().describe('Fecha ISO YYYY-MM-DD; si se omite, se usa el reporte más reciente'),
      }),
      execute: async (input) => detalleReporte(actor, input),
    }),
    historialPolea: tool({
      description: 'Historial de temperaturas de una polea específica de una faja a lo largo del tiempo, opcionalmente acotado a un rango de fechas.',
      inputSchema: z.object({
        tag: z.string().describe('Tag/código de la faja'),
        numeroPolea: z.number().int().describe('Número de la polea'),
        desde: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
        hasta: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
      }),
      execute: async (input) => historialPolea(actor, input),
    }),
    buscarLecturas: tool({
      description: 'Búsqueda transversal de lecturas de poleas en todas las fajas del usuario (o una en particular), filtrando por condición mínima, temperatura mínima, número de polea y/o rango de fechas. Útil para preguntas agregadas como "qué poleas están en mal estado" o "qué lecturas pasaron de cierta temperatura".',
      inputSchema: z.object({
        tag: z.string().optional().describe('Tag de la faja; si se omite, busca en todas las fajas del usuario'),
        numeroPolea: z.number().int().optional(),
        desde: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
        hasta: z.string().optional().describe('Fecha ISO YYYY-MM-DD'),
        condicionMinima: CondicionEnum.optional().describe('Incluye esta condición y las más severas (ej: INSATISFACTORIO incluye también INACEPTABLE)'),
        tempMinima: z.number().optional().describe('Temperatura mínima (°C) en cualquiera de las dos chumaceras'),
        limite: z.number().int().optional().describe('Máximo de resultados, por defecto 20, tope 50'),
      }),
      execute: async (input) => buscarLecturas(actor, input),
    }),
  }
}
