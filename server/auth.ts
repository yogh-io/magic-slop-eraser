/**
 * Auth used to require an `Authorization: Bearer <token>` per doc, with the
 * token stored alongside the doc and returned at creation time. We collapsed
 * that to "the doc UUID is the capability" - a v4 UUID has 122 bits of
 * entropy, enough that the URL itself functions as a share-by-link credential.
 *
 * This file now only exports the small `fail()` helper that route handlers
 * use to return error JSON. The bearer check is gone.
 */
export function fail(status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
