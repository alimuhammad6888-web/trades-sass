import twilio from 'twilio'
import { NextRequest, NextResponse } from 'next/server'

type VerifyTwilioWebhookArgs = {
  req: NextRequest
  formData: FormData
  pathname: string
}

function getWebhookBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  return req.nextUrl.origin.replace(/\/+$/, '')
}

function formDataToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  )
}

export function verifyTwilioWebhook({
  req,
  formData,
  pathname,
}: VerifyTwilioWebhookArgs): NextResponse | null {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get('x-twilio-signature')

  if (!authToken) {
    console.error('[twilio/webhook] missing TWILIO_AUTH_TOKEN')
    return new NextResponse('Twilio auth token is not configured.', { status: 500 })
  }

  if (!signature) {
    console.error('[twilio/webhook] missing x-twilio-signature header')
    return new NextResponse('Invalid Twilio signature.', { status: 403 })
  }

  const url = `${getWebhookBaseUrl(req)}${pathname}`
  const params = formDataToObject(formData)
  const isValid = twilio.validateRequest(authToken, signature, url, params)

  if (isValid) return null

  console.error('[twilio/webhook] signature validation failed:', { pathname, url })
  return new NextResponse('Invalid Twilio signature.', { status: 403 })
}
