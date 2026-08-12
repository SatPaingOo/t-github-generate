'use client';

import { useState } from 'react';

interface Build {
  id: string;
  appName: string;
  slug: string;
  platform: string;
  status: 'building' | 'done' | 'failed';
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  folderUrl: string;
}

const STATUS_META: Record<Build['status'], { label: string; cls: string; dot: string }> = {
  building: { label: 'Building…', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  done: { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export default function StatusPage() {
  const [email, setEmail] = useState(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('email') || ''
      : '',
  );
  const [loading, setLoading] = useState(false);
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(
    typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('email'),
  );

  async function lookUp(e?: React.FormEvent, prefilledEmail?: string) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setBuilds(null);
    const target = prefilledEmail ?? email;
    try {
      const res = await fetch(`/api/status?email=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Lookup failed.');
      } else {
        setBuilds(data.builds);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  // auto-search when arriving with ?email=
  const [autoRan, setAutoRan] = useState(false);
  if (searched && !autoRan && typeof window !== 'undefined') {
    setAutoRan(true);
    lookUp(undefined, new URLSearchParams(window.location.search).get('email') || undefined);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-2xl px-4">
        <a href="/" className="text-xs font-medium text-indigo-600 hover:underline">
          ← Back to generator
        </a>
        <header className="mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">📦 Build Status</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the email you used when generating — see your apps and their build status.
          </p>
        </header>

        <form onSubmit={lookUp} className="mt-6 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {loading ? 'Checking…' : 'Check status'}
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {builds ? (
          builds.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No builds found for this email yet. Generate an app first!
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {builds.map(b => {
                const meta = STATUS_META[b.status];
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{b.appName}</p>
                        <p className="text-[11px] text-slate-400">
                          {b.platform === 'windows' ? 'Windows' : 'Android'} · {b.slug} ·{' '}
                          {new Date(b.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {b.status === 'done' ? (
                        <a
                          href={b.downloadUrl}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
                          ⬇ Download
                        </a>
                      ) : null}
                      <a
                        href={b.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        View folder ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}
