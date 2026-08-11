import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, ValidationError } from '@/lib/sanitize';
import { consumeCode, appendGeneration, idGen, listCodes, saveCodes } from '@/lib/store';
import { buildAppConfig, createGeneratedRepo, TEMPLATE_REPOS } from '@/lib/github';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as GenerateRequest;

    // 1. validate + sanitize the form payload
    const v = validateRequest(raw);

    // 2. consume the code (single-use) — this is the rate limiter
    const code = consumeCode(v.code);
    if (!code) {
      return NextResponse.json(
        { ok: false, message: 'Invalid or already-used code.' },
        { status: 400 },
      );
    }

    // 3. create the new repo from the platform template
    const templateRepo = TEMPLATE_REPOS[v.platform];
    if (!templateRepo) {
      return NextResponse.json(
        { ok: false, message: `No template for platform "${v.platform}".` },
        { status: 400 },
      );
    }

    const repoName = `app-${v.slug}-${Math.random().toString(36).slice(2, 6)}`;
    const appConfig = buildAppConfig({
      appName: v.appName,
      slug: v.slug,
      theme: v.theme,
      primaryColor: v.primaryColor,
      supportEmail: v.supportEmail,
      platform: v.platform,
      packageName: v.packageName,
      version: v.version,
      jsName: v.jsName,
    });

    let repoFullName: string;
    try {
      const created = await createGeneratedRepo({
        repoName,
        templateRepo,
        appConfig,
        logoBytes: v.logoBytes,
      });
      repoFullName = created.fullName;
    } catch (err) {
      // refund the code so the user can retry
      const codes = listCodes();
      const rec = codes.find(c => c.code === v.code);
      if (rec) {
        rec.used = Math.max(0, rec.used - 1);
        saveCodes(codes);
      }
      console.error('generate failed:', err);
      return NextResponse.json(
        { ok: false, message: `Generation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      );
    }

    // 4. log the generation (notifier workflow emails the user when the build is done)
    appendGeneration({
      id: idGen(),
      createdAt: new Date().toISOString(),
      email: v.supportEmail,
      appName: v.appName,
      slug: v.slug,
      platform: v.platform,
      code: v.code,
      repoUrl: `https://github.com/${repoFullName}`,
      repoName: repoFullName,
      status: 'building',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      repoUrl: `https://github.com/${repoFullName}`,
      repoName: repoFullName,
      message:
        'Build started! We will email you the download link when it is ready (10–20 min).',
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
