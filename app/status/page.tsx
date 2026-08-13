'use client';

import { useState } from 'react';

interface Build {
  id: string;
  appName: string;
  slug: string;
  platform: string;
  status: 'queued' | 'building' | 'done' | 'failed';
  queuePosition?: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  folderUrl: string;
}

const STATUS_META: Record<Build['status'], { label: string; cls: string; dot: string }> = {
  queued: { label: 'Queued', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  building: { label: 'Building…', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  done: { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

function initialParams() {
  if (typeof window === 'undefined') return { email: '', code: '' };
  const s = new URLSearchParams(window.location.search);
  return { email: s.get('email') || '', code: s.get('code') || '' };
}

export default function StatusPage() {
  const initial = initialParams();
  const [email, setEmail] = useState(initial.email);
  const [code, setCode] = useState(initial.code);
  const [loading, setLoading] = useState(false);
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  async function lookUp(e?: React.FormEvent, prefilled?: { email: string; code: string }) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setBuild(null);
    const em = prefilled?.email ?? email;
    const cd = prefilled?.code ?? code;
    try {
      const res = await fetch(`/api/status?email=${encodeURIComponent(em)}&code=${encodeURIComponent(cd)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Lookup failed.');
      } else {
        setBuild(data.build);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  // auto-search when arriving with ?email=...&code=...
  if ((initial.email || initial.code) && !autoRan && typeof window !== 'undefined') {
    setAutoRan(true);
    if (initial.email && initial.code) lookUp(undefined, initial);
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-xl px-4">
        <a href="/" className="text-xs font-medium text-indigo-600 hover:underline">
          ← Back to generator
        </a>
        <header className="mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">📦 Build Status</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the <span className="font-semibold">email</span> and{' '}
            <span className="font-semibold">tracking code</span> you got when generating — the
            code is your private key to the build.
          </p>
        </header>

        <form onSubmit={lookUp} className="mt-6 space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
          <input
            required
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="TGEN-XXXXXXXX (your tracking code)"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {loading ? 'Checking…' : 'Check status'}
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {build ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{build.appName}</p>
                <p className="text-[11px] text-slate-400">
                  {build.platform === 'windows' ? 'Windows' : 'Android'} · {build.slug} ·{' '}
                  {new Date(build.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_META[build.status].cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[build.status].dot}`} />
                {STATUS_META[build.status].label}
              </span>
            </div>
            {build.status === 'queued' || build.status === 'building' ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {build.status === 'queued'
                  ? `You're #${build.queuePosition ?? '—'} in the build queue — builds run one at a time, so yours starts after the current one finishes (~10-15 min after it begins).`
                  : 'Build in progress — your app file appears here in ~10-15 min. You will also get an email when it is ready.'}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              {build.status === 'done' ? (
                <a
                  href={build.downloadUrl}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                  ⬇ Download
                </a>
              ) : null}
              <a
                href={build.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                View folder ↗
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
