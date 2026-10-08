import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Client-side rate limiting. This is a UX + deterrence layer only: anyone can
// reinstall the app or call the API directly, so the backend MUST enforce its
// own limits (and return 429 + Retry-After, which maps onto RateLimitError).

export type RateLimitPolicy = {
  /** Failures allowed inside the window before locking. */
  maxAttempts: number;
  windowMs: number;
  /** First lockout; doubles for each consecutive lockout, capped at maxLockoutMs. */
  lockoutMs: number;
  maxLockoutMs?: number;
};

type Entry = { attempts: number[]; lockedUntil: number; lockouts: number };

const STORAGE_PREFIX = 'lovenest.ratelimit.';
const MINUTE = 60_000;

export const POLICIES = {
  login: { maxAttempts: 5, windowMs: 15 * MINUTE, lockoutMs: 5 * MINUTE, maxLockoutMs: 60 * MINUTE },
  // Device-wide cap so someone can't dodge the per-email limit by cycling emails.
  loginDevice: { maxAttempts: 15, windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxLockoutMs: 60 * MINUTE },
  signUp: { maxAttempts: 3, windowMs: 60 * MINUTE, lockoutMs: 30 * MINUTE },
  resetRequest: { maxAttempts: 3, windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE },
  otpVerify: { maxAttempts: 5, windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE },
  placeOrder: { maxAttempts: 3, windowMs: 5 * MINUTE, lockoutMs: 5 * MINUTE },
} satisfies Record<string, RateLimitPolicy>;

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super(`Too many attempts. Try again in ${formatWait(retryAfterMs)}.`);
    this.name = 'RateLimitError';
  }
}

export const formatWait = (ms: number) => {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} min`;
};

const cache = new Map<string, Entry>();

const load = async (key: string): Promise<Entry> => {
  const cached = cache.get(key);
  if (cached) return cached;
  let entry: Entry = { attempts: [], lockedUntil: 0, lockouts: 0 };
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    if (raw) entry = JSON.parse(raw);
  } catch {
    // Corrupt or unavailable storage: fall back to an in-memory entry.
  }
  cache.set(key, entry);
  return entry;
};

const save = (key: string, entry: Entry) => {
  cache.set(key, entry);
  AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry)).catch(() => {});
};

/** Throws RateLimitError if `key` is currently locked. */
export const assertNotLimited = async (key: string) => {
  const entry = await load(key);
  const wait = entry.lockedUntil - Date.now();
  if (wait > 0) throw new RateLimitError(wait);
};

/** Ms until `key` unlocks (0 when free). */
export const lockRemaining = async (key: string) => Math.max(0, (await load(key)).lockedUntil - Date.now());

/** Count one attempt; locks the key once the policy's budget is spent. */
export const recordAttempt = async (key: string, policy: RateLimitPolicy) => {
  const now = Date.now();
  const entry = await load(key);
  const attempts = [...entry.attempts.filter((t) => now - t < policy.windowMs), now];
  if (attempts.length >= policy.maxAttempts) {
    const lockFor = Math.min(policy.lockoutMs * 2 ** entry.lockouts, policy.maxLockoutMs ?? policy.lockoutMs);
    save(key, { attempts: [], lockedUntil: now + lockFor, lockouts: entry.lockouts + 1 });
  } else {
    save(key, { ...entry, attempts });
  }
};

export const clearAttempts = (key: string) => save(key, { attempts: [], lockedUntil: 0, lockouts: 0 });

/** Ticking countdown for a lockout; returns remaining ms (0 when unlocked). */
export const useCountdown = (until: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, until - now);
};

/** Screen-level lockout state: call `lock(ms)` on a rate-limit error to disable the form with a live countdown. */
export const useLockout = (initialKey?: string) => {
  const [until, setUntil] = useState(0);
  const remaining = useCountdown(until);

  useEffect(() => {
    if (!initialKey) return;
    lockRemaining(initialKey).then((ms) => ms > 0 && setUntil(Date.now() + ms));
  }, [initialKey]);

  return { locked: remaining > 0, remaining, lock: (ms: number) => setUntil(Date.now() + ms) };
};
