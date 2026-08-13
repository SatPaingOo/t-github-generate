# TGen — Technical Notes

App Generator Platform (Demo/Sample) — user fills a form on the website → GitHub Actions builds a customized app (Android / Windows) → **artifact (APK/exe) is committed into this repo's `public/exports/` for direct download** — no per-app repo needed.

**Live:** https://t-github-generate.vercel.app

---

## 1. Concept

```
User → Next.js Website (form: appName, theme, primary/secondary colors, logo, email, platform, code)
         ▼  POST /api/generate  (validate → limits → code check → workflow dispatch)
     GitHub Actions (on t-github-generate — build-export.yml)
         ├─ clone template repo (mobile / electron)
         ├─ write app.config.json + logo → node scripts/generate.mjs (branding)
         ├─ android → gradle assembleRelease | windows → electron-builder dist
         └─ commit artifact into public/exports/{platform}/{slug}/  (+ info.json)
         ▼
     User downloads directly: raw.githubusercontent.com/.../public/exports/... (~10–15 min)
         → SMTP notifier emails the download link when done (status → done)
```

## 2. Repositories (3 — all public)

| Repo | Stack | Role |
|---|---|---|
| `t-github-generate` | Next.js 16 | Website + APIs + JSON/CSV "DB" + Actions trigger + notifier |
| `t-github-gen-mobile-app` | React Native (CLI) | Template — Android APK (iOS: future) |
| `t-github-gen-electron-app` | Electron + React | Template — Windows exe (macOS: future) |

The two templates share a **byte-identical core** (11 files across `configs/` `services/` `contexts/`) — only the SQLite adapter and UI layer differ. Same flow & logic on both platforms; UI code is the only split.

## 3. Server-side flow — POST /api/generate

Order matters — cheap checks run before anything costly is consumed:

```
1.  validate + sanitize payload (lib/sanitize.ts)
2.  per-IP rate limit           data/rate_limits.json    (3/hr)            → 429
3.  per-email daily limit       data/email_limits.json   (1/platform/24h)  → 429
4.  combined build budget       data/build_quota.json + billing API        → 429
5.  consume single-use code     data/codes.json          (invalid → 400)
6.  upload logo → public/inputs/{slug}/logo.png (git tree API)
7.  trigger build-export workflow (workflow_dispatch, real email in payload)
8.  append generation row (status=queued|building, email=MASKED) → CSV
9.  bump limits (IP, email-hash, monthly quota)
10. respond { ok, repoUrl, downloadUrl, queuePosition }
```

Failure in step 6/7 **refunds the code** so the user can retry.

## 4. Data model — the GitHub repo is the database

Vercel serverless has no writable filesystem, so all state is files in this repo, read/written via the Contents API (every write is a commit — fine for demo scale; no atomic locking).

| File | Purpose | Notes |
|---|---|---|
| `data/codes.json` | single-use access codes | `{ code, maxUses, used, createdAt }` |
| `data/generations.csv` | append-only build log | status: `queued` → `building` → `done`/`failed` |
| `data/rate_limits.json` | IP → recent timestamps | 3/hr window |
| `data/email_limits.json` | **sha256(salt:email)** → platform → timestamps | raw email never stored |
| `data/build_quota.json` | month + build count | 120/month, auto-reset on month change |
| `public/exports/{p}/{slug}/` | user artifacts | `<slug>-v<version>.apk|Setup.exe` + `info.json` |
| `public/inputs/{slug}/` | staged logo | deleted by the workflow after the build |
| `public/defaults/` | pre-built default apps | direct download, no code needed |

### Email privacy — the important bit

- The public CSV stores only `maskEmail(email)` → `kyaw*****@gmail.com`.
- Status lookup masks the queried email and compares masked forms **plus** the code (`getGenerationByEmailAndCode`).
- The **real** email travels only in the workflow dispatch payload (Actions logs redact it via `::add-mask::`).
- Per-email limits use a salted SHA-256 key, so the limit store is also unreadable.

## 5. Limits / abuse protection (defense in depth)

| Layer | Rule | Why |
|---|---|---|
| Access codes | single-use, owner-distributed | no code → no build |
| IP rate limit | 3 builds/hr | burst abuse |
| Email daily limit | 1 build/platform/24h | per-user fairness (mobile + desktop = 2/day) |
| Monthly quota | 120 builds/month | protects owner's Actions budget |
| Actions billing (optional) | pauses at < 30 min remaining | real minutes from GitHub billing API (`GITHUB_BILLING_TOKEN`) |
| Concurrency | Actions `concurrency: build-export` | serializes builds; site exposes queue position |

**Budget check order:** site cap → real minutes. Token absent / API fails → **fail open** to the site counter (never blocks on a missing optional token).

> Note: public-repo Actions runs are **free/unlimited** on the standard runners, so this repo's builds don't burn the 2000-min private quota — the billing check matters if the repo ever goes private or other private repos share the account.

## 6. Queue semantics

- The workflow `concurrency` group serializes builds (one at a time).
- The site marks a new generation `queued` when another build is active; `queuePosition` = count of active rows created before it + 1.
- `GET /api/status` returns `queuePosition` for queued/building builds; the status page renders a "You're #N in the build queue" note.
- When the workflow's `send-email.mjs` completes it sets the row `done` (match by slug+platform, `[skip ci]` commit).

