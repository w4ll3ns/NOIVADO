import { NextResponse, type NextRequest } from 'next/server'

import { adminCookieName } from '@/lib/auth/constants'

const MP_FORM_TARGETS = 'https://*.mercadopago.com.br https://*.mercadopago.com https://*.mercadolivre.com'

function buildCsp(nonce: string, isDev: boolean) {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `media-src 'self' blob:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' ${MP_FORM_TARGETS}`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'
  const { pathname, search } = request.nextUrl

  // HTTPS obrigatório (atrás de proxy reverso/CDN que informa o protocolo original).
  if (!isDev && process.env.FORCE_HTTPS !== 'false' && request.headers.get('x-forwarded-proto') === 'http') {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    return NextResponse.redirect(`https://${host}${pathname}${search}`, 308)
  }

  // Área administrativa: sem cookie de sessão, vai para o login.
  // (A sessão é validada de verdade no servidor, em cada página e ação.)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !request.cookies.get(adminCookieName())) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce, isDev)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|brand|m/|p/|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
