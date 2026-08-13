'use client';

import { useEffect, useRef, useState } from 'react';
import { PLATFORMS, PRESET_COLORS, STEPS } from '@/configs/constants';
import type { GenerateResponse, Platform } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { AppPreview } from '@/components/feature/AppPreview';
import { DefaultApps } from '@/components/feature/DefaultApps';

/** Rich, type-aware error banner so rate limits are clear, not confusing. */
function ErrorBanner({ data, onSwitchPlatform }: { data: GenerateResponse; onSwitchPlatform: () => void }) {
  const platformLabel =
    data.blockedPlatform === 'windows' ? 'Windows' : data.blockedPlatform === 'android' ? 'Android' : 'this platform';
  const otherLabel = data.blockedPlatform === 'windows' ? 'Android' : data.blockedPlatform === 'android' ? 'Windows' : 'another platform';

  if (data.code === 'EMAIL_LIMIT') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-5">⏰</span>
          <div>
            <p className="font-semibold">Daily limit reached for this email</p>
            <p className="mt-0.5 text-amber-800">
              {data.message}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSwitchPlatform}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
                Switch to {otherLabel}
              </button>
              <a
                href="/status"
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                Check existing builds
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.code === 'IP_LIMIT') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-5">🛡️</span>
          <div>
            <p className="font-semibold">Too many builds from your network</p>
            <p className="mt-0.5 text-amber-800">{data.message}</p>
            {typeof data.retryAfterMin === 'number' ? (
              <p className="mt-1 text-xs text-amber-600">Try again in about {data.retryAfterMin} minute{data.retryAfterMin > 1 ? 's' : ''}.</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (data.code === 'INVALID_EMAIL') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>📧</span>
        <div>
          <p className="font-semibold">This email can't receive mail</p>
          <p className="mt-0.5">{data.message} We need a working address to send your download link.</p>
        </div>
      </div>
    );
  }

  if (data.code === 'OTP_INVALID' || data.code === 'OTP_EXPIRED' || data.code === 'OTP_LIMIT') {
    const title =
      data.code === 'OTP_EXPIRED'
        ? 'That code expired'
        : data.code === 'OTP_LIMIT'
          ? 'Too many wrong attempts'
          : 'Wrong code';
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>🔑</span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5">
            {data.message}{' '}
            <button
              type="button"
              onClick={() => onSwitchPlatform()} // reuses the reset handler below
              className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-500">
              Request a new code
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (data.code === 'ACTIONS_BUDGET') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-5">⛽</span>
          <div>
            <p className="font-semibold">Builds paused — Actions minutes low</p>
            <p className="mt-0.5">{data.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.code === 'MONTHLY_QUOTA') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-5">📅</span>
          <div>
            <p className="font-semibold">Monthly build budget reached</p>
            <p className="mt-0.5">{data.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // VALIDATION / INTERNAL / unknown
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>⚠️</span> {data.message}
    </div>
  );
}

