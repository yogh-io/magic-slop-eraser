import type { DocStore } from '../store'
import type { ResolutionEvent } from '../../src/types'
import { bus } from '../bus'
import { authorize, fail } from '../auth'
import { json, notFound } from '../shared'

export async function handleEvents(
  req: Request,
  store: DocStore,
  docId: string,
  sub: string | null,
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()
  const authErr = authorize(req, state.doc.token)
  if (authErr) return authErr

  // GET /docs/:id/events  -> SSE
  if (sub === null && req.method === 'GET') {
    return sseStream(store, docId, req)
  }

  // GET /docs/:id/events/poll?since=N  -> long-poll
  if (sub === 'poll' && req.method === 'GET') {
    return longPoll(store, docId, req)
  }

  return fail(405, 'method not allowed')
}

function sseStream(store: DocStore, docId: string, req: Request): Response {
  const url = new URL(req.url)
  const lastEventId = req.headers.get('last-event-id')
  const sinceParam = url.searchParams.get('since')
  const since = lastEventId ? Number(lastEventId) : sinceParam ? Number(sinceParam) : 0

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: ResolutionEvent): void => {
        const data = `id: ${event.cursor}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(enc.encode(data))
        } catch {
          // closed
        }
      }

      // 1. Replay missed events
      const missed = await store.readEventsSince(docId, since)
      for (const e of missed) send(e)

      // 2. Subscribe for live events
      const unsubscribe = bus.subscribe(docId, send)

      // 3. Heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`))
        } catch {
          /* closed */
        }
      }, 25000)

      // 4. Cleanup on abort
      const abort = (): void => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      req.signal.addEventListener('abort', abort)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  })
}

async function longPoll(store: DocStore, docId: string, req: Request): Promise<Response> {
  const url = new URL(req.url)
  const since = Number(url.searchParams.get('since') ?? '0')
  const timeoutMs = Math.min(60000, Number(url.searchParams.get('timeout') ?? '30000'))

  // Immediate replay if anything is buffered past the cursor
  const missed = await store.readEventsSince(docId, since)
  if (missed.length > 0) return json({ events: missed })

  // Wait for the next event or timeout
  const event = await new Promise<ResolutionEvent | null>((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe()
      resolve(null)
    }, timeoutMs)
    const unsubscribe = bus.subscribe(docId, (e) => {
      clearTimeout(timer)
      unsubscribe()
      resolve(e)
    })
    req.signal.addEventListener('abort', () => {
      clearTimeout(timer)
      unsubscribe()
      resolve(null)
    })
  })

  return json({ events: event ? [event] : [] })
}
