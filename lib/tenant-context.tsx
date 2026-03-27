'use client'

// lib/tenant-context.tsx
import { createContext, useContext, ReactNode } from 'react'
import { type Tenant, type TenantFeatures, DEFAULT_FEATURES } from './tenant'

type TenantContextValue = {
  tenant:   Tenant | null
  features: TenantFeatures
  loading:  boolean
  theme:    'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
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
  theme,
  setTheme,
}: {
  children: ReactNode
  tenant:   Tenant | null
  loading:  boolean
  theme:    'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
}) {
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
