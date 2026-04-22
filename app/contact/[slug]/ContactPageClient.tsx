"use client";

import { FormEvent, useState } from "react";

type Branding = {
  tenantId: string;
  slug: string;
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
  bgColor: string;
  textColor: string;
};

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  message: string;
};

const initialForm: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  message: "",
};

const DEFAULT_CARD = "#ffffff";
const DEFAULT_MUTED = "#6b7280";
const DEFAULT_BORDER = "#e5e7eb";
const DEFAULT_INPUT_TEXT = "#111827";

function hexToRgb(hex: string) {
  const normalized = hex.trim();
  const clean = normalized.startsWith("#") ? normalized.slice(1) : normalized;

  if (clean.length !== 6) return null;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  return `${r}, ${g}, ${b}`;
}

export default function ContactPageClient({
  branding,
}: {
  branding: Branding;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryRgb = hexToRgb(branding.primaryColor);

  const brandStyle = {
    "--brand": branding.primaryColor,
    "--brand-rgb": primaryRgb ?? "37, 99, 235",
    "--page-bg": branding.bgColor,
    "--page-text": branding.textColor,
    "--card-bg": DEFAULT_CARD,
    "--muted": DEFAULT_MUTED,
    "--border": DEFAULT_BORDER,
  } as React.CSSProperties;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: branding.slug, ...form }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      setForm(initialForm);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{
          ...brandStyle,
          backgroundColor: "var(--page-bg)",
          color: "var(--page-text)",
        }}
      >
        <TenantHeader
          tenantName={branding.tenantName}
          logoUrl={branding.logoUrl}
        />

        <div
          className="rounded-2xl shadow-sm p-8 max-w-md w-full text-center"
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(var(--brand-rgb), 0.12)" }}
          >
            <svg
              className="w-6 h-6"
              style={{ color: "var(--brand)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold mb-2">Message sent!</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            We received your message and will be in touch shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        ...brandStyle,
        backgroundColor: "var(--page-bg)",
        color: "var(--page-text)",
      }}
    >
      <TenantHeader
        tenantName={branding.tenantName}
        logoUrl={branding.logoUrl}
      />

      <div
        className="rounded-2xl shadow-sm p-8 max-w-lg w-full"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border)",
        }}
      >
        <h1 className="text-2xl font-semibold mb-1">Contact Us</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Fill out the form below and we&apos;ll get back to you as soon as
          possible.
        </p>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="first_name"
                className="block text-sm font-medium mb-1"
              >
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                autoComplete="given-name"
                value={form.first_name}
                onChange={handleChange}
                className="brand-input w-full rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none"
                style={{
                  backgroundColor: "#fff",
                  color: DEFAULT_INPUT_TEXT,
                  border: "1px solid var(--border)",
                }}
                placeholder="Jane"
              />
            </div>

            <div>
              <label
                htmlFor="last_name"
                className="block text-sm font-medium mb-1"
              >
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                autoComplete="family-name"
                value={form.last_name}
                onChange={handleChange}
                className="brand-input w-full rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none"
                style={{
                  backgroundColor: "#fff",
                  color: DEFAULT_INPUT_TEXT,
                  border: "1px solid var(--border)",
                }}
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={handleChange}
              className="brand-input w-full rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none"
              style={{
                backgroundColor: "#fff",
                color: DEFAULT_INPUT_TEXT,
                border: "1px solid var(--border)",
              }}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="brand-input w-full rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none"
              style={{
                backgroundColor: "#fff",
                color: DEFAULT_INPUT_TEXT,
                border: "1px solid var(--border)",
              }}
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              value={form.message}
              onChange={handleChange}
              className="brand-input w-full rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none resize-none"
              style={{
                backgroundColor: "#fff",
                color: DEFAULT_INPUT_TEXT,
                border: "1px solid var(--border)",
              }}
              placeholder="How can we help you?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{
              backgroundColor: "var(--brand)",
            }}
          >
            {loading ? "Sending..." : "Send message"}
          </button>
        </form>
      </div>

      <style>{`
        .brand-input:focus {
          border-color: var(--brand) !important;
          box-shadow: 0 0 0 1px var(--brand);
        }
      `}</style>
    </main>
  );
}

function TenantHeader({
  tenantName,
  logoUrl,
}: {
  tenantName: string;
  logoUrl: string | null;
}) {
  return (
    <div className="flex flex-col items-center mb-6">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={tenantName}
          className="h-10 object-contain mb-2"
        />
      ) : (
        <div
          className="h-10 px-4 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: "rgba(var(--brand-rgb), 0.1)" }}
        >
          <span
            className="text-base font-bold tracking-tight"
            style={{ color: "var(--brand)" }}
          >
            {tenantName}
          </span>
        </div>
      )}
    </div>
  );
}