/**
 * SMTP email sending from the website (Vercel serverless).
 *
 * Used by the OTP flow to deliver the verification code. Requires the SMTP
 * env vars (same Gmail creds used by the build workflow — here they live in
 * Vercel so the site itself can send). Reuses the runner lessons: resolve the
 * host to IPv4 and keep the hostname as TLS SNI, with 465 → 587 fallback.
 */
import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host || !smtpConfigured()) {
    throw new Error('SMTP is not configured on the server.');
  }

  let smtpIpv4 = host;
  try {
    const { address } = await dns.lookup(host, { family: 4 });
    smtpIpv4 = address;
  } catch {
    // keep the hostname — some setups resolve fine without forcing IPv4
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  const transport = nodemailer.createTransport({
    host: smtpIpv4,
    port,
    secure,
    tls: { servername: host },
    connectionTimeout: 15000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
  } catch (err) {
    // fallback: try the alternate port (465 ⇄ 587)
    if (secure) {
      const fallback = nodemailer.createTransport({
        host: smtpIpv4,
        port: 587,
        secure: false,
        tls: { servername: host },
        connectionTimeout: 15000,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await fallback.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
      return;
    }
    throw err;
  }
}
