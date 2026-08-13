/**
 * GitHub-backed file store (the "database").
 *
 *   data/codes.json         — valid single-use codes (owner maintains)
 *   data/generations.csv    — append-only generation log
 *
 * Files live IN the repo (t-github-generate) and are read/written through the
 * GitHub Contents API — so it works on Vercel serverless (no writable
 * filesystem) and is persistent across instances. All writes are commits.
 *
 * NOTE: read-modify-write has no atomic locking — fine for a demo scale.
 */

import { createHash } from 'crypto';
import type { CodeRecord, GenerationRecord, GenerationStatus } from './types';
import { readRepoFile, writeRepoFile, getActionsBilling } from './github';
import { maskEmail } from './sanitize';

const CODES_PATH = 'data/codes.json';
const CSV_PATH = 'data/generations.csv';
const RATE_LIMIT_PATH = 'data/rate_limits.json';
const EMAIL_LIMIT_PATH = 'data/email_limits.json';
const QUOTA_PATH = 'data/build_quota.json';

const CSV_HEADER =
  'id,createdAt,email,appName,slug,platform,code,repoUrl,repoName,status,releaseUrl,updatedAt,version\n';

/** Per-IP generation limit (protects Actions minutes). */
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseCsv(text: string): GenerationRecord[] {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    return {
      id: cells[0],
      createdAt: cells[1],
      email: cells[2],
      appName: cells[3],
      slug: cells[4],
      platform: cells[5] as GenerationRecord['platform'],
      code: cells[6],
      repoUrl: cells[7],
      repoName: cells[8],
      status: cells[9] as GenerationStatus,
      releaseUrl: cells[10] || undefined,
      updatedAt: cells[11],
      version: cells[12] || '1.0.0',
    };
  });
}

/* ---------------- codes ---------------- */

export async function listCodes(): Promise<CodeRecord[]> {
  const file = await readRepoFile(CODES_PATH);
  if (!file) return [];
  try {
    return JSON.parse(file.content) as CodeRecord[];
  } catch {
    return [];
  }
}

export async function saveCodes(codes: CodeRecord[]): Promise<void> {
  await writeRepoFile(
    CODES_PATH,
    JSON.stringify(codes, null, 2) + '\n',
    'chore: update codes.json [skip ci]',
  );
}

/**
 * Consume a code if it is valid (exists, has uses left). Returns the record,
 * or null when invalid/already used up.
 */
export async function consumeCode(code: string): Promise<CodeRecord | null> {
  const codes = await listCodes();
  const rec = codes.find(c => c.code === code);
  if (!rec || rec.used >= rec.maxUses) return null;
  rec.used += 1;
  await saveCodes(codes);
  return rec;
}

/* ---------------- generations.csv ---------------- */

export async function appendGeneration(rec: GenerationRecord): Promise<void> {
  const line = [
    rec.id,
    rec.createdAt,
    rec.email,
    rec.appName,
    rec.slug,
    rec.platform,
    rec.code,
    rec.repoUrl,
    rec.repoName,
    rec.status,
    rec.releaseUrl ?? '',
    rec.updatedAt,
    rec.version ?? '1.0.0',
  ]
    .map(escapeCsv)
    .join(',') + '\n';

  const existing = await readRepoFile(CSV_PATH);
  const content = existing ? existing.content + line : CSV_HEADER + line;
  await writeRepoFile(CSV_PATH, content, 'chore: log generation [skip ci]');
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  const file = await readRepoFile(CSV_PATH);
  if (!file) return [];
  return parseCsv(file.content);
}

export async function updateGenerationStatus(
  id: string,
  status: GenerationStatus,
  releaseUrl?: string,
): Promise<void> {
  const file = await readRepoFile(CSV_PATH);
  if (!file) return;
  const lines = file.content.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith(`${id},`)) {
      const cells = lines[i].split(',');
      cells[9] = status;
      cells[10] = releaseUrl ?? '';
      cells[11] = new Date().toISOString();
      lines[i] = cells.join(',');
    }
  }
  await writeRepoFile(CSV_PATH, lines.join('\n'), 'chore: update generation status [skip ci]');
}

