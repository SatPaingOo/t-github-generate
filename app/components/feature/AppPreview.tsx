'use client';

/**
 * AppPreview — live mockup of the generated app (phone for mobile, window for
 * desktop). Mirrors the actual Notes+Todos app branding (accent bar, icon,
 * cards) so the user sees their choices in real time.
 */

import type { Platform } from '@/lib/types';

interface Props {
  appName: string;
  color: string;
  theme: 'light' | 'dark' | 'system';
  platform: Platform;
  logo?: string | null;
}

export function AppPreview({ appName, color, theme, platform, logo }: Props) {
  const isDesktop = platform === 'windows' || platform === 'macos';
  const dark = theme === 'dark';

  const bg = dark ? '#0F172A' : '#F1F5F9';
  const surface = dark ? '#1E293B' : '#FFFFFF';
  const text = dark ? '#F1F5F9' : '#0F172A';
  const muted = dark ? '#94A3B8' : '#64748B';
  const border = dark ? '#334155' : '#E2E8F0';

  const initial = (appName || 'T').trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center">
      {/* Device frame */}
      {isDesktop ? (
        <div
          className="w-full overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: surface, borderColor: border }}>
          {/* Window chrome */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ background: dark ? '#0B1220' : '#F8FAFC', borderBottom: `1px solid ${border}` }}>
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-2 truncate text-xs font-medium" style={{ color: muted }}>
              {appName || 'My App'}
            </span>
          </div>
          <div className="p-4">
            <DesktopBody
              appName={appName}
              color={color}
              logo={logo}
              initial={initial}
              dark={dark}
              bg={bg}
              surface={surface}
              text={text}
              muted={muted}
            />
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-[280px] rounded-[2.2rem] border-8 p-2 shadow-2xl"
          style={{ background: dark ? '#111827' : '#0F172A', borderColor: '#0F172A' }}>
          <div className="overflow-hidden rounded-[1.6rem]">
            <PhoneBody
              appName={appName}
              color={color}
              logo={logo}
              initial={initial}
              dark={dark}
              bg={bg}
              surface={surface}
              text={text}
              muted={muted}
              border={border}
            />
          </div>
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-slate-400">Live preview of your app</p>
    </div>
  );
}

function BrandStrip({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center gap-1 py-1.5" style={{ background: color }}>
      <span className="text-[10px] font-bold text-white">Generated with TGen</span>
    </div>
  );
}

function AppIcon({ color, logo, initial }: { color: string; logo?: string | null; initial: string }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white"
      style={{ background: color }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="logo" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

function PhoneBody(props: {
  appName: string;
  color: string;
  logo?: string | null;
  initial: string;
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}) {
  const { appName, color, logo, initial, bg, surface, text, muted, border } = props;
  return (
    <div style={{ background: bg, minHeight: 420 }}>
      <BrandStrip color={color} />
      <div className="flex flex-col items-center px-4 pt-6 pb-8">
        <AppIcon color={color} logo={logo} initial={initial} />
        <p className="mt-2.5 text-base font-bold" style={{ color: text }}>
          {appName || 'My App'}
        </p>
        <p className="text-[10px]" style={{ color: muted }}>
          Android app
        </p>

        <div className="mt-4 w-full space-y-2">
          {[
            { label: 'Theme', value: 'Dark' },
            { label: 'Version', value: '1.0.0' },
            { label: 'Support', value: 'you@mail.com' },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: surface, border: `1px solid ${border}` }}>
              <span className="text-[10px]" style={{ color: muted }}>
                {row.label}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: text }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* bottom nav */}
      <div className="flex border-t px-6 py-2.5" style={{ background: surface, borderColor: border }}>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-sm">🗒</span>
          <span className="text-[9px] font-bold" style={{ color: color }}>
            Notes
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-sm">✅</span>
          <span className="text-[9px]" style={{ color: muted }}>
            Todos
          </span>
        </div>
      </div>
    </div>
  );
}

function DesktopBody(props: {
  appName: string;
  color: string;
  logo?: string | null;
  initial: string;
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  muted: string;
}) {
  const { appName, color, logo, initial, bg, surface, text, muted } = props;
  return (
    <div style={{ background: bg, borderRadius: 12, padding: 14 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AppIcon color={color} logo={logo} initial={initial} />
          <div>
            <p className="text-sm font-bold" style={{ color: text }}>
              {appName || 'My App'}
            </p>
            <p className="text-[10px]" style={{ color: muted }}>
              Windows app
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: `${color}22`, color: color }}>
          Windows · exe
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { t: 'Grocery list', s: 'milk, eggs, bread', c: '#F59E0B' },
          { t: 'Meeting notes', s: 'Q3 planning…', c: '#10B981' },
          { t: 'App ideas', s: '1. TGen, 2. …', c: '#6366F1' },
          { t: 'Reading list', s: 'Clean Code…', c: '#EC4899' },
        ].map((note, i) => (
          <div
            key={i}
            className="rounded-xl p-3"
            style={{ background: surface, border: `1px solid ${'#E2E8F0'}` }}>
            <div className="mb-1.5 h-1 w-6 rounded-full" style={{ background: note.c }} />
            <p className="text-[11px] font-semibold" style={{ color: text }}>
              {note.t}
            </p>
            <p className="text-[10px]" style={{ color: muted }}>
              {note.s}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
