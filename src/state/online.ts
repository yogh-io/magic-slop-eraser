import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { AgentHints, DocResponse, Flag, ResolutionEvent, ResponseKind, Suggestion } from '../types'

interface DocSummary {
  id: string
  title: string
  source: string
  sourceHash: string
  version: number
}

interface FetchedDoc {
  doc: DocSummary
  sourceHash: string
  counts: { 1: number; 2: number; 3: number }
  score: { value: number; rationale: string }
  flags: Flag[]
  agentHints: AgentHints
}

export interface OnlineSession {
  id: string
  loading: Ref<boolean>
  error: Ref<string | null>
  doc: Ref<DocSummary | null>
  flags: Ref<Flag[]>
  suggestions: Ref<Suggestion[]>
  responses: Ref<DocResponse[]>
  score: Ref<number>
  agentHints: Ref<AgentHints>
  /** Per-flag awaiting candidate, if one exists. */
  candidateByFlag: ComputedRef<Record<string, Suggestion | undefined>>
  /** Per-flag pending response, if one exists. */
  pendingResponseByFlag: ComputedRef<Record<string, DocResponse | undefined>>
  /** Counts of flags grouped by display state, used for the panel summary. */
  panelCounts: ComputedRef<{ open: number; pending: number; awaiting: number; stuck: number; closed: number }>
  postResponse(flagId: string, kind: ResponseKind, body?: string): Promise<DocResponse | null>
  cancelResponse(responseId: string): Promise<void>
  acceptFlag(flagId: string): Promise<void>
  discardFlag(flagId: string): Promise<void>
  skipFlag(flagId: string): Promise<void>
  keepFlag(flagId: string): Promise<void>
  putAgentHints(hints: AgentHints): Promise<void>
  disconnect(): void
}

