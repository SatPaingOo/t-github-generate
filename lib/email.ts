/**
 * Pre-build email checks.
 *
 * A full "does this inbox exist" check requires sending the address a mail
 * (SMTP servers accept unknown addresses to prevent enumeration — Gmail
 * returns 250 for anything). What we CAN do cheaply and reliably before
 * burning an Actions build is verify the domain actually accepts mail via
 * its MX records — this catches obviously fake addresses like
 * `user@no-such-domain.com` instantly.
 */
import { resolveMx } from 'node:dns/promises';

/** Does the email's domain have MX records (i.e. can it receive mail)? */
export async function emailDomainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return false;
  try {
    const mx = await resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false; // NXDOMAIN / no MX → doesn't accept mail
  }
}
