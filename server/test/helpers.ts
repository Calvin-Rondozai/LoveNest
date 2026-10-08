import { app } from '../src/app.js';

let ipCounter = 0;
/** A distinct client IP per test, so rate limits from one test never affect another. */
export const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

type Options = { method?: string; body?: unknown; cookie?: string; ip?: string; origin?: string };

export async function call(path: string, { method = 'GET', body, cookie, ip = '127.0.0.1', origin }: Options = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': ip };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { res, status: res.status, json, cookie: sessionCookie(res) ?? cookie };
}

/** Extracts "name=value" pairs from Set-Cookie for the next request. */
function sessionCookie(res: Response) {
  const raw = res.headers.getSetCookie();
  if (!raw.length) return undefined;
  return raw.map((c) => c.split(';')[0]).join('; ');
}
