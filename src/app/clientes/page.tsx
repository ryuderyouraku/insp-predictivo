import { listClientes } from '@/server/actions/clientes'
import { ClienteForm } from './ClienteForm'
import { ClienteRow } from './ClienteRow'

export default async function ClientesPage() {
  const clientes = await listClientes()
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Clientes</h1>
      <ClienteForm />
      {clientes.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-gray-500">
          Todavía no hay clientes. Crea el primero con el formulario de arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {clientes.map((cliente) => (
            <ClienteRow key={cliente.id} cliente={cliente} />
          ))}
        </ul>
      )}
    </main>
  )
}
