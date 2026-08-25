import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import {
  createFaja,
  updatePoleaTipo,
  updateCriterio,
  updateNumeroPoleas,
  deleteFaja,
  countReportesByFaja,
} from '../../src/server/actions/fajas'
import { DEFAULT_CRITERIOS } from '../../src/lib/criterios'
import { setActor, ADMIN_ACTOR } from '../helpers/actor'

async function setupFaja(numeroPoleas = 3) {
  const cliente = await prisma.cliente.create({ data: { nombre: 'Test Cliente Edit' } })
  const contratista = await prisma.contratista.create({ data: { nombre: 'Test Contratista Edit' } })
  const faja = await createFaja({
    clienteId: cliente.id,
    contratistaId: contratista.id,
    area: '8888',
    nombre: 'CV001',
    lugar: 'MOQUEGUA',
    numeroPoleas,
    criterios: DEFAULT_CRITERIOS,
  })
  return { cliente, contratista, faja }
}

describe('faja editing actions', () => {
  beforeEach(() => setActor(ADMIN_ACTOR))
  afterEach(async () => {
    await prisma.faja.deleteMany({ where: { tag: { startsWith: '8888' } } })
    await prisma.cliente.deleteMany({ where: { nombre: 'Test Cliente Edit' } })
    await prisma.contratista.deleteMany({ where: { nombre: 'Test Contratista Edit' } })
  })

  it('updates a polea tipo', async () => {
    const { faja } = await setupFaja()
    const polea = await prisma.polea.findFirstOrThrow({ where: { fajaId: faja.id, numero: 1 } })
    const updated = await updatePoleaTipo(polea.id, 'Motriz')
    expect(updated.tipo).toBe('Motriz')
  })

  it('updates a criterio range', async () => {
    const { faja } = await setupFaja()
    const criterio = await prisma.criterioAceptacion.findFirstOrThrow({ where: { fajaId: faja.id, nivel: 'BUENO' } })
    const updated = await updateCriterio(criterio.id, { tempMin: 10, tempMax: 20, deltaMin: 0, deltaMax: 3 })
    expect(updated.tempMin).toBe(10)
    expect(updated.tempMax).toBe(20)
  })

  it('allows increasing numeroPoleas', async () => {
    const { faja } = await setupFaja(3)
    const updated = await updateNumeroPoleas(faja.id, 5)
    expect(updated.numeroPoleas).toBe(5)
    const poleas = await prisma.polea.findMany({ where: { fajaId: faja.id } })
    expect(poleas).toHaveLength(5)
  })

  it('rejects reducing numeroPoleas below poleas with existing lecturas', async () => {
    const { faja } = await setupFaja(3)
    const polea3 = await prisma.polea.findFirstOrThrow({ where: { fajaId: faja.id, numero: 3 } })
    const reporte = await prisma.reporte.create({
      data: {
        fajaId: faja.id,
        fecha: new Date(),
        especialista: 'X',
        supervisor: 'Y',
        numeroOT: '123',
        condicionGeneral: 'BUENO',
        createdByUserId: 'test-user',
      },
    })
    await prisma.lecturaPolea.create({
      data: {
        reporteId: reporte.id,
        poleaId: polea3.id,
        tempIzquierda: 20,
        tempDerecha: 20,
        fotoIzquierdaUrl: 'https://example.com/a.jpg',
        fotoDerechaUrl: 'https://example.com/b.jpg',
        condicion: 'BUENO',
        diagnosticoTexto: 'texto',
      },
    })
    await expect(updateNumeroPoleas(faja.id, 2)).rejects.toThrow(
      'No se puede reducir el número de poleas por debajo de las que ya tienen reportes'
    )
  })

  it('counts reportes and deletes a faja in cascade', async () => {
    const { faja } = await setupFaja(1)
    expect(await countReportesByFaja(faja.id)).toBe(0)
    await deleteFaja(faja.id)
    expect(await prisma.faja.findUnique({ where: { id: faja.id } })).toBeNull()
  })
})
