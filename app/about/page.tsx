'use client';

/**
 * About page — explains what TGen is, how it works, privacy, and what you get.
 */

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Fill the form',
    desc: 'Pick a name, theme, primary/secondary colors, an optional logo, and a platform (Android or Windows). No account, just an access code.',
  },
  {
    n: '02',
    title: 'We build it on GitHub Actions',
    desc: 'Your config is written into a template app (React Native / Electron) and compiled into a real installable file — APK or Windows exe.',
  },
  {
    n: '03',
    title: 'Download & install',
    desc: 'The finished file appears in public/exports and you download it directly. No app store, no review, no waiting for us.',
  },
];

const FAQS = [
  {
    q: 'Is my data stored on your server?',
    a: 'No. Your app config is only used to build your app. All Notes/Todos data inside the generated app is stored locally on the device (SQLite) — we never see it. Your email is only used to send you the download link (notifier coming).',
  },
  {
    q: 'What do I get?',
    a: 'A complete Notes + Todos app with your name, colors and logo — plus the source repo so you can keep developing it yourself.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. This is a demo/sample platform. We just ask for a single-use access code so one person cannot generate unlimited builds (GitHub Actions costs money).',
  },
  {
    q: 'Why an email?',
    a: 'Builds take 10–15 minutes. We email you the repo + download link when it is ready instead of making you wait on the page.',
  },
  {
    q: 'Can I publish the app to stores?',
    a: 'Yes, the generated repo is yours. For Play Store you would sign it with your own keystore; for App Store you would need an Apple Developer account (iOS is not part of this demo yet).',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* hero */}
      <section className="bg-slate-950 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            About <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">TGen</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
            TGen is a demo app generator: you answer a short form and a real, installable
            Android or Windows app is built for you by GitHub Actions — name, theme,
            colors and logo all yours.
          </p>
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-xl font-bold text-slate-900">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map(s => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-indigo-500">{s.n}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* privacy */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-xl font-bold text-slate-900">Privacy &amp; ownership</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">🔒 Your data stays on your device</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                The generated app stores all Notes and Todos in a local SQLite database on
                your phone or computer. TGen has no access to it.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">© The app is yours</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                The generated code and app belong to you. The template code is MIT licensed,
                and the only trace of us is a small “Made with TGen” line.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-xl font-bold text-slate-900">FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQS.map(f => (
            <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:content-none">
                {f.q}
                <span className="float-right text-indigo-500 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">Want to try it?</p>
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
            ⚡ Generate your app
          </a>
        </div>
      </section>
    </main>
  );
}
