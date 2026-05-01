import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ClickRecipientRow = {
  id: string
  tenant_id: string
  customer_id: string
  campaign_id: string
  click_token: string | null
  clicked_at: string | null
  campaigns: {
    cta_url: string | null
    clicked_count: number | null
  } | {
    cta_url: string | null
    clicked_count: number | null
  }[] | null
}

function normalizeUrl(input: string | null | undefined) {
  const raw = input?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function dashboardRedirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard', req.url))
}

async function loadRecipientByClickToken(token: string): Promise<ClickRecipientRow | null> {
  const { data, error } = await supabaseAdmin
    .from('campaign_recipients')
    .select(`
      id,
      tenant_id,
      customer_id,
      campaign_id,
      click_token,
      clicked_at,
      campaigns (
        cta_url,
        clicked_count
      )
    `)
    .eq('click_token', token)
    .maybeSingle()

  if (error) {
    console.error('[campaigns/click] failed to load click token:', error.message)
    return null
  }

  return (data as unknown as ClickRecipientRow | null) ?? null
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()

  if (!token) {
    return dashboardRedirect(req)
  }

  const recipient = await loadRecipientByClickToken(token)

  if (!recipient) {
    return dashboardRedirect(req)
  }

  const campaignData = Array.isArray(recipient.campaigns) ? recipient.campaigns[0] ?? null : recipient.campaigns
  const destination = normalizeUrl(campaignData?.cta_url)

  if (!destination) {
    return dashboardRedirect(req)
  }

  const nowIso = new Date().toISOString()
  const firstClick = !recipient.clicked_at

  const { error: eventErr } = await supabaseAdmin
    .from('campaign_events')
    .insert({
      tenant_id: recipient.tenant_id,
      campaign_id: recipient.campaign_id,
      campaign_recipient_id: recipient.id,
      customer_id: recipient.customer_id,
      event_type: 'clicked',
      event_metadata: {
        destination_url: destination,
      },
    })

  if (eventErr) {
    console.error('[campaigns/click] failed to insert click event:', eventErr.message)
  }

  const recipientUpdate: {
    delivery_status: 'clicked'
    clicked_at?: string
  } = {
    delivery_status: 'clicked',
  }

  if (firstClick) {
    recipientUpdate.clicked_at = nowIso
  }

  const { error: recipientErr } = await supabaseAdmin
    .from('campaign_recipients')
    .update(recipientUpdate)
    .eq('id', recipient.id)
    .eq('tenant_id', recipient.tenant_id)

  if (recipientErr) {
    console.error('[campaigns/click] failed to update recipient click status:', recipientErr.message)
  }

  if (firstClick) {
    const currentClickedCount = campaignData?.clicked_count ?? 0

    const { error: campaignErr } = await supabaseAdmin
      .from('campaigns')
      .update({
        clicked_count: currentClickedCount + 1,
      })
      .eq('id', recipient.campaign_id)
      .eq('tenant_id', recipient.tenant_id)

    if (campaignErr) {
      console.error('[campaigns/click] failed to increment campaign click count:', campaignErr.message)
    }
  }

  return NextResponse.redirect(destination)
}
