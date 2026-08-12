# TEST GITHUB GENERATE APP

App Generator Platform (Demo/Sample) — user fills a form on the website → GitHub Actions builds a customized app (Android / Windows) → **artifact (APK/exe) is committed into this repo's `public/exports/` for direct download** — no per-app repo needed.

## 1. Concept

```
User → Next.js Website (form: app name, theme, primary/secondary colors, logo, email, platform, code)
         ▼  POST /api/generate  (code check → build-export workflow dispatch)
     GitHub Actions (on t-github-generate — build-export.yml)
         ├─ clone template repo (mobile / electron)
         ├─ write app.config.json + logo → node scripts/generate.mjs (branding)
         ├─ android job → APK build | windows job → exe build
         └─ commit artifact into public/exports/{platform}/{slug}/  (+ info.json)
         ▼
     User downloads directly: raw.githubusercontent.com/.../public/exports/... (10–15 min)
         → Notifier (future): cron workflow emails the link when ready
```

## 2. Repositories (3)

> All three are **PUBLIC** on GitHub. The two templates have **isTemplate: true** so the website can create new repos from them.

| Repo | Stack | Role | Status |
|---|---|---|---|
| `t-github-generate` | Next.js | Website + form + API + JSON/CSV "DB" + Actions trigger + notifier | ✅ pushed, ready to deploy |
| `t-github-gen-mobile-app` | React Native (CLI) | Template app — Android (MVP), iOS (future) | ✅ template, builds verified |
| `t-github-gen-electron-app` | Electron + React | Template app — Windows (MVP), macOS (future) | ✅ template, builds verified |

## 3. MVP Scope (only this for now)

- **Platforms:** Android (APK) + Windows (exe) only.
- iOS / macOS comes later — but the generate script and workflows must be written in an extensible way (platform matrix) so they can be added later.
- **Public website** — no login required. **Email is required** (to send the repo link).
- **Code (limit) system** — generation only works if the user has a code (protects against abuse / cost).
- Since this is a sample, apps only need to build successfully — production-ready is not required.

## 4. User Flow

1. User fills the form on the website: `appName, theme, color, logo, email, platform(android|windows), code`
2. Server validates the code against `codes.json` (exists / already used)
3. Valid ဆိုရင်:
   - `generations.csv` (log/DB) ထဲ request record
   - **`build-export` workflow** ကို website repo မှာ dispatch (per-app repo မဖန်တီးတော့ဘူး)
   - Workflow က template repo ကို clone → `app.config.json` + logo apply → build → **artifact ကို `public/exports/{platform}/{slug}/` ထဲ commit**
4. User ကို ချက်ချင်း ပြတာ: **"Build started — download link will appear"** (`https://github.com/SatPaingOo/t-github-generate/tree/main/public/exports/{platform}/{slug}`)
5. Artifact တန်းထွက်: `app.apk` / `setup.exe` — raw URL ကနေ download ရတယ် (Vercel/Next static folder ကနေလည်း ရနိုင်)

## 5. Email Flow (async — user doesn't wait) — FUTURE (not implemented yet)

Since builds can take 10–20+ minutes, the user is not kept waiting on the page:

- Email sending will be handled by a **scheduled workflow (cron, e.g. every 5 min) in the website repo**:
  - Scan `generations.csv` for `status=building`
  - Check if `public/exports/{platform}/{slug}/` artifact now exists (GitHub contents API)
  - When done, send email via SMTP (website repo secrets) → update status to `done`
- This was chosen so SMTP credentials live in **one place only** (website repo).
- **Currently**: the form already returns the download URL immediately; email is a future notifier.

## 6. Limit System — "Code"

- Owner pre-generates codes and stores them in `codes.json` (website repo).
- `POST /api/generate` only proceeds if the code is valid — invalid/used code → reject (show email + reason).
- **Default: single-use** — one code = one generation. (`maxUses` field allows N-uses — TBD)
- JSON/CSV is used as the DB — no real database in MVP.

### codes.json (DB #1 — codes)
```json
[
  { "code": "DEMO-001", "maxUses": 1, "used": 0, "createdAt": "2026-08-10T00:00:00Z" }
]
```

### generations.csv (DB #2 — append-only log)
```csv
id,createdAt,email,appName,slug,platform,code,repoUrl,status,releaseUrl,updatedAt
gen-001,2026-08-10T10:00:00Z,a@b.com,MyApp,myapp,android,DEMO-001,https://github.com/SatPaingOo/t-github-generate/tree/main/public/exports/android/myapp,building,,2026-08-10T10:00:00Z
```
- `status`: `building` → `done` / `failed`
- `repoUrl` = export folder URL (`public/exports/{platform}/{slug}`), not a separate repo

