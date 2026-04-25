import { expect, test } from '@playwright/test'

const DEMO_SLUG = 'bigboss-electric'

test.describe('public pages', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto(`/t/${DEMO_SLUG}`)

    await expect(page).toHaveURL(new RegExp(`/t/${DEMO_SLUG}$`))
    await expect(page.locator('body')).toContainText(/book now/i)
  })

  test('booking page loads', async ({ page }) => {
    await page.goto(`/book/${DEMO_SLUG}`)

    await expect(page).toHaveURL(new RegExp(`/book/${DEMO_SLUG}$`))
    await expect(page.locator('body')).toContainText(/book now|select a service|choose a service/i)
  })

  test('contact page loads', async ({ page }) => {
    await page.goto(`/contact/${DEMO_SLUG}`)

    await expect(page).toHaveURL(new RegExp(`/contact/${DEMO_SLUG}$`))
    await expect(page.locator('body')).toContainText(/send message|fill out the form/i)
  })

  test('navigation between public pages works', async ({ page }) => {
    await page.goto(`/t/${DEMO_SLUG}`)

    await page.getByRole('link', { name: /contact us/i }).click()
    await expect(page).toHaveURL(new RegExp(`/contact/${DEMO_SLUG}$`))

    await page.getByRole('link', { name: /book now/i }).click()
    await expect(page).toHaveURL(new RegExp(`/book/${DEMO_SLUG}$`))

    await page.locator('a.booking-nav-logo').click()
    await expect(page).toHaveURL(new RegExp(`/t/${DEMO_SLUG}$`))
  })
})
