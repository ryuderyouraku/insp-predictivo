import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import { getFajaByTag } from '@/server/actions/fajas'
import { requireUser } from '@/lib/session'
import { canCreateReporte } from '@/lib/permissions'
import { listSupervisoresDeContratista } from '@/server/actions/users'
import { ReporteForm } from './ReporteForm'

export default async function NewReportePage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const user = await requireUser()
  const faja = await getFajaByTag(tag)
  if (!faja) notFound()
  if (!canCreateReporte(user, faja)) redirect(`/fajas/${encodeURIComponent(faja.tag)}`)

  const [clerkUser, supervisores] = await Promise.all([
    currentUser(),
    listSupervisoresDeContratista(faja.contratistaId),
  ])

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link href={`/fajas/${encodeURIComponent(faja.tag)}`} className="text-sm text-gray-500 hover:text-blue-700">
        ← Volver a {faja.tag}
      </Link>
      <h1 className="text-xl font-semibold">Nuevo reporte — {faja.tag}</h1>
      <ReporteForm faja={faja} currentUserName={clerkUser?.fullName ?? ''} supervisores={supervisores} />
    </main>
  )
}
