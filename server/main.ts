import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import { createStore } from './store'
import { handleDocs } from './routes/docs'
import { handleFlags } from './routes/flags'
import { handleResponses } from './routes/responses'
import { handleResolutions } from './routes/resolutions'
import { handleEvents } from './routes/events'
import { handleCatalogue } from './routes/catalogue'
import { handleDensity } from './routes/density'
import { handleAgent } from './routes/agent'
import { json, notFound } from './shared'
import { SKILL_VERSION } from './skillVersion'

const store = createStore()
const port = Number(process.env.PORT ?? 8787)
const STATIC_DIR = process.env.STATIC_DIR ?? './dist'

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.startsWith('/.well-known/')) {
    return new Response('not found', { status: 404 })
  }
  const candidate = pathname === '/' ? '/index.html' : pathname
  const filePath = join(STATIC_DIR, candidate)
  try {
    const s = await stat(filePath)
    if (s.isFile()) {
      const file = Bun.file(filePath)
      return new Response(file)
    }
  } catch {
    // fall through
  }
  if (!pathname.startsWith('/assets/') && !/\.\w+$/.test(pathname)) {
    try {
      const idx = Bun.file(join(STATIC_DIR, 'index.html'))
      if (await idx.exists()) return new Response(idx, { headers: { 'content-type': 'text/html' } })
    } catch {
      /* not built */
    }
  }
  return null
}

/**
 * Wrap a route response so every reply (including errors and SSE streams)
 * carries the current SKILL.md version. Agents send their own
 * `X-Skill-Version` request header; if it lags the server's literal, we
 * also flip `X-Skill-Stale: true` so the agent surfaces an upgrade hint
 * to the user.
 */
function withSkillHeaders(req: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Skill-Latest-Version', SKILL_VERSION)
  const reqVersion = req.headers.get('x-skill-version')
  if (reqVersion && reqVersion !== SKILL_VERSION) {
    headers.set('X-Skill-Stale', 'true')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { pathname } = url

  if (pathname === '/health') return json({ ok: true, skillVersion: SKILL_VERSION })

  if (pathname === '/catalogue' && req.method === 'GET') {
    return handleCatalogue()
  }

  if (pathname.startsWith('/docs')) {
    const segs = pathname.split('/').filter(Boolean) // ['docs', id?, verb?, sub?, ...]

    // POST /docs
    if (segs.length === 1) return handleDocs(req, store, null, null)

    const docId = segs[1]
    const verb = segs[2] ?? null
    const subVerb = segs[3] ?? null

    // /docs/:id  or  /docs/:id/source[/revert]
    // or /docs/:id/agent-hints  or /docs/:id/voice-samples  or /docs/:id/companion
    if (segs.length === 2) {
      return handleDocs(req, store, docId, null)
    }
    if (
      verb === 'source' ||
      verb === 'agent-hints' ||
      verb === 'voice-samples' ||
      verb === 'companion'
    ) {
      if (segs.length <= 4) return handleDocs(req, store, docId, verb, subVerb)
    }

    // /docs/:id/events  or /docs/:id/events/poll
    if (verb === 'events') {
      return handleEvents(req, store, docId, subVerb)
    }

    // /docs/:id/responses[/:rid[/punt|/cancel]]
    if (verb === 'responses') {
      return handleResponses(req, store, docId, segs.slice(3))
    }

    // /docs/:id/resolutions
    if (verb === 'resolutions' && segs.length === 3) {
      return handleResolutions(req, store, docId)
    }

    // /docs/:id/flags[/:fid[/verb]]
    if (verb === 'flags') {
      return handleFlags(req, store, docId, segs.slice(3))
    }

    // /docs/:id/density
    if (verb === 'density' && segs.length === 3) {
      return handleDensity(req, store, docId)
    }

    // /docs/:id/agent/{heartbeat|notes|tasks}
    if (verb === 'agent') {
      return handleAgent(req, store, docId, segs.slice(3))
    }
  }

  const staticResponse = await serveStatic(pathname)
  if (staticResponse) return staticResponse

  return notFound()
}

const server = Bun.serve({
  port,
  // SSE streams need to live longer than Bun's default 10s request timeout.
  // 0 disables the per-request timeout entirely; the client owns the lifecycle.
  idleTimeout: 0,
  async fetch(req): Promise<Response> {
    const response = await route(req)
    return withSkillHeaders(req, response)
  },
})

console.log(`slopmop server listening on http://localhost:${server.port} (skill ${SKILL_VERSION})`)
