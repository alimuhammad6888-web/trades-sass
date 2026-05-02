import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 500 }
    )
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const destination = new URL(`${origin}/dashboard/billing`)

  destination.searchParams.set('connect', 'refresh')
  if (tenantId) {
    destination.searchParams.set('tenant_id', tenantId)
  }

  return NextResponse.redirect(destination)
}
