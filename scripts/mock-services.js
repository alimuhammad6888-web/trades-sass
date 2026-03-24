// scripts/mock-services.js
// Run alongside Next.js for local dev without real API keys.
// Usage: node scripts/mock-services.js
// Then set USE_MOCK_AI=true, USE_MOCK_SMS=true in .env.local

const http = require('http')

const MOCK_AI_RESPONSES = [
  "Hi there! I'd be happy to help you schedule a service. Could I get your name and phone number?",
  "Thanks! And what service are you looking for — plumbing, HVAC, or something else?",
  "Got it! I've noted your details. A team member will call you back within 2 hours to confirm your appointment.",
  "We offer drain clearing ($99), water heater service ($299), leak detection ($149), and HVAC tune-ups ($89). Which sounds right for you?",
  "Our hours are Monday–Friday 8am–5pm and Saturday 9am–1pm. Would any of those times work for you?",
]

let aiCallCount = 0

const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Mock OpenAI chat completions
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      const reply = MOCK_AI_RESPONSES[aiCallCount % MOCK_AI_RESPONSES.length]
      aiCallCount++

      // Simulate lead capture on 3rd message
      const content = aiCallCount % 3 === 0
        ? `${reply} [LEAD:{"name":"Test Customer","phone":"(555) 000-1234","service":"Drain Clearing"}]`
        : reply

      res.writeHead(200)
      res.end(JSON.stringify({
        id: `mock-${Date.now()}`,
        choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }))
      console.log(`[mock-ai] → "${reply.slice(0, 60)}..."`)
      return
    }

    // Mock Twilio SMS
    if (req.url?.includes('/Messages') && req.method === 'POST') {
      const sid = `SM${Math.random().toString(36).slice(2, 18).toUpperCase()}`
      res.writeHead(201)
      res.end(JSON.stringify({ sid, status: 'queued', price: '0' }))
      try {
        const params = new URLSearchParams(body)
        console.log(`[mock-sms] → To: ${params.get('To')} | "${params.get('Body')?.slice(0, 60)}..."`)
      } catch {}
      return
    }

    // Mock Resend email
    if (req.url === '/emails' && req.method === 'POST') {
      const id = `mock-email-${Date.now()}`
      res.writeHead(200)
      res.end(JSON.stringify({ id }))
      try {
        const data = JSON.parse(body)
        console.log(`[mock-email] → To: ${data.to} | Subject: "${data.subject}"`)
      } catch {}
      return
    }

    res.writeHead(404)
    res.end(JSON.stringify({ error: 'mock route not found', url: req.url }))
  })
})

server.listen(3001, () => {
  console.log('\n✓ Mock services running on http://localhost:3001')
  console.log('  → OpenAI:  POST /v1/chat/completions')
  console.log('  → Twilio:  POST /2010-04-01/Accounts/.../Messages')
  console.log('  → Resend:  POST /emails')
  console.log('\nSet in .env.local:')
  console.log('  USE_MOCK_AI=true')
  console.log('  USE_MOCK_SMS=true')
  console.log('  USE_MOCK_EMAIL=true\n')
})
