import type { DocStore } from '../store'
import type { DocState } from '../types'
import type { ResolutionEvent } from '../../src/types'
import { bus } from '../bus'
import { fail } from '../auth'
import { notFound } from '../shared'

export async function handleEvents(req: Request, store: DocStore, docId: string): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()

  // GET /docs/:id/events  -> SSE
  if (req.method === 'GET') return sseStream(state, docId, req)

  return fail(405, 'method not allowed')
}

function eventsSince(state: DocState, cursor: number): ResolutionEvent[] {
  return state.events.filter((e) => e.cursor > cursor)
}

function sseStream(state: DocState, docId: string, req: Request): Response {
  const url = new URL(req.url)
  const lastEventId = req.headers.get('last-event-id')
  const sinceParam = url.searchParams.get('since')
  const since = lastEventId ? Number(lastEventId) : sinceParam ? Number(sinceParam) : 0

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (event: ResolutionEvent): void => {
        const data = `id: ${event.cursor}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(enc.encode(data))
        } catch {
          // closed
        }
      }

      // 1. Replay missed events from the in-state log.
      for (const e of eventsSince(state, since)) send(e)

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
