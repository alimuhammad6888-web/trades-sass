import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, slug, is_active, business_settings ( tagline, primary_color, phone, booking_lead_time_hours, booking_window_days )')
    .eq('slug', slug)
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  if (!tenant.is_active) {
    return NextResponse.json({ error: 'This business is not currently available' }, { status: 403 })
  }

  const settings = Array.isArray(tenant.business_settings)
    ? tenant.business_settings[0]
    : tenant.business_settings

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_mins, price_cents')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order')

  const { data: siteContent } = await supabase
    .from('tenant_site_content')
    .select('hero_headline, hero_subheadline, hero_badge, stats_json, why_us_json, cta_primary_text, cta_secondary_text, cta_description, footer_tagline, is_published')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      tagline: settings?.tagline ?? null,
      primary_color: settings?.primary_color ?? null,
      phone: settings?.phone ?? null,
      booking_lead_time_hours: settings?.booking_lead_time_hours ?? 2,
      booking_window_days: settings?.booking_window_days ?? 60,
    },
    services: services ?? [],
    siteContent: siteContent ?? null,
  })
}
