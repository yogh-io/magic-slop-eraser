export function authorize(req: Request, expected: string): Response | null {
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)/i.exec(auth)
  if (!match || match[1] !== expected) return fail(401, 'unauthorized')
  return null
}

export function fail(status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
