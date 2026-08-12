import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, ValidationError } from '@/lib/sanitize';
import {
  consumeCode,
  appendGeneration,
  idGen,
  listCodes,
  saveCodes,
  checkRateLimit,
  bumpRateLimit,
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

    // 5. log the generation (status = building; artifact lands in public/exports)
    //    artifact filename uses the user's app (slug + version) — must match build-export.yml
    const filename =
      v.platform === 'windows'
        ? `${v.slug}-Setup-v${v.version}.exe`
        : `${v.slug}-v${v.version}.apk`;
    await appendGeneration({
      id: idGen(),
      createdAt: new Date().toISOString(),
      email: v.supportEmail,
      appName: v.appName,
      slug: v.slug,
      platform: v.platform,
      code: v.code,
      repoUrl: exportDirUrl(v.platform, v.slug),
      repoName: `public/exports/${v.platform}/${v.slug}`,
      status: 'building',
      updatedAt: new Date().toISOString(),
      version: v.version,
    });

    // 6. record this IP's generation (rate limit)
    await bumpRateLimit(ip);

    return NextResponse.json({
      ok: true,
      repoUrl: exportDirUrl(v.platform, v.slug),
      downloadUrl: exportRawUrl(v.platform, v.slug, filename),
      message:
        'Build started! Your app file will appear in ~10-15 min — check the link below.',
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
