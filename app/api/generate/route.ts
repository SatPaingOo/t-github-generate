import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, ValidationError, maskEmail } from '@/lib/sanitize';
import {
  consumeCode,
  appendGeneration,
  idGen,
  listCodes,
  saveCodes,
  checkRateLimit,
  bumpRateLimit,
  checkEmailLimit,
  bumpEmailLimit,
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

    // 1b. per-IP rate limit (protects Actions minutes)
    const ip = clientIp(req);
    const limit = await checkRateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          message: `Too many requests from this IP (max ${RATE_LIMIT_MAX} per hour). Try again in ~${limit.retryAfterMin} min.`,
        },
        { status: 429 },
      );
    }

    // 1c. per-email daily limit — one build per platform per 24h
    const emailLimit = await checkEmailLimit(v.supportEmail, v.platform);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          message: `This email already generated a ${v.platform === 'windows' ? 'Windows' : 'Android'} app today. Try again in ~${emailLimit.retryAfterMin} min.`,
        },
        { status: 429 },
      );
    }

    // 2. consume the code (single-use)
    const code = await consumeCode(v.code);
    if (!code) {
      return NextResponse.json(
        { ok: false, message: 'Invalid or already-used code.' },
        { status: 400 },
      );
    }

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
      // refund the code so the user can retry
      const codes = await listCodes();
      const rec = codes.find(c => c.code === v.code);
      if (rec) {
        rec.used = Math.max(0, rec.used - 1);
        await saveCodes(codes);
      }
      console.error('generate failed:', err);
      return NextResponse.json(
        { ok: false, message: `Generation failed: ${err instanceof Error ? err.message : String(err)}` },
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
      code: v.code,
      repoUrl: exportDirUrl(v.platform, v.slug),
      repoName: `public/exports/${v.platform}/${v.slug}`,
      status: queued ? 'queued' : 'building',
      updatedAt: new Date().toISOString(),
      version: v.version,
    });

    // 6. record this IP + email's generation (rate limits)
    await bumpRateLimit(ip);
    await bumpEmailLimit(v.supportEmail, v.platform);

    return NextResponse.json({
      ok: true,
      repoUrl: exportDirUrl(v.platform, v.slug),
      downloadUrl: exportRawUrl(v.platform, v.slug, filename),
      queuePosition,
      message: queued
        ? `You're #${queuePosition} in the build queue — the current build finishes first, then yours starts (~10-15 min after it begins).`
        : 'Build started! Your app file will appear in ~10-15 min — check the link below.',
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    console.error('unexpected:', err);
    return NextResponse.json(
      { ok: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
