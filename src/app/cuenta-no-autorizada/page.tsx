'use client'

import { useClerk, useUser } from '@clerk/nextjs'

export default function CuentaNoAutorizadaPage() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <main className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
      <h1 className="text-2xl font-bold">Cuenta no autorizada</h1>
      <p className="max-w-md text-slate-300">
        Iniciaste sesión {email ? <>con <span className="font-medium">{email}</span></> : ''}, pero ningún
        administrador te dio acceso a esta aplicación todavía con ese correo. Pídele a un administrador que
        te agregue desde Administración usando exactamente ese correo, y vuelve a intentarlo.
      </p>
      <button
        onClick={() => signOut({ redirectUrl: '/sign-in' })}
        className="rounded border border-white/20 px-4 py-2 hover:bg-white/10"
      >
        Cerrar sesión
      </button>
    </main>
  )
}
