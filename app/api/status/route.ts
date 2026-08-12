import { NextRequest, NextResponse } from 'next/server';
import { getGenerationsByEmail } from '@/lib/store';
import { exportRawUrl, exportDirUrl } from '@/lib/github';

export const runtime = 'nodejs';

/**
 * Status API — given an email, return all builds for it with live status.
 * GET /api/status?email=user@example.com
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, message: 'A valid email is required.' }, { status: 400 });
  }

  const gens = await getGenerationsByEmail(email);

  const builds = gens.map(g => {
    const version = g.version || '1.0.0';
    const filename =
      g.platform === 'windows'
        ? `${g.slug}-Setup-v${version}.exe`
        : `${g.slug}-v${version}.apk`;
    return {
      id: g.id,
      appName: g.appName,
      slug: g.slug,
      platform: g.platform,
      status: g.status,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      downloadUrl: exportRawUrl(g.platform, g.slug, filename),
      folderUrl: exportDirUrl(g.platform, g.slug),
    };
  });

  return NextResponse.json({ ok: true, email, builds });
}
