// app/book/page.tsx
// Legacy route — redirects to slug-based booking.
// All bookings now go through /book/[slug].
import { redirect } from 'next/navigation'

export default function BookPage() {
  redirect('/book/demo-plumbing')
}
