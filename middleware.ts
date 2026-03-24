import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next()
  }

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const slug = isLocalhost
    ? (url.searchParams.get('tenant') ?? 'demo-plumbing')
    : host.split('.')[0]

  const response = NextResponse.next()
  response.headers.set('x-tenant-slug', slug)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
