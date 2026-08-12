'use client';

/**
 * DefaultApps — pre-built apps anyone can download immediately (no code).
 * Lets users compare the default app vs a generated (custom) app.
 */

const DEFAULTS = [
  {
    platform: 'android',
    label: 'Android',
    icon: '🤖',
    file: 'app.apk',
    size: '56 MB',
    href: '/defaults/android/app.apk',
    desc: 'Notes + Todos app · installable APK (debug-signed)',
    badge: 'Ready',
  },
  {
    platform: 'windows',
    label: 'Windows',
    icon: '🪟',
    file: 'setup.exe',
    size: '89 MB',
    href: '/defaults/windows/setup.exe',
    desc: 'Notes + Todos app · NSIS installer',
    badge: 'Ready',
  },
];

export function DefaultApps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">🎁 Default apps — download now</h2>
            <p className="mt-1 text-sm text-slate-500">
              No code needed. Try the pre-built app first, then generate your own branded
              version below.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
            ● Free · ready to install
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DEFAULTS.map(d => (
            <a
              key={d.platform}
              href={d.href}
              download
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl transition-colors group-hover:bg-indigo-50">
                {d.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-slate-900">TGen App · {d.label}</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    {d.badge}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{d.desc}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {d.file} · {d.size}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors group-hover:bg-indigo-500">
                <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                  <path d="M10 3a.75.75 0 01.75.75v7.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.75A.75.75 0 0110 3zM4.5 13.5a.75.75 0 01.75.75v1.5c0 .41.34.75.75.75h8c.41 0 .75-.34.75-.75v-1.5a.75.75 0 011.5 0v1.5A2.25 2.25 0 0114 18.75H6A2.25 2.25 0 013.75 16.5v-1.5a.75.75 0 01.75-.75z" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          💡 <span className="font-medium text-slate-500">Default</span> vs{' '}
          <span className="font-medium text-slate-500">Generated</span> — same app, your name,
          colors &amp; logo. Scroll down to build yours.
        </p>
      </div>
    </section>
  );
}
