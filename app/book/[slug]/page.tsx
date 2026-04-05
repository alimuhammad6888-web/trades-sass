// Server Component — no 'use client'
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (same as the API route).
// Schema matched exactly to app/api/public/tenant-by-slug/route.ts
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BookingFlow from './BookingFlow'

export default async function BookSlugPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  // Service role key — bypasses RLS, same auth as the API route
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Query 1: fetch tenant only — no nested join
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) notFound()

  // Query 2: fetch business_settings explicitly using tenant_id
  const { data: settings } = await supabase
    .from('business_settings')
    .select('tagline, primary_color, accent_color, phone, booking_lead_time_hours, booking_window_days')
    .eq('tenant_id', tenant.id)
    .single()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_mins, price_cents')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('display_order')             // display_order, not sort_order

  // Flatten into the shape BookingFlow expects (matches API route output)
  const tenantForClient = {
    id:                    tenant.id,
    name:                  tenant.name,
    slug:                  tenant.slug,
    tagline:               settings?.tagline               ?? null,
    primary_color:         settings?.primary_color         ?? null,
    accent_color:          settings?.accent_color          ?? null,
    phone:                 settings?.phone                 ?? null,
    booking_lead_time_hours: settings?.booking_lead_time_hours ?? 2,
    booking_window_days:   settings?.booking_window_days   ?? 60,
  }

  return (
    <BookingFlow
      slug={slug}
      initialTenant={tenantForClient}
      initialServices={services ?? []}
    />
  )
}
