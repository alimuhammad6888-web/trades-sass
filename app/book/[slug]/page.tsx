// Server Component — no 'use client'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BookingFlow from './BookingFlow'

export default async function BookSlugPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) notFound()

  const { data: settings } = await supabase
    .from('business_settings')
    .select('tagline, primary_color, accent_color, bg_color, text_color, phone, booking_lead_time_hours, booking_window_days, features')
    .eq('tenant_id', tenant.id)
    .single()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_mins, price_cents')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order')

  const tenantForClient = {
    id:                      tenant.id,
    name:                    tenant.name,
    slug:                    tenant.slug,
    tagline:                 settings?.tagline                ?? null,
    primary_color:           settings?.primary_color          ?? null,
    accent_color:            settings?.accent_color           ?? null,
    bg_color:                settings?.bg_color               ?? null,
    text_color:              settings?.text_color             ?? null,
    phone:                   settings?.phone                  ?? null,
    booking_lead_time_hours: settings?.booking_lead_time_hours ?? 2,
    booking_window_days:     settings?.booking_window_days    ?? 60,
    features:                settings?.features               ?? {},
  }

  return (
    <BookingFlow
      slug={slug}
      initialTenant={tenantForClient}
      initialServices={services ?? []}
    />
  )
}