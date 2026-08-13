# ⚡ TGen — App Generator Platform

> Turn a web form into a real **Android (APK)** and **Windows (exe)** app in ~15 minutes — powered by Next.js + GitHub Actions. No app-store account, no local toolchain, no cost to the user.

**Live demo:** https://t-github-generate.vercel.app

---

## What it does

A user fills in a form on the website (app name, brand colors, logo, email, platform, access code). TGen:

1. **Validates** the request (code, per-IP rate limit, per-email daily limit, monthly build budget).
2. **Triggers** a GitHub Actions workflow that clones a branded template repo, injects the user's config, and compiles a real native app (React Native APK or Electron Windows installer).
3. **Commits** the finished artifact into this repo's `public/exports/` — directly downloadable.
4. **Emails** the user a download link when the build completes (Gmail SMTP).

No separate per-app repo is created, no database server is needed — the "database" is a set of JSON/CSV files living in the repo, read/written through the GitHub Contents API (which also makes it work on serverless Vercel).

## Architecture

```
┌───────────────────────────────┐        ┌──────────────────────────────┐
│  t-github-generate  (Next.js) │        │  GitHub Actions (this repo)  │
│                               │        │                              │
│  form → POST /api/generate    │        │  build-export.yml            │
│    ├─ validate + sanitize     │  dispatch│  ├─ clone template repo     │
│    ├─ rate limits (IP/email)  │───────▶ │  ├─ write app.config.json   │
│    ├─ monthly budget check    │        │  ├─ npm ci + generate.mjs    │
│    ├─ consume single-use code │        │  ├─ android → gradle APK     │
│    ├─ upload logo             │        │  │  windows → electron exe   │
│    └─ log to generations.csv  │        │  ├─ commit artifact + info   │
│                               │        │  ├─ email download link      │
│  /api/status — email+code     │        │  └─ mark status done         │
│  /api/quota — remaining budget│        │                              │
└───────────────────────────────┘        └──────────────────────────────┘
         │  download (raw.githubusercontent)
         ▼
  public/exports/{platform}/{slug}/{slug}-v{version}.apk/.exe
```

### Repositories (3, all public)

| Repo | Stack | Role |
|---|---|---|
| **`t-github-generate`** | Next.js 16 (App Router) + Vercel | Website, APIs, JSON/CSV store, build orchestrator, email notifier |
| **`t-github-gen-mobile-app`** | React Native 0.86 (CLI) + op-sqlite | Template — Notes + Todos app, Android |
| **`t-github-gen-electron-app`** | Electron 35 + React + Vite + better-sqlite3 | Template — same app, Windows desktop |

> The two template apps share a **byte-identical core** (configs / services / contexts — 11 files) — only the platform adapter and UI layer differ, so the generated apps behave identically across Android and Windows.

## Features

### User-facing
- **Live app preview** — the form's left panel mirrors the real generated app (brand bar, colors, theme switcher, Notes/Todos UI) as you type.
- **Default apps** — pre-built APK/exe you can download instantly (no code) to compare with a generated one.
- **Build status page** — `email + access code` → live badge (`queued` with queue position / `building` / `ready` / `failed`) + download button.
- **Email notifier** — download link arrives by email when the build finishes.

### Anti-abuse / cost protection (defense in depth)
| Layer | Rule |
|---|---|
| Access codes | single-use, pre-generated (`TGEN-XXXXXXXX`) — no code, no build |
| Per-IP rate limit | 3 builds / hour |
| Per-email daily limit | 1 build / platform / 24h (keyed by **SHA-256 hash** — never stored raw) |
| Monthly build quota | 120 builds / calendar month (protects the owner's Actions budget) |
| GitHub billing check | optional token reads the account's **real remaining Actions minutes**; pauses builds under a threshold |
| Concurrency queue | Actions serializes builds; users see their queue position |

### Privacy
- **Emails are never stored in plain text.** The public CSV keeps only a masked form (`kyaw*****@gmail.com`); the real address flows only through the workflow dispatch payload to the SMTP notifier.
- The workflow **redacts the email from public Actions logs** (`::add-mask::`).
- Per-email limits use a **salted hash** of the address, so even the limit store reveals nothing.

### Templates (generated app)
- Notes + Todos with SQLite (sync API) — create / edit / delete, persisted across restarts.
- **Built-in theme switcher** (Light / Dark / System) that honors brand colors.
- Config-driven branding: `app.config.json` → `scripts/generate.mjs` replaces `{{TOKENS}}` in native files, moves the Kotlin package, and renders launcher icons.
- Tooling: `@/` path aliases, pinned Node/npm (`.nvmrc`, `engine-strict`), husky + lint-staged, `ci.yml` (typecheck + lint + test).

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Requires a `.env.local` with `GITHUB_TOKEN` (repo-scoped PAT with `actions:write` + `contents:write`). Optional: `GITHUB_BILLING_TOKEN` (classic PAT) for the real-minutes budget check.

```bash
npx tsc --noEmit && npx next build   # type + production build check
```

## Tech stack

**Website:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, TypeScript, Octokit.
**Mobile template:** React Native 0.86 CLI, Hermes, op-sqlite v17 (sync API).
**Desktop template:** Electron 35, React 19, Vite 6, better-sqlite3 v13 (IPC `tgen:db`), electron-builder.
**Infra:** Vercel (serverless), GitHub Actions (build runner), Gmail SMTP (notifier).

## Docs

- [NOTE.md](./NOTE.md) — full technical notes, decisions, and the build log.

## License

MIT — demo/sample project. The generated apps include a "Made with TGen · testing purposes only" note.
