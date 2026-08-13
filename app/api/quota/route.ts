import { NextResponse } from 'next/server';
import { getBuildQuota } from '@/lib/store';

export const runtime = 'nodejs';

/** Monthly build budget — used by the form to show remaining builds. */
export async function GET() {
  const quota = await getBuildQuota();
  return NextResponse.json({ ok: true, ...quota });
}
