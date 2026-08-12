'use client';

/**
 * AppPreview — faithful live mockup of the generated Notes+Todos app.
 * Mirrors the ACTUAL app design (shared by both the RN and Electron apps):
 *   - BrandBar on top (secondary color)
 *   - search bar + add button (primary color)
 *   - note cards with colored left accents
 *   - bottom tab bar (Notes / Todos)
 * Phone = single column · Desktop = responsive 2-column grid.
 */

import type { Platform } from '@/lib/types';

interface Props {
  appName: string;
  color: string;
  secondaryColor?: string;
  theme: 'light' | 'dark' | 'system';
  platform: Platform;
  logo?: string | null;
}

const NOTE_SAMPLES = [
  { t: 'Grocery list', s: 'milk, eggs, bread, coffee…', c: '#F59E0B', time: '12m' },
  { t: 'Meeting notes', s: 'Q3 planning · decide budget…', c: '#10B981', time: '1h' },
  { t: 'App ideas', s: '1. TGen · 2. Notes app…', c: '#6366F1', time: '3h' },
  { t: 'Reading list', s: 'Clean Code · Refactoring…', c: '#EC4899', time: '1d' },
  { t: 'Workout plan', s: 'Mon: legs · Tue: arms…', c: '#06B6D4', time: '2d' },
  { t: 'Travel todo', s: 'passport, visa, booking…', c: '#F59E0B', time: '4d' },
];

