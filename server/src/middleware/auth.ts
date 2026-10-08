import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors.js';
import { env } from '../env.js';
import type { AppEnv } from '../app.js';

const trustedOrigins = new Set([new URL(env.BETTER_AUTH_URL).origin, ...env.ADMIN_ORIGINS]);

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
