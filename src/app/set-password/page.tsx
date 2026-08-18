import Link from 'next/link'
import { validatePasswordSetToken } from '@/server/actions/passwordSetToken'
import { SetPasswordForm } from './SetPasswordForm'

export default async function SetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? ''
  const status = token ? await validatePasswordSetToken(token) : { valid: false }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        {status.valid ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Crea tu contraseña</h1>
            <p className="mb-4 text-sm text-gray-500">
              Hola {status.userName}, define la contraseña que usarás para ingresar.
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">Enlace no válido</h1>
            <p className="mb-4 text-sm text-gray-500">
              Este enlace expiró o ya fue usado. Pide a tu administrador que te reenvíe la invitación
              por WhatsApp.
            </p>
            <Link href="/login" className="text-sm text-blue-700 hover:underline">
              ← Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