## 7. Generated Repo — app.config.json (shared by both templates)

The website pushes only this file + logo into the template repo (mobile / electron). Build reads everything from this file.

```json
{
  "schemaVersion": 1,
  "appName": "MyApp",
  "slug": "myapp",
  "theme": "dark",
  "primaryColor": "#3B82F6",
  "secondaryColor": "#64748B",
  "logoUrl": "assets/logo.png",
  "supportEmail": "support@example.com",
  "platforms": ["android", "windows"],
  "packageName": "com.example.myapp",
  "version": "1.0.0"
}
```

- `packageName` (Android) / future `bundleId` (iOS) — for store deploy; hidden form field (provide a default).
- Input must be sanitized — if app name contains `"`, `;`, newline, the config / native files break → validate + escape.
- `theme` = a pre-existing theme choice in the template (light/dark/...), `primaryColor` = accent (buttons/icons), `secondaryColor` = header bar/badges.

## 8. Template = Config-Driven (placeholder approach)

- `scripts/generate.mjs` (in template repo) reads `app.config.json` and:
  - Replaces placeholders: `{{APP_NAME}}`, `{{PRIMARY_COLOR}}`, `{{SECONDARY_COLOR}}`, `{{APP_NAME_JS}}`, `{{PACKAGE_NAME}}` — **only in specific source/config files** (never in node_modules / binaries)
  - Android: `AndroidManifest.xml` (app/activity package names), `strings.xml` (app_name), `colors.xml` (primary+secondary), mipmap icons (36–192px), `MainActivity.kt` (component name), Kotlin package move
  - Electron: `package.json` (appId/productName), window title, icon → `.ico`
  - Future iOS: `Info.plist` (CFBundleDisplayName), AppIcon set / macOS `.icns`
- Logo → icons: use `sharp` to generate all required sizes
- Pin versions (`.nvmrc`, exact deps) — RN has heavy version churn
- ⚠️ **Templates must stay pristine (tokens) in the default branch** — build workflows run `generate.mjs` inside the build job and **never commit** branded files back (was a bug: a generate job committed → tokens lost → exports broke).

## 9. GitHub Actions

### Template repos (mobile / electron) — build-android.yml / build-windows.yml
| Job | Work |
|---|---|
| `android` / `windows` | checkout → `npm ci` → `node scripts/generate.mjs` (branding, no commit) → build → upload artifact + GitHub Release |

### Website repo — build-export.yml (the generator)
| Job | Work |
|---|---|
| `export` | dispatch (workflow_dispatch inputs) → clone template repo → write `app.config.json` + logo → `npm ci` + `node scripts/generate.mjs` → build APK/exe → **commit into `public/exports/{platform}/{slug}/`** (`app.apk` / `setup.exe` + `info.json`) → push `[skip ci]` |

### Website repo — notifier workflow (FUTURE)
- Cron (e.g. `*/5 * * * *`): scan `generations.csv` → check export artifact exists → send email → update status

## 10. Platform Matrix

| Platform | Template | MVP | Future | Build notes |
|---|---|---|---|---|
| Android | mobile | ✅ | — | debug-signed APK (installable) |
| Windows | electron | ✅ | — | exe installer |
| iOS | mobile | ⏸ | later | signing required — unsigned/simulator or user Apple account flow (TBD) |
| macOS | electron | ⏸ | later | macOS build runner cost is high (watch) |

## 11. Secrets / Credentials

| Secret | Where | Permission |
|---|---|---|
| GitHub PAT (fine-grained) | Website server (.env) — never in browser | `actions:write` (workflow dispatch), `contents:write` (logo upload to website repo) |
| SMTP creds | Website repo Actions secrets | Email sending (future notifier) |
| Android keystore | MVP: shared debug keystore from generate script (sample only) — production would use repo secret flow (future) | APK signing |

## 12. Costs / Limits (things to be aware of)

- GitHub Actions free (private): 2000 min/month — Android ~10–20 min, Electron ~15 min → enough for MVP scale, but the code system controls this.
- **Release assets are permanent** — Actions artifacts only last 90 days → downloads must be served from **Releases**.
- Public generated repos → Actions minutes are **free** (public repos) → public repos in MVP also saves cost.

## 13. Milestones (in order)

1. **Mobile template** — make it config-driven + `generate.mjs` + Android workflow → APK produced (end-to-end)
2. **Electron template** — config-driven + Windows exe workflow
3. **Website** — form + `/api/generate` (code check → repo create → push) + `codes.json` / `generations.csv`
4. **Notifier** — cron workflow + email
5. **Polish** — error states, validation, rate limit (IP), test demo flow

