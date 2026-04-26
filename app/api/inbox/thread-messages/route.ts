import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return bad('Unauthorized', 401)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return bad('Supabase env vars are not configured', 500)
  }

  const customerId = req.nextUrl.searchParams.get('customer_id')?.trim()

  if (!customerId) return bad('customer_id is required', 400)

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const {
    data: { user },
    error: authErr,
  } = await supabaseUser.auth.getUser(token)

  if (authErr || !user) {
    console.error('[inbox/thread-messages] auth error:', authErr?.message)
    return bad('Unauthorized', 401)
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[inbox/thread-messages] failed to load user tenant:', userErr.message)
    return bad('Failed to verify tenant', 500)
  }

  if (!userRow?.tenant_id) {
    return bad('Tenant not found', 404)
  }

  const tenantId = userRow.tenant_id

  const { data: customer, error: customerErr } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (customerErr) {
    console.error('[inbox/thread-messages] failed to load customer:', customerErr.message)
    return bad('Failed to load customer', 500)
  }

  if (!customer) {
    return bad('Customer not found', 404)
  }

  const { data: threads, error: threadsErr } = await supabaseAdmin
    .from('inbox_threads')
    .select('id, customer_id, last_message_at, status')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('last_message_at', { ascending: true })

  if (threadsErr) {
    console.error('[inbox/thread-messages] failed to load threads:', threadsErr.message)
    return bad('Failed to load thread history', 500)
  }

  const safeThreads = threads ?? []

  if (safeThreads.length === 0) {
    return NextResponse.json({ threads: [], messages: [] })
  }

  const threadIds = safeThreads.map(thread => thread.id)

  const { data: messages, error: messagesErr } = await supabaseAdmin
    .from('inbox_messages')
    .select('*')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true })

  if (messagesErr) {
    console.error('[inbox/thread-messages] failed to load messages:', messagesErr.message)
    return bad('Failed to load messages', 500)
  }

  return NextResponse.json({
    threads: safeThreads,
    messages: messages ?? [],
  })
}
