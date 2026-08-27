'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import { useState } from 'react'

export function NavBar() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!isLoaded || !isSignedIn) return null

  const role = user.publicMetadata.role
  const isAdmin = role === 'ADMIN'
  const isSupervisor = role === 'SUPERVISOR'
  const displayName = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? ''

  const links = [
    { href: '/fajas', label: 'Fajas' },
    ...(isAdmin ? [{ href: '/clientes', label: 'Clientes' }, { href: '/contratistas', label: 'Contratistas' }] : []),
    ...(isAdmin
      ? [{ href: '/admin', label: 'Administración' }]
      : isSupervisor
        ? [{ href: '/admin', label: 'Mi equipo' }]
        : []),
  ]

  return (
    <nav className="border-b bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/fajas" className="font-semibold text-gray-900">
            Termografía
          </Link>
          <div className="hidden items-center gap-1 text-sm font-medium sm:flex">
            {links.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded px-3 py-1.5 transition ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-700'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="hidden items-center gap-3 text-sm text-gray-500 sm:flex">
          <span className="max-w-[12rem] truncate">{displayName}</span>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="rounded border px-2 py-1 hover:bg-gray-50"
          >
            Salir
          </button>
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded border text-gray-600 sm:hidden"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm font-medium sm:hidden">
          {links.map((link) => {
            const active = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded px-3 py-2 transition ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-700'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-gray-500">
            <span className="truncate">{displayName}</span>
            <button
              onClick={() => signOut({ redirectUrl: '/sign-in' })}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
