/**
 * One-off SMTP test (GitHub Actions) — verifies Gmail creds work.
 * Tries port 465 (implicit TLS) then 587 (STARTTLS), forcing IPv4.
 */

import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';

const { address: ipv4 } = await dns.lookup(process.env.SMTP_HOST, { family: 4 });
const to = process.env.TO || process.env.SMTP_USER;
const auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
const servername = process.env.SMTP_HOST;

async function trySend(port, secure) {
  const transporter = nodemailer.createTransport({
    host: ipv4,
    port,
    secure,
    tls: { servername },
    connectionTimeout: 20000,
    auth,
  });
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: '✅ TGen SMTP test — it works!',
    text: 'SMTP is configured correctly. Build-complete emails will now be sent.',
  });
  return port;
}

for (const [port, secure] of [[465, true], [587, false]]) {
  try {
    const used = await trySend(port, secure);
    console.log(`Test email sent to ${to} via port ${used}`);
    process.exit(0);
  } catch (err) {
    console.log(`port ${port} failed: ${err.message}`);
  }
}
console.error('ALL SMTP PORTS FAILED');
process.exit(1);
