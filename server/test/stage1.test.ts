import { describe, expect, it } from 'vitest';
import { call, freshIp } from './helpers.js';
import { testOutbox } from '../src/lib/email.js';
import { seed } from '../src/db/seed.js';
import { db } from '../src/db/client.js';
import { category, product } from '../src/db/schema.js';

const ADMIN_ORIGIN = 'http://localhost:8080';

describe('Stage 1: foundation', () => {
  it('health check reports the database is up', async () => {
    const { status, json } = await call('/health');
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, db: 'up' });
  });

  it('returns JSON 404s and security headers', async () => {
    const { status, json, res } = await call('/api/nope');
    expect(status).toBe(404);
    expect(json.error.code).toBe('not_found');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('allows CORS with credentials only for the admin dashboard origin', async () => {
    const allowed = await call('/api/auth/get-session', { method: 'OPTIONS', origin: ADMIN_ORIGIN });
    expect(allowed.res.headers.get('access-control-allow-origin')).toBe(ADMIN_ORIGIN);
    expect(allowed.res.headers.get('access-control-allow-credentials')).toBe('true');

    const blocked = await call('/api/auth/get-session', { method: 'OPTIONS', origin: 'https://evil.example' });
    expect(blocked.res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('seeds categories, products and the first admin, and is safe to re-run', async () => {
    await seed();
    await seed();
    expect(await db.$count(category)).toBe(5);
    expect(await db.$count(product)).toBe(6);

    const signIn = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email: 'admin@lovenest.test', password: 'AdminPass123' } });
    expect(signIn.status).toBe(200);
    const session = await call('/api/auth/get-session', { cookie: signIn.cookie });
    expect(session.json.user.role).toBe('admin');
  });
});

describe('Stage 1: auth wiring', () => {
  const email = 'tendai@example.com';
  const password = 'Lovenest2026';

  it('signs up a customer with default role and extra fields', async () => {
    const { status, cookie } = await call('/api/auth/sign-up/email', {
      method: 'POST',
      ip: freshIp(),
      body: { email, password, name: 'Tendai Moyo', acceptedTermsVersion: '2026-10-08' },
    });
    expect(status).toBe(200);

    const session = await call('/api/auth/get-session', { cookie });
    expect(session.json.user).toMatchObject({ email, name: 'Tendai Moyo', role: 'user', mustChangePassword: false, acceptedTermsVersion: '2026-10-08' });
  });

  it('rejects a wrong password without saying which part was wrong', async () => {
    const { status, json } = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email, password: 'WrongPass99' } });
    expect(status).toBe(401);
    expect(JSON.stringify(json).toLowerCase()).toContain('invalid email or password');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const { status } = await call('/api/auth/sign-up/email', { method: 'POST', ip: freshIp(), body: { email: 'short@example.com', password: 'abc12', name: 'Short' } });
    expect(status).toBe(400);
  });

  it('rate limits repeated sign-in attempts from one address', async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await call('/api/auth/sign-in/email', { method: 'POST', ip, body: { email, password: `Wrong${i}pass` } })).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('resets a password with a 6-digit emailed code', async () => {
    testOutbox.length = 0;
    const sent = await call('/api/auth/email-otp/send-verification-otp', { method: 'POST', ip: freshIp(), body: { email, type: 'forget-password' } });
    expect(sent.status).toBe(200);
    const code = testOutbox.at(-1)?.subject.match(/\d{6}/)?.[0];
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await call('/api/auth/email-otp/reset-password', { method: 'POST', ip: freshIp(), body: { email, otp: '000000', password: 'NewPass2026' } });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const reset = await call('/api/auth/email-otp/reset-password', { method: 'POST', ip: freshIp(), body: { email, otp: code, password: 'NewPass2026' } });
    expect(reset.status).toBe(200);

    const signIn = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email, password: 'NewPass2026' } });
    expect(signIn.status).toBe(200);
  });

  it('does not reveal whether an email has an account when requesting a code', async () => {
    const res = await call('/api/auth/email-otp/send-verification-otp', { method: 'POST', ip: freshIp(), body: { email: 'nobody@example.com', type: 'forget-password' } });
    expect(res.status).toBe(200);
  });
});
