import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { createFaja } from '../../src/server/actions/fajas'
import { createReporte } from '../../src/server/actions/reportes'
import { DEFAULT_CRITERIOS } from '../../src/lib/criterios'
import { executeIntent } from '../../src/server/whatsapp/handlers'
import { setActor, supervisorActor, ADMIN_ACTOR } from '../helpers/actor'
import type { ActorUser } from '../../src/lib/permissions'

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
    numeroAvisoSAP: 'SAP-1',
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

describe('whatsapp handlers', () => {
  afterEach(async () => {
    await prisma.faja.deleteMany({ where: { tag: { startsWith: '9999' } } })
    await prisma.cliente.deleteMany({ where: { nombre: 'Test Cliente WA' } })
    await prisma.contratista.deleteMany({ where: { nombre: { startsWith: 'Test Contratista WA' } } })
  })

  it('listado_fajas only lists fajas within the actor scope', async () => {
    const { faja, actorA, actorB } = await makeScenario()

    const listA = await executeIntent(actorA, { tipo: 'listado_fajas' })
    expect(listA).toContain(faja.tag)

    const listB = await executeIntent(actorB, { tipo: 'listado_fajas' })
    expect(listB).not.toContain(faja.tag)
  })

  it('estado_faja returns condición general for an in-scope faja', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, { tipo: 'estado_faja', fajaTag: faja.tag })
    expect(reply).toContain(faja.tag)
    expect(reply).toContain('Aceptable')
  })

  it('estado_faja gives the same generic "not found" wording for an out-of-scope faja and a nonexistent one', async () => {
    const { faja, actorB } = await makeScenario()
    const outOfScope = await executeIntent(actorB, { tipo: 'estado_faja', fajaTag: faja.tag })
    const nonexistent = await executeIntent(actorB, { tipo: 'estado_faja', fajaTag: '0000NOPE' })
    // Same template for both — neither reveals whether the tag exists outside the actor's scope.
    expect(outOfScope).toContain('No encontré la faja')
    expect(outOfScope).toContain('o no tienes acceso a ella.')
    expect(outOfScope).not.toContain('Condición general')
    expect(nonexistent).toContain('No encontré la faja')
    expect(nonexistent).toContain('o no tienes acceso a ella.')
  })

  it('ultimo_reporte lists every polea reading of the latest reporte', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, { tipo: 'ultimo_reporte', fajaTag: faja.tag })
    expect(reply).toContain('Polea 1')
    expect(reply).toContain('Polea 2')
    expect(reply).toContain('68°C')
  })

  it('historial_polea reports the readings for that specific polea', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, { tipo: 'historial_polea', fajaTag: faja.tag, numeroPolea: 1 })
    expect(reply).toContain('Historial polea 1')
    expect(reply).toContain('68°C')
    expect(reply).not.toContain('40°C')
  })

  it('historial_polea reports no data for a polea number that does not exist on the faja', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, { tipo: 'historial_polea', fajaTag: faja.tag, numeroPolea: 99 })
    expect(reply).toContain('no tiene una polea número 99')
  })

  it('lectura_en_fecha filters to the requested polea when given', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, {
      tipo: 'lectura_en_fecha',
      fajaTag: faja.tag,
      numeroPolea: 2,
      fecha: '2026-07-12',
    })
    expect(reply).toContain('Polea 2')
    expect(reply).not.toContain('Polea 1')
  })

  it('lectura_en_fecha reports nothing found for a date with no reporte', async () => {
    const { faja, actorA } = await makeScenario()
    const reply = await executeIntent(actorA, { tipo: 'lectura_en_fecha', fajaTag: faja.tag, fecha: '2020-01-01' })
    expect(reply).toContain('No encontré lecturas')
  })

  it('no_reconocido returns the list of supported queries', async () => {
    const actor: ActorUser = { id: 'x', role: 'ADMIN', contratistaId: null, clienteId: null }
    const reply = await executeIntent(actor, { tipo: 'no_reconocido' })
    expect(reply).toContain('estado de')
    expect(reply).toContain('historial de la polea')
  })
})
