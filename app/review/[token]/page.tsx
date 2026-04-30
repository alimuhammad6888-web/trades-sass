'use client'

import { useEffect, useState } from 'react'

type ReviewData = {
  tenantName: string
  googleReviewUrl: string | null
  yelpReviewUrl: string | null
  expired: boolean
}

type SubmitResult = {
  success: boolean
  isPositive: boolean
  googleReviewUrl: string | null
  yelpReviewUrl: string | null
}

export default function ReviewPage({
  params,
}: {
  params: { token: string }
}) {
  const token = params.token

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      const res = await fetch(`/api/review/${token}`)
      const payload = await res.json().catch(() => null)

      if (!mounted) return

      if (res.status === 410) {
        setExpired(true)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(payload?.error ?? 'Failed to load review page.')
        setLoading(false)
        return
      }

      setReviewData(payload)
      setLoading(false)
    }

    load()

    return () => {
      mounted = false
    }
  }, [token])

  async function submitReview() {
    if (!rating || submitting) return

    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/review/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating,
        feedback_text: feedbackText.trim() || undefined,
      }),
    })

    const payload = await res.json().catch(() => null)

    if (res.status === 410) {
      setExpired(true)
      setSubmitting(false)
      return
    }

    if (!res.ok) {
      setError(payload?.error ?? 'Failed to submit feedback.')
      setSubmitting(false)
      return
    }

    setSubmitted(payload)
    setSubmitting(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f2ee',
        fontFamily: 'sans-serif',
        padding: '20px 16px 40px',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e8e4dc',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '18px 20px',
              background: '#1a1917',
              borderBottom: '3px solid #F4C300',
            }}
          >
            <div
              style={{
                color: '#F4C300',
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              Customer Feedback
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {loading && (
              <div style={{ fontSize: '14px', color: '#6b665f' }}>Loading…</div>
            )}

            {!loading && expired && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#fdf0ef',
                  border: '1px solid #f2c8c5',
                  color: '#8c2820',
                  fontSize: '13px',
                }}
              >
                This review link has expired.
              </div>
            )}

            {!loading && !expired && error && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#fdf0ef',
                  border: '1px solid #f2c8c5',
                  color: '#8c2820',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            {!loading && !expired && reviewData && !submitted && (
              <>
                <div style={{ marginBottom: '18px' }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: '24px',
                      lineHeight: 1.2,
                      color: '#1a1917',
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                    }}
                  >
                    How was your experience with {reviewData.tenantName}?
                  </h1>
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: '13px',
                      lineHeight: 1.6,
                      color: '#6b665f',
                    }}
                  >
                    Your feedback helps the business improve and deliver a better experience.
                  </p>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#9a9590',
                      marginBottom: '8px',
                    }}
                  >
                    Rating
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        onClick={() => setRating(value)}
                        type="button"
                        style={{
                          minWidth: '48px',
                          padding: '10px 0',
                          borderRadius: '8px',
                          border: rating === value ? '1px solid #1a1917' : '1px solid #d8d3ca',
                          background: rating === value ? '#1a1917' : '#fff',
                          color: rating === value ? '#fff' : '#1a1917',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#9a9590',
                      marginBottom: '8px',
                    }}
                  >
                    Feedback
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    rows={5}
                    placeholder="Tell us a little more about your experience…"
                    style={{
                      width: '100%',
                      padding: '14px',
                      border: '1px solid #d8d3ca',
                      borderRadius: '8px',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      color: '#1a1917',
                      fontFamily: 'sans-serif',
                    }}
                  />
                </div>

                <button
                  onClick={submitReview}
                  disabled={!rating || submitting}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1a1917',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: !rating || submitting ? 'not-allowed' : 'pointer',
                    opacity: !rating || submitting ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit feedback'}
                </button>
              </>
            )}

            {!loading && !expired && submitted && (
              <>
                <div style={{ marginBottom: '18px' }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: '24px',
                      lineHeight: 1.2,
                      color: '#1a1917',
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                    }}
                  >
                    Thank you for your feedback.
                  </h1>
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: '13px',
                      lineHeight: 1.6,
                      color: '#6b665f',
                    }}
                  >
                    {submitted.isPositive
                      ? 'We appreciate you taking the time to share your experience.'
                      : 'We appreciate the feedback. The business may follow up.'}
                  </p>
                </div>

                {submitted.isPositive && (submitted.googleReviewUrl || submitted.yelpReviewUrl) && (
                  <div
                    style={{
                      border: '1px solid #e8e4dc',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #e8e4dc',
                        background: '#f8f6f1',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1a1917',
                      }}
                    >
                      Share your review publicly
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      {submitted.googleReviewUrl && (
                        <a
                          href={submitted.googleReviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'block',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            background: '#1a1917',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        >
                          Leave a Google review
                        </a>
                      )}

                      {submitted.yelpReviewUrl && (
                        <a
                          href={submitted.yelpReviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'block',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            border: '1px solid #d8d3ca',
                            color: '#1a1917',
                            fontSize: '14px',
                            fontWeight: 700,
                            textAlign: 'center',
                            background: '#fff',
                          }}
                        >
                          Leave a Yelp review
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