export function AppPreview({ appName, color, secondaryColor, theme, platform, logo }: Props) {
  const isDesktop = platform === 'windows' || platform === 'macos';
  const dark = theme === 'dark';
  const primary = color;
  const secondary = secondaryColor || color;

  const bg = dark ? '#0F172A' : '#F1F5F9';
  const surface = dark ? '#1E293B' : '#FFFFFF';
  const border = dark ? '#334155' : '#E2E8F0';
  const text = dark ? '#F1F5F9' : '#0F172A';
  const muted = dark ? '#94A3B8' : '#64748B';

  const initial = (appName || 'T').trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center">
      {isDesktop ? (
        <DesktopMockup
          appName={appName}
          primary={primary}
          secondary={secondary}
          logo={logo}
          initial={initial}
          bg={bg}
          surface={surface}
          border={border}
          text={text}
          muted={muted}
        />
      ) : (
        <PhoneMockup
          appName={appName}
          primary={primary}
          secondary={secondary}
          logo={logo}
          initial={initial}
          bg={bg}
          surface={surface}
          border={border}
          text={text}
          muted={muted}
        />
      )}
      <p className="mt-3 text-xs font-medium text-slate-400">
        Live preview — matches the generated {isDesktop ? 'Windows' : 'Android'} app
      </p>

      {/* color legend — shows what primary/secondary affect */}
      <div className="mt-3 w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-300" style={{ background: primary }} />
          <span className="font-semibold text-slate-700">Primary</span>
          <span className="text-slate-400">buttons · active tab · progress</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-300" style={{ background: secondary }} />
          <span className="font-semibold text-slate-700">Secondary</span>
          <span className="text-slate-400">header bar · badges</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shared pieces ---------------- */

function BrandBar({ name, secondary }: { name: string; secondary: string }) {
  return (
    <div
      className="flex items-center justify-center gap-1 py-2"
      style={{ background: secondary }}>
      <span className="text-xs font-bold text-white">{name || 'My App'}</span>
      <span className="text-xs font-medium text-white/75">· TGen</span>
    </div>
  );
}

function AppIcon({ primary, logo, initial }: { primary: string; logo?: string | null; initial: string }) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-lg font-bold text-white shrink-0"
      style={{ background: primary }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="logo" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

function NoteCardRow({
  note,
  surface,
  border,
  text,
  muted,
}: {
  note: { t: string; s: string; c: string; time: string };
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  return (
    <div
      className="flex items-center rounded-2xl border px-3 py-2.5"
      style={{ background: surface, borderColor: border }}>
      <span className="mr-3 w-1 self-stretch rounded-full" style={{ background: note.c }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold" style={{ color: text }}>
          {note.t}
        </p>
        <p className="truncate text-[11px]" style={{ color: muted }}>
          {note.s}
        </p>
        <p className="mt-0.5 text-[9px]" style={{ color: muted }}>
          {note.time} ago
        </p>
      </div>
      <span className="text-xs opacity-50">🗑</span>
    </div>
  );
}

function TabBar({ primary, surface, border, muted }: { primary: string; surface: string; border: string; muted: string }) {
  return (
    <div
      className="flex border-t px-6 py-2"
      style={{ background: surface, borderColor: border }}>
      <div className="flex flex-1 flex-col items-center gap-0.5">
        <span className="text-sm">🗒</span>
        <span className="text-[10px] font-bold" style={{ color: primary }}>
          Notes
        </span>
        <span className="h-1 w-1 rounded-full" style={{ background: primary }} />
      </div>
      <div className="flex flex-1 flex-col items-center gap-0.5">
        <span className="text-sm">✅</span>
        <span className="text-[10px]" style={{ color: muted }}>
          Todos
        </span>
        <span className="h-1 w-1 rounded-full" style={{ background: 'transparent' }} />
      </div>
    </div>
  );
}

function SearchRow({ surface, border, primary }: { surface: string; border: string; primary: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      <div
        className="flex-1 rounded-xl border px-3 py-2"
        style={{ background: surface, borderColor: border }}>
        <span className="text-[11px] text-slate-400">Search notes…</span>
      </div>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: primary }}>
        +
      </div>
    </div>
  );
}

/* ---------------- phone (Android) ---------------- */

function PhoneMockup(props: {
  appName: string;
  primary: string;
  secondary: string;
  logo?: string | null;
  initial: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  const { appName, primary, secondary, logo, initial, bg, surface, border, text, muted } = props;
  return (
    <div
      className="w-full max-w-[290px] rounded-[2.4rem] border-[10px] shadow-2xl"
      style={{ background: '#0F172A', borderColor: '#0F172A' }}>
      <div className="overflow-hidden rounded-[1.7rem]">
        <div style={{ background: bg, minHeight: 460 }}>
          <BrandBar name={appName} secondary={secondary} />
          <div className="flex items-center gap-2 px-3 pt-3">
            <AppIcon primary={primary} logo={logo} initial={initial} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: text }}>
                {appName || 'My App'}
              </p>
              <p className="text-[10px]" style={{ color: muted }}>
                Android · v1.0.0
              </p>
            </div>
          </div>
          <SearchRow surface={surface} border={border} primary={primary} />
          <div className="space-y-2 px-3 py-3">
            {NOTE_SAMPLES.slice(0, 4).map((n, i) => (
              <NoteCardRow key={i} note={n} surface={surface} border={border} text={text} muted={muted} />
            ))}
          </div>
          <TabBar primary={primary} surface={surface} border={border} muted={muted} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- desktop (Windows) ---------------- */

function DesktopMockup(props: {
  appName: string;
  primary: string;
  secondary: string;
  logo?: string | null;
  initial: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  const { appName, primary, secondary, logo, initial, bg, surface, border, text, muted } = props;
  return (
    <div
      className="w-full overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: surface, borderColor: border }}>
      {/* window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: '#0B1220', borderBottom: `1px solid ${border}` }}>
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate text-xs font-medium text-slate-400">
          {appName || 'My App'}
        </span>
      </div>

      <div style={{ background: bg, padding: 12 }}>
        <BrandBar name={appName} secondary={secondary} />

        {/* header: icon + actions */}
        <div className="flex items-center gap-3 px-2 pt-3">
          <AppIcon primary={primary} logo={logo} initial={initial} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold" style={{ color: text }}>
              {appName || 'My App'}
            </p>
            <p className="text-[11px]" style={{ color: muted }}>
              Windows app · v1.0.0
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ background: primary }}>
            exe
          </span>
        </div>

        <SearchRow surface={surface} border={border} primary={primary} />

        {/* notes grid — responsive 1→2 cols */}
        <div className="grid grid-cols-1 gap-2 px-2 py-3 sm:grid-cols-2">
          {NOTE_SAMPLES.map((n, i) => (
            <NoteCardRow key={i} note={n} surface={surface} border={border} text={text} muted={muted} />
          ))}
        </div>

        <TabBar primary={primary} surface={surface} border={border} muted={muted} />
      </div>
    </div>
  );
}
