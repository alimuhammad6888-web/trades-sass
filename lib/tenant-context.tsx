'use client'

// lib/tenant-context.tsx
import { createContext, useContext, ReactNode } from 'react'
import { type BillingRecord } from './billing'
import { type Tenant, type TenantFeatures, DEFAULT_FEATURES } from './tenant'

type TenantContextValue = {
  tenant:   Tenant | null
  billing:  BillingRecord | null
  features: TenantFeatures
  loading:  boolean
  theme:    'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
}

const TenantContext = createContext<TenantContextValue>({
  tenant:   null,
  billing:  null,
  features: DEFAULT_FEATURES,
  loading:  true,
  theme:    'dark',
  setTheme: () => {},
})

export function TenantProvider({
  children,
  tenant,
  billing,
  loading,
  theme,
  setTheme,
}: {
  children: ReactNode
  tenant:   Tenant | null
  billing:  BillingRecord | null
  loading:  boolean
  theme:    'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
}) {
  return (
    <TenantContext.Provider value={{
      tenant,
      billing,
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
