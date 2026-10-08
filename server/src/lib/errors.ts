import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Every API error response has the same shape:
 *   { "error": { "code": "machine_readable", "message": "Human readable.", "fields"?: {...} } }
 */
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found.`);
export const forbidden = (message = 'You do not have permission to do this.') => new ApiError(403, 'forbidden', message);
export const badRequest = (message: string, fields?: Record<string, string>) => new ApiError(400, 'invalid_request', message, fields);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
