'use server'

import { generateText, Output, NoObjectGeneratedError } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { requireUser } from '@/lib/session'
import type { Condicion, CriterioAceptacion } from '@prisma/client'

const haiku = anthropic('claude-haiku-4-5-20251001')

const AnalisisSchema = z.object({
  tempIzquierda: z.number(),
  tempDerecha: z.number(),
  condicion: z.enum(['BUENO', 'ACEPTABLE', 'INSATISFACTORIO', 'INACEPTABLE']),
  diagnosticoTexto: z.string(),
})

export interface AnalizarTermogramaInput {
  numeroPolea: number
  fotoIzquierdaUrl: string
  fotoDerechaUrl: string
  criterios: Pick<CriterioAceptacion, 'nivel' | 'tempMin' | 'tempMax' | 'deltaMin' | 'deltaMax'>[]
}

export interface AnalisisTermograma {
  tempIzquierda: number
  tempDerecha: number
  condicion: Condicion
  diagnosticoTexto: string
}

export async function analizarTermograma(input: AnalizarTermogramaInput): Promise<AnalisisTermograma> {
  await requireUser()

  const criteriosTexto = input.criterios
    .map((c) => `- ${c.nivel}: temperatura ${c.tempMin}–${c.tempMax}°C, delta entre chumaceras ${c.deltaMin}–${c.deltaMax}°C`)
    .join('\n')

  try {
    const { output } = await generateText({
      model: haiku,
      output: Output.object({ schema: AnalisisSchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Eres un especialista en termografía industrial certificado como analista en termografia categoria 3 revisando chumaceras de fajas transportadoras. ` +
                `Te comparto dos fotos de termograma de la polea ${input.numeroPolea}: chumacera lado izquierdo y chumacera lado derecho. ` +
                `Cada cámara térmica imprime la lectura de temperatura directamente sobre la imagen — léela con precisión, no la estimes por el color.\n\n` +
                `Criterios de aceptación de esta faja:\n${criteriosTexto}\n\n` +
                `Ten en cuenta: un delta alto entre ambas chumaceras no siempre indica una falla mecánica. A veces se debe a que una de las chumaceras está expuesta directamente al sol o tiene polvo/suciedad acumulada sobre la carcasa, lo que eleva su lectura superficial sin que haya un problema real de lubricación o rodamiento. Si el delta es alto, revisa las imágenes en busca de esos indicios (luz solar directa, superficie sucia o polvorienta) antes de asumir una falla mecánica.\n\n` +
                `Responde con:\n` +
                `- tempIzquierda y tempDerecha: la temperatura exacta (°C) leída en cada foto.\n` +
                `- condicion: el nivel que corresponde según los criterios de arriba, usando la temperatura más alta entre ambas lecturas y el delta entre ellas.\n` +
                `- diagnosticoTexto: solo el diagnóstico, sin recomendaciones ni acciones a tomar. Español, técnico y directo, máximo 2 oraciones, mencionando ambas temperaturas y la condición resultante. Si el delta es alto, indica si las imágenes muestran señales de exposición solar o polvo en alguna chumacera como posible causa, además de las causas mecánicas habituales.`,
            },
            { type: 'text', text: 'Foto chumacera izquierda:' },
            { type: 'file', mediaType: 'image', data: input.fotoIzquierdaUrl },
            { type: 'text', text: 'Foto chumacera derecha:' },
            { type: 'file', mediaType: 'image', data: input.fotoDerechaUrl },
          ],
        },
      ],
    })
    return output
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error('La IA no pudo leer la temperatura de las imágenes. Intenta de nuevo o ingresa los valores manualmente.')
    }
    throw error
  }
}

export interface GenerarObservacionInput {
  lecturas: { numeroPolea: number; tempIzquierda: number; tempDerecha: number; condicion: Condicion }[]
}

export async function generarObservacionGeneral(input: GenerarObservacionInput): Promise<string> {
  await requireUser()
  if (input.lecturas.length === 0) {
    throw new Error('Completa al menos una lectura antes de generar la observación')
  }

  const resumen = input.lecturas
    .map((l) => {
      const delta = Math.abs(l.tempIzquierda - l.tempDerecha)
      return `Polea ${l.numeroPolea}: chumacera izquierda ${l.tempIzquierda}°C, chumacera derecha ${l.tempDerecha}°C, delta ${delta.toFixed(1)}°C, condición ${l.condicion}`
    })
    .join('\n')

  const { text } = await generateText({
    model: haiku,
    prompt:
      `Eres un especialista en termografía industrial certificado como analista en termografia categoria 3. Con estas lecturas de todas las poleas de una faja transportadora, ` +
      `escribe la observación general del reporte de inspección: 1 oración, en español, técnicas y directas.\n` +
      `Si todas las condiciones son BUENO, la observación debe indicar que el equipo no presenta observaciones (por ejemplo "Equipo sin observaciones") y agregar una recomendación breve no más de 10 palabras.\n` +
      `Si alguna polea tiene condición ACEPTABLE, INSATISFACTORIO o INACEPTABLE, menciona qué polea(s) y qué se recomienda hacer.\n` +
      `Ten en cuenta que un delta alto entre chumaceras no siempre indica una falla mecánica: a veces se debe a que una chumacera está expuesta directamente al sol o tiene polvo acumulado, lo que eleva su lectura sin que sea un problema real. Si el delta reportado es alto, sugiere verificar exposición solar o suciedad en la chumacera antes de asumir una falla, junto con la recomendación técnica habitual.\n\n` +
      `Lecturas:\n${resumen}`,
  })
  return text.trim()
}
