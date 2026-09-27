/** FastAPI's `detail` message from an axios error, when it is a plain string (not a validation list). */
export function errorDetail(error: unknown): string | undefined {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : undefined;
}
