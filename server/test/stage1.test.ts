import { describe, expect, it } from 'vitest';
import { call, freshIp, RECOVERY } from './helpers.js';
import { applyExpoOrigin } from '../src/middleware/auth.js';
import { seed } from '../src/db/seed.js';
import { db } from '../src/db/client.js';
import { category, product } from '../src/db/schema.js';

const ADMIN_ORIGIN = 'http://localhost:8080';

describe('Stage 1: foundation', () => {
  it('health check reports the database is up', async () => {
    const { status, json } = await call('/health');
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, db: 'up', email: 'test' });
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

  it('signs up a customer and signs them in immediately', async () => {
    const signedUp = await call('/api/auth/sign-up/email', {
      method: 'POST',
      ip: freshIp(),
      body: { email, password, name: 'Tendai Moyo', phone: '0771234567', acceptedTermsVersion: '2026-10-09', ...RECOVERY },
    });
    expect(signedUp.status).toBe(200);

    const session = await call('/api/auth/get-session', { cookie: signedUp.cookie });
    expect(session.json.user).toMatchObject({
      email,
      name: 'Tendai Moyo',
      phone: '+263771234567',
      role: 'user',
      mustChangePassword: false,
      acceptedTermsVersion: '2026-10-09',
    });
  });

  it('maps Expo Metro origins to the app scheme', () => {
    const mapped = applyExpoOrigin(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { origin: 'http://192.168.1.20:8081', 'expo-origin': 'exp://192.168.1.20:8081/--/' },
      }),
    );
    expect(mapped.headers.get('origin')).toBe('lovenest://');

    const website = applyExpoOrigin(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'expo-origin': 'exp://192.168.1.20:8081/--/' },
      }),
    );
    expect(website.headers.get('origin')).toBe('https://evil.example');

    const expoOnly = applyExpoOrigin(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'expo-origin': 'exp://192.168.1.20:8081/--/' },
      }),
    );
    expect(expoOnly.headers.get('origin')).toBe('lovenest://');
  });

  it('accepts sign-up from a development build (Metro Origin plus expo-origin)', async () => {
    const { status } = await call('/api/auth/sign-up/email', {
      method: 'POST',
      ip: freshIp(),
      origin: 'http://192.168.1.20:8081',
      headers: { 'expo-origin': 'exp://192.168.1.20:8081/--/' },
      body: {
        email: `device-${Date.now()}@example.com`,
        password: 'Lovenest2026',
        name: 'Device User',
        phone: '0771234568',
        acceptedTermsVersion: '2026-10-09',
        ...RECOVERY,
      },
    });
    expect(status).toBe(200);
  });

  it('rejects a wrong password without saying which part was wrong', async () => {
    const { status, json } = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email, password: 'WrongPass99' } });
    expect(status).toBe(401);
    expect(JSON.stringify(json).toLowerCase()).toContain('invalid email or password');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const { status } = await call('/api/auth/sign-up/email', {
      method: 'POST',
      ip: freshIp(),
      body: { email: 'short@example.com', password: 'abc12', name: 'Short', phone: '0771234567', acceptedTermsVersion: '2026-10-09', ...RECOVERY },
    });
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

  it('resets a password with the security question from sign-up', async () => {
    const lookup = await call('/api/recovery/lookup', { method: 'POST', ip: freshIp(), body: { email } });
    expect(lookup.status).toBe(200);
    expect(lookup.json.questionId).toBe(RECOVERY.securityQuestion);

    const wrong = await call('/api/recovery/reset', {
      method: 'POST',
      ip: freshIp(),
      body: { email, answer: 'wrong-answer', password: 'NewPass2026' },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.json.error.code).toBe('wrong_answer');

    const reset = await call('/api/recovery/reset', {
      method: 'POST',
      ip: freshIp(),
      body: { email, answer: ' misty ', password: 'NewPass2026' },
    });
    expect(reset.status).toBe(200);

    const signIn = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email, password: 'NewPass2026' } });
    expect(signIn.status).toBe(200);
  });

  it('does not look up a security question for an unknown email', async () => {
    const res = await call('/api/recovery/lookup', { method: 'POST', ip: freshIp(), body: { email: 'nobody@example.com' } });
    expect(res.status).toBe(404);
  });

  it('tells older accounts without a security question to contact support', async () => {
    const res = await call('/api/recovery/lookup', { method: 'POST', ip: freshIp(), body: { email: 'admin@lovenest.test' } });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('recovery_unavailable');
  });

  it('lets a signed-in user update name and phone', async () => {
    const email = `profile-${Date.now()}@example.com`;
    const signedUp = await call('/api/auth/sign-up/email', {
      method: 'POST',
      ip: freshIp(),
      body: { email, password: 'Customer2026', name: 'Before Name', phone: '0771234567', acceptedTermsVersion: '2026-10-09', ...RECOVERY },
    });
    expect(signedUp.status).toBe(200);

    const updated = await call('/api/auth/update-user', {
      method: 'POST',
      ip: freshIp(),
      cookie: signedUp.cookie,
      body: { name: 'After Name', phone: '0779988776' },
    });
    expect(updated.status).toBe(200);

    const session = await call('/api/auth/get-session', { cookie: signedUp.cookie ?? updated.cookie });
    expect(session.json.user).toMatchObject({
      name: 'After Name',
      phone: '+263779988776',
    });
  });
});