## 7. UI error handling (type-aware)

The API returns a machine-readable `code` alongside the message; the form renders a tailored banner:

| code | banner | action offered |
|---|---|---|
| `EMAIL_LIMIT` | amber "Daily limit reached" | **Switch to {other platform}** · Check existing builds |
| `IP_LIMIT` | amber "Too many builds from your network" | retry hint (minutes) |
| `MONTHLY_QUOTA` | red "Monthly budget reached" | resume next month note |
| `ACTIONS_BUDGET` | red "Builds paused — minutes low" | — |
| `INVALID_CODE` | red "Invalid access code" | format hint |
| `VALIDATION` / `INTERNAL` | generic red | — |

The submit button is disabled (with the reason) when the budget is exhausted; a live badge shows `N builds left · M min budget`.

## 8. GitHub Actions — build-export.yml

```
on: workflow_dispatch (inputs: platform, appName, slug, theme, primary/secondaryColor,
                       supportEmail, packageName, version)
permissions: contents: write
concurrency: build-export (cancel-in-progress: false)

jobs.export (ubuntu-latest | windows-latest):
  checkout → setup node 22 / java 17 / gradle
  → ::add-mask:: supportEmail          ← privacy: hide real email from public logs
  → clone template repo (depth 1)
  → write app.config.json from inputs
  → apply uploaded logo (public/inputs/{slug}/logo.png) if present
  → npm ci && node scripts/generate.mjs   (branding, NO commit — templates stay pristine)
  → android: gradlew assembleRelease | windows: npm run dist:win
  → copy artifact → public/exports/{platform}/{slug}/ + info.json
  → commit + push [skip ci]
  → npm i nodemailer; node .github/scripts/send-email.mjs   (SMTP secrets)
  → commit status update (done) [skip ci]
```

Gotchas learned:
- `[skip ci]` on every bot commit — otherwise builds re-trigger loops.
- Template default branch **must stay pristine with `{{TOKENS}}`** — a previous bug committed branded files back and broke every later export.
- Gradle on CI: chmod +x gradlew; electron-builder needs `--publish never` (no GH_TOKEN).
- SMTP from GitHub runners: no IPv6 → resolve host to IPv4, keep hostname as TLS SNI; port 465 → 587 fallback.

## 9. Templates — config-driven branding

`scripts/generate.mjs` (in each template) reads `app.config.json` and replaces `{{TOKENS}}` **only in specific source/config files**:

- **Android:** manifest packages, `strings.xml` (name), `colors.xml`, mipmap icons, `MainActivity.kt` component name, Kotlin package move, autolinking cache-bust (`tgenVersion`).
- **Electron:** `package.json` (appId/productName), window title, app icon.
- Future: iOS `Info.plist` / AppIcon, macOS `.icns`.

Input sanitization matters — app names with quotes/newlines would break native configs (handled in `lib/sanitize.ts`).

## 10. Generated app (both platforms)

- Notes + Todos with SQLite — create/edit/delete, done-state, priority cycle; **persists across restarts**.
- Built-in **theme switcher** (Light / Dark / System) — in-app override stored in context.
- Brand colors: primary = buttons/icons, secondary = header bar/badges.
- About screen shows app info + version + a compact "Made with TGen · testing purposes only" card.
- Default logo: ⚡ lightning (indigo→violet gradient) rendered as the app icon unless the user uploads one.

## 11. Verification (done)

- `npx tsc --noEmit` ✅ · `next build` ✅
- Real end-to-end: form → dispatch → Actions build → artifact commit → SMTP email → status `done` ✅ (run `31681401726`, "Warning App")
- Status lookup: email+code → build returned (masked match) ✅; email-only → 400 ✅
- Public CSV contains **no raw emails** (masked only) ✅
- Budget logic (quota / billing fallback / platform limits) unit-verified ✅

## 12. Costs & limits to be aware of

- Public-repo Actions: **free** on standard runners → builds don't consume the 2000-min private quota.
- If the repo goes private: ~10–20 min/build Android, ~15 min Windows → monthly quota (120) + billing check keep it well under 2000 min.
- Exported artifacts live in git (large files) — prune `public/exports/` occasionally.

## 13. Milestones — done

1. ✅ Mobile template — config-driven, Android APK end-to-end
2. ✅ Electron template — config-driven, Windows exe
3. ✅ Website — form + `/api/generate` + codes/generations store
4. ✅ Notifier — SMTP email on build complete (port 465/587 fallback)
5. ✅ Polish — validation, type-aware errors, IP + email + monthly limits, queue, status page, default apps, live preview, privacy (mask + hash + log redaction)
6. ✅ Deploy — Vercel production, GitHub repo as DB

## 14. Open questions / future

- iOS/macOS (Apple $99 dev account + macOS runner cost — deferred)
- Custom domain, analytics
- Code distribution flow (auto-generate on a schedule? paid flow?)
- Alerting when the monthly quota is nearly exhausted (cron workflow)
