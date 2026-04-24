# AGENTS.md

## Project Overview
Multi-tenant SaaS for trades businesses (Next.js App Router, Supabase, Stripe).

## Core Architecture Rules
- Public pages (/t/[slug], /book/[slug], /contact/[slug]) must be Server Components
- Client components are only for interactivity (forms, state)
- Never perform tenant lookup client-side
- Always resolve tenant server-side using SUPABASE_SERVICE_ROLE_KEY

## Data & Safety Rules
- Do not modify database schema unless explicitly asked
- Do not change billing or Stripe logic without explicit instruction
- Do not introduce breaking changes to booking flow
- Always preserve existing API routes

## UI Rules
- Reuse existing styling patterns from lib/tenant-theme.ts
- Do not duplicate components or links
- Replace existing elements instead of adding duplicates

## Git & Workflow Rules
- Always confirm current branch before changes
- Do not switch branches unless instructed
- Prefer minimal, safe diffs
- Never delete large files without showing full replacement

## Output Rules
- Return full files for major changes
- Be explicit about created vs modified files
- Avoid partial patches for critical routes

## Priority
- Stability > correctness > optimization