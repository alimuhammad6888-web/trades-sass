import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_STATUSES = new Set(['new', 'reviewing', 'approved', 'rejected'])

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('onboarding_requests')
    .update({
      status,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[admin/onboarding/status]', error.message)
    return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
