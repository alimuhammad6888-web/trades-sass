import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type OnboardingSubmitBody = {
  business_name?: string
  owner_name?: string
  owner_email?: string
  owner_phone?: string
  business_phone?: string
  business_email?: string
  service_area?: string
  business_address?: string
  preferred_website_name?: string
  plan_interest?: string
  google_review_url?: string
  yelp_review_url?: string
  notes?: string
  website?: string
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalText(value: unknown) {
  const trimmed = normalizeText(value)
  return trimmed.length > 0 ? trimmed : null
}

function normalizeEmail(value: unknown) {
  const trimmed = normalizeText(value).toLowerCase()
  return trimmed.length > 0 ? trimmed : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeSlug(value: unknown) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized.length > 0 ? normalized : null
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as OnboardingSubmitBody | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (normalizeText(body.website)) {
    return NextResponse.json({ success: true })
  }

  const businessName = normalizeText(body.business_name)
  const ownerEmail = normalizeEmail(body.owner_email)

  if (!businessName) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }

  if (!ownerEmail || !isValidEmail(ownerEmail)) {
    return NextResponse.json({ error: 'A valid owner email is required.' }, { status: 400 })
  }

  const insertPayload = {
    status: 'new',
    business_name: businessName,
    owner_name: normalizeOptionalText(body.owner_name),
    owner_email: ownerEmail,
    owner_phone: normalizeOptionalText(body.owner_phone),
    business_phone: normalizeOptionalText(body.business_phone),
    business_email: normalizeOptionalText(body.business_email),
    trade_category: null,
    service_area: normalizeOptionalText(body.service_area),
    business_address: normalizeOptionalText(body.business_address),
    desired_slug: normalizeSlug(body.preferred_website_name),
    plan_interest: normalizeOptionalText(body.plan_interest),
    brand_color: null,
    google_review_url: normalizeOptionalText(body.google_review_url),
    yelp_review_url: normalizeOptionalText(body.yelp_review_url),
    services_text: null,
    business_hours_text: null,
    notes: normalizeOptionalText(body.notes),
    source: 'public_onboarding',
    invite_status: 'not_invited',
  }

  const { error } = await supabaseAdmin
    .from('onboarding_requests')
    .insert(insertPayload)

  if (error) {
    console.error('[onboarding/submit] insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to submit onboarding request.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
