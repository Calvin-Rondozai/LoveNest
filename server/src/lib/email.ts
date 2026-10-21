import { Resend } from 'resend';
import { env, isProd } from '../env.js';

export type Email = { to: string; subject: string; text: string; html?: string };

/** Emails "sent" while NODE_ENV=test, so tests can read codes. */
export const testOutbox: Email[] = [];

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** How outbound mail is delivered right now (for /health and OTP responses). */
export function emailDeliveryMode(): 'resend' | 'console' | 'test' {
  if (env.NODE_ENV === 'test') return 'test';
  return resend ? 'resend' : 'console';
}

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY, development prints the
 * email to the terminal; production refuses to start without it (see env check below).
 *
 * With Resend's free `onboarding@resend.dev` sender you can only deliver to the email address
 * on your Resend account. Verify your own domain and set EMAIL_FROM before emailing customers.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(email);
    return;
  }
  if (!resend) {
    // eslint-disable-next-line no-console
    console.info(`\n[email:dev] To: ${email.to}\n[email:dev] Subject: ${email.subject}\n${email.text}\n`);
    return;
  }
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html ?? layout(email.subject, email.text),
  });
  if (error) {
    // Never log the email body: it may contain a one-time code.
    const detail = [error.name, 'message' in error ? String((error as { message?: string }).message ?? '') : '']
      .filter(Boolean)
      .join(': ');
    // eslint-disable-next-line no-console
    console.error(`Email to ${maskEmail(email.to)} failed: ${detail || 'unknown Resend error'}`);
    const testingOnly =
      /only send testing emails|verify a domain|onboarding@resend\.dev/i.test(detail) ||
      /only send testing emails|verify a domain/i.test(JSON.stringify(error));
    throw new Error(
      testingOnly
        ? 'Resend will only deliver to your Resend account email until you verify a domain. Set EMAIL_FROM to an address on that domain, or request the code using the email you used to sign up for Resend.'
        : 'Email could not be sent. Check RESEND_API_KEY and EMAIL_FROM on the server.',
    );
  }
  // eslint-disable-next-line no-console
  console.info(`Email queued via Resend to ${maskEmail(email.to)} id=${data?.id ?? 'unknown'}`);
}

export function codeEmail(code: string, purpose: string) {
  const text = `Your LoveNest code is ${code}.\n\nUse it to ${purpose}. It expires in 10 minutes.\n\nIf you did not ask for this code, you can ignore this email. Someone may have typed your email address by mistake.`;
  const html = layout(
    'Your LoveNest code',
    `<p style="margin:0 0 16px">Use this code to ${escapeHtml(purpose)}:</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#E2233F">${escapeHtml(code)}</p>
     <p style="margin:0 0 8px;color:#6C6C70">It expires in 10 minutes.</p>
     <p style="margin:0;color:#6C6C70">If you did not ask for this code, you can ignore this email.</p>`,
    true,
  );
  return { text, html };
}

function layout(title: string, body: string, bodyIsHtml = false) {
  const content = bodyIsHtml ? body : `<p style="margin:0;white-space:pre-line">${escapeHtml(body)}</p>`;
  return `<!doctype html><html><body style="margin:0;background:#FFF7F7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1416">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;border-radius:16px;padding:28px">
<tr><td><p style="font-size:20px;font-weight:700;margin:0 0 20px">Love<span style="color:#E2233F">Nest</span></p>
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>${content}</td></tr></table>
<p style="font-size:12px;color:#8C8386;margin-top:16px">LoveNest Gifts</p></td></tr></table></body></html>`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, '$1***$2');

if (isProd && !env.RESEND_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('RESEND_API_KEY is required in production: email verification codes cannot be delivered without it.');
  process.exit(1);
}
