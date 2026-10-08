import type { MiddlewareHandler } from 'hono';
import { ApiError } from './errors.js';
import type { AppEnv } from '../app.js';

// Fixed-window limiter for LoveNest's own endpoints (Better Auth limits its own routes in the
// database). In memory is fine on a single Render instance; a restart only resets windows early.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const clientIp = (headers: Headers) =>
  headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';

export function rateLimit(name: string, { max, windowMs }: { max: number; windowMs: number }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const who = c.get('user')?.id ?? clientIp(c.req.raw.headers);
    const key = `${name}:${who}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      throw new ApiError(429, 'rate_limited', `Too many requests. Try again in ${retryAfter} seconds.`);
    }
    await next();
  };
}

// Drop expired buckets so memory stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 60_000).unref();

export const resetRateLimits = () => buckets.clear();
