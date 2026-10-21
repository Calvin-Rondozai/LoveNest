import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import { sanitize } from './validation.js';

export const SECURITY_QUESTIONS = [
  { id: 'mother_maiden', label: "What is your mother's maiden name?" },
  { id: 'first_pet', label: 'What was the name of your first pet?' },
  { id: 'birth_city', label: 'In which city were you born?' },
  { id: 'favourite_teacher', label: "What is your favourite teacher's name?" },
  { id: 'primary_school', label: 'What was the name of your primary school?' },
] as const;

export type SecurityQuestionId = (typeof SECURITY_QUESTIONS)[number]['id'];

const IDS = new Set<string>(SECURITY_QUESTIONS.map((q) => q.id));

export const isSecurityQuestionId = (id: unknown): id is SecurityQuestionId => typeof id === 'string' && IDS.has(id);

export const securityQuestionLabel = (id: string) => SECURITY_QUESTIONS.find((q) => q.id === id)?.label ?? id;

export function normalizeAnswer(raw: string) {
  return sanitize(raw).toLowerCase();
}

export function hashAnswer(raw: string) {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(normalizeAnswer(raw)).digest('hex');
}

export function answersMatch(raw: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const a = Buffer.from(hashAnswer(raw), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function validateAnswer(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Enter an answer.';
  const value = sanitize(raw);
  if (value.length < 2) return 'Your answer looks too short.';
  if (value.length > 80) return 'Keep the answer under 80 characters.';
  return null;
}
