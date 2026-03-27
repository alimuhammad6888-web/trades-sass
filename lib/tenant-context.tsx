'use client'

// lib/tenant-context.tsx
import { createContext, useContext, ReactNode } from 'react'
import { type Tenant, type TenantFeatures, DEFAULT_FEATURES } from './tenant'

type TenantContextValue = {
  tenant:   Tenant | null
  features: TenantFeatures
  loading:  boolean
}

const TenantContext = createContext<TenantContextValue>({
  tenant:   null,
  features: DEFAULT_FEATURES,
  loading:  true,
})

export function TenantProvider({
  children, tenant, loading,
}: {
  children: ReactNode
  tenant:   Tenant | null
  loading:  boolean
}) {
  return (
    <TenantContext.Provider value={{ tenant, features: tenant?.features ?? DEFAULT_FEATURES, loading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