> Important: finish one platform (Android) end-to-end first, then add the others.

## Progress Log

### ✅ Done — Templates pushed to GitHub (public + template repos)
- `t-github-gen-mobile-app` — **PUBLIC + isTemplate: true** ✅ (https://github.com/SatPaingOo/t-github-gen-mobile-app)
- `t-github-gen-electron-app` — **PUBLIC + isTemplate: true** ✅ (https://github.com/SatPaingOo/t-github-gen-electron-app)
- CI + build workflows auto-run on push (verified live on GitHub)
- Fixed along the way:
  - build workflows needed `permissions: contents: write` (generate push + Release → was 403)
  - `android/gradlew` needed the executable bit (git chmod +x) + `chmod +x` in CI (Linux runner)
  - electron-builder needs `--publish never` (it tried to auto-publish → GH_TOKEN error; the `softprops/action-gh-release` step publishes instead)

### ✅ Done — Website (t-github-generate) — MVP committed locally
- Next.js 16 (App Router, TS), form + API:
  - `app/page.tsx` — generate form (appName, email, theme, color picker, logo upload, platform select, code) with error/success states
  - `app/api/generate/route.ts` — validate → consume code → create repo from template (`POST /repos/{owner}/{template}/generate`) → push `app.config.json` + logo (git tree API, `[skip ci]`) → log to `generations.csv` → code refund on failure
  - `lib/sanitize.ts` — appName/color/email/packageName/version/platform validation (mirrors the template generate scripts)
  - `lib/store.ts` — JSON/CSV "DB": `data/codes.json` (single-use codes) + `data/generations.csv` (append-only log; notifier polls this)
  - `lib/github.ts` — Octokit: create repo from template, wait for branch, push config+logo; token from env (`GITHUB_TOKEN`), never in the browser
  - `.env.example` — GITHUB_TOKEN + GITHUB_OWNER
- **Verified**: `next build` passes (static `/` + dynamic `/api/generate`)

### ⏳ Next
1. Push website to GitHub — **DONE** (https://github.com/SatPaingOo/t-github-generate)
2. **Notifier** — cron workflow in website repo: poll `generations.csv` → check build status/release → **email the repo + download link** (SMTP creds as repo secrets)
3. **Polish** — Vercel/self-host deploy, rate limit (IP), demo codes for testing

### ✅ LIVE End-to-End Verification (2026-08-11)
Full flow tested with a real generation on GitHub:
- **New export flow** (no per-app repo): `POST /api/generate` → `build-export` workflow on `t-github-generate` → clone template → build → **artifact committed into `public/exports/{platform}/{slug}/`**
- Android verified: `public/exports/android/demo-export/app.apk` (59.2 MB) + `color-test/app.apk` — valid APK (PK magic), download 200
- `public/exports/android/demo-export/info.json` — appName/slug/platform/theme/colors/version/builtAt next to the artifact
- **App name/theme/colors ARE applied to the artifact** — config → app.config.json → template generate script → native configs (verified by aapt: label, package; colorSecondary fix removed an AppCompat-incompatible attr)
- ⚠️ **Old flow (per-app repo) is retired** — `app-ha-ha-a6md`, `app-test-notes-rmud` were created by the old flow; new flow never creates separate repos (both leftovers to be deleted by owner)
- Demo codes: `DEMO-0001` (used), `DEMO-0002` (used), `DEMO-0003` (used) in `data/codes.json`

### ✅ Design merge (mobile ⇄ desktop)
- Shared core (configs/services/contexts) is **byte-identical** between RN & Electron — same flow & logic (11 files)
- Card design tokens match: `borderRadius: 16`, `padding: 14`, `themes.ts` identical — UI merge
- **Website AppPreview** now faithfully mirrors the real app: BrandBar (secondary color), search + add button, note cards with colored accents, Notes/Todos tab bar; **responsive** — phone = single column, Windows = 2-col grid
- Tests: RN jest 6/6, Electron vitest 4/4 (notes/todos CRUD + sort verified)

### ✅ Default apps (pre-built, direct download — no code)
- `public/defaults/android/app.apk` (59 MB) + `public/defaults/windows/setup.exe` (92 MB) — built from the template repos (fixed builds) and committed
- Website **"Default apps — download now"** section lets users grab a working app instantly, then compare with a generated (custom) one
- Raw download verified: `https://raw.githubusercontent.com/SatPaingOo/t-github-generate/main/public/defaults/{android/app.apk|windows/setup.exe}` (200/206)

### ✅ Local E2E — Android + Windows (both PASS, no GitHub Actions used)
Ran real install → launch → interact on the Android emulator + built Windows exe:
- **Android (emulator, UI-level)**: app launches with custom name; Notes (create/edit/delete + SQLite), Todos (add/toggle done/priority cycle Low→Med→High), **persistence** (force-stop → relaunch → data + done-state survives) — all PASS
- **Windows (exe)**: window visible 1000×720, title = user app name; `electron/db.js` CRUD round-trip (CREATE/READ/UPDATE/DELETE/PERSIST) PASS under Electron ABI; UI renders (CDP: BrandBar, tabs, empty states)
- **3 runtime bugs found & fixed** (all pushed):
  1. Android `AndroidManifest.xml` package tokens — Kotlin package move didn't update `.MainApplication` → ClassNotFoundException crash
  2. Electron packaged `loadFile` path — `app/dist` is at repo root, not under `electron/` → ERR_FILE_NOT_FOUND
  3. `MainActivity.getMainComponentName()` kept `{{APP_NAME_JS}}` token → JS "has not been registered" crash
- **Root cause fixed**: template build workflows had a separate `generate` job that **committed branded files back to the default branch** → tokens were lost → exports cloned a non-pristine template. Merged generate into the build job (no commit) → **template default branch stays pristine with tokens forever**

### ✅ Done — Mobile template (t-github-gen-mobile-app)
- RN 0.86.2 CLI project, config-driven:
  - `app.config.json` schema (shared with electron template)
  - `scripts/generate.mjs` — sanitize config → replace `{{TOKENS}}` → move Kotlin package (fixed for unchanged-package case) → Android mipmap icons → **busts RN autolinking cache** (`tgenVersion` bump — build.gradle namespace changes alone don't invalidate the SHA-keyed autolinking cache)
  - **Sample app: Notes + Todos with SQLite** (`@op-engineering/op-sqlite` v17, sync `executeSync` API)
  - **Folder structure (byte-identical with Electron):** `app/configs/` · `app/services/` (types, db/contract+schema+index, noteRepo, todoRepo) · `app/contexts/` (platform-agnostic ThemeContext — `systemDark` injected by entry, AppContext) · `app/components/` (ui/ + feature) · `app/screens/` · `app/index.tsx`
  - **`@/` path alias** (babel-plugin-module-resolver + tsconfig paths) + `@appConfig` — no more relative imports
  - **Tooling:** `.nvmrc` (22.13) · `.npmrc` (engine-strict) · `.editorconfig` · engines (node ≥22.13, npm ≥10) · packageManager · **husky + lint-staged** pre-commit (eslint --fix + prettier) · **ci.yml** (typecheck + lint + test)
  - `.github/workflows/build-android.yml` — generate → assembleRelease (debug-signed) → Release + artifacts
- **Verified**: tsc ✅ jest ✅ (6 tests incl. shared repos test) eslint ✅ (0 errors) real APK build ✅

### ✅ Done — Electron template (t-github-gen-electron-app)
- Electron 35 + React 19 + Vite 6 + electron-builder 26:
  - **Sample app: Notes + Todos with SQLite** (`better-sqlite3` v13 in main process, sync IPC `tgen:db` via preload)
  - **Folder structure mirrors RN — shared core files are byte-identical (11/11):** `app/src/configs/` · `app/src/services/` · `app/src/contexts/` · `app/src/components/` · `app/src/screens/` · `app/src/App.tsx` — only the platform adapter (`db/sqliteAdapter.ts`) and UI layer differ
  - **`@/` path alias** (vite resolve.alias + tsconfig paths) + `@appConfig`
  - **Tooling:** `.nvmrc` · `.npmrc` · `.editorconfig` · engines · packageManager · **husky + lint-staged** · **eslint (typescript-eslint + react-hooks)** · **vitest** (globals on — the SAME shared test file runs on jest+vitest) · **ci.yml**
  - `.github/workflows/build-windows.yml` — generate → NSIS exe → Release
  - packaging: `better-sqlite3` in `dependencies`, `npmRebuild: true`
- **Verified**: tsc ✅ vitest ✅ (4 shared tests) eslint ✅ (0 errors) vite ✅ exe build ✅ (win32-x64 native binary packaged)
- ⚠️ Note: local exe build requires `npm run generate` first (tokens must be replaced before electron-builder); CI does this automatically. Tokens are restored to pristine state in the repo.

## 14. Open Questions (TBD)

1. **Code system:** single-use (default) or N-uses (`maxUses`)? How are codes distributed (manually by owner)?
2. **Repo name:** is `app-{slug}-{random}` the right format — retry on collision?
3. **Theme:** how many themes in the template (light/dark/...) — does the form have a theme selector?
4. **iOS signing** (future): unsigned build, or a flow where the user uploads their own cert?
