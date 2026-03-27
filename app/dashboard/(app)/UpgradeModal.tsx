'use client'

type Props = {
  feature:  string
  plan:     string
  onClose:  () => void
}

const FEATURE_INFO: Record<string, { title: string; desc: string; requiredPlan: string }> = {
  chatbot:       { title: 'AI Chatbot',       desc: 'Capture leads 24/7 with an AI assistant that books appointments automatically.',    requiredPlan: 'pro' },
  sms:           { title: 'SMS Notifications', desc: 'Send automated booking confirmations, reminders, and follow-ups via text.',        requiredPlan: 'pro' },
  campaigns:     { title: 'Email Campaigns',   desc: 'Send promotional emails and social media posts to your customer list.',            requiredPlan: 'pro' },
  inbox:         { title: 'Unified Inbox',     desc: 'Manage all customer emails in one place, linked to bookings and customer records.', requiredPlan: 'pro' },
  custom_domain: { title: 'Custom Domain',     desc: 'Use your own domain like book.yourbusiness.com instead of a shared URL.',         requiredPlan: 'enterprise' },
}

const PLAN_PRICES: Record<string, { price: string; features: string[] }> = {
  pro: {
    price: '$99/month',
    features: ['AI chatbot & lead capture', 'SMS confirmations & reminders', 'Email campaigns', 'Unified inbox', 'Unlimited bookings', 'Priority support'],
  },
  enterprise: {
    price: '$249/month',
    features: ['Everything in Pro', 'Custom domain', 'White-label branding', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'],
  },
}

export default function UpgradeModal({ feature, plan, onClose }: Props) {
  const info      = FEATURE_INFO[feature] ?? { title: feature, desc: 'Upgrade to unlock this feature.', requiredPlan: 'pro' }
  const planInfo  = PLAN_PRICES[info.requiredPlan] ?? PLAN_PRICES.pro
  const isPro     = info.requiredPlan === 'pro'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'12px', padding:'32px', maxWidth:'420px', width:'100%', position:'relative' }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#9a9590', lineHeight:1 }}>×</button>

        {/* Badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'4px 12px', background: isPro ? '#fef4e0' : '#eef4fb', borderRadius:'20px', marginBottom:'16px' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color: isPro ? '#9a5c10' : '#1e4d8c', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {isPro ? 'Pro' : 'Enterprise'} feature
          </span>
        </div>

        <h2 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'8px' }}>
          {info.title}
        </h2>
        <p style={{ fontSize:'14px', color:'#9a9590', lineHeight:1.6, marginBottom:'20px' }}>
          {info.desc}
        </p>

        {/* Plan card */}
        <div style={{ background:'#f8f6f1', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'16px', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'12px' }}>
            <span style={{ fontFamily:'Georgia, serif', fontSize:'18px', fontStyle:'italic', color:'#1a1917' }}>
              {isPro ? 'Pro plan' : 'Enterprise plan'}
            </span>
            <span style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917', fontWeight:500 }}>
              {planInfo.price}
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {planInfo.features.map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#4a4843' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#1a6b4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => { alert('Billing coming soon — contact us to upgrade!'); onClose() }}
          style={{ width:'100%', padding:'12px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'15px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', marginBottom:'10px' }}>
          Upgrade to {isPro ? 'Pro' : 'Enterprise'}
        </button>
        <button onClick={onClose}
          style={{ width:'100%', padding:'10px', background:'transparent', color:'#9a9590', border:'none', cursor:'pointer', fontSize:'13px', fontFamily:'sans-serif' }}>
          Maybe later
        </button>
      </div>
    </div>
  )
}
