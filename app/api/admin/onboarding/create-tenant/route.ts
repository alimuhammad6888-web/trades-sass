import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type OnboardingRequestRow = {
  id: string
  status: string
  business_name: string
  owner_name: string | null
  owner_email: string
  business_phone: string | null
  business_email: string | null
  desired_slug: string | null
  plan_interest: string | null
  tenant_id: string | null
  auth_user_id: string | null
}

const STARTER_SERVICES = [
  { name: 'Service Call', description: 'On-site visit, diagnosis, and minor repairs.', duration_mins: 60, price_cents: 15000, display_order: 1 },
  { name: 'Standard Repair', description: 'Common repair work with parts and labor included.', duration_mins: 120, price_cents: 35000, display_order: 2 },
  { name: 'Full Inspection', description: 'Comprehensive safety inspection with written report.', duration_mins: 90, price_cents: 25000, display_order: 3 },
]

const ALLOWED_SOURCE_STATUSES = new Set(['reviewing', 'approved'])
const ALLOWED_PLANS = new Set(['starter', 'pro', 'enterprise'])

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function splitOwnerName(ownerName: string | null) {
  const fullName = normalizeText(ownerName)
  if (!fullName) {
    return { firstName: 'Owner', lastName: 'Account' }
  }

  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Owner' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function markRequestFailed(requestId: string, tenantId: string | null, message: string) {
  const now = new Date().toISOString()

  await supabaseAdmin
    .from('onboarding_requests')
    .update({
      tenant_id: tenantId,
      invite_status: 'failed',
      auto_create_error: message,
      processed_at: now,
    })
    .eq('id', requestId)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const onboardingRequestId =
    typeof body?.onboardingRequestId === 'string' ? body.onboardingRequestId : ''

  if (!onboardingRequestId) {
    return NextResponse.json({ error: 'onboardingRequestId is required' }, { status: 400 })
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from('onboarding_requests')
    .select(`
      id,
      status,
      business_name,
      owner_name,
      owner_email,
      business_phone,
      business_email,
      desired_slug,
      plan_interest,
      tenant_id,
      auth_user_id
    `)
    .eq('id', onboardingRequestId)
    .maybeSingle<OnboardingRequestRow>()

  if (requestError) {
    console.error('[admin/onboarding/create-tenant] request lookup failed:', requestError.message)
    return NextResponse.json({ error: 'Failed to load onboarding request.' }, { status: 500 })
  }

  if (!request) {
    return NextResponse.json({ error: 'Onboarding request not found.' }, { status: 404 })
  }

  if (!ALLOWED_SOURCE_STATUSES.has(request.status)) {
    return NextResponse.json({ error: 'Request must be reviewing or approved before tenant creation.' }, { status: 400 })
  }

  if (request.tenant_id) {
    return NextResponse.json({ error: 'This onboarding request already has a tenant.' }, { status: 409 })
  }

  const businessName = normalizeText(request.business_name)
  const ownerEmail = normalizeText(request.owner_email).toLowerCase()
  const desiredSlug = normalizeText(request.desired_slug)
  const slug = normalizeSlug(desiredSlug || businessName)
  const normalizedPlan = normalizeText(request.plan_interest).toLowerCase()
  const plan = ALLOWED_PLANS.has(normalizedPlan) ? normalizedPlan : 'starter'

  if (!businessName) {
    return NextResponse.json({ error: 'Business name is required on the onboarding request.' }, { status: 400 })
  }

  if (!ownerEmail) {
    return NextResponse.json({ error: 'Owner email is required on the onboarding request.' }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ error: 'Could not derive a valid website name for this business.' }, { status: 400 })
  }

  const { firstName, lastName } = splitOwnerName(request.owner_name)

  const { data: existingTenant, error: existingTenantError } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingTenantError) {
    console.error('[admin/onboarding/create-tenant] slug lookup failed:', existingTenantError.message)
    return NextResponse.json({ error: 'Failed to validate website name.' }, { status: 500 })
  }

  if (existingTenant) {
    return NextResponse.json({ error: `Website name "${slug}" is already taken.` }, { status: 409 })
  }

  let tenantId: string | null = null

  try {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: businessName,
        slug,
        plan,
        is_active: true,
      })
      .select('id')
      .single()

    if (tenantError || !tenant) {
      console.error('[admin/onboarding/create-tenant] tenant insert failed:', tenantError)
      return NextResponse.json({ error: 'Failed to create tenant.' }, { status: 500 })
    }

    tenantId = tenant.id

    const notificationEmail = normalizeText(request.business_email) || ownerEmail

    const { error: settingsError } = await supabaseAdmin
      .from('business_settings')
      .insert({
        tenant_id: tenantId,
        phone: normalizeText(request.business_phone) || null,
        email: notificationEmail,
        notification_email: notificationEmail,
      })

    if (settingsError) {
      throw new Error(`Failed to create business settings: ${settingsError.message}`)
    }

    const { error: siteContentError } = await supabaseAdmin
      .from('tenant_site_content')
      .insert({
        tenant_id: tenantId,
      })

    if (siteContentError) {
      throw new Error(`Failed to create site content: ${siteContentError.message}`)
    }

    const { count: existingServicesCount, error: servicesCountError } = await supabaseAdmin
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (servicesCountError) {
      throw new Error(`Failed to check existing services: ${servicesCountError.message}`)
    }

    if ((existingServicesCount ?? 0) === 0) {
      const { error: servicesError } = await supabaseAdmin
        .from('services')
        .insert(
          STARTER_SERVICES.map(service => ({
            tenant_id: tenantId,
            is_active: true,
            ...service,
          }))
        )

      if (servicesError) {
        throw new Error(`Failed to create starter services: ${servicesError.message}`)
      }
    }
  } catch (dbError) {
    const message = errorMessage(dbError)
    console.error('[admin/onboarding/create-tenant] pre-invite setup failed:', message)
    await markRequestFailed(request.id, tenantId, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      ownerEmail,
      {
        data: {
          tenant_id: tenantId,
          role: 'owner',
          first_name: firstName,
          last_name: lastName,
        },
      }
    )

    if (inviteError || !inviteData.user?.id) {
      throw new Error(inviteError?.message || 'Invite was sent without a usable auth user id.')
    }

    const authUserId = inviteData.user.id

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', ownerEmail)
      .maybeSingle()

    if (existingUserError) {
      throw new Error(`Failed to check owner user record: ${existingUserError.message}`)
    }

    if (existingUser) {
      const { error: updateUserError } = await supabaseAdmin
        .from('users')
        .update({
          auth_user_id: authUserId,
          role: 'owner',
          first_name: firstName,
          last_name: lastName,
          is_active: true,
        })
        .eq('id', existingUser.id)

      if (updateUserError) {
        throw new Error(`Failed to update owner user record: ${updateUserError.message}`)
      }
    } else {
      const { error: insertUserError } = await supabaseAdmin
        .from('users')
        .insert({
          tenant_id: tenantId,
          auth_user_id: authUserId,
          email: ownerEmail,
          role: 'owner',
          first_name: firstName,
          last_name: lastName,
          is_active: true,
        })

      if (insertUserError) {
        throw new Error(`Failed to create owner user record: ${insertUserError.message}`)
      }
    }

    const now = new Date().toISOString()

    const { error: updateRequestError } = await supabaseAdmin
      .from('onboarding_requests')
      .update({
        tenant_id: tenantId,
        auth_user_id: authUserId,
        invite_status: 'invited',
        invited_at: now,
        processed_at: now,
        status: 'approved',
        auto_create_error: null,
      })
      .eq('id', request.id)

    if (updateRequestError) {
      throw new Error(`Failed to update onboarding request: ${updateRequestError.message}`)
    }

    return NextResponse.json({
      success: true,
      tenantId,
      authUserId,
      slug,
    })
  } catch (inviteOrUserError) {
    const message = errorMessage(inviteOrUserError)
    console.error('[admin/onboarding/create-tenant] invite/user step failed:', message)
    await markRequestFailed(request.id, tenantId, message)
    return NextResponse.json(
      {
        error: `Tenant created, but owner invite failed: ${message}`,
      },
      { status: 500 }
    )
  }
}
