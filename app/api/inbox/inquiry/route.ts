import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildCustomerUpdatePayload,
  matchCustomerRows,
  normalizeCustomerIdentity,
} from '@/src/lib/customer-normalization'

type InquiryBody = {
  slug?: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  message?: string
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InquiryBody

    const slug = body.slug?.trim()
    const firstName = body.first_name?.trim()
    const lastName = body.last_name?.trim()
    const phone = body.phone?.trim()
    const email = body.email?.trim()
    const message = body.message?.trim()

    if (!slug) return bad('Missing slug.')
    if (!firstName || !lastName || !phone || !email || !message) {
      return bad('All fields are required.')
    }

    // Resolve tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      return bad('Tenant not found.', 404)
    }

    const tenantId = tenant.id

    const identity = normalizeCustomerIdentity({
      firstName,
      lastName,
      phone,
      email,
    })

    let customerId: string | null = null

    const { data: customerRows, error: lookupError } = await supabaseAdmin
      .from('customers')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('tenant_id', tenantId)
      .or('phone.not.is.null,email.not.is.null')

    if (lookupError) {
      console.error('[inquiry] customer lookup failed:', lookupError)
      return bad('Failed to look up customer.', 500)
    }

    const match = matchCustomerRows(customerRows ?? [], identity)

    if (match.hadIdentityConflict) {
      console.warn('[inquiry] customer identity warning:', {
        type: 'identity_conflict',
        tenantId,
      })
    }

    if (match.hadMultiplePhoneMatches || match.hadMultipleEmailMatches) {
      console.warn('[inquiry] customer identity warning:', {
        type: 'multiple_customer_matches',
        tenantId,
      })
    }

    if (match.customer?.id) {
      customerId = match.customer.id

      const updatePayload = buildCustomerUpdatePayload(match.customer, identity)

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('customers')
          .update(updatePayload)
          .eq('id', customerId)

        if (updateError) {
          console.error('[inquiry] customer update failed:', updateError)
          return bad('Failed to update customer.', 500)
        }
      }
    }

    // Create new customer if none matched
    if (!customerId) {
      const { data: newCustomer, error: insertError } = await supabaseAdmin
        .from('customers')
        .insert({
          tenant_id: tenantId,
          first_name: identity.firstName!,
          last_name: identity.lastName,
          email: identity.normalizedEmail,
          phone: identity.normalizedPhone,
        })
        .select('id')
        .single()

      if (insertError || !newCustomer) {
        console.error('[inquiry] customer insert error:', insertError)
        return bad('Failed to create customer.', 500)
      }

      customerId = newCustomer.id
    }

    // Create inbox thread
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 60)

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('inbox_threads')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        source: 'website_form',
        status: 'new',
        last_message_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (threadError || !thread) {
      console.error('[inquiry] thread insert error:', threadError)
      return bad('Failed to create thread.', 500)
    }

    // Create inbox message
    const { error: messageError } = await supabaseAdmin
      .from('inbox_messages')
      .insert({
        thread_id: thread.id,
        direction: 'inbound',
        channel: 'web_form',
        body: message,
      })

    if (messageError) {
      console.error('[inquiry] message insert error:', messageError)
      return bad('Failed to create message.', 500)
    }

    return NextResponse.json(
      {
        success: true,
        thread_id: thread.id,
        customer_id: customerId,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[inquiry] unexpected error:', err)
    return bad('Internal server error.', 500)
  }
}
