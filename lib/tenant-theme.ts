type TenantThemeSettings = {
  primary_color?: string | null
  accent_color?: string | null
  bg_color?: string | null
  text_color?: string | null
}

type TenantThemeOptions = {
  fallbackBg?: string
  bgSurfaceAmount?: number
  bgCardAmount?: number
  bgDeepAmount?: number
  bgBorderAmount?: number
  textMutedAmount?: number
}

export function adjustHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export function getTenantTheme(settings?: TenantThemeSettings | null, options: TenantThemeOptions = {}) {
  const brand = settings?.primary_color || '#F4C300'
  const accent = settings?.accent_color || brand
  const bg = settings?.bg_color || options.fallbackBg || '#0a0a0a'
  const text = settings?.text_color || '#ffffff'

  const bgSurface = adjustHex(bg, options.bgSurfaceAmount ?? 8)
  const bgCard = adjustHex(bg, options.bgCardAmount ?? 8)
  const bgDeep = adjustHex(bg, options.bgDeepAmount ?? -4)
  const bgBorder = adjustHex(bg, options.bgBorderAmount ?? 20)
  const textMuted = adjustHex(text, options.textMutedAmount ?? -120)

  return {
    brand,
    accent,
    bg,
    text,
    textColor: text,
    bgSurface,
    bgCard,
    bgDeep,
    bgBorder,
    textMuted,
  }
}
