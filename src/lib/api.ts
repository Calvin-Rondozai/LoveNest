import { API_URL } from '../config';
import { authClient } from './authClient';

// Calls LoveNest's own endpoints (catalog, orders). The session cookie from the auth client
// is attached manually because React Native does not manage cookies for us.

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; headers?: Record<string, string>; auth?: boolean };

const TIMEOUT_MS = 20000;

export async function apiRequest<T>(path: string, { method = 'GET', body, headers = {}, auth = true }: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth) {
    const cookie = await authClient.getCookie();
    if (cookie) finalHeaders.Cookie = cookie;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    throw new ApiRequestError(0, 'network', timedOut ? 'LoveNest took too long to respond. Please try again.' : "Can't reach LoveNest right now. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
  if (!res.ok) {
    const retry = Number(res.headers.get('Retry-After')) || 0;
    throw new ApiRequestError(
      res.status,
      data?.error?.code ?? (res.status === 401 ? 'unauthorized' : 'error'),
      data?.error?.message ?? 'Something went wrong. Please try again.',
      data?.error?.fields,
      retry ? retry * 1000 : undefined,
    );
  }
  return data as T;
}

/** Random key so a retried checkout never creates a second order. */
export const newIdempotencyKey = () =>
  `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
