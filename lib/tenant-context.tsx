'use client'

// lib/tenant-context.tsx
import { createContext, useContext, ReactNode, useState, useCallback } from 'react'
import { type Tenant, type TenantFeatures, DEFAULT_FEATURES } from './tenant'

type TenantContextValue = {
  tenant:     Tenant | null
  features:   TenantFeatures
  loading:    boolean
  theme:      'dark' | 'light'
  setTheme:   (t: 'dark' | 'light') => void
}

const TenantContext = createContext<TenantContextValue>({
  tenant:   null,
  features: DEFAULT_FEATURES,
  loading:  true,
  theme:    'dark',
  setTheme: () => {},
})

export function TenantProvider({
  children,
  tenant,
  loading,
  initialTheme = 'dark',
  onThemeChange,
}: {
  children:      ReactNode
  tenant:        Tenant | null
  loading:       boolean
  initialTheme?: 'dark' | 'light'
  onThemeChange?: (t: 'dark' | 'light') => void
}) {
  const [theme, setThemeState] = useState<'dark' | 'light'>(initialTheme)

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t)
    onThemeChange?.(t)
  }, [onThemeChange])

  return (
    <TenantContext.Provider value={{
      tenant,
      features: tenant?.features ?? DEFAULT_FEATURES,
      loading,
      theme,
      setTheme,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
