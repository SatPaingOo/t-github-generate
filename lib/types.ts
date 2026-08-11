/** Shared types for the TGen generate website. */

export type Platform = 'android' | 'windows' | 'ios' | 'macos';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface GenerateRequest {
  appName: string;
  theme: ThemeMode;
  primaryColor: string;
  logoBase64?: string; // data URL or raw base64 (PNG/JPEG) — optional
  supportEmail: string;
  platform: Platform;
  code: string;
  packageName?: string; // optional, default derived
  version?: string; // optional, default 1.0.0
}

export interface GenerateResponse {
  ok: boolean;
  repoUrl?: string;
  repoName?: string;
  message: string;
}

export interface CodeRecord {
  code: string;
  maxUses: number;
  used: number;
  createdAt: string;
}

export type GenerationStatus = 'building' | 'done' | 'failed';

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
}
