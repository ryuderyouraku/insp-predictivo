import { listContratistas } from '@/server/actions/contratistas'
import { ContratistaForm } from './ContratistaForm'
import { ContratistaRow } from './ContratistaRow'

export default async function ContratistasPage() {
  const contratistas = await listContratistas()
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Contratistas</h1>
      <ContratistaForm />
      {contratistas.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-gray-500">
          Todavía no hay contratistas. Crea el primero con el formulario de arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {contratistas.map((contratista) => (
            <ContratistaRow key={contratista.id} contratista={contratista} />
          ))}
        </ul>
      )}
    </main>
  )
}
