export function authorize(req: Request, expected: string): Response | null {
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)/i.exec(auth)
  if (match && match[1] === expected) return null
  // SSE fallback: EventSource cannot send custom headers, so accept ?token= for GET only.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const tk = url.searchParams.get('token')
    if (tk && tk === expected) return null
  }
  return fail(401, 'unauthorized')
}

export function fail(status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
