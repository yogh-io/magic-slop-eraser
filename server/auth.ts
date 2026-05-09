/** Tiny helper for error JSON responses, shared across route handlers. */
export function fail(status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
