// lib/services.ts
// Central factory for all external service clients.
// Automatically uses mock servers when USE_MOCK_* env vars are set.
// This means you never change business logic code to switch between
// real and mock — just flip an env var.

import OpenAI from 'openai'
import twilio from 'twilio'
import { Resend } from 'resend'

const MOCK_BASE = 'http://localhost:3001'

// ── OpenAI ────────────────────────────────────────────────────
// When USE_MOCK_AI=true, all calls hit the local mock server.

export function getOpenAI(): OpenAI {
  if (process.env.USE_MOCK_AI === 'true') {
    return new OpenAI({
      apiKey:  'mock-key',
      baseURL: `${MOCK_BASE}/v1`,
    })
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ── Twilio SMS ────────────────────────────────────────────────

export function getTwilio() {
  if (process.env.USE_MOCK_SMS === 'true') {
    // Return a lightweight mock that mirrors the Twilio API shape
    return {
      messages: {
        create: async (params: { to: string; from: string; body: string }) => {
          const res = await fetch(
            `${MOCK_BASE}/2010-04-01/Accounts/MOCK/Messages`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(params).toString(),
            }
          )
          return res.json()
        },
      },
    }
  }
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

export const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? '+15550000000'

// ── Resend email ──────────────────────────────────────────────

export function getResend() {
  if (process.env.USE_MOCK_EMAIL === 'true') {
    return {
      emails: {
        send: async (params: any) => {
          await fetch(`${MOCK_BASE}/emails`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(params),
          })
          return { id: `mock-${Date.now()}` }
        },
      },
      batch: {
        send: async (emails: any[]) => {
          await Promise.all(emails.map(e =>
            fetch(`${MOCK_BASE}/emails`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(e),
            })
          ))
          return { data: emails.map((_, i) => ({ id: `mock-${i}` })) }
        },
      },
    }
  }
  return new Resend(process.env.RESEND_API_KEY)
}
