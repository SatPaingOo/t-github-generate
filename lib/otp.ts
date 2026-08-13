/**
 * Email OTP (one-time code) verification — the gate before any build.
 *
 * Replaces pre-generated access codes: the user enters an email, we email a
 * 6-digit code, and the build only starts after they prove they received it.
 * This makes fake/typo'd addresses harmless — a code that never arrives can't
 * be entered, so no build is ever burned on an email the owner doesn't have.
 *
 * Privacy: only salted hashes are stored (email-hash → otp-hash), never the
 * raw email or the raw code. Codes are single-use, expire after 10 min, and
 * lock after 5 failed attempts.
 */
import { createHash, randomInt } from 'crypto';
import { readRepoFile, writeRepoFile } from './github';
import { emailKey } from './store';

const OTPS_PATH = 'data/otps.json';
const OTP_TTL_MS = 10 * 60 * 1000; // code valid for 10 min
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 min between sends
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000; // hourly send budget
const OTP_SEND_MAX = 5; // 5 sends / hour / email

interface OtpRecord {
  otpHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  sendCount: number; // sends within the last hour window
  firstSendAt: number;
}

type OtpData = Record<string, OtpRecord>;

function hashOtp(email: string, otp: string): string {
  const salt = process.env.OTP_HASH_SALT ?? 'tgen-otp';
  return createHash('sha256').update(`${salt}:${email.trim().toLowerCase()}:${otp}`).digest('hex');
}

async function readOtps(): Promise<OtpData> {
  const file = await readRepoFile(OTPS_PATH);
  if (!file) return {};
  try {
    return JSON.parse(file.content) as OtpData;
  } catch {
    return {};
  }
}

async function writeOtps(data: OtpData): Promise<void> {
  await writeRepoFile(OTPS_PATH, JSON.stringify(data, null, 2) + '\n', 'chore: otp [skip ci]');
}

/** Generate a fresh 6-digit code. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Human-friendly build tracking code, e.g. TGEN-8K3F9Z2A (status page key). */
export function generateTrackingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)];
  return `TGEN-${out}`;
}

export interface SendOtpResult {
  ok: boolean;
  otp?: string;
  code?: 'OTP_COOLDOWN' | 'OTP_SEND_LIMIT';
  retryAfterSec?: number;
}

/**
 * Create + store a code for `email`, ready to be emailed. Enforces a resend
 * cooldown and an hourly send budget (protects the SMTP quota and abuse).
 */
export async function createOtp(email: string): Promise<SendOtpResult> {
  const data = await readOtps();
  const key = emailKey(email);
  const now = Date.now();
  const rec = data[key];

  if (rec) {
    if (now - rec.lastSentAt < RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (now - rec.lastSentAt)) / 1000);
      return { ok: false, code: 'OTP_COOLDOWN', retryAfterSec };
    }
    // count sends within the last hour
    const windowed = now - rec.firstSendAt < OTP_SEND_WINDOW_MS;
    if (windowed && rec.sendCount >= OTP_SEND_MAX) {
      return { ok: false, code: 'OTP_SEND_LIMIT' };
    }
  }

  const otp = generateOtp();
  data[key] = {
    otpHash: hashOtp(email, otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: rec && now - rec.firstSendAt < OTP_SEND_WINDOW_MS ? rec.sendCount + 1 : 1,
    firstSendAt: rec && now - rec.firstSendAt < OTP_SEND_WINDOW_MS ? rec.firstSendAt : now,
  };
  await writeOtps(data);
  return { ok: true, otp };
}

export interface VerifyOtpResult {
  ok: boolean;
  code?: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_LIMIT';
  attemptsLeft?: number;
}

/**
 * Verify the code the user entered. Consumes the code on success (single-use);
 * increments attempts on failure and locks the code after too many tries.
 */
export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
  const data = await readOtps();
  const key = emailKey(email);
  const rec = data[key];
  if (!rec) return { ok: false, code: 'OTP_INVALID' };

  if (Date.now() > rec.expiresAt) {
    delete data[key];
    await writeOtps(data);
    return { ok: false, code: 'OTP_EXPIRED' };
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    delete data[key];
    await writeOtps(data);
    return { ok: false, code: 'OTP_LIMIT' };
  }
  if (hashOtp(email, otp) !== rec.otpHash) {
    rec.attempts += 1;
    await writeOtps(data);
    return { ok: false, code: 'OTP_INVALID', attemptsLeft: OTP_MAX_ATTEMPTS - rec.attempts };
  }
  delete data[key];
  await writeOtps(data);
  return { ok: true };
}

/** Drop a pending code (e.g. SMTP send failed) so the user can retry cleanly. */
export async function discardOtp(email: string): Promise<void> {
  const data = await readOtps();
  delete data[emailKey(email)];
  await writeOtps(data);
}
