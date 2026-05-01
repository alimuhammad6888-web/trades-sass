import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RecipientTokenRow = {
  id: string
  tenant_id: string
  customer_id: string
  campaign_id: string
  unsubscribe_token: string | null
  campaigns: {
    tenants: {
      name: string | null
    } | {
      name: string | null
    }[] | null
  } | {
    tenants: {
      name: string | null
    } | {
      name: string | null
    }[] | null
  }[] | null
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlPage(params: {
  title: string
  body: string
  status?: number
}) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f4f2ee;
        color: #1a1917;
      }
      .wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
      }
      .card {
        width: 100%;
        max-width: 560px;
        background: #ffffff;
        border: 1px solid #e8e4dc;
        border-radius: 10px;
        overflow: hidden;
      }
      .head {
        padding: 18px 20px;
        background: #1a1917;
        border-bottom: 3px solid #F4C300;
      }
      .brand {
        color: #F4C300;
        font-size: 20px;
        font-weight: 700;
        font-family: Georgia, serif;
        font-style: italic;
      }
      .body {
        padding: 20px;
        line-height: 1.6;
        font-size: 14px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 24px;
        font-family: Georgia, serif;
        font-style: italic;
      }
      p {
        margin: 0 0 14px;
        color: #4a4843;
      }
      .btn {
        display: inline-block;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        background: #1a1917;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }
      .btn-secondary {
        background: #f0ede6;
        color: #1a1917;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      form {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="head">
          <div class="brand">Campaign preferences</div>
        </div>
        <div class="body">
          ${params.body}
        </div>
      </div>
    </div>
  </body>
</html>`,
    {
      status: params.status ?? 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }
  )
}

function getTenantName(row: RecipientTokenRow | null) {
  const campaignData = Array.isArray(row?.campaigns) ? row?.campaigns[0] ?? null : row?.campaigns
  const tenantData = campaignData?.tenants
  if (!tenantData) return 'this business'
  if (Array.isArray(tenantData)) return tenantData[0]?.name?.trim() || 'this business'
  return tenantData.name?.trim() || 'this business'
}

async function loadRecipientByUnsubscribeToken(token: string): Promise<RecipientTokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from('campaign_recipients')
    .select(`
      id,
      tenant_id,
      customer_id,
      campaign_id,
      unsubscribe_token,
      campaigns (
        tenants (
          name
        )
      )
    `)
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    console.error('[campaigns/unsubscribe] failed to load recipient token:', error.message)
    return null
  }

  return (data as unknown as RecipientTokenRow | null) ?? null
}

function invalidPage() {
  return htmlPage({
    title: 'Invalid unsubscribe link',
    status: 404,
    body: `
      <h1>Invalid unsubscribe link</h1>
      <p>This link is missing or no longer valid.</p>
      <div class="actions">
        <a class="btn btn-secondary" href="/dashboard">Back to dashboard</a>
      </div>
    `,
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()

  if (!token) {
    return invalidPage()
  }

  const recipient = await loadRecipientByUnsubscribeToken(token)

  if (!recipient) {
    return invalidPage()
  }

  const businessName = escapeHtml(getTenantName(recipient))

  return htmlPage({
    title: 'Unsubscribe from campaign emails',
    body: `
      <h1>Unsubscribe from future marketing emails from ${businessName}?</h1>
      <p>This will stop future campaign emails for this business. Transactional messages and booking-related updates may still be sent separately.</p>
      <form method="post" action="/api/campaigns/unsubscribe">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <div class="actions">
          <button class="btn" type="submit">Yes, unsubscribe me</button>
          <a class="btn btn-secondary" href="/">Cancel</a>
        </div>
      </form>
    `,
  })
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const token = typeof form?.get('token') === 'string' ? String(form?.get('token')).trim() : ''

  if (!token) {
    return invalidPage()
  }

  const recipient = await loadRecipientByUnsubscribeToken(token)

  if (!recipient) {
    return invalidPage()
  }

  const { error: optOutErr } = await supabaseAdmin
    .from('customer_channel_opt_outs')
    .upsert(
      {
        tenant_id: recipient.tenant_id,
        customer_id: recipient.customer_id,
        channel: 'email',
        source: 'unsubscribe_link',
      },
      {
        onConflict: 'tenant_id,customer_id,channel',
      }
    )

  if (optOutErr) {
    console.error('[campaigns/unsubscribe] failed to upsert opt-out:', optOutErr.message)
    return htmlPage({
      title: 'Unable to update preferences',
      status: 500,
      body: `
        <h1>We couldn’t update your preferences</h1>
        <p>Please try again in a moment.</p>
      `,
    })
  }

  const { error: eventErr } = await supabaseAdmin
    .from('campaign_events')
    .insert({
      tenant_id: recipient.tenant_id,
      campaign_id: recipient.campaign_id,
      campaign_recipient_id: recipient.id,
      customer_id: recipient.customer_id,
      event_type: 'unsubscribed',
      event_metadata: {
        source: 'unsubscribe_link',
      },
    })

  if (eventErr) {
    console.error('[campaigns/unsubscribe] failed to insert unsubscribe event:', eventErr.message)
  }

  const { error: recipientErr } = await supabaseAdmin
    .from('campaign_recipients')
    .update({
      delivery_status: 'unsubscribed',
    })
    .eq('id', recipient.id)
    .eq('tenant_id', recipient.tenant_id)

  if (recipientErr) {
    console.error('[campaigns/unsubscribe] failed to update recipient status:', recipientErr.message)
  }

  const businessName = escapeHtml(getTenantName(recipient))

  return htmlPage({
    title: 'You’re unsubscribed',
    body: `
      <h1>You’re unsubscribed</h1>
      <p>You won’t receive future marketing emails from ${businessName}.</p>
      <p>Your preferences have been updated successfully.</p>
    `,
  })
}
