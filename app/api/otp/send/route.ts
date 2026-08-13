import { NextRequest, NextResponse } from 'next/server';
import { sanitizeEmail, ValidationError } from '@/lib/sanitize';
import { emailDomainAcceptsMail } from '@/lib/email';
import { createOtp, discardOtp } from '@/lib/otp';
import { sendEmail, smtpConfigured } from '@/lib/email-send';

export const runtime = 'nodejs';

/**
 * POST /api/otp/send — email a 6-digit verification code to the user.
 * The code is the new "access key": the build only starts after the user
 * proves they received it, which makes fake emails harmless.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const clean = sanitizeEmail(email ?? '');

    // the domain must accept mail — catches obvious typos before we send
    if (!(await emailDomainAcceptsMail(clean))) {
      const domain = clean.split('@')[1] || '';
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_EMAIL',
          message: `The email's domain (${domain}) doesn't exist or doesn't accept mail — check the address and try again.`,
        },
        { status: 400 },
      );
    }

    if (!smtpConfigured()) {
      return NextResponse.json(
        { ok: false, code: 'INTERNAL', message: 'Email service is not configured yet — please try again later.' },
        { status: 500 },
      );
    }

    const created = await createOtp(clean);
    if (!created.ok) {
      const message =
        created.code === 'OTP_SEND_LIMIT'
          ? 'Too many codes sent to this email this hour. Try again in a bit.'
          : `Please wait ${created.retryAfterSec}s before requesting another code.`;
      return NextResponse.json({ ok: false, code: created.code, retryAfterSec: created.retryAfterSec, message }, { status: 429 });
    }

    // store the code, then email it — if sending fails, drop it so the user
    // can retry immediately (no half-baked code left behind)
    try {
      await sendEmail({
        to: clean,
        subject: '🔑 Your TGen verification code',
        html: otpHtml(created.otp as string),
      });
    } catch (err) {
      await discardOtp(clean).catch(() => {});
      console.error('otp send failed:', err);
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          ok: false,
          code: 'INTERNAL',
          message: `Could not send the code (${detail}). Check that the SMTP settings on the server are correct, then try again.`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: 'Code sent — check your inbox (and spam).' });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, code: 'VALIDATION', message: err.message }, { status: 400 });
    }
    console.error('otp send unexpected:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

function otpHtml(otp: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 440px; margin: 0 auto; padding: 24px; background: #F1F5F9; border-radius: 16px;">
      <div style="background: linear-gradient(135deg,#6366F1,#8B5CF6); border-radius: 12px; padding: 18px; text-align: center; color: #fff;">
        <h2 style="margin: 0;">⚡ TGen</h2>
        <p style="margin: 4px 0 0; opacity: 0.85;">Your verification code</p>
      </div>
      <div style="background: #fff; border-radius: 12px; padding: 20px; margin-top: 16px; text-align: center;">
        <p style="margin: 0 0 8px; color: #334155;">Enter this code on the website to start your app build:</p>
        <p style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #4F46E5;">${otp}</p>
        <p style="margin: 14px 0 0; font-size: 12px; color: #94A3B8;">
          Valid for 10 minutes · single use · don't share it
        </p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #94A3B8; margin-top: 16px;">
        Made with TGen — demo app generator · testing purposes only
      </p>
    </div>
  `;
}