export function GenerateScreen() {
  const [appName, setAppName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366F1');
  const [secondaryColor, setSecondaryColor] = useState('#64748B');
  const [supportEmail, setSupportEmail] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendIn, setOtpResendIn] = useState(0);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorData, setErrorData] = useState<GenerateResponse | null>(null);
  const [budget, setBudget] = useState<{
    available: boolean;
    reason: 'MONTHLY_QUOTA' | 'ACTIONS_BUDGET' | null;
    month: string;
    builds: { used: number; max: number; remaining: number };
    minutes: { included: number; used: number; remaining: number } | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/quota')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setBudget(d);
      })
      .catch(() => {
        /* badge is optional — form still works */
      });
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  useEffect(() => {
    if (otpResendIn <= 0) {
      if (resendTimer.current) {
        clearInterval(resendTimer.current);
        resendTimer.current = null;
      }
      return;
    }
    if (!resendTimer.current) {
      resendTimer.current = setInterval(() => {
        setOtpResendIn(s => (s > 0 ? s - 1 : 0));
      }, 1000);
    }
  }, [otpResendIn]);

  /** Step 1 — send the 6-digit code to the entered email. */
  async function onSendCode(e: React.MouseEvent) {
    e.preventDefault();
    if (!supportEmail) {
      setError('Enter your email first — we send the verification code there.');
      return;
    }
    setOtpSending(true);
    setError(null);
    setErrorData(null);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supportEmail }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok || !data.ok) {
        setErrorData(data);
        setError(data.message || 'Could not send the code.');
        return;
      }
      setOtpSent(true);
      setOtp('');
      setOtpResendIn(60);
      setError("Code sent! Check your inbox (and spam) — it's valid for 10 minutes.");
    } catch {
      setError('Network error — please try again.');
    } finally {
      setOtpSending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otpSent) {
      setError('Send the verification code to your email first.');
      return;
    }
    setLoading(true);
    setError(null);
    setErrorData(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          primaryColor,
          secondaryColor,
          supportEmail,
          platform,
          otp,
          logoBase64,
        }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok || !data.ok) {
        setErrorData(data);
        setError(data.message || 'Generation failed.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError('Logo must be a PNG or JPEG image.');
      setErrorData(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setLogoPreview(dataUrl);
      setLogoBase64(dataUrl);
      setError(null);
      setErrorData(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              ⚡
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">TGen</p>
              <p className="text-[10px] text-slate-400">App Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/status"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.25a.75.75 0 00-1.5 0v5.19l3.28 1.64a.75.75 0 10.69-1.33l-2.47-1.24V5.75z"
                  clipRule="evenodd"
                />
              </svg>
              Status
            </a>
            <a
              href="/about"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
              About
            </a>
            <a
              href="https://github.com/SatPaingOo/t-github-generate"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <Badge tone="indigo">⚡ Free · GitHub Actions powered</Badge>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Turn a form into a{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              real Android &amp; Windows app
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
            Choose a name, colors and a logo — we build a complete Notes &amp; Todos app for
            you, compile it on GitHub Actions, and email you the download link.
          </p>

          {/* steps */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map(s => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur">
                <p className="text-xs font-bold text-indigo-400">{s.n}</p>
                <p className="mt-1 text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEFAULT APPS ============ */}
      <DefaultApps />

      {/* ============ FORM + PREVIEW ============ */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          {/* FORM */}
          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create your app</h2>
                <p className="mt-1 text-sm text-slate-500">
                  All fields below are applied to the generated app.
                </p>
              </div>
              {budget ? (
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    budget.available
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-600'
                  }`}
                  title={`Build budget ${budget.month} — used ${budget.builds.used} of ${budget.builds.max} builds`}
                >
                  {budget.available
                    ? `${budget.builds.remaining} builds left${budget.minutes ? ` · ${budget.minutes.remaining} min budget` : ''}`
                    : budget.reason === 'ACTIONS_BUDGET'
                      ? 'Builds paused (Actions minutes low)'
                      : 'Monthly budget used'}
                </span>
              ) : null}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              {/* App name */}
              <Field label="App name" hint="Shown on the launcher, title bar and home screen.">
                <TextInput
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  placeholder="My Awesome App"
                  maxLength={40}
                  required
                />
              </Field>

              {/* Email + verification code */}
              <Field label="Email address" hint="We send a verification code here, then the download link.">
                <div className="flex gap-2">
                  <TextInput
                    type="email"
                    value={supportEmail}
                    onChange={e => {
                      setSupportEmail(e.target.value);
                      setOtpSent(false);
                    }}
                    placeholder="you@example.com"
                    className="flex-1"
                    required
                  />
                  <button
                    type="button"
                    onClick={onSendCode}
                    disabled={otpSending || otpResendIn > 0}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50">
                    {otpSending ? 'Sending…' : otpResendIn > 0 ? `Resend in ${otpResendIn}s` : otpSent ? 'Resend code' : 'Send code'}
                  </button>
                </div>
                {otpSent ? (
                  <div className="mt-2 flex gap-2">
                    <TextInput
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      className="w-36 text-center text-lg font-bold tracking-[0.4em]"
                      required
                    />
                    <span className="self-center text-xs text-slate-400">Check your inbox (and spam)</span>
                  </div>
                ) : null}
              </Field>

              {/* Brand colors */}
              <Field label="Brand colors" hint="Primary = buttons & icons · Secondary = header bar & badges.">
                <div className="space-y-3">
                  {/* Primary */}
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Primary</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                      />
                      <TextInput
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        maxLength={7}
                        className="w-28"
                      />
                    </div>
                  </div>
                  {/* Secondary */}
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Secondary</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={e => setSecondaryColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                      />
                      <TextInput
                        value={secondaryColor}
                        onChange={e => setSecondaryColor(e.target.value)}
                        maxLength={7}
                        className="w-28"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`color ${c}`}
                      onClick={() => setPrimaryColor(c)}
                      className={
                        primaryColor === c
                          ? 'h-7 w-7 rounded-full ring-2 ring-indigo-500 ring-offset-2'
                          : 'h-7 w-7 rounded-full transition-transform hover:scale-110'
                      }
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </Field>

              {/* Logo */}
              <Field label="Logo" hint="PNG or JPEG, up to 2 MB — used for the app icon.">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onLogoFile}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50">
                    <span>🖼</span> Choose image
                  </button>
                  {logoPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview}
                        alt="logo preview"
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview(null);
                          setLogoBase64(undefined);
                          if (fileRef.current) fileRef.current.value = '';
                        }}
                        className="text-xs font-medium text-red-500 hover:underline">
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">No logo — we use your color</span>
                  )}
                </div>
              </Field>

              {/* Platform */}
              <Field label="Platform">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => p.available && setPlatform(p.value)}
                      disabled={!p.available}
                      className={
                        platform === p.value
                          ? 'rounded-xl border-2 border-indigo-500 bg-indigo-50 px-3 py-3 text-left transition-colors'
                          : 'rounded-xl border border-slate-200 px-3 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'
                      }>
                      <div className="text-xl">{p.icon}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{p.label}</div>
                      <div className="text-[11px] text-slate-400">{p.desc}</div>
                      <div
                        className={
                          p.available
                            ? 'mt-1.5 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600'
                            : 'mt-1.5 inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400'
                        }>
                        {p.tag}
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Status */}
              {errorData ? (
                <ErrorBanner
                  data={errorData}
                  onSwitchPlatform={() => {
                    setOtpSent(false);
                    setOtp('');
                    setError(null);
                    setErrorData(null);
                  }}
                />
              ) : error ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <span>⚠️</span> {error}
                </div>
              ) : null}
              {result ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">🎉 {result.message}</p>
                  {result.trackingCode ? (
                    <p className="mt-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-xs">
                      🔑 Your tracking code: <span className="font-mono font-bold text-emerald-900">{result.trackingCode}</span>
                      <span className="text-emerald-700"> — keep it with your email to check the build.</span>
                    </p>
                  ) : null}
                  {result.downloadUrl ? (
                    <a
                      href={result.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2">
                      ⬇ Download your app (appears when ready) ↗
                    </a>
                  ) : null}
                  {result.repoUrl ? (
                    <a
                      href={result.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block font-medium text-emerald-600 underline underline-offset-2">
                      View folder {result.repoUrl} ↗
                    </a>
                  ) : null}
                  <a
                    href={`/status?email=${encodeURIComponent(supportEmail)}&code=${encodeURIComponent(result.trackingCode ?? '')}`}
                    className="mt-2 inline-block rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200">
                    📦 Track build status
                  </a>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={loading || budget?.available === false || !otpSent}
                className="w-full">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Building… this takes ~15 min
                  </>
                ) : budget?.available === false ? (
                  budget.reason === 'ACTIONS_BUDGET' ? (
                    <>⛽ Builds paused — minutes low</>
                  ) : (
                    <>📅 Monthly budget used — resume next month</>
                  )
                ) : !otpSent ? (
                  <>📧 Verify your email to start the build</>
                ) : (
                  <>⚡ Generate my app</>
                )}
              </Button>
              <p className="text-center text-xs text-slate-400">
                Free demo — verify your email, then we build on GitHub Actions. Limited build
                budget each month (used {budget?.builds.used ?? '—'}/{budget?.builds.max ?? 120}
                {budget?.minutes ? ` · ${budget.minutes.remaining} min left` : ''}).
              </p>
            </form>
          </Card>

          {/* PREVIEW */}
          <div className="lg:sticky lg:top-20">
            <div className={platform === 'windows' || platform === 'macos' ? 'mx-auto max-w-2xl' : 'mx-auto max-w-[340px]'}>
              <AppPreview
                appName={appName}
                color={primaryColor}
                secondaryColor={secondaryColor}
                theme="light"
                platform={platform}
                logo={logoPreview}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-400">
            © 2026 TGen — demo app generator. Built with Next.js + GitHub Actions.
          </p>
          <div className="flex gap-4 text-xs text-slate-400">
            <a className="transition-colors hover:text-slate-700" href="https://github.com/SatPaingOo/t-github-gen-mobile-app" target="_blank" rel="noreferrer">
              Mobile template
            </a>
            <a className="transition-colors hover:text-slate-700" href="https://github.com/SatPaingOo/t-github-gen-electron-app" target="_blank" rel="noreferrer">
              Desktop template
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
