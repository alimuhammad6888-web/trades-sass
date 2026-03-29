// app/api/admin/tenants/create/route.ts
// Creates tenant + business_settings + business_hours + owner auth user.
// Owner's `users` row is auto-created by the handle_new_user() trigger.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLANS = ['free', 'pro', 'enterprise']

const DEFAULT_HOURS: { day: string; is_open: boolean; open_time: string | null; close_time: string | null }[] = [
  { day: 'mon', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'tue', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'wed', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'thu', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'fri', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'sat', is_open: false, open_time: null,     close_time: null },
  { day: 'sun', is_open: false, open_time: null,     close_time: null },
]

const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  free:       { chatbot: false, sms: false, campaigns: false, inbox: false, custom_domain: false },
  pro:        { chatbot: true,  sms: true,  campaigns: true,  inbox: true,  custom_domain: false },
  enterprise: { chatbot: true,  sms: true,  campaigns: true,  inbox: true,  custom_domain: true },
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await req.json()
    const {
      name, slug, plan, tagline, phone, email, primary_color, timezone,
      owner_first_name, owner_last_name, owner_email, owner_password,
    } = body

    // ── 1. Validate required fields ───────────────────────────
    if (!name?.trim())       return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    if (!slug?.trim())       return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    if (!email?.trim())      return NextResponse.json({ error: 'Business email is required' }, { status: 400 })
    if (!owner_first_name?.trim()) return NextResponse.json({ error: 'Owner first name is required' }, { status: 400 })
    if (!owner_last_name?.trim())  return NextResponse.json({ error: 'Owner last name is required' }, { status: 400 })
    if (!owner_email?.trim())      return NextResponse.json({ error: 'Owner email is required' }, { status: 400 })
    if (!owner_password || owner_password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // ── 2. Validate slug format ───────────────────────────────
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
      return NextResponse.json({ error: 'Slug must be lowercase letters, numbers, and hyphens' }, { status: 400 })
    }

    // ── 3. Validate plan ──────────────────────────────────────
    const safePlan = PLANS.includes(plan) ? plan : 'free'

    // ── 4. Check slug uniqueness ──────────────────────────────
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 })
    }

    // ── 5. Create tenant ──────────────────────────────────────
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ name: name.trim(), slug: slug.trim(), plan: safePlan, is_active: true })
      .select('id')
      .single()

    if (tenantErr || !tenant) {
      console.error('[admin/tenants/create] tenant insert failed:', tenantErr)
      return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
    }

    const tenantId = tenant.id

    // ── 6. Create business_settings ───────────────────────────
    const { error: settingsErr } = await supabase
      .from('business_settings')
      .insert({
        tenant_id:     tenantId,
        tagline:       tagline?.trim() || null,
        phone:         phone?.trim() || null,
        email:         email.trim(),
        primary_color: primary_color || '#F4C300',
        timezone:      timezone || 'America/Los_Angeles',
        features:      PLAN_FEATURES[safePlan] ?? PLAN_FEATURES.free,
        notification_email: email.trim(),
      })

    if (settingsErr) {
      console.error('[admin/tenants/create] settings insert failed:', settingsErr)
      // Cleanup: remove the orphaned tenant
      await supabase.from('tenants').delete().eq('id', tenantId)
      return NextResponse.json({ error: 'Failed to create business settings' }, { status: 500 })
    }

    // ── 7. Create business_hours (Mon–Sun defaults) ───────────
    const { error: hoursErr } = await supabase
      .from('business_hours')
      .insert(DEFAULT_HOURS.map(h => ({ tenant_id: tenantId, ...h })))

    if (hoursErr) {
      console.error('[admin/tenants/create] hours insert failed:', hoursErr)
      // Non-fatal — tenant and settings exist, hours can be set later
    }

    // ── 8. Create owner auth user ─────────────────────────────
    // The handle_new_user() trigger reads raw_user_meta_data and
    // auto-inserts the users row with role='owner'.
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: owner_email.trim(),
      password: owner_password,
      email_confirm: true,
      user_metadata: {
        tenant_id:  tenantId,
        role:       'owner',
        first_name: owner_first_name.trim(),
        last_name:  owner_last_name.trim(),
      },
    })

    if (authErr || !authData.user) {
      console.error('[admin/tenants/create] auth user creation failed:', authErr)
      // Tenant + settings exist but no owner — return warning, not failure
      return NextResponse.json({
        success: true,
        tenantId,
        warning: `Tenant created but owner account failed: ${authErr?.message}. Create the owner manually.`,
      })
    }

    // ── 9. Return success ─────────────────────────────────────
    return NextResponse.json({
      success:  true,
      tenantId,
      slug,
      ownerId:  authData.user.id,
    })

  } catch (err: any) {
    console.error('[admin/tenants/create] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
