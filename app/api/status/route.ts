import { NextRequest, NextResponse } from 'next/server';
import { getGenerationByEmailAndCode, queuePositionOf } from '@/lib/store';
import { exportRawUrl, exportDirUrl } from '@/lib/github';

export const runtime = 'nodejs';

/**
 * Status API — given the email + single-use code used at generation time,
 * return that build with live status.
 * GET /api/status?email=user@example.com&code=TGEN-XXXXXXX
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim();
  const code = req.nextUrl.searchParams.get('code')?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, message: 'A valid email is required.' }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json(
      { ok: false, message: 'The access code is required (it is the key to your build).' },
      { status: 400 },
    );
  }

  const gen = await getGenerationByEmailAndCode(email, code);
  if (!gen) {
    return NextResponse.json(
      { ok: false, message: 'No build found for this email + code pair.' },
      { status: 404 },
    );
  }

  const version = gen.version || '1.0.0';
  const filename =
    gen.platform === 'windows'
      ? `${gen.slug}-Setup-v${version}.exe`
      : `${gen.slug}-v${version}.apk`;

  const queuePosition =
    gen.status === 'queued' || gen.status === 'building'
      ? await queuePositionOf(gen.createdAt)
      : undefined;

  return NextResponse.json({
    ok: true,
    build: {
      id: gen.id,
      appName: gen.appName,
      slug: gen.slug,
      platform: gen.platform,
      status: gen.status,
      queuePosition,
      createdAt: gen.createdAt,
      updatedAt: gen.updatedAt,
      downloadUrl: exportRawUrl(gen.platform, gen.slug, filename),
      folderUrl: exportDirUrl(gen.platform, gen.slug),
    },
  });
}
