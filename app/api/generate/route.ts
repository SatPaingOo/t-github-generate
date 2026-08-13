import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, ValidationError, maskEmail } from '@/lib/sanitize';
import { emailDomainAcceptsMail } from '@/lib/email';
import { verifyOtp, generateTrackingCode } from '@/lib/otp';
import {
  appendGeneration,
  idGen,
  checkRateLimit,
  bumpRateLimit,
  checkEmailLimit,
  bumpEmailLimit,
  bumpBuildQuota,
  checkBuildBudget,
  activeBuildCount,
  RATE_LIMIT_MAX,
} from '@/lib/store';
import { exportDirUrl, exportRawUrl, triggerExportBuild, uploadExportLogo } from '@/lib/github';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as GenerateRequest;

    // 1. validate + sanitize the form payload
    const v = validateRequest(raw);

    // 1a. the email's domain must actually accept mail (MX records) — a fake
    //     address must be rejected HERE, before any code is consumed or a
    //     build (and its Actions minutes) is burned.
    if (!(await emailDomainAcceptsMail(v.supportEmail))) {
      const domain = v.supportEmail.split('@')[1] || '';
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_EMAIL',
          message: `The email's domain (${domain}) doesn't exist or doesn't accept mail — check the address and try again.`,
        },
        { status: 400 },
      );
    }

    // 1b. per-IP rate limit (protects Actions minutes)
    const ip = clientIp(req);
    const limit = await checkRateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          code: 'IP_LIMIT',
          retryAfterMin: limit.retryAfterMin,
          message: `Too many requests from this IP (max ${RATE_LIMIT_MAX} per hour). Try again in ~${limit.retryAfterMin} min.`,
        },
        { status: 429 },
      );
    }

    // 1c. per-email daily limit — one build per platform per 24h
    const emailLimit = await checkEmailLimit(v.supportEmail, v.platform);
    if (!emailLimit.allowed) {
      const platformLabel = v.platform === 'windows' ? 'Windows' : 'Android';
      const otherPlatform = v.platform === 'windows' ? 'android' : 'windows';
      return NextResponse.json(
        {
          ok: false,
          code: 'EMAIL_LIMIT',
          retryAfterMin: emailLimit.retryAfterMin,
          blockedPlatform: v.platform,
          message: `This email already generated a ${platformLabel} app today (1 build per platform per day). Try again in ~${emailLimit.retryAfterMin} min, or generate a ${otherPlatform === 'windows' ? 'Windows' : 'Android'} app instead.`,
        },
        { status: 429 },
      );
    }

    // 1d. combined build budget — the site's monthly cap + (when configured)
    //     the owner's real remaining Actions minutes from GitHub billing.
    //     Checked BEFORE consuming a code so no codes are wasted when full.
    const budget = await checkBuildBudget();
    if (!budget.available) {
      if (budget.reason === 'ACTIONS_BUDGET' && budget.minutes) {
        return NextResponse.json(
          {
            ok: false,
            code: 'ACTIONS_BUDGET',
            message: `The account's GitHub Actions minutes are nearly used up (${budget.minutes.remaining} min left of ${budget.minutes.included}). Generation is paused until the next billing cycle — please try again later.`,
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          code: 'MONTHLY_QUOTA',
          message: `TGen's monthly build budget (${budget.builds.max} builds) for ${budget.month} is used up. New builds resume on the 1st of next month.`,
        },
        { status: 429 },
      );
    }

    // 2. verify the emailed code — the ownership gate before anything is
    //    spent. A fake/typo'd email can't get past this (no code arrives),
    //    so no build is ever burned on an address the user doesn't have.
    const otpCheck = await verifyOtp(v.supportEmail, v.otp);
    if (!otpCheck.ok) {
      const message =
        otpCheck.code === 'OTP_EXPIRED'
          ? 'That code has expired — request a new one.'
          : otpCheck.code === 'OTP_LIMIT'
            ? 'Too many wrong attempts — request a new code.'
            : `Wrong code${typeof otpCheck.attemptsLeft === 'number' ? ` — ${otpCheck.attemptsLeft} attempt${otpCheck.attemptsLeft === 1 ? '' : 's'} left` : ''}. Check the 6-digit code we emailed you.`;
      return NextResponse.json(
        { ok: false, code: otpCheck.code, attemptsLeft: otpCheck.attemptsLeft, message },
        { status: 400 },
      );
    }

    // the user proved they own the email — mint a tracking code for the
    // status page (email + tracking code), and start the build
    const trackingCode = generateTrackingCode();

    try {
      // 3. optional: stage the logo so the export workflow can use it
      if (v.logoBytes) {
        await uploadExportLogo(v.slug, v.logoBytes);
      }

      // 4. trigger the build-export workflow on this repo
      await triggerExportBuild({
        platform: v.platform,
        appName: v.appName,
        slug: v.slug,
        theme: v.theme,
        primaryColor: v.primaryColor,
        secondaryColor: v.secondaryColor,
        supportEmail: v.supportEmail,
        packageName: v.packageName,
        version: v.version,
      });
    } catch (err) {
      console.error('generate failed:', err);
      return NextResponse.json(
        { ok: false, code: 'INTERNAL', message: `Generation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      );
    }

    // 5. log the generation — status is "queued" when another build is
    //    active (GitHub Actions serializes them via concurrency), else
    //    "building". email is stored MASKED — the real email only flows to
    //    the workflow (via dispatch payload) for the notifier, never into
    //    the public CSV.
    const activeCount = await activeBuildCount();
    const queued = activeCount > 0;
    const queuePosition = activeCount + 1;
    const filename =
      v.platform === 'windows'
        ? `${v.slug}-Setup-v${v.version}.exe`
        : `${v.slug}-v${v.version}.apk`;
    await appendGeneration({
      id: idGen(),
      createdAt: new Date().toISOString(),
      email: maskEmail(v.supportEmail),
      appName: v.appName,
      slug: v.slug,
      platform: v.platform,
      code: trackingCode,
      repoUrl: exportDirUrl(v.platform, v.slug),
      repoName: `public/exports/${v.platform}/${v.slug}`,
      status: queued ? 'queued' : 'building',
      updatedAt: new Date().toISOString(),
      version: v.version,
    });

    // 6. record this IP + email + monthly quota (rate limits)
    await bumpRateLimit(ip);
    await bumpEmailLimit(v.supportEmail, v.platform);
    await bumpBuildQuota();

    return NextResponse.json({
      ok: true,
      trackingCode,
      repoUrl: exportDirUrl(v.platform, v.slug),
      downloadUrl: exportRawUrl(v.platform, v.slug, filename),
      queuePosition,
      message: queued
        ? `You're #${queuePosition} in the build queue — the current build finishes first, then yours starts (~10-15 min after it begins).`
        : 'Build started! Your app file will appear in ~10-15 min — check the link below.',
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, code: 'VALIDATION', message: err.message },
        { status: 400 },
      );
    }
    console.error('unexpected:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
