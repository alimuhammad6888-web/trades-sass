import { NextRequest, NextResponse } from 'next/server'
import { slugFromHost } from '@/lib/host'

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

  const slug = slugFromHost(host, url.searchParams.get('tenant'))

  const response = NextResponse.next()
  if (slug) response.headers.set('x-tenant-slug', slug)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
