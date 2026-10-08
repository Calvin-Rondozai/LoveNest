import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';
import { sql } from 'drizzle-orm';
import { auth, type AuthSession, type AuthUser } from './auth.js';
import { db } from './db/client.js';
import { env, isProd } from './env.js';
import { ApiError } from './lib/errors.js';
import { LOCAL_UPLOAD_DIR } from './lib/storage.js';
import { paynowMode } from './lib/paynow.js';
import { csrfGuard } from './middleware/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { orderRoutes } from './routes/orders.js';
import { paymentRoutes } from './routes/payments.js';
import { adminRoutes } from './routes/admin.js';

export type AppEnv = {
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
};

// server/ whether running from src (tsx) or dist (node).
const SERVER_ROOT = fileURLToPath(new URL('../', import.meta.url));
const fromCwd = (p: string) => relative(process.cwd(), p) || '.';
const ADMIN_DIR = resolve(SERVER_ROOT, '../admin');
const LEGAL_DIR = resolve(SERVER_ROOT, '../legal-site');

export const app = new Hono<AppEnv>();

if (env.NODE_ENV !== 'test') app.use('*', logger());
app.use(
  '*',
  secureHeaders({
    strictTransportSecurity: isProd ? 'max-age=31536000; includeSubDomains' : false,
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginResourcePolicy: 'cross-origin', // product photos are loaded by the app
  }),
);

// Only needed if the dashboard is opened from a different origin during development.
app.use(
  '/api/*',
  cors({
    origin: (origin) => (env.ADMIN_ORIGINS.includes(origin) ? origin : null),
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
  }),
);

// Small JSON bodies everywhere, except product photo uploads.
const PHOTO_UPLOAD = /^\/api\/admin\/products\/[^/]+\/image$/;
app.use('/api/*', (c, next) =>
  bodyLimit({
    maxSize: PHOTO_UPLOAD.test(c.req.path) ? 6 * 1024 * 1024 : 100 * 1024,
    onError: (ctx) => ctx.json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } }, 413),
  })(c, next),
);

// Better Auth: sign-in, sign-up, codes, sessions, admin user actions.
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Paynow posts here from its own servers (no session, no Origin). Verified by hash.
app.route('/api/payments', paymentRoutes);

// Everything else: attach the signed-in user and block cross-site writes.
app.use('/api/*', async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', result?.user ?? null);
  c.set('session', result?.session ?? null);
  await next();
});
app.use('/api/*', csrfGuard);

app.get('/api/me', (c) => {
  const user = c.get('user');
  if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in.');
  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role === 'admin' ? 'admin' : 'customer', mustChangePassword: Boolean(user.mustChangePassword) },
  });
});
app.route('/api', catalogRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/admin', adminRoutes);

app.get('/health', async (c) => {
  try {
    await db.run(sql`select 1`);
    return c.json({ ok: true, db: 'up', payments: paynowMode });
  } catch {
    return c.json({ ok: false, db: 'down' }, 503);
  }
});

// ---------- static sites ----------

const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://res.cloudinary.com; " +
  "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
const LEGAL_CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

if (existsSync(ADMIN_DIR)) {
  app.get('/admin', (c) => c.redirect('/admin/', 301));
  app.use('/admin/*', async (c, next) => {
    await next();
    c.header('Content-Security-Policy', ADMIN_CSP);
    c.header('Cache-Control', c.req.path.endsWith('/') || c.req.path.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
  });
  app.use('/admin/*', serveStatic({ root: fromCwd(ADMIN_DIR), rewriteRequestPath: (p) => p.replace(/^\/admin/, '') }));
}

if (existsSync(LEGAL_DIR)) {
  app.get('/legal', (c) => c.redirect('/legal/', 301));
  app.use('/legal/*', async (c, next) => {
    await next();
    c.header('Content-Security-Policy', LEGAL_CSP);
  });
  app.use('/legal/*', serveStatic({ root: fromCwd(LEGAL_DIR), rewriteRequestPath: (p) => p.replace(/^\/legal/, '') }));
}

// Development-only product photo storage (production uses Cloudinary).
if (!isProd) {
  app.use('/uploads/*', serveStatic({ root: fromCwd(LOCAL_UPLOAD_DIR), rewriteRequestPath: (p) => p.replace(/^\/uploads/, '') }));
}

// Paynow's return URL (only used by web checkout); send people somewhere friendly.
app.get('/payments/return', (c) => c.text('Payment received. You can return to the LoveNest app.'));

app.get('/', (c) => c.json({ name: 'LoveNest API', ok: true }));

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'http_error', message: err.message } }, err.status);
  }
  // Better Auth API errors thrown from auth.api.* calls inside our routes.
  const apiErr = err as { statusCode?: number; body?: { message?: string; code?: string } };
  if (typeof apiErr.statusCode === 'number' && apiErr.statusCode >= 400 && apiErr.statusCode < 500) {
    return c.json({ error: { code: apiErr.body?.code?.toLowerCase() ?? 'invalid_request', message: apiErr.body?.message ?? 'Request failed.' } }, apiErr.statusCode as 400);
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return c.json({ error: { code: 'internal', message: isProd ? 'Something went wrong. Please try again.' : String(err) } }, 500);
});
