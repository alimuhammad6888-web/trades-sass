import { expect, test } from '@playwright/test'

const DEMO_SLUG = 'bigboss-electric'

test.describe('/api/inbox/inquiry', () => {
  test('returns success for a valid payload', async ({ request }) => {
    const now = Date.now()

    const response = await request.post('/api/inbox/inquiry', {
      data: {
        slug: DEMO_SLUG,
        first_name: 'E2E',
        last_name: 'Tester',
        phone: `555000${String(now).slice(-4)}`,
        email: `e2e-${now}@example.com`,
        message: 'This is a Playwright validation inquiry.',
      },
    })

    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.thread_id).toBeTruthy()
    expect(body.customer_id).toBeTruthy()
  })

  test('fails for an invalid payload', async ({ request }) => {
    const response = await request.post('/api/inbox/inquiry', {
      data: {
        slug: DEMO_SLUG,
        first_name: 'Only',
      },
    })

    expect(response.status()).toBe(400)

    const body = await response.json()
    expect(body.error).toMatch(/required|missing/i)
  })
})
