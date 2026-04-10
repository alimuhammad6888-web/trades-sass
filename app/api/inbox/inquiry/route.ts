// app/api/inbox/inquiry/route.ts
// Server-side contact/inquiry creation.
// Upserts customer, creates inbox_thread + inbox_message.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Body = {
  slug?:       string
  first_name?: string
  last_name?:  string
  phone?:      string
  email?:      string
  message?:    string
  subject?:    string | null
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return bad('Invalid JSON body')
  }

  const slug      = body.slug?.trim()
  const firstName = body.first_name?.trim()
  const lastName  = body.last_name?.trim()
  const phone     = body.phone?.trim()
  const email     = body.email?.trim()
  const message   = body.message?.trim()
  const subject   = body.subject?.trim() || null

  if (!slug)      return bad('Missing tenant slug')
  if (!firstName) return bad('Missing first_name')
  if (!lastName)  return bad('Missing last_name')
  if (!phone)     return bad('Missing phone')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad('Valid email required')
  }
  if (!message || message.length < 5) {
    return bad('Message must be at least 5 characters')
  }

  const admin = supabaseAdmin()

  // 1. Tenant lookup
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .single()

  if (tErr || !tenant || !tenant.is_active) {
    return bad('Business not found', 404)
  }

  // 2. Customer upsert — match by phone first, then email
  let customerId: string | null = null

  const { data: byPhone } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone', phone)
    .maybeSingle()

  if (byPhone?.id) {
    customerId = byPhone.id
    await admin
      .from('customers')
      .update({ first_name: firstName, last_name: lastName, email })
      .eq('id', byPhone.id)
  } else {
    // Try email match
    const { data: byEmail } = await admin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('email', email)
      .maybeSingle()

    if (byEmail?.id) {
      customerId = byEmail.id
      await admin
        .from('customers')
        .update({ first_name: firstName, last_name: lastName, phone })
        .eq('id', byEmail.id)
    }
  }

  // 3. Create new customer if no match
  if (!customerId) {
    const { data: created, error: custErr } = await admin
      .from('customers')
      .insert({
        tenant_id:   tenant.id,
        first_name:  firstName,
        last_name:   lastName,
        phone,
        email,
        lead_source: 'website',
      })
      .select('id')
      .single()

    if (custErr || !created?.id) return bad('Could not save contact', 500)
    customerId = created.id
  }

  // 4. Create inbox thread
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60_000).toISOString()

  const { data: thread, error: thErr } = await admin
    .from('inbox_threads')
    .insert({
      tenant_id:       tenant.id,
      customer_id:     customerId,
      source:          'website_form',
      subject,
      status:          'new',
      last_message_at: new Date().toISOString(),
      expires_at:      expiresAt,
    })
    .select('id')
    .single()

  if (thErr || !thread?.id) return bad('Could not create inquiry', 500)

  // 5. Create initial message
  const { error: msgErr } = await admin
    .from('inbox_messages')
    .insert({
      thread_id: thread.id,
      direction: 'inbound',
      channel:   'web_form',
      body:      message,
    })

  if (msgErr) return bad('Could not save message', 500)

  return NextResponse.json({
    success:  true,
    threadId: thread.id,
  })
}
