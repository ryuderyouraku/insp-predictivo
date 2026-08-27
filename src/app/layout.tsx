import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Reportes de Termografía',
  description: 'Gestión y reportes de termografía de chumaceras',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <ClerkProvider signInUrl="/sign-in" signInFallbackRedirectUrl="/">
          <NavBar />
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
