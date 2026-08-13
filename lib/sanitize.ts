/** Input sanitization + validation for the generate form. */

import type { GenerateRequest, Platform, ThemeMode } from './types';

const ALLOWED_PLATFORMS: Platform[] = ['android', 'windows', 'ios', 'macos'];
const ALLOWED_THEMES: ThemeMode[] = ['light', 'dark', 'system'];

export class ValidationError extends Error {}

export function sanitizeAppName(name: string): string {
  if (typeof name !== 'string' || !name.trim()) throw new ValidationError('App name is required.');
  return name.replace(/["'`<>;\\\n\r\t]/g, '').trim().slice(0, 40);
}

/** JS-safe name for the RN component name / Gradle project name (e.g. "My Cool App!" → "MyCoolApp"). */
export function toJsName(appName: string): string {
  const base = appName.replace(/[^a-zA-Z0-9]/g, '');
  if (!base) throw new ValidationError('App name must contain at least one letter or number.');
  const named = base.charAt(0).toUpperCase() + base.slice(1);
  return /^[a-zA-Z]/.test(named) ? named : `App${named}`;
}

/** Lowercase dashed slug from app name (e.g. "My Cool App" → "my-cool-app"). */
export function toSlug(appName: string): string {
  const slug = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'app';
}

export function sanitizePackageName(pkg: string | undefined, slug: string): string {
  const fallback = `com.tgen.${slug.replace(/[^a-z0-9]/g, '') || 'app'}`;
  const candidate = (pkg || fallback).trim();
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(candidate)) {
    throw new ValidationError('Package name must be lowercase dot-separated (e.g. com.example.myapp).');
  }
  return candidate.toLowerCase();
}

export function sanitizeColor(color: string, label = 'Color'): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw new ValidationError(`${label} must be #RGB or #RRGGBB.`);
  }
  return color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase()
    : color.toLowerCase();
}

export function sanitizeTheme(theme: string): ThemeMode {
  if (!ALLOWED_THEMES.includes(theme as ThemeMode)) return 'light';
  return theme as ThemeMode;
}

export function sanitizePlatform(platform: string): Platform {
  if (!ALLOWED_PLATFORMS.includes(platform as Platform)) {
    throw new ValidationError(`Platform "${platform}" is not supported.`);
  }
  return platform as Platform;
}

export function sanitizeVersion(version: string | undefined): string {
  if (!version) return '1.0.0';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new ValidationError('Version must be semver (e.g. 1.0.0).');
  return version;
}

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new ValidationError('A valid email is required (we send the repo link there).');
  }
  return email.trim().toLowerCase();
}

/**
 * Mask an email so the full address never lands in a public log/CSV.
 * e.g. satpaingoov2@gmail.com → satp*****@gmail.com
 * Status lookup matches on the masked form + the single-use code.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 4);
  const dots = local.length > 4 ? '*****' : '**';
  return `${visible}${dots}@${domain}`;
}

/** Validate a user-supplied logo (data URL) — decode, size-check, return bytes. */
export function decodeLogo(logoBase64: string | undefined): Buffer | null {
  if (!logoBase64) return null;
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(logoBase64.trim());
  if (!match) throw new ValidationError('Logo must be a PNG or JPEG image.');
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new ValidationError('Logo must be under 2 MB.');
  return buf;
}

/** The 6-digit verification code emailed to the user. */
export function sanitizeOtp(otp: string): string {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    throw new ValidationError('Enter the 6-digit code we emailed you.');
  }
  return otp.trim();
}

/** Full validation + normalization of a generate request. */
export function validateRequest(raw: GenerateRequest) {
  const appName = sanitizeAppName(raw.appName);
  const slug = toSlug(appName);
  return {
    appName,
    slug,
    jsName: toJsName(appName),
    theme: sanitizeTheme(raw.theme),
    primaryColor: sanitizeColor(raw.primaryColor),
    secondaryColor: sanitizeColor(raw.secondaryColor || '#64748B', 'Secondary color'),
    supportEmail: sanitizeEmail(raw.supportEmail),
    platform: sanitizePlatform(raw.platform),
    otp: sanitizeOtp(raw.otp),
    packageName: sanitizePackageName(raw.packageName, slug),
    version: sanitizeVersion(raw.version),
    logoBytes: decodeLogo(raw.logoBase64),
  };
}
