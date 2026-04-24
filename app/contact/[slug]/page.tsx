// app/contact/[slug]/page.tsx
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getTenantTheme } from '@/lib/tenant-theme'
import ContactPageClient from './ContactPageClient'

export default async function ContactPage({ params }: { params: { slug: string } }) {
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
    .select('primary_color, accent_color, bg_color, text_color, logo_url')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const theme = getTenantTheme(settings)

  return (
    <ContactPageClient
      slug={tenant.slug}
      tenantName={tenant.name}
      logoUrl={settings?.logo_url ?? null}
      brand={theme.brand}
      accent={theme.accent}
      bg={theme.bg}
      text={theme.text}
      bgSurface={theme.bgSurface}
      bgBorder={theme.bgBorder}
      textMuted={theme.textMuted}
    />
  )
}
