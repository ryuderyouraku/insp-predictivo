import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { createFaja, getFajaById } from '../../src/server/actions/fajas'
import { createReporte, getReporteById, deleteReporte } from '../../src/server/actions/reportes'
import { DEFAULT_CRITERIOS } from '../../src/lib/criterios'
import { setActor, ADMIN_ACTOR } from '../helpers/actor'

async function setupFaja() {
  const cliente = await prisma.cliente.create({ data: { nombre: 'Test Cliente Reporte' } })
  const contratista = await prisma.contratista.create({ data: { nombre: 'Test Contratista Reporte' } })
  const faja = await createFaja({
    clienteId: cliente.id,
    contratistaId: contratista.id,
    area: '7777',
    nombre: 'CV001',
    lugar: 'MOQUEGUA',
    numeroPoleas: 2,
    criterios: DEFAULT_CRITERIOS,
  })
  return getFajaById(faja.id)
}

describe('createReporte', () => {
  beforeEach(() => setActor(ADMIN_ACTOR))
  afterEach(async () => {
    await prisma.faja.deleteMany({ where: { tag: { startsWith: '7777' } } })
    await prisma.cliente.deleteMany({ where: { nombre: 'Test Cliente Reporte' } })
    await prisma.contratista.deleteMany({ where: { nombre: 'Test Contratista Reporte' } })
  })

  it('creates a reporte with lecturas and derives condicionGeneral as the worst one', async () => {
    const faja = await setupFaja()
    if (!faja) throw new Error('faja not created')

    const reporte = await createReporte({
      fajaId: faja.id,
      fecha: new Date('2026-08-02'),
      especialistaNombre: 'Nelson Larico',
      supervisor: 'Rolando Aliaga',
      numeroOT: '4016597449',
      lecturas: faja.poleas.map((polea, index) => ({
        poleaId: polea.id,
        tempIzquierda: 20,
        tempDerecha: 21,
        fotoIzquierdaUrl: 'https://example.com/i.jpg',
        fotoDerechaUrl: 'https://example.com/d.jpg',
        condicion: index === 0 ? ('ACEPTABLE' as const) : ('BUENO' as const),
        diagnosticoTexto: `texto polea ${polea.numero}`,
      })),
    })

    expect(reporte.condicionGeneral).toBe('ACEPTABLE')

    const detalle = await getReporteById(reporte.id)
    expect(detalle?.lecturas).toHaveLength(2)
  })

  it('rejects a reporte missing a lectura for one of the poleas', async () => {
    const faja = await setupFaja()
    if (!faja) throw new Error('faja not created')

    await expect(
      createReporte({
        fajaId: faja.id,
        fecha: new Date(),
        especialistaNombre: 'X',
        supervisor: 'Y',
        numeroOT: '123',
        lecturas: [
          {
            poleaId: faja.poleas[0].id,
            tempIzquierda: 20,
            tempDerecha: 21,
            fotoIzquierdaUrl: 'https://example.com/i.jpg',
            fotoDerechaUrl: 'https://example.com/d.jpg',
            condicion: 'BUENO',
            diagnosticoTexto: 'texto',
          },
        ],
      })
    ).rejects.toThrow('Debes registrar una lectura para cada una de las 2 poleas de la faja')
  })

  it('deletes a reporte', async () => {
    const faja = await setupFaja()
    if (!faja) throw new Error('faja not created')

    const reporte = await createReporte({
      fajaId: faja.id,
      fecha: new Date(),
      especialistaNombre: 'X',
      supervisor: 'Y',
      numeroOT: '123',
      lecturas: faja.poleas.map((polea) => ({
        poleaId: polea.id,
        tempIzquierda: 20,
        tempDerecha: 21,
        fotoIzquierdaUrl: 'https://example.com/i.jpg',
        fotoDerechaUrl: 'https://example.com/d.jpg',
        condicion: 'BUENO' as const,
        diagnosticoTexto: 'texto',
      })),
    })

    await deleteReporte(reporte.id)
    expect(await getReporteById(reporte.id)).toBeNull()
  })
})
