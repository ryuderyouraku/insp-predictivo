import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { Role } from '@prisma/client'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role as Role | undefined
    const deny = () => NextResponse.redirect(new URL('/fajas', req.url))

    if (pathname.startsWith('/admin')) {
      if (role !== 'ADMIN' && role !== 'SUPERVISOR') return deny()
    } else if (pathname.startsWith('/clientes') || pathname.startsWith('/contratistas')) {
      if (role !== 'ADMIN') return deny()
    } else if (pathname === '/fajas/new') {
      if (role !== 'ADMIN' && role !== 'SUPERVISOR') return deny()
    } else if (/^\/fajas\/[^/]+\/reportes\/new/.test(pathname)) {
      if (role === 'CLIENTE') return deny()
    }

    return NextResponse.next()
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      // La vista de impresión la navega Puppeteer sin cookies de sesión; se protege
      // con su propio token HMAC (ver printToken.ts), no con sesión de usuario.
      authorized: ({ token, req }) => {
        if (/^\/reportes\/print\/[^/]+/.test(req.nextUrl.pathname)) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/clientes/:path*',
    '/contratistas/:path*',
    '/fajas/:path*',
    '/reportes/:path*',
    '/api/cloudinary/:path*',
    '/admin/:path*',
  ],
}
