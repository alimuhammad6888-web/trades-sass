import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/onboarding/list]', error.message)
    return NextResponse.json({ error: 'Failed to load onboarding requests' }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}
