export type CustomerIdentityInput = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

export type NormalizedCustomerIdentity = {
  firstName: string | null
  lastName: string | null
  email: string | null
  normalizedEmail: string | null
  phone: string | null
  normalizedPhone: string | null
}

export type CustomerMatchRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  created_at: string | null
}

export type CustomerMatchResult = {
  customer: CustomerMatchRow | null
  phoneMatch: CustomerMatchRow | null
  emailMatch: CustomerMatchRow | null
  hadPhoneMatches: boolean
  hadEmailMatches: boolean
  hadMultiplePhoneMatches: boolean
  hadMultipleEmailMatches: boolean
  hadIdentityConflict: boolean
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeEmail(email: string | null | undefined) {
  const trimmed = trimToNull(email)
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

export function normalizePhone(phone: string | null | undefined) {
  const trimmed = trimToNull(phone)
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null
  if (hasPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits || null
}

export function normalizeCustomerIdentity(input: CustomerIdentityInput): NormalizedCustomerIdentity {
  const firstName = trimToNull(input.firstName)
  const lastName = trimToNull(input.lastName)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = normalizePhone(input.phone)

  return {
    firstName,
    lastName,
    email: normalizedEmail,
    normalizedEmail,
    phone: normalizedPhone,
    normalizedPhone,
  }
}

function compareCustomers(a: CustomerMatchRow, b: CustomerMatchRow) {
  const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN
  const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN
  const aHasTime = Number.isFinite(aTime)
  const bHasTime = Number.isFinite(bTime)

  if (aHasTime && bHasTime && aTime !== bTime) {
    return aTime - bTime
  }

  if (aHasTime !== bHasTime) {
    return aHasTime ? -1 : 1
  }

  return a.id.localeCompare(b.id)
}

function chooseCanonicalCustomer(rows: CustomerMatchRow[]) {
  if (rows.length === 0) return null
  return [...rows].sort(compareCustomers)[0] ?? null
}

export function matchCustomerRows(
  rows: CustomerMatchRow[],
  identity: Pick<NormalizedCustomerIdentity, 'normalizedEmail' | 'normalizedPhone'>
): CustomerMatchResult {
  const phoneMatches = identity.normalizedPhone
    ? rows.filter(row => normalizePhone(row.phone) === identity.normalizedPhone)
    : []

  const emailMatches = identity.normalizedEmail
    ? rows.filter(row => normalizeEmail(row.email) === identity.normalizedEmail)
    : []

  const phoneMatch = chooseCanonicalCustomer(phoneMatches)
  const emailMatch = chooseCanonicalCustomer(emailMatches)
  const hadIdentityConflict =
    !!phoneMatch &&
    !!emailMatch &&
    phoneMatch.id !== emailMatch.id

  return {
    customer: phoneMatch ?? emailMatch,
    phoneMatch,
    emailMatch,
    hadPhoneMatches: phoneMatches.length > 0,
    hadEmailMatches: emailMatches.length > 0,
    hadMultiplePhoneMatches: phoneMatches.length > 1,
    hadMultipleEmailMatches: emailMatches.length > 1,
    hadIdentityConflict,
  }
}

export function buildCustomerUpdatePayload(
  existing: CustomerMatchRow,
  identity: NormalizedCustomerIdentity
) {
  const payload: Partial<CustomerMatchRow> = {}

  if (!existing.first_name && identity.firstName) {
    payload.first_name = identity.firstName
  }

  if (!existing.last_name && identity.lastName) {
    payload.last_name = identity.lastName
  }

  if (identity.normalizedEmail && existing.email !== identity.normalizedEmail) {
    payload.email = identity.normalizedEmail
  }

  if (identity.normalizedPhone && existing.phone !== identity.normalizedPhone) {
    payload.phone = identity.normalizedPhone
  }

  return payload
}
