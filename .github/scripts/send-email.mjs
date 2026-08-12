/**
 * Send build-complete email to the user who generated the app.
 *
 * Reads the matching row from data/generations.csv (GitHub store — the API
 * writes it before dispatching the export build), then emails the download
 * link via SMTP (Gmail). Run inside the build-export workflow after the
 * artifact is committed.
 *
 * Env: SLUG, PLATFORM, APP_NAME, VERSION, SMTP_HOST, SMTP_PORT, SMTP_USER,
 *      SMTP_PASS, (EMAIL_FROM optional — falls back to SMTP_USER)
 */

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import dns from 'node:dns/promises';

// GitHub runners have no IPv6 → resolve the SMTP host to IPv4 and keep the
// hostname as the TLS SNI (nodemailer's `family` option is unreliable).
const { address: smtpIpv4 } = await dns.lookup(process.env.SMTP_HOST, {
  family: 4,
});

/** Mark the matching generation row as done (build + email succeeded). */
function markDone(slug, platform) {
  const p = 'data/generations.csv';
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells[4] === slug && cells[5] === platform) {
      cells[9] = 'done'; // status
      cells[11] = new Date().toISOString(); // updatedAt
      lines[i] = cells.join(',');
    }
  }
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

const slug = process.env.SLUG;
const platform = process.env.PLATFORM;
const appName = process.env.APP_NAME;
const version = process.env.VERSION || '1.0.0';

// generations.csv columns: id,createdAt,email,appName,slug,platform,code,repoUrl,repoName,status,releaseUrl,updatedAt
const csv = fs.existsSync('data/generations.csv')
  ? fs.readFileSync('data/generations.csv', 'utf8')
  : '';
const rows = csv.split('\n').filter(Boolean).slice(1);
const match = rows
  .map(line => line.split(','))
  .find(cells => cells[4] === slug && cells[5] === platform);

const email = match ? match[2] : null;
if (!email) {
  console.log(`[email] no generations.csv row for ${slug}/${platform} — skipping`);
  process.exit(0);
}

const filename =
  platform === 'windows'
    ? `${slug}-Setup-v${version}.exe`
    : `${slug}-v${version}.apk`;
const downloadUrl = `https://raw.githubusercontent.com/SatPaingOo/t-github-generate/main/public/exports/${platform}/${slug}/${filename}`;
const folderUrl = `https://github.com/SatPaingOo/t-github-generate/tree/main/public/exports/${platform}/${slug}`;

const platformLabel = platform === 'windows' ? 'Windows' : 'Android';

async function sendOnPort(port, secure) {
  const t = nodemailer.createTransport({
    host: smtpIpv4,
    port,
    secure,
    tls: { servername: process.env.SMTP_HOST },
    connectionTimeout: 20000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: `🎉 ${appName} is ready! (${platformLabel})`,
    html: htmlBody,
  });
}

const htmlBody = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #F1F5F9; border-radius: 16px;">
    <div style="background: linear-gradient(135deg,#6366F1,#8B5CF6); border-radius: 12px; padding: 20px; text-align: center; color: #fff;">
      <h2 style="margin: 0;">⚡ ${appName}</h2>
      <p style="margin: 4px 0 0; opacity: 0.85;">Your ${platformLabel} app is ready!</p>
    </div>
    <div style="background: #fff; border-radius: 12px; padding: 20px; margin-top: 16px;">
      <p style="margin: 0 0 12px; color: #334155;">Download your app file below:</p>
      <a href="${downloadUrl}" style="display: block; text-align: center; background: #6366F1; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600;">
        ⬇ Download ${filename}
      </a>
      <p style="margin: 16px 0 0; font-size: 12px; color: #64748B;">
        Or view the export folder:<br/>
        <a href="${folderUrl}" style="color: #6366F1;">${folderUrl}</a>
      </p>
    </div>
    <p style="text-align: center; font-size: 11px; color: #94A3B8; margin-top: 16px;">
      Made with TGen — demo app generator · testing purposes only
    </p>
  </div>
`;

for (const [port, secure] of [[465, true], [587, false]]) {
  try {
    await sendOnPort(port, secure);
    markDone(slug, platform);
    console.log(`[email] sent to ${email} via port ${port}`);
    process.exit(0);
  } catch (err) {
    console.log(`[email] port ${port} failed: ${err.message}`);
  }
}
console.error('[email] ALL SMTP PORTS FAILED');
process.exit(1);
