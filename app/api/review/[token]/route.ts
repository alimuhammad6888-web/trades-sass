import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

type ReviewTokenContext = {
  tokenRow: {
    id: string
    tenant_id: string
    customer_id: string
    booking_id: string
    expires_at: string
  }
  tenantName: string
  googleReviewUrl: string | null
  yelpReviewUrl: string | null
}

type ReviewTokenContextResult = { error: null } & ReviewTokenContext

function hasReviewTokenContext(
  value:
    | ReviewTokenContextResult
    | {
        error:
          | 'not_found'
          | 'expired'
          | 'lookup_failed'
          | 'tenant_not_found'
          | 'settings_not_found'
      }
): value is ReviewTokenContextResult {
  return value.error === null
}

async function loadReviewTokenContext(token: string): Promise<
  | {
      error:
        | 'not_found'
        | 'expired'
        | 'lookup_failed'
        | 'tenant_not_found'
        | 'settings_not_found'
    }
  | ReviewTokenContextResult
> {
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from('review_tokens')
    .select('id, tenant_id, customer_id, booking_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (tokenErr) {
    console.error('[review/token] token lookup failed:', tokenErr.message)
    return { error: 'lookup_failed' }
  }

  if (!tokenRow) {
    return { error: 'not_found' }
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return { error: 'expired' }
  }

  const [
    { data: tenantRow, error: tenantErr },
    { data: settingsRow, error: settingsErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tokenRow.tenant_id)
      .single(),
    supabaseAdmin
      .from('business_settings')
      .select('google_review_url, yelp_review_url')
      .eq('tenant_id', tokenRow.tenant_id)
      .single(),
  ])

  if (tenantErr || !tenantRow) {
    console.error('[review/token] tenant lookup failed:', tenantErr?.message)
    return { error: 'tenant_not_found' }
  }

  if (settingsErr || !settingsRow) {
    console.error('[review/token] business settings lookup failed:', settingsErr?.message)
    return { error: 'settings_not_found' }
  }

  return {
    error: null,
    tokenRow,
    tenantName: tenantRow.name,
    googleReviewUrl: settingsRow.google_review_url?.trim() || null,
    yelpReviewUrl: settingsRow.yelp_review_url?.trim() || null,
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params
  const resolved = await loadReviewTokenContext(token)

  if (resolved.error === 'not_found') return bad('Review link not found.', 404)
  if (resolved.error === 'expired') return bad('Review link has expired.', 410)
  if (!hasReviewTokenContext(resolved)) return bad('Failed to load review link.', 500)
  const contextData = resolved

  return NextResponse.json({
    tenantName: contextData.tenantName,
    googleReviewUrl: contextData.googleReviewUrl,
    yelpReviewUrl: contextData.yelpReviewUrl,
    expired: false,
  })
}

export async function POST(
  req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params
  const resolved = await loadReviewTokenContext(token)

  if (resolved.error === 'not_found') return bad('Review link not found.', 404)
  if (resolved.error === 'expired') return bad('Review link has expired.', 410)
  if (!hasReviewTokenContext(resolved)) return bad('Failed to load review link.', 500)
  const contextData = resolved

  const payload = await req.json().catch(() => null)
  const rating = payload?.rating
  const feedbackText =
    typeof payload?.feedback_text === 'string' ? payload.feedback_text.trim() : ''

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return bad('Rating must be an integer between 1 and 5.', 400)
  }

  const isPositive = rating >= 4

  const { error: feedbackErr } = await supabaseAdmin.from('customer_feedback').insert({
    tenant_id: contextData.tokenRow.tenant_id,
    customer_id: contextData.tokenRow.customer_id,
    booking_id: contextData.tokenRow.booking_id,
    review_token_id: contextData.tokenRow.id,
    rating,
    is_positive: isPositive,
    feedback_text: feedbackText || null,
  })

  if (feedbackErr) {
    console.error('[review/token] feedback insert failed:', feedbackErr.message)
    return bad('Failed to save feedback.', 500)
  }

  const { error: tokenUpdateErr } = await supabaseAdmin
    .from('review_tokens')
    .update({
      used_at: new Date().toISOString(),
    })
    .eq('id', contextData.tokenRow.id)

  if (tokenUpdateErr) {
    console.error('[review/token] token used_at update failed:', tokenUpdateErr.message)
    return bad('Failed to finalize feedback.', 500)
  }

  return NextResponse.json({
    success: true,
    isPositive,
    googleReviewUrl: contextData.googleReviewUrl,
    yelpReviewUrl: contextData.yelpReviewUrl,
  })
}
