import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../db/client.js';
import { account, session, user } from '../db/schema.js';
import { parseBody, emailAddress, password } from '../lib/validation.js';
import { answersMatch, isSecurityQuestionId, securityQuestionLabel, validateAnswer } from '../lib/security-question.js';
import { rateLimit } from '../lib/rate-limit.js';
import { ApiError, badRequest } from '../lib/errors.js';
import type { AppEnv } from '../app.js';

const lookupSchema = z.object({ email: emailAddress });
const resetSchema = z.object({
  email: emailAddress,
  answer: z.string(),
  password,
});

export const recoveryRoutes = new Hono<AppEnv>()
  .post('/lookup', rateLimit('recovery-lookup', { max: 5, windowMs: 15 * 60_000 }), async (c) => {
    const { email } = await parseBody(c, lookupSchema);
    const [row] = await db
      .select({ securityQuestion: user.securityQuestion, banned: user.banned })
      .from(user)
      .where(eq(user.email, email));
    if (!row || row.banned) throw new ApiError(404, 'not_found', 'No account was found with that email.');
    if (!row.securityQuestion || !isSecurityQuestionId(row.securityQuestion)) {
      throw new ApiError(409, 'recovery_unavailable', 'This account has no security question. Message LoveNest on WhatsApp to reset the password.');
    }
    return c.json({ questionId: row.securityQuestion, question: securityQuestionLabel(row.securityQuestion) });
  })

  .post('/reset', rateLimit('recovery-reset', { max: 5, windowMs: 15 * 60_000 }), async (c) => {
    const input = await parseBody(c, resetSchema);
    const answerProblem = validateAnswer(input.answer);
    if (answerProblem) throw badRequest(answerProblem, { answer: answerProblem });

    const [row] = await db
      .select({ id: user.id, securityAnswerHash: user.securityAnswerHash, banned: user.banned })
      .from(user)
      .where(eq(user.email, input.email));
    if (!row || row.banned || !answersMatch(input.answer, row.securityAnswerHash)) {
      throw new ApiError(400, 'wrong_answer', 'That answer does not match. Please try again.');
    }

    const hash = await hashPassword(input.password);
    await db
      .update(account)
      .set({ password: hash })
      .where(and(eq(account.userId, row.id), eq(account.providerId, 'credential')));
    await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, row.id));
    await db.delete(session).where(eq(session.userId, row.id));
    return c.json({ ok: true });
  });
