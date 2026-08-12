'use client';

import { useState } from 'react';

/**
 * AppPreview — faithful live mockup of the generated Notes+Todos app.
 * Mirrors the ACTUAL app (shared by RN + Electron):
 *   - BrandBar (secondary color)
 *   - search + add button (primary color)
 *   - note cards with colored accents
 *   - bottom tab bar: Notes / Todos / About
 *   - About tab has the in-app theme switcher (Light/Dark/System) — it works
 *     live, exactly like the real app
 */

import type { Platform } from '@/lib/types';
import type { ThemeMode } from '@/lib/types';

interface Props {
  appName: string;
  color: string;
  secondaryColor?: string;
  theme: ThemeMode;
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

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

type PreviewTab = 'notes' | 'todos' | 'about';

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return mode === 'dark';
}

export function AppPreview({ appName, color, secondaryColor, theme, platform, logo }: Props) {
  const isDesktop = platform === 'windows' || platform === 'macos';
  // in-app theme switcher (About tab) overrides the configured theme — like the real app
  const [themeMode, setThemeMode] = useState<ThemeMode>(theme);
  const [tab, setTab] = useState<PreviewTab>('notes');

  const dark = resolveDark(themeMode);
  const primary = color;
  const secondary = secondaryColor || color;

  const bg = dark ? '#0F172A' : '#F1F5F9';
  const surface = dark ? '#1E293B' : '#FFFFFF';
  const border = dark ? '#334155' : '#E2E8F0';
  const text = dark ? '#F1F5F9' : '#0F172A';
  const muted = dark ? '#94A3B8' : '#64748B';

  const initial = (appName || 'T').trim().charAt(0).toUpperCase();

  const common = { appName, primary, secondary, logo, initial, tab, setTab, themeMode, setThemeMode, bg, surface, border, text, muted };

  return (
    <div className="flex flex-col items-center">
      {isDesktop ? <DesktopMockup {...common} /> : <PhoneMockup {...common} />}
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
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full bg-slate-500" />
          <span className="font-semibold text-slate-700">Theme</span>
          <span className="text-slate-400">switch in the About tab (like the real app)</span>
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
      <span className="text-xs font-medium text-white/75">· Powered by TGen</span>
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

function TabBar({
  active,
  onSelect,
  primary,
  surface,
  border,
  muted,
}: {
  active: PreviewTab;
  onSelect: (t: PreviewTab) => void;
  primary: string;
  surface: string;
  border: string;
  muted: string;
}) {
  const tabs: { key: PreviewTab; label: string; glyph: string }[] = [
    { key: 'notes', label: 'Notes', glyph: '🗒' },
    { key: 'todos', label: 'Todos', glyph: '✅' },
    { key: 'about', label: 'About', glyph: 'ℹ️' },
  ];
  return (
    <div
      className="flex border-t px-4 py-2"
      style={{ background: surface, borderColor: border }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent"
            style={{ fontFamily: 'inherit' }}>
            <span className="text-sm">{t.glyph}</span>
            <span className="text-[10px]" style={{ color: isActive ? primary : muted, fontWeight: isActive ? 700 : 400 }}>
              {t.label}
            </span>
            <span className="h-1 w-1 rounded-full" style={{ background: isActive ? primary : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

/** About tab content — mirrors the real AboutScreen (theme switcher included). */
function AboutContent({
  appName,
  primary,
  logo,
  initial,
  themeMode,
  setThemeMode,
  surface,
  border,
  text,
  muted,
}: {
  appName: string;
  primary: string;
  logo?: string | null;
  initial: string;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  const card = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  };
  return (
    <div className="px-3 py-3">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
        <AppIcon primary={primary} logo={logo} initial={initial} />
        <p style={{ margin: '8px 0 2px', fontSize: 16, fontWeight: 700, color: text }}>{appName || 'My App'}</p>
        <p style={{ margin: 0, fontSize: 10, color: muted }}>app · v1.0.0</p>
      </div>

      {/* Theme switcher — live, like the real app */}
      <div style={card}>
        <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: text }}>
          Theme
        </p>
        <div style={{ display: 'flex', borderRadius: 10, border: `1px solid ${border}`, background: surface, padding: 3 }}>
          {THEME_OPTIONS.map(opt => {
            const isActive = themeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setThemeMode(opt.value)}
                className="flex-1 cursor-pointer border-none"
                style={{
                  borderRadius: 8,
                  padding: '6px 0',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  background: isActive ? primary : 'transparent',
                  color: isActive ? '#FFFFFF' : muted,
                  fontWeight: isActive ? 700 : 400,
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* App info */}
      <div style={card}>
        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: text }}>
          App info
        </p>
        {[
          ['Version', '1.0.0'],
          ['Package', 'com.example.myapp'],
          ['Support', 'you@mail.com'],
        ].map(([l, v], i) => (
          <div
            key={l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderBottom: i === 2 ? 'none' : `1px solid ${border}`,
            }}>
            <span style={{ fontSize: 11, color: muted }}>{l}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* TGen info */}
      <div style={card}>
        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: text }}>
          About TGen
        </p>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 17, color: muted }}>
          This app was generated with TGen — a demo app generator. Powered by TGen · v1.0.0
        </p>
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
  tab: PreviewTab;
  setTab: (t: PreviewTab) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  const { appName, primary, secondary, logo, initial, tab, setTab, themeMode, setThemeMode, bg, surface, border, text, muted } = props;
  return (
    <div
      className="w-full max-w-[290px] rounded-[2.4rem] border-[10px] shadow-2xl"
      style={{ background: '#0F172A', borderColor: '#0F172A' }}>
      <div className="overflow-hidden rounded-[1.7rem]">
        <div style={{ background: bg, minHeight: 460 }}>
          <BrandBar name={appName} secondary={secondary} />
          {tab === 'about' ? (
            <AboutContent
              appName={appName}
              primary={primary}
              logo={logo}
              initial={initial}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              surface={surface}
              border={border}
              text={text}
              muted={muted}
            />
          ) : (
            <>
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
            </>
          )}
          <TabBar active={tab} onSelect={setTab} primary={primary} surface={surface} border={border} muted={muted} />
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
  tab: PreviewTab;
  setTab: (t: PreviewTab) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  const { appName, primary, secondary, logo, initial, tab, setTab, themeMode, setThemeMode, bg, surface, border, text, muted } = props;
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

        {tab === 'about' ? (
          <AboutContent
            appName={appName}
            primary={primary}
            logo={logo}
            initial={initial}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            surface={surface}
            border={border}
            text={text}
            muted={muted}
          />
        ) : (
          <>
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
            </div>

            <SearchRow surface={surface} border={border} primary={primary} />

            {/* notes grid — responsive 1→2 cols */}
            <div className="grid grid-cols-1 gap-2 px-2 py-3 sm:grid-cols-2">
              {NOTE_SAMPLES.map((n, i) => (
                <NoteCardRow key={i} note={n} surface={surface} border={border} text={text} muted={muted} />
              ))}
            </div>
          </>
        )}

        <TabBar active={tab} onSelect={setTab} primary={primary} surface={surface} border={border} muted={muted} />
      </div>
    </div>
  );
}
