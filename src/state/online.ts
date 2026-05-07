import { ref, computed, type Ref } from 'vue'
import type { Flag, ResolutionEvent } from '../types'

interface DocSummary {
  id: string
  token: string
  title: string
  source: string
  version: number
}

interface FetchedDoc {
  doc: DocSummary
  counts: { 1: number; 2: number; 3: number }
  score: { value: number; rationale: string }
  flags: Flag[]
}

export interface OnlineSession {
  id: string
  token: string
  loading: Ref<boolean>
  error: Ref<string | null>
  doc: Ref<DocSummary | null>
  flags: Ref<Flag[]>
  score: Ref<number>
  openFlags: Ref<Flag[]>
  resolve(flagId: string, patch: string): Promise<void>
  skip(flagId: string): Promise<void>
  keepDeliberate(flagId: string): Promise<void>
  disconnect(): void
}

export function createOnlineSession(id: string, token: string): OnlineSession {
  const loading = ref(true)
  const error = ref<string | null>(null)
  const doc = ref<DocSummary | null>(null)
  const flags = ref<Flag[]>([])
  const score = ref(0)
  let cursor = 0
  let eventSource: EventSource | null = null

  const openFlags = computed(() => flags.value.filter((f) => (f.status ?? 'open') === 'open'))

  const auth = { 'authorization': `Bearer ${token}` }

  async function bootstrap(): Promise<void> {
    try {
      const r = await fetch(`/docs/${id}`, { headers: auth })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      const data = (await r.json()) as FetchedDoc
      doc.value = data.doc
      flags.value = data.flags
      score.value = data.score?.value ?? 0
      cursor = data.doc.version
      subscribe()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function subscribe(): void {
    const url = `/docs/${id}/events?since=${cursor}`
    // EventSource doesn't allow custom headers, so token is passed via querystring.
    // To avoid leaking the token in URL params, we instead use a manual fetch+stream.
    // But for v1 simplicity, route the SSE through the same auth via a query param.
    // (Server accepts ?token= as a fallback for SSE specifically.)
    eventSource = new EventSource(`${url}&token=${encodeURIComponent(token)}`)
    eventSource.onmessage = (msg) => handleEvent(JSON.parse(msg.data) as ResolutionEvent)
    // Also catch named events
    for (const evtType of ['flag-added', 'flag-resolved', 'flag-skipped', 'flag-kept', 'flag-stale', 'source-edited', 'suggestion-added', 'suggestion-verdict', 'comment-added']) {
      eventSource.addEventListener(evtType, (msg: MessageEvent) => handleEvent(JSON.parse(msg.data) as ResolutionEvent))
    }
    eventSource.onerror = () => {
      // browser auto-reconnects with Last-Event-ID
    }
  }

  async function refreshFlags(): Promise<void> {
    const r = await fetch(`/docs/${id}/flags`, { headers: auth })
    if (!r.ok) return
    const data = (await r.json()) as { flags: Flag[] }
    flags.value = data.flags
  }

  async function refreshDoc(): Promise<void> {
    const r = await fetch(`/docs/${id}`, { headers: auth })
    if (!r.ok) return
    const data = (await r.json()) as FetchedDoc
    doc.value = data.doc
    flags.value = data.flags
    score.value = data.score?.value ?? 0
  }

  function handleEvent(ev: ResolutionEvent): void {
    cursor = Math.max(cursor, ev.cursor)
    switch (ev.type) {
      case 'flag-added':
        refreshFlags()
        break
      case 'flag-resolved':
      case 'flag-skipped':
      case 'flag-kept':
      case 'flag-stale':
        refreshDoc()
        break
      case 'source-edited':
        refreshDoc()
        break
      default:
        // suggestion + comment: not surfaced in this minimal v1
        break
    }
  }

  async function post(path: string, body: unknown): Promise<void> {
    const r = await fetch(path, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
  }

  async function resolve(flagId: string, patch: string): Promise<void> {
    await post(`/docs/${id}/flags/${flagId}/resolve`, { patch })
  }
  async function skip(flagId: string): Promise<void> {
    await post(`/docs/${id}/flags/${flagId}/skip`, {})
  }
  async function keepDeliberate(flagId: string): Promise<void> {
    await post(`/docs/${id}/flags/${flagId}/keep-deliberate`, {})
  }
  function disconnect(): void {
    eventSource?.close()
    eventSource = null
  }

  bootstrap()

  return { id, token, loading, error, doc, flags, score, openFlags, resolve, skip, keepDeliberate, disconnect }
}
