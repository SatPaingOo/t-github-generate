'use client';

import { useRef, useState } from 'react';
import type { GenerateResponse, Platform, ThemeMode } from '@/lib/types';

const PLATFORMS: { value: Platform; label: string; desc: string }[] = [
  { value: 'android', label: 'Android', desc: 'APK' },
  { value: 'windows', label: 'Windows', desc: 'exe' },
  { value: 'ios', label: 'iOS', desc: 'Soon' },
  { value: 'macos', label: 'macOS', desc: 'Soon' },
];

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B', '#EC4899'];

export default function HomePage() {
  const [appName, setAppName] = useState('');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [supportEmail, setSupportEmail] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [code, setCode] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError('Logo must be a PNG or JPEG image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setLogoPreview(dataUrl);
      setLogoBase64(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          theme,
          primaryColor,
          supportEmail,
          platform,
          code,
          logoBase64,
        }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok || !data.ok) {
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

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-lg px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">TGen — App Generator</h1>
          <p className="mt-2 text-sm text-slate-500">
            Fill the form and we will build your branded app on GitHub Actions, then email
            you the repo + download link.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          {/* App name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">App name *</label>
            <input
              className={inputCls}
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="My Awesome App"
              required
              maxLength={40}
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email (we send the repo link here) *
            </label>
            <input
              className={inputCls}
              type="email"
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Theme */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Theme</label>
            <div className="flex gap-2">
              {THEMES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={
                    theme === t.value
                      ? 'flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white'
                      : 'flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
                  }>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Brand color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
              <input
                className={inputCls}
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                maxLength={7}
              />
            </div>
            <div className="mt-2 flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`color ${c}`}
                  onClick={() => setPrimaryColor(c)}
                  className={
                    primaryColor === c
                      ? 'h-6 w-6 rounded-full ring-2 ring-blue-500 ring-offset-2'
                      : 'h-6 w-6 rounded-full'
                  }
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo (optional)</label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={onLogoFile} className="hidden" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Choose image
              </button>
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="logo preview" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="text-xs text-slate-400">PNG / JPEG, up to 2 MB</span>
              )}
              {logoPreview ? (
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    setLogoBase64(undefined);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="text-xs text-red-500 hover:underline">
                  remove
                </button>
              ) : null}
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Platform *</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  disabled={p.value === 'ios' || p.value === 'macos'}
                  className={
                    platform === p.value
                      ? 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white'
                      : 'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
                  }>
                  {p.label}
                  <span className={platform === p.value ? 'block text-xs text-blue-100' : 'block text-xs text-slate-400'}>
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Access code *</label>
            <input
              className={inputCls}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="DEMO-0001"
              required
            />
            <p className="mt-1 text-xs text-slate-400">One code = one generated app.</p>
          </div>

          {/* Errors / result */}
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {result ? (
            <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">
              <p className="font-medium">{result.message}</p>
              {result.repoUrl ? (
                <a href={result.repoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-600 underline">
                  {result.repoUrl}
                </a>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Generating… (this takes ~15 min)' : 'Generate my app'}
          </button>
        </form>
      </div>
    </main>
  );
}
