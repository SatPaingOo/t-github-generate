import { NextResponse } from 'next/server';
import { checkBuildBudget } from '@/lib/store';

export const runtime = 'nodejs';

/**
 * Build budget — the site's monthly build cap plus (when GITHUB_BILLING_TOKEN
 * is configured) the owner's real remaining Actions minutes from GitHub's
 * billing API. Used by the form to show remaining capacity, and tells the
 * client which block applies so it can disable the submit button.
 */
export async function GET() {
  const budget = await checkBuildBudget();
  return NextResponse.json({ ok: true, ...budget });
}
