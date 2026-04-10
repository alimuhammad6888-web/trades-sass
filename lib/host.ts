// lib/host.ts
// Shared hostname → tenant slug parser.
// Used by middleware (server) and the client-side tenant resolver.

const DEV_DEFAULT_SLUG = 'demo-plumbing'

/**
 * Resolve a tenant slug from a hostname.
 *
 * Rules:
 *  - localhost / 127.0.0.1 / *.local → use ?tenant= query param or dev default
 *  - *.vercel.app (preview/prod-on-vercel default domain) → use ?tenant= or null
 *  - Real domain with subdomain (sub.example.com) → return 'sub' (ignore 'www')
 *  - Bare apex domain (example.com) → use ?tenant= or null
 *
 * Never returns an empty string; returns null when no slug can be determined.
 */
export function slugFromHost(
  host: string | null | undefined,
  searchParam?: string | null,
): string | null {
  const param = searchParam && searchParam.trim() ? searchParam.trim() : null
  if (!host) return param

  const bare = host.split(':')[0].toLowerCase()

  const isLocal =
    bare === 'localhost' ||
    bare === '127.0.0.1' ||
    bare === '0.0.0.0' ||
    bare.endsWith('.local')

  if (isLocal) return param ?? DEV_DEFAULT_SLUG

  // Vercel's shared *.vercel.app domain is not a tenant subdomain —
  // only trust the ?tenant= param there.
  if (bare === 'vercel.app' || bare.endsWith('.vercel.app')) {
    return param
  }

  const parts = bare.split('.')
  // Bare apex (example.com) — no tenant in hostname
  if (parts.length < 3) return param

  const sub = parts[0]
  if (!sub || sub === 'www') return param
  return sub
}

export { DEV_DEFAULT_SLUG }
