// scripts/create-demo-user.js
// Creates a demo owner account linked to the seed tenant.
// Run after: supabase db reset
// Usage: node scripts/create-demo-user.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111'
const DEMO_EMAIL     = 'owner@demo.com'
const DEMO_PASSWORD  = 'Demo1234!'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', DEMO_EMAIL)
    .maybeSingle()

  if (existing) {
    console.log('✓ Demo user already exists — login with:', DEMO_EMAIL, '/', DEMO_PASSWORD)
    return
  }

  // Create auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email:          DEMO_EMAIL,
    password:       DEMO_PASSWORD,
    email_confirm:  true,    // skip email confirmation for local dev
    user_metadata: {
      tenant_id:  DEMO_TENANT_ID,
      role:       'owner',
      first_name: 'Joe',
      last_name:  'Demo',
    },
  })

  if (authErr) {
    console.error('✗ Failed to create auth user:', authErr.message)
    process.exit(1)
  }

  console.log('✓ Demo user created')
  console.log('  Email:    ', DEMO_EMAIL)
  console.log('  Password: ', DEMO_PASSWORD)
  console.log('  Role:      owner')
  console.log('  Tenant:    Joe\'s Plumbing & HVAC (demo)')

  // The handle_new_user trigger fires automatically and creates
  // the users table row from the metadata above.
  // Verify it worked:
  await new Promise(r => setTimeout(r, 500))
  const { data: userRow } = await supabase
    .from('users')
    .select('id, role, tenant_id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (userRow) {
    console.log('✓ users table row created (role:', userRow.role + ')')
  } else {
    // Fallback: create manually if trigger didn't fire
    await supabase.from('users').insert({
      tenant_id:    DEMO_TENANT_ID,
      auth_user_id: authData.user.id,
      role:         'owner',
      first_name:   'Joe',
      last_name:    'Demo',
      email:        DEMO_EMAIL,
    })
    console.log('✓ users table row created manually')
  }
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