export function idGen(prefix = 'gen'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- rate limit (per IP) ---------------- */

interface RateLimitData {
  [ip: string]: number[]; // recent generation timestamps
}

async function readRateLimits(): Promise<RateLimitData> {
  const file = await readRepoFile(RATE_LIMIT_PATH);
  if (!file) return {};
  try {
    return JSON.parse(file.content) as RateLimitData;
  } catch {
    return {};
  }
}

/**
 * Check whether `ip` may generate now. Returns remaining quota (or 0) and
 * how long to wait if blocked.
 */
export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterMin: number;
}> {
  const data = await readRateLimits();
  const now = Date.now();
  const times = (data[ip] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (times.length >= RATE_LIMIT_MAX) {
    const oldest = Math.min(...times);
    const retryAfterMin = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 60000));
    return { allowed: false, remaining: 0, retryAfterMin };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - times.length, retryAfterMin: 0 };
}

/** Record a successful generation for `ip`. */
export async function bumpRateLimit(ip: string): Promise<void> {
  const data = await readRateLimits();
  const now = Date.now();
  data[ip] = (data[ip] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  data[ip].push(now);
  for (const k of Object.keys(data)) {
    if (data[k].length === 0) delete data[k];
  }
  await writeRepoFile(
    RATE_LIMIT_PATH,
    JSON.stringify(data, null, 2) + '\n',
    'chore: rate limit [skip ci]',
  );
}

/* ---------------- email daily limit (privacy-safe) ---------------- */

/** Per-email cap: one build per platform per 24h (protects Actions minutes). */
export const EMAIL_DAILY_MAX = 1;
export const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

interface EmailLimitData {
  [hash: string]: Record<string, number[]>; // platform -> recent timestamps
}

/**
 * Key for a real email WITHOUT persisting it: sha256(salt:email). The masked
 * form can't be used for limits (it collides across users) and the raw form
 * must never be stored — hashing keeps per-email counting while staying
 * privacy-safe. Salt comes from EMAIL_HASH_SALT env (set in Vercel).
 */
export function emailKey(email: string): string {
  const salt = process.env.EMAIL_HASH_SALT ?? 'tgen-demo';
  return createHash('sha256').update(`${salt}:${email.trim().toLowerCase()}`).digest('hex');
}

async function readEmailLimits(): Promise<EmailLimitData> {
  const file = await readRepoFile(EMAIL_LIMIT_PATH);
  if (!file) return {};
  try {
    return JSON.parse(file.content) as EmailLimitData;
  } catch {
    return {};
  }
}

export async function checkEmailLimit(
  email: string,
  platform: string,
): Promise<{ allowed: boolean; remaining: number; retryAfterMin: number }> {
  const data = await readEmailLimits();
  const now = Date.now();
  const times = ((data[emailKey(email)] || {})[platform] || []).filter(
    t => now - t < EMAIL_WINDOW_MS,
  );
  if (times.length >= EMAIL_DAILY_MAX) {
    const oldest = Math.min(...times);
    const retryAfterMin = Math.max(1, Math.ceil((EMAIL_WINDOW_MS - (now - oldest)) / 60000));
    return { allowed: false, remaining: 0, retryAfterMin };
  }
  return { allowed: true, remaining: EMAIL_DAILY_MAX - times.length, retryAfterMin: 0 };
}

/** Record a successful generation for `email` on `platform`. */
export async function bumpEmailLimit(email: string, platform: string): Promise<void> {
  const data = await readEmailLimits();
  const now = Date.now();
  const key = emailKey(email);
  data[key] = data[key] || {};
  data[key][platform] = (data[key][platform] || []).filter(t => now - t < EMAIL_WINDOW_MS);
  data[key][platform].push(now);
  for (const k of Object.keys(data)) {
    for (const p of Object.keys(data[k])) {
      if (data[k][p].length === 0) delete data[k][p];
    }
    if (Object.keys(data[k]).length === 0) delete data[k];
  }
  await writeRepoFile(
    EMAIL_LIMIT_PATH,
    JSON.stringify(data, null, 2) + '\n',
    'chore: email limit [skip ci]',
  );
}

/* ---------------- build queue ---------------- */

/**
 * A generation older than this while still "active" is treated as stale.
 * The workflow marks rows done when it finishes; only an email failure used
 * to leave them stuck as building forever — those must never count against
 * the real queue (they'd inflate the position for everyone behind them).
 */
const ACTIVE_TTL_MS = 4 * 60 * 60 * 1000;

function isActiveNow(g: GenerationRecord): boolean {
  return (
    (g.status === 'building' || g.status === 'queued') &&
    Date.now() - new Date(g.createdAt).getTime() < ACTIVE_TTL_MS
  );
}

/** How many builds are currently active (building or queued, not stale). */
export async function activeBuildCount(): Promise<number> {
  const all = await listGenerations();
  return all.filter(isActiveNow).length;
}

/** 1-based queue position: actives created strictly before `createdAt` + 1. */
export async function queuePositionOf(createdAt: string): Promise<number> {
  const all = await listGenerations();
  const before = all.filter(g => isActiveNow(g) && g.createdAt < createdAt);
  return before.length + 1;
}

/* ---------------- monthly build quota (Actions minutes budget) ---------------- */

/**
 * The owner's GitHub account has a ~2000 min/month Actions budget. Each build
 * costs ~5–15 min, so cap total builds per calendar month well under that.
 * When the cap is hit the site stops accepting builds (no code is consumed)
 * and tells the user it resumes next month.
 */
export const MONTHLY_BUILD_MAX = 120;

interface BuildQuotaData {
  month: string; // YYYY-MM
  builds: number;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function readBuildQuota(): Promise<BuildQuotaData> {
  const file = await readRepoFile(QUOTA_PATH);
  if (!file) return { month: currentMonth(), builds: 0 };
  try {
    const d = JSON.parse(file.content) as BuildQuotaData;
    if (d.month !== currentMonth()) return { month: currentMonth(), builds: 0 }; // new month → reset
    return d;
  } catch {
    return { month: currentMonth(), builds: 0 };
  }
}

export async function getBuildQuota(): Promise<{
  month: string;
  used: number;
  max: number;
  remaining: number;
  available: boolean;
}> {
  const d = await readBuildQuota();
  return {
    month: d.month,
    used: d.builds,
    max: MONTHLY_BUILD_MAX,
    remaining: Math.max(0, MONTHLY_BUILD_MAX - d.builds),
    available: d.builds < MONTHLY_BUILD_MAX,
  };
}

/** Record a successful workflow dispatch for the current month. */
export async function bumpBuildQuota(): Promise<void> {
  const d = await readBuildQuota();
  await writeRepoFile(
    QUOTA_PATH,
    JSON.stringify({ month: currentMonth(), builds: d.builds + 1 }, null, 2) + '\n',
    'chore: build quota [skip ci]',
  );
}

/** Minimum remaining account Actions minutes to allow one more build. */
export const MIN_BUILD_MINUTES = 30;

export interface BuildBudget {
  available: boolean;
  reason: 'MONTHLY_QUOTA' | 'ACTIONS_BUDGET' | null;
  month: string;
  builds: { used: number; max: number; remaining: number };
  minutes: { included: number; used: number; remaining: number } | null;
}

/**
 * Combined budget check:
 *  1. the site's own monthly build cap (always enforced), and
 *  2. the owner's real remaining Actions minutes from GitHub's billing API —
 *     only when GITHUB_BILLING_TOKEN is set (public repo runs are free, so
 *     this matters mostly if the repo is private or other private repos burn
 *     the account's 2000 min). Falls back to the cap alone when absent.
 */
export async function checkBuildBudget(): Promise<BuildBudget> {
  const q = await getBuildQuota();
  const builds = { used: q.used, max: q.max, remaining: q.remaining };
  const billing = await getActionsBilling();
  const minutes = billing
    ? { included: billing.includedMinutes, used: billing.usedMinutes, remaining: billing.remainingMinutes }
    : null;

  if (!q.available) {
    return { available: false, reason: 'MONTHLY_QUOTA', month: q.month, builds, minutes };
  }
  if (minutes && minutes.remaining < MIN_BUILD_MINUTES) {
    return { available: false, reason: 'ACTIONS_BUDGET', month: q.month, builds, minutes };
  }
  return { available: true, reason: null, month: q.month, builds, minutes };
}

/* ---------------- status lookup ---------------- */

export async function getGenerationByEmailAndCode(
  email: string,
  code: string,
): Promise<GenerationRecord | null> {
  const all = await listGenerations();
  const c = code.trim().toUpperCase();
  // emails are stored masked — compare the masked form of the query
  const e = email.trim().toLowerCase();
  const masked = maskEmail(e);
  return (
    all.find(
      g => g.email.toLowerCase() === masked && g.code.toUpperCase() === c,
    ) || null
  );
}

export async function getGenerationsByEmail(email: string): Promise<GenerationRecord[]> {
  const all = await listGenerations();
  const e = email.trim().toLowerCase();
  return all
    .filter(g => g.email.toLowerCase() === e)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
