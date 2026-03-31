// app/page.tsx
// Root landing — redirects to the demo tenant's public site.
// In production, this would be a marketing page or tenant picker.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/t/demo-plumbing')
}
