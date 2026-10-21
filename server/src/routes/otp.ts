import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.js';
import { db } from '../db/client.js';
import { user, verification } from '../db/schema.js';
import { codeEmail, sendEmail, emailDeliveryMode } from '../lib/email.js';
import { parseBody, emailAddress } from '../lib/validation.js';
import { rateLimit } from '../lib/rate-limit.js';
import { ApiError } from '../lib/errors.js';
import type { AppEnv } from '../app.js';

/**
 * OTP request routes that await Resend and return real errors.
 * Better Auth's built-in email-otp endpoints swallow send failures and still
 * return 200, which left the app showing "code sent" when nothing was delivered.
 */

const bodySchema = z.object({ email: emailAddress });

async function issueAndSend(email: string) {
  await db.delete(verification).where(eq(verification.identifier, `email-verification-otp-${email}`));
  const otp = await auth.api.createVerificationOTP({ body: { email, type: 'email-verification' } });
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new ApiError(500, 'otp_failed', 'Could not create a verification code. Please try again.');
  }
  const { text, html } = codeEmail(otp, 'verify your email address');
  try {
    await sendEmail({ to: email, subject: `${otp} is your LoveNest code`, text, html });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Email could not be sent.';
    throw new ApiError(502, 'email_failed', detail);
  }
}

export const otpRoutes = new Hono<AppEnv>()
  .post('/email-verification', rateLimit('otp-verify-send', { max: 3, windowMs: 15 * 60_000 }), async (c) => {
    const { email } = await parseBody(c, bodySchema);
    const [row] = await db.select({ id: user.id, emailVerified: user.emailVerified }).from(user).where(eq(user.email, email));
    // Same response whether or not the account exists, so we never reveal who is registered.
    if (row && !row.emailVerified) await issueAndSend(email);
    return c.json({ ok: true, delivery: emailDeliveryMode() });
  });