export function createOnlineSession(id: string): OnlineSession {
  const loading = ref(true)
  const error = ref<string | null>(null)
  const doc = ref<DocSummary | null>(null)
  const flags = ref<Flag[]>([])
  const suggestions = ref<Suggestion[]>([])
  const responses = ref<DocResponse[]>([])
  const score = ref(0)
  const agentHints = ref<AgentHints>({})
  let cursor = 0
  let eventSource: EventSource | null = null

  const candidateByFlag = computed<Record<string, Suggestion | undefined>>(() => {
    // Latest unaccepted suggestion per flag is the running best (the
    // awaiting-accept overlay).
    const out: Record<string, Suggestion> = {}
    const sorted = [...suggestions.value].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    )
    for (const s of sorted) {
      if (s.accepted) continue
      if (out[s.flagId]) continue
      out[s.flagId] = s
    }
    return out
  })

  const pendingResponseByFlag = computed<Record<string, DocResponse | undefined>>(() => {
    const out: Record<string, DocResponse> = {}
    for (const r of responses.value) {
      if (r.status !== 'pending') continue
      // First pending wins; if there are multiple, the oldest is what the agent sees first.
      if (!out[r.flagId]) out[r.flagId] = r
    }
    return out
  })

  const panelCounts = computed(() => {
    const out = { open: 0, pending: 0, awaiting: 0, stuck: 0, closed: 0 }
    for (const f of flags.value) {
      const status = f.status ?? 'open'
      if (status === 'awaiting-accept') {
        out.awaiting++
        continue
      }
      if (status === 'open') {
        const pending = pendingResponseByFlag.value[f.id]
        if (pending) {
          out.pending++
        } else {
          // Could also be stuck via response status
          const stuck = responses.value.find(
            (r) => r.flagId === f.id && r.status === 'stuck',
          )
          if (stuck) out.stuck++
          else out.open++
        }
        continue
      }
      out.closed++
    }
    return out
  })

  async function bootstrap(): Promise<void> {
    try {
      const [docRes, respRes, compRes] = await Promise.all([
        fetch(`/docs/${id}`),
        fetch(`/docs/${id}/responses`),
        fetch(`/docs/${id}/companion`),
      ])
      if (!docRes.ok) throw new Error(`${docRes.status}: ${await docRes.text()}`)
      const data = (await docRes.json()) as FetchedDoc
      doc.value = data.doc
      flags.value = data.flags
      score.value = data.score?.value ?? 0
      agentHints.value = data.agentHints ?? {}
      cursor = data.doc.version

      if (respRes.ok) {
        const r = (await respRes.json()) as { responses: DocResponse[] }
        responses.value = r.responses
      }
      if (compRes.ok) {
        const c = (await compRes.json()) as { suggestions: Suggestion[] }
        suggestions.value = c.suggestions ?? []
      }

      subscribe()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function subscribe(): void {
    eventSource = new EventSource(`/docs/${id}/events?since=${cursor}`)
    eventSource.onmessage = (msg) => handleEvent(JSON.parse(msg.data) as ResolutionEvent)
    const namedEvents = [
      'flag-added',
      'flag-awaiting-accept',
      'flag-resolved',
      'flag-skipped',
      'flag-kept',
      'flag-stale',
      'suggestion-added',
      'suggestion-discarded',
      'response-added',
      'response-resolved',
      'response-stuck',
      'response-cancelled',
      'comment-added',
      'source-edited',
      'source-reverted',
      'agent-hints-updated',
      'document-replaced',
    ]
    for (const evtType of namedEvents) {
      eventSource.addEventListener(evtType, (msg: MessageEvent) =>
        handleEvent(JSON.parse(msg.data) as ResolutionEvent),
      )
    }
    eventSource.onerror = () => {
      /* browser auto-reconnects with Last-Event-ID */
    }
  }

  async function refreshDoc(): Promise<void> {
    const r = await fetch(`/docs/${id}`)
    if (!r.ok) return
    const data = (await r.json()) as FetchedDoc
    doc.value = data.doc
    flags.value = data.flags
    score.value = data.score?.value ?? 0
    agentHints.value = data.agentHints ?? {}
  }

  async function refreshResponses(): Promise<void> {
    const r = await fetch(`/docs/${id}/responses`)
    if (!r.ok) return
    const data = (await r.json()) as { responses: DocResponse[] }
    responses.value = data.responses
  }

  function handleEvent(ev: ResolutionEvent): void {
    cursor = Math.max(cursor, ev.cursor)
    switch (ev.type) {
      case 'flag-added':
      case 'flag-resolved':
      case 'flag-skipped':
      case 'flag-kept':
      case 'flag-stale':
      case 'flag-awaiting-accept':
      case 'source-edited':
      case 'source-reverted':
      case 'document-replaced':
        // Flag/source-shape change: refresh the whole doc snapshot.
        refreshDoc()
        break
      case 'suggestion-added': {
        // Insert the new suggestion into the local list. Payload carries the
        // ids; we fetch on demand by re-pulling the doc, since suggestions
        // don't have a list endpoint yet. For now, refresh via companion.
        refreshSuggestionsLazy(ev)
        break
      }
      case 'suggestion-discarded': {
        const sid = ev.payload?.suggestionId as string | undefined
        if (sid) suggestions.value = suggestions.value.filter((s) => s.id !== sid)
        break
      }
      case 'response-added':
      case 'response-resolved':
      case 'response-stuck':
      case 'response-cancelled':
        refreshResponses()
        break
      case 'agent-hints-updated': {
        const hints = ev.payload?.hints as AgentHints | undefined
        if (hints) agentHints.value = hints
        break
      }
      default:
        break
    }
  }

  async function refreshSuggestionsLazy(ev: ResolutionEvent): Promise<void> {
    // Pull from the companion endpoint when a new suggestion arrives. The
    // payload doesn't carry the full text; companion gives us pre/post.
    const r = await fetch(`/docs/${id}/companion`)
    if (!r.ok) return
    const data = (await r.json()) as { suggestions: Suggestion[] }
    suggestions.value = data.suggestions
  }

  async function postJson<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        error.value = `${r.status}: ${await r.text()}`
        return null
      }
      return (await r.json()) as T
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return null
    }
  }

  async function postResponse(
    flagId: string,
    kind: ResponseKind,
    body?: string,
  ): Promise<DocResponse | null> {
    const out = await postJson<{ response: DocResponse }>(`/docs/${id}/responses`, {
      flagId,
      kind,
      body: body ?? '',
    })
    if (out?.response) responses.value = [...responses.value, out.response]
    return out?.response ?? null
  }

  async function cancelResponse(rid: string): Promise<void> {
    await postJson(`/docs/${id}/responses/${rid}/cancel`, {})
  }

  async function acceptFlag(flagId: string): Promise<void> {
    await postJson(`/docs/${id}/flags/${flagId}/accept`, {})
  }

  async function discardFlag(flagId: string): Promise<void> {
    await postJson(`/docs/${id}/flags/${flagId}/discard`, {})
  }

  async function skipFlag(flagId: string): Promise<void> {
    // Skip is a Response with kind='skip'; the server self-resolves and closes
    // the flag. No need for a separate /flags/:fid/skip call.
    await postResponse(flagId, 'skip')
  }

  async function keepFlag(flagId: string): Promise<void> {
    await postResponse(flagId, 'keep')
  }

  async function putAgentHints(hints: AgentHints): Promise<void> {
    try {
      const r = await fetch(`/docs/${id}/agent-hints`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(hints),
      })
      if (r.ok) {
        const data = (await r.json()) as { agentHints: AgentHints }
        agentHints.value = data.agentHints
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function disconnect(): void {
    eventSource?.close()
    eventSource = null
  }

  bootstrap()

  return {
    id,
    loading,
    error,
    doc,
    flags,
    suggestions,
    responses,
    score,
    agentHints,
    candidateByFlag,
    pendingResponseByFlag,
    panelCounts,
    postResponse,
    cancelResponse,
    acceptFlag,
    discardFlag,
    skipFlag,
    keepFlag,
    putAgentHints,
    disconnect,
  }
}
