const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const slug = 'bigboss-electric'

const targets = [
  `/t/${slug}`,
  `/book/${slug}`,
  `/contact/${slug}`,
]

async function ping(path) {
  const started = performance.now()

  try {
    const response = await fetch(new URL(path, baseUrl), {
      redirect: 'manual',
    })

    const durationMs = Math.round(performance.now() - started)
    console.log(`${response.status} ${path} ${durationMs}ms`)
  } catch (error) {
    const durationMs = Math.round(performance.now() - started)
    const message = error instanceof Error ? error.message : String(error)
    console.log(`ERR ${path} ${durationMs}ms ${message}`)
    process.exitCode = 1
  }
}

console.log(`Smoke test base URL: ${baseUrl}`)
console.log(`Smoke test slug: ${slug}`)

for (const target of targets) {
  await ping(target)
}
