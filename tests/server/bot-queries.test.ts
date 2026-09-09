import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { createFaja } from '../../src/server/actions/fajas'
import { createReporte } from '../../src/server/actions/reportes'
import { DEFAULT_CRITERIOS } from '../../src/lib/criterios'
import { listarFajas, detalleFaja, listarReportes, detalleReporte, historialPolea, buscarLecturas } from '../../src/server/bot/queries'
import { setActor, supervisorActor, ADMIN_ACTOR } from '../helpers/actor'

async function makeScenario() {
  const cliente = await prisma.cliente.create({ data: { nombre: 'Test Cliente WA' } })
  const contratistaA = await prisma.contratista.create({ data: { nombre: 'Test Contratista WA A' } })
  const contratistaB = await prisma.contratista.create({ data: { nombre: 'Test Contratista WA B' } })

  setActor(ADMIN_ACTOR)
  const faja = await createFaja({
    clienteId: cliente.id,
    contratistaId: contratistaA.id,
    area: '9999',
    nombre: 'WA01',
    lugar: 'MOQUEGUA',
    numeroPoleas: 2,
    criterios: DEFAULT_CRITERIOS,
  })
  const poleas = await prisma.polea.findMany({ where: { fajaId: faja.id }, orderBy: { numero: 'asc' } })

  const actorA = supervisorActor(contratistaA.id, 'wa-actor-a')
  setActor(actorA)
  await createReporte({
    fajaId: faja.id,
    fecha: new Date('2026-07-12'),
    especialista: 'Nelson',
    supervisor: 'Rolando',
    numeroOT: 'OT-1',
    lecturas: [
      {
        poleaId: poleas[0].id,
        tempIzquierda: 68,
        tempDerecha: 71,
        fotoIzquierdaUrl: 'https://example.com/a.jpg',
        fotoDerechaUrl: 'https://example.com/b.jpg',
        condicion: 'ACEPTABLE',
        diagnosticoTexto: 'diag',
      },
      {
        poleaId: poleas[1].id,
        tempIzquierda: 40,
        tempDerecha: 41,
        fotoIzquierdaUrl: 'https://example.com/c.jpg',
        fotoDerechaUrl: 'https://example.com/d.jpg',
        condicion: 'BUENO',
        diagnosticoTexto: 'diag2',
      },
    ],
  })

  const actorB = supervisorActor(contratistaB.id, 'wa-actor-b')
  return { faja, actorA, actorB }
}

describe('bot queries', () => {
  afterEach(async () => {
    await prisma.faja.deleteMany({ where: { tag: { startsWith: '9999' } } })
    await prisma.cliente.deleteMany({ where: { nombre: 'Test Cliente WA' } })
    await prisma.contratista.deleteMany({ where: { nombre: { startsWith: 'Test Contratista WA' } } })
  })

  it('listarFajas only lists fajas within the actor scope', async () => {
    const { faja, actorA, actorB } = await makeScenario()

    const { fajas: fajasA } = await listarFajas(actorA)
    expect(fajasA.map((f) => f.tag)).toContain(faja.tag)

    const { fajas: fajasB } = await listarFajas(actorB)
    expect(fajasB.map((f) => f.tag)).not.toContain(faja.tag)
  })

  it('detalleFaja returns the acceptance criteria for an in-scope faja', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await detalleFaja(actorA, faja.tag)
    if ('error' in result) throw new Error('expected faja details')
    expect(result.tag).toBe(faja.tag)
    expect(result.criterios).toHaveLength(DEFAULT_CRITERIOS.length)
    expect(result.poleas).toHaveLength(2)
  })

  it('detalleFaja gives the same generic "not found" wording for an out-of-scope faja and a nonexistent one', async () => {
    const { faja, actorB } = await makeScenario()
    const outOfScope = await detalleFaja(actorB, faja.tag)
    const nonexistent = await detalleFaja(actorB, '0000NOPE')

    if (!('error' in outOfScope)) throw new Error('expected an error')
    if (!('error' in nonexistent)) throw new Error('expected an error')
    expect(outOfScope.error).toBe(nonexistent.error.replace('0000NOPE', faja.tag))
  })

  it('detalleReporte returns condición general and every polea reading of the latest reporte', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await detalleReporte(actorA, { tag: faja.tag })
    if ('error' in result) throw new Error('expected a reporte')
    if (result.reporte === null) throw new Error('expected a reporte')
    expect(result.reporte.condicionGeneral).toBe('ACEPTABLE')
    expect(result.reporte.lecturas).toHaveLength(2)
    expect(result.reporte.lecturas.find((l) => l.numeroPolea === 1)?.tempIzquierda).toBe(68)
  })

  it('historialPolea reports the readings for that specific polea', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await historialPolea(actorA, { tag: faja.tag, numeroPolea: 1 })
    if ('error' in result) throw new Error('expected history')
    expect(result.lecturas.some((l) => l.tempIzquierda === 68)).toBe(true)
    expect(result.lecturas.some((l) => l.tempIzquierda === 40)).toBe(false)
  })

  it('historialPolea reports an error for a polea number that does not exist on the faja', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await historialPolea(actorA, { tag: faja.tag, numeroPolea: 99 })
    if (!('error' in result)) throw new Error('expected an error')
    expect(result.error).toContain('no tiene una polea número 99')
  })

  it('buscarLecturas filters to the requested polea and date', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await buscarLecturas(actorA, { tag: faja.tag, numeroPolea: 2, desde: '2026-07-12', hasta: '2026-07-12' })
    if ('error' in result) throw new Error('expected lecturas')
    expect(result.lecturas.every((l) => l.numeroPolea === 2)).toBe(true)
    expect(result.lecturas).toHaveLength(1)
  })

  it('buscarLecturas returns nothing for a date range with no reporte', async () => {
    const { faja, actorA } = await makeScenario()
    const result = await buscarLecturas(actorA, { tag: faja.tag, desde: '2020-01-01', hasta: '2020-01-02' })
    if ('error' in result) throw new Error('expected lecturas')
    expect(result.lecturas).toHaveLength(0)
  })

  it('buscarLecturas respects the actor scope even without a tag filter', async () => {
    const { actorB } = await makeScenario()
    const result = await buscarLecturas(actorB, { condicionMinima: 'BUENO' })
    if ('error' in result) throw new Error('expected lecturas')
    expect(result.lecturas).toHaveLength(0)
  })

  it('listarReportes only returns reportes within the actor scope', async () => {
    const { faja, actorA, actorB } = await makeScenario()
    const resultA = await listarReportes(actorA, {})
    if ('error' in resultA) throw new Error('expected reportes')
    expect(resultA.reportes.some((r) => r.fajaTag === faja.tag)).toBe(true)

    const resultB = await listarReportes(actorB, {})
    if ('error' in resultB) throw new Error('expected reportes')
    expect(resultB.reportes.some((r) => r.fajaTag === faja.tag)).toBe(false)
  })
})
