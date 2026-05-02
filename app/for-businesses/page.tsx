import Link from 'next/link'

const FEATURES = [
  {
    title: 'Booking website',
    body: 'Give customers a clean online booking flow with your services, hours, and branding in one place.',
  },
  {
    title: 'CRM and customers',
    body: 'Keep customer details, history, and follow-up context organized so your team can move faster.',
  },
  {
    title: 'Inbox',
    body: 'Bring customer conversations into one workspace instead of juggling messages across tools.',
  },
  {
    title: 'Review funnel',
    body: 'Turn completed jobs into review opportunities with a more consistent follow-up system.',
  },
  {
    title: 'Campaigns',
    body: 'Reach past customers with targeted email campaigns when you have openings, promos, or seasonal pushes.',
  },
  {
    title: 'Booking payments',
    body: 'Prepare your business to accept booking payments through your own Stripe-connected account.',
  },
] as const

export default function ForBusinessesPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1115',
        color: '#f5f7fb',
        fontFamily: 'sans-serif',
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          .for-businesses-hero,
          .for-businesses-features {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <div
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '32px 20px 72px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '48px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f4c300' }}>
            TradesSaaS
          </div>
          <Link
            href="/onboarding"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#f4c300',
              color: '#0f1115',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            Start onboarding
          </Link>
        </div>

        <div
          className="for-businesses-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
            gap: '24px',
            alignItems: 'stretch',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              padding: '36px',
              borderRadius: '16px',
              background: '#171b22',
              border: '1px solid #252b35',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8ea0b8', marginBottom: '14px' }}>
              Built for trades businesses
            </div>
            <h1
              style={{
                margin: '0 0 16px',
                fontSize: '44px',
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: 0,
              }}
            >
              Launch a booking, CRM, and follow-up system that actually fits the field.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '16px',
                lineHeight: 1.7,
                color: '#b9c4d4',
                maxWidth: '58ch',
              }}
            >
              Tell us about your business, your services, and the setup you need. We&apos;ll review the request, prepare your account, and send the owner a secure setup link later.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                marginTop: '28px',
              }}
            >
              <Link
                href="/onboarding"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  background: '#f4c300',
                  color: '#0f1115',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                Request setup
              </Link>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #2a313d',
                  color: '#b9c4d4',
                  fontSize: '14px',
                }}
              >
                No password collected on the intake form
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '24px',
              borderRadius: '16px',
              background: '#11151b',
              border: '1px solid #252b35',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8ea0b8' }}>
              What happens next
            </div>
            {[
              'Submit your business details and the setup you want.',
              'We review the request and prepare your business account.',
              'If approved, we’ll email you a secure account setup link.',
            ].map((step, index) => (
              <div
                key={step}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    background: '#f4c300',
                    color: '#0f1115',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.7, color: '#d8e0ec' }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="for-businesses-features"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          }}
        >
          {FEATURES.map(feature => (
            <div
              key={feature.title}
              style={{
                padding: '22px',
                borderRadius: '14px',
                background: '#171b22',
                border: '1px solid #252b35',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f5f7fb', marginBottom: '10px' }}>
                {feature.title}
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.7, color: '#b9c4d4' }}>
                {feature.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
