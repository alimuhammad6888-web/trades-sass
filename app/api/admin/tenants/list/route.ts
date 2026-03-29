import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, plan, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/tenants/list]', error)
    return NextResponse.json({ error: 'Failed to load tenants' }, { status: 500 })
  }

  return NextResponse.json({ tenants: data ?? [] })
}
