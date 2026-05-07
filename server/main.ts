import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import { createStore } from './store'
import { handleDocs } from './routes/docs'
import { handleFlags } from './routes/flags'
import { handleEvents } from './routes/events'
import { handleCatalogue } from './routes/catalogue'
import { json, notFound } from './shared'

const store = createStore()
const port = Number(process.env.PORT ?? 8787)
const STATIC_DIR = process.env.STATIC_DIR ?? './dist'

async function serveStatic(pathname: string): Promise<Response | null> {
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
  // SPA fallback: serve index.html for non-asset routes
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

const server = Bun.serve({
  port,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url)
    const { pathname } = url

    if (pathname === '/health') return json({ ok: true })

    if (pathname === '/catalogue' && req.method === 'GET') {
      return handleCatalogue()
    }

    if (pathname.startsWith('/docs')) {
      const segs = pathname.split('/').filter(Boolean) // ['docs', id?, 'flags'?, fid?, 'verb'?]
      // /docs (POST)  or /docs/:id (GET, PUT/source, DELETE)
      if (segs.length === 1) {
        return handleDocs(req, store, null, null)
      }
      const docId = segs[1]
      if (segs.length === 2 || (segs.length === 3 && segs[2] === 'source') || (segs.length === 3 && segs[2] === 'run-detectors')) {
        return handleDocs(req, store, docId, segs[2] ?? null)
      }
      // /docs/:id/events  or /docs/:id/events/poll
      if (segs[2] === 'events') {
        return handleEvents(req, store, docId, segs[3] ?? null)
      }
      // /docs/:id/companion
      if (segs[2] === 'companion') {
        return handleDocs(req, store, docId, 'companion')
      }
      // /docs/:id/flags ...
      if (segs[2] === 'flags') {
        return handleFlags(req, store, docId, segs.slice(3))
      }
    }

    const staticResponse = await serveStatic(pathname)
    if (staticResponse) return staticResponse

    return notFound()
  },
})

console.log(`eraser server listening on http://localhost:${server.port}`)
