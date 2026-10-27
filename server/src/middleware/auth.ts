import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors.js';
import { env } from '../env.js';
import type { AppEnv } from '../app.js';

const trustedOrigins = new Set([new URL(env.BETTER_AUTH_URL).origin, ...env.ADMIN_ORIGINS]);

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

/** Metro and Expo send a LAN Origin that Better Auth does not recognise. The Expo client also sends expo-origin (often exp://IP:8081, not lovenest://). */
export const isAppOrDevOrigin = (origin: string) => {
  if (!origin || origin === 'null') return true;
  if (origin.startsWith(`${env.APP_SCHEME}:`) || origin.startsWith('exp:') || origin.startsWith('exps:')) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
};

/**
 * Native requests must look like the app scheme so Better Auth accepts them in production too.
 * Never rewrite a public website Origin, even if expo-origin is spoofed.
 */
export function applyExpoOrigin(request: Request): Request {
  const expoOrigin = request.headers.get('expo-origin');
  const current = request.headers.get('origin');
  const fromNativeHeader = Boolean(expoOrigin) && (current === null || isAppOrDevOrigin(current));
  const fromMetro = !expoOrigin && current !== null && isAppOrDevOrigin(current);
  if (!fromNativeHeader && !fromMetro) return request;
  const headers = new Headers(request.headers);
  headers.set('origin', `${env.APP_SCHEME}://`);
  return new Request(request, { headers });
}

/**
 * Cross-site request forgery guard for LoveNest's own routes (Better Auth checks its own).
 * Browsers always send Origin on cross-site POST/PATCH/DELETE; reject unknown ones. The mobile
 * app is not a browser and sends no Origin, so it is unaffected.
 */
export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('origin');
    if (origin && !trustedOrigins.has(origin)) throw new ApiError(403, 'bad_origin', 'Request blocked: unknown origin.');
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in.');
  if (user.mustChangePassword) {
    throw new ApiError(403, 'password_change_required', 'Choose a new password to continue.');
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in.');
  if (user.role !== 'admin') throw new ApiError(403, 'forbidden', 'Admins only.');
  if (user.mustChangePassword) {
    throw new ApiError(403, 'password_change_required', 'Choose a new password to continue.');
  }
  await next();
};
