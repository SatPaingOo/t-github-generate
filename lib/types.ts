/** Shared types for the TGen generate website. */

export type Platform = 'android' | 'windows' | 'ios' | 'macos';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface GenerateRequest {
  appName: string;
  theme: ThemeMode;
  primaryColor: string;
  secondaryColor?: string;
  logoBase64?: string; // data URL or raw base64 (PNG/JPEG) — optional
  supportEmail: string;
  platform: Platform;
  otp: string; // 6-digit code emailed to the user (proves email ownership)
  packageName?: string; // optional, default derived
  version?: string; // optional, default 1.0.0
}

export interface GenerateResponse {
  ok: boolean;
  code?:
    | 'INVALID_EMAIL'
    | 'OTP_INVALID'
    | 'OTP_EXPIRED'
    | 'OTP_LIMIT'
    | 'EMAIL_LIMIT'
    | 'IP_LIMIT'
    | 'MONTHLY_QUOTA'
    | 'ACTIONS_BUDGET'
    | 'VALIDATION'
    | 'INTERNAL';
  retryAfterMin?: number;
  retryAfterSec?: number;
  attemptsLeft?: number;
  blockedPlatform?: string;
  queuePosition?: number;
  trackingCode?: string;
  repoUrl?: string;
  downloadUrl?: string;
  repoName?: string;
  message: string;
}

export interface CodeRecord {
  code: string;
  maxUses: number;
  used: number;
  createdAt: string;
}

export type GenerationStatus = 'queued' | 'building' | 'done' | 'failed';

export interface GenerationRecord {
  id: string;
  createdAt: string;
  email: string;
  appName: string;
  slug: string;
  platform: Platform;
  code: string;
  repoUrl: string;
  repoName: string;
  status: GenerationStatus;
  releaseUrl?: string;
  updatedAt: string;
  version?: string;
}
