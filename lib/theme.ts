// lib/theme.ts
// Shared theme tokens for all dashboard pages.
// Usage: const T = useThemeTokens()

import { useTenant } from './tenant-context'

export type ThemeTokens = {
  bg:        string
  card:      string
  border:    string
  hover:     string
  divider:   string
  t1:        string  // primary text
  t2:        string  // secondary text
  t3:        string  // muted text
  label:     string  // section labels
  input:     string  // input background
  inputBorder: string
  isDark:    boolean
}

export function useThemeTokens(): ThemeTokens {
  const { theme } = useTenant()
  const dark = theme === 'dark'

  return dark ? {
    bg:          '#0f0f0f',
    card:        '#161616',
    border:      '#2e2e2e',
    hover:       '#1e1e1e',
    divider:     '#1e1e1e',
    t1:          '#ffffff',
    t2:          '#cccccc',
    t3:          '#aaaaaa',
    label:       '#888888',
    input:       '#111111',
    inputBorder: '#2e2e2e',
    isDark:      true,
  } : {
    bg:          '#f4f2ee',
    card:        '#ffffff',
    border:      '#e8e4dc',
    hover:       '#fafafa',
    divider:     '#f0ede6',
    t1:          '#1a1917',
    t2:          '#4a4843',
    t3:          '#9a9590',
    label:       '#9a9590',
    input:       '#ffffff',
    inputBorder: '#e8e4dc',
    isDark:      false,
  }
}
