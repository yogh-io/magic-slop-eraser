import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  AgentActivity,
  AgentHints,
  AgentNote,
  AgentNoteKind,
  AgentTask,
  AgentTaskStatus,
  DocResponse,
  Flag,
  Rung,
  ResolutionEvent,
  ResponseKind,
  Suggestion,
} from '../types'
import { makeAnchor } from '../anchoring/textAnchor'

interface DocSummary {
  id: string
  title: string
  source: string
  sourceHash: string
  version: number
}

export interface ScoreInfo {
  value: number
  rationale: string
  topContributors: { patternId: string; count: number; weighted: number }[]
  byRung: Record<Rung, { count: number; weighted: number }>
}

export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

interface FetchedDoc {
  doc: DocSummary
  sourceHash: string
  counts: { 1: number; 2: number; 3: number }
  score: ScoreInfo
  flags: Flag[]
  agentHints: AgentHints
  paragraphs?: ParagraphInfo[]
  density?: Record<string, DensityAxes>
  agentActivity?: AgentActivity
}

export interface OnlineSession {
  id: string
  loading: Ref<boolean>
  error: Ref<string | null>
  /** True when the doc fetch returned 404. Means the session has either
   *  expired (72h of inactivity) or the URL is wrong. The page should switch
   *  to a dedicated empty state instead of showing a generic error. */
  expired: Ref<boolean>
  doc: Ref<DocSummary | null>
  flags: Ref<Flag[]>
  suggestions: Ref<Suggestion[]>
  responses: Ref<DocResponse[]>
  score: Ref<ScoreInfo | null>
  agentHints: Ref<AgentHints>
  paragraphs: Ref<ParagraphInfo[]>
  density: Ref<Record<string, DensityAxes>>
  agentActivity: Ref<AgentActivity>
  /** Tasks ordered by createdAt (oldest first) for stable display. */
  agentTasks: ComputedRef<AgentTask[]>
  /** Notes ordered newest-first for the timeline. */
  agentNotes: ComputedRef<AgentNote[]>
  /** Task counts for the summary line. */
  agentTaskCounts: ComputedRef<{ open: number; inProgress: number; done: number; total: number }>
  /** ms since last agent activity, or null if never seen. Refreshes once a second. */
  agentLastSeenAgo: ComputedRef<number | null>
  /** Reactive `Date.now()`-style ms timestamp ticked every second. Use this as
   *  the right-hand side for any `ms ago` display so per-note timestamps stay
   *  live without each consumer wiring its own setInterval. */
  nowMs: Ref<number>
  /** Per-flag awaiting candidate, if one exists. Returns the newest unaccepted
   *  suggestion (single-candidate flow). Use `candidatesByFlag` to access all
   *  candidates when the flag has multiple (brush mode, multi-candidate scan). */
  candidateByFlag: ComputedRef<Record<string, Suggestion | undefined>>
  /** All unaccepted candidates per flag, sorted newest-first. Brush flags
   *  typically carry ~3; scan flags carry 1 unless the drafter posted
   *  alternatives. */
  candidatesByFlag: ComputedRef<Record<string, Suggestion[]>>
  /** Per-flag pending response, if one exists. */
  pendingResponseByFlag: ComputedRef<Record<string, DocResponse | undefined>>
  /** Counts of flags grouped by display state, used for the panel summary. */
  panelCounts: ComputedRef<{ open: number; pending: number; awaiting: number; stuck: number; closed: number }>
  /** Live count of brush (user-sourced) flags. Surfaces in the panel header
   *  separately from the catalogue score. */
  readerConcernCount: ComputedRef<number>
  postResponse(flagId: string, kind: ResponseKind, body?: string): Promise<DocResponse | null>
  cancelResponse(responseId: string): Promise<void>
  /** Accept a flag's awaiting candidate, mutating source. When the flag has
   *  multiple unaccepted candidates, `suggestionId` must specify which one;
   *  the server rejects with 400 otherwise. */
  acceptFlag(flagId: string, suggestionId?: string): Promise<void>
  discardFlag(flagId: string, suggestionId?: string): Promise<void>
  skipFlag(flagId: string): Promise<void>
  keepFlag(flagId: string): Promise<void>
  /** Post a brush flag: reader highlighted a span and typed a complaint. */
  postUserFlag(selection: { start: number; end: number; text: string }, userNote: string): Promise<Flag | null>
  /** Delete a brush flag the user no longer wants to keep around. */
  removeUserFlag(flagId: string): Promise<void>
  putAgentHints(hints: AgentHints): Promise<void>
  disconnect(): void
}

export function createOnlineSession(id: string): OnlineSession {
  const loading = ref(true)
  const error = ref<string | null>(null)
  const expired = ref(false)
  const doc = ref<DocSummary | null>(null)
  const flags = ref<Flag[]>([])
  const suggestions = ref<Suggestion[]>([])
  const responses = ref<DocResponse[]>([])
  const score = ref<ScoreInfo | null>(null)
  const agentHints = ref<AgentHints>({})
  const paragraphs = ref<ParagraphInfo[]>([])
  const density = ref<Record<string, DensityAxes>>({})
  const agentActivity = ref<AgentActivity>({ tasks: {}, notes: {} })
  /** Reactive "now" used by `agentLastSeenAgo`. Ticked once a second so the
   *  "37s ago" pill keeps counting without forcing the whole panel to re-render
   *  on a higher cadence. */
  const nowTick = ref(Date.now())
  let cursor = 0
  let eventSource: EventSource | null = null
  let nowTimer: ReturnType<typeof setInterval> | null = null

  const candidatesByFlag = computed<Record<string, Suggestion[]>>(() => {
    const out: Record<string, Suggestion[]> = {}
    const sorted = [...suggestions.value].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    )
    for (const s of sorted) {
      if (s.accepted) continue
      if (!out[s.flagId]) out[s.flagId] = []
      out[s.flagId].push(s)
    }
    return out
  })

  const candidateByFlag = computed<Record<string, Suggestion | undefined>>(() => {
    // Latest unaccepted suggestion per flag (newest-first) - what single-
    // candidate scan flows render in the gutter. Multi-candidate (brush, or
    // scan with alternatives) uses `candidatesByFlag` instead and shows a
    // carousel.
    const out: Record<string, Suggestion> = {}
    for (const [flagId, list] of Object.entries(candidatesByFlag.value)) {
      if (list.length > 0) out[flagId] = list[0]
    }
    return out
  })

  const readerConcernCount = computed(() =>
    flags.value.filter((f) => f.source === 'user' && (f.status ?? 'open') !== 'resolved' && (f.status ?? 'open') !== 'stale').length,
  )

  const pendingResponseByFlag = computed<Record<string, DocResponse | undefined>>(() => {
    const out: Record<string, DocResponse> = {}
    for (const r of responses.value) {
      if (r.status !== 'pending') continue
      // First pending wins; if there are multiple, the oldest is what the agent sees first.
      if (!out[r.flagId]) out[r.flagId] = r
    }
    return out
  })

  const agentTasks = computed<AgentTask[]>(() => {
    const list = Object.values(agentActivity.value.tasks ?? {})
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    return list
  })

  const agentNotes = computed<AgentNote[]>(() => {
    const list = Object.values(agentActivity.value.notes ?? {})
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return list
  })

  const agentTaskCounts = computed(() => {
    const out = { open: 0, inProgress: 0, done: 0, total: 0 }
    for (const t of agentTasks.value) {
      out.total++
      if (t.status === 'open') out.open++
      else if (t.status === 'in-progress') out.inProgress++
      else if (t.status === 'done') out.done++
    }
    return out
  })

  const agentLastSeenAgo = computed<number | null>(() => {
    const ts = agentActivity.value.lastSeenAt
    if (!ts) return null
    const ms = nowTick.value - new Date(ts).getTime()
    return ms < 0 ? 0 : ms
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
      if (docRes.status === 404) {
        expired.value = true
        return
      }
      if (!docRes.ok) throw new Error(`${docRes.status}: ${await docRes.text()}`)
      const data = (await docRes.json()) as FetchedDoc
      doc.value = data.doc
      flags.value = data.flags
      score.value = data.score ?? null
      agentHints.value = data.agentHints ?? {}
      paragraphs.value = data.paragraphs ?? []
      density.value = data.density ?? {}
      agentActivity.value = data.agentActivity ?? { tasks: {}, notes: {} }
      cursor = data.doc.version

      if (respRes.ok) {
        const r = (await respRes.json()) as { responses: DocResponse[] }
        responses.value = r.responses
      }
      if (compRes.ok) {
        const c = (await compRes.json()) as { suggestions: Suggestion[] }
        suggestions.value = c.suggestions ?? []
      }

      startNowTicker()
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
      'density-updated',
      'agent-heartbeat',
      'agent-note-added',
      'agent-task-upserted',
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
    score.value = data.score ?? null
    agentHints.value = data.agentHints ?? {}
    paragraphs.value = data.paragraphs ?? []
    density.value = data.density ?? {}
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
      case 'density-updated': {
        // The full density map is small enough to refresh wholesale.
        refreshDoc()
        break
      }
      case 'agent-hints-updated': {
        const hints = ev.payload?.hints as AgentHints | undefined
        if (hints) agentHints.value = hints
        break
      }
      case 'agent-heartbeat': {
        const ts = (ev.payload?.lastSeenAt as string | undefined) ?? ev.ts
        agentActivity.value = { ...agentActivity.value, lastSeenAt: ts }
        break
      }
      case 'agent-note-added': {
        const noteId = ev.payload?.noteId as string | undefined
        const body = ev.payload?.body as string | undefined
        const kind = (ev.payload?.kind as AgentNoteKind | undefined) ?? 'observation'
        if (!noteId || typeof body !== 'string') break
        const next = { ...agentActivity.value }
        next.notes = {
          ...next.notes,
          [noteId]: { id: noteId, body, kind, createdAt: ev.ts },
        }
        next.lastSeenAt = ev.ts
        agentActivity.value = next
        break
      }
      case 'agent-task-upserted': {
        const key = ev.payload?.key as string | undefined
        const title = ev.payload?.title as string | undefined
        const status = (ev.payload?.status as AgentTaskStatus | undefined) ?? 'in-progress'
        if (!key || typeof title !== 'string') break
        const next = { ...agentActivity.value }
        const prior = next.tasks[key]
        next.tasks = {
          ...next.tasks,
          [key]: {
            key,
            title,
            status,
            detail: prior?.detail,
            createdAt: prior?.createdAt ?? ev.ts,
            updatedAt: ev.ts,
          },
        }
        next.lastSeenAt = ev.ts
        agentActivity.value = next
        break
      }
      default:
        break
    }
    // Any drafter-attributable event (flag-added, suggestion-added,
    // resolutions etc.) also bumps the last-seen pulse so the user sees the
    // pipeline alive even if the skill forgets to heartbeat.
    if (isAgentEvent(ev.type)) {
      agentActivity.value = { ...agentActivity.value, lastSeenAt: ev.ts }
    }
  }

  function isAgentEvent(type: ResolutionEvent['type']): boolean {
    return (
      type === 'flag-added' ||
      type === 'suggestion-added' ||
      type === 'response-resolved' ||
      type === 'response-stuck' ||
      type === 'density-updated' ||
      type === 'document-replaced' ||
      type === 'agent-heartbeat' ||
      type === 'agent-note-added' ||
      type === 'agent-task-upserted'
    )
  }

  function startNowTicker(): void {
    if (nowTimer) return
    nowTimer = setInterval(() => {
      nowTick.value = Date.now()
    }, 1000)
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
    extra?: Record<string, unknown>,
  ): Promise<DocResponse | null> {
    const out = await postJson<{ response: DocResponse }>(`/docs/${id}/responses`, {
      flagId,
      kind,
      body: body ?? '',
      ...(extra ?? {}),
    })
    if (out?.response) responses.value = [...responses.value, out.response]
    return out?.response ?? null
  }

  async function cancelResponse(rid: string): Promise<void> {
    await postJson(`/docs/${id}/responses/${rid}/transition`, { to: 'cancelled' })
  }

  // Every user action on a flag is a Response with the matching kind. The
  // server self-resolves accept/discard/skip/keep without a roundtrip to the
  // drafter; SSE events drive the local refresh.
  async function acceptFlag(flagId: string, suggestionId?: string): Promise<void> {
    await postResponse(flagId, 'accept', undefined, suggestionId ? { suggestionId } : undefined)
  }

  async function discardFlag(flagId: string, suggestionId?: string): Promise<void> {
    await postResponse(flagId, 'discard', undefined, suggestionId ? { suggestionId } : undefined)
  }

  async function skipFlag(flagId: string): Promise<void> {
    await postResponse(flagId, 'skip')
  }

  async function keepFlag(flagId: string): Promise<void> {
    await postResponse(flagId, 'keep')
  }

  async function postUserFlag(
    selection: { start: number; end: number; text: string },
    userNote: string,
  ): Promise<Flag | null> {
    const src = doc.value?.source
    if (!src) return null
    // Build an anchor with prefix/suffix context so the server can relocate
    // through subsequent source edits - same shape the drafter uses.
    const anchor = makeAnchor(src, selection.start, selection.end)
    const out = await postJson<{ added: number; flags: Flag[] }>(`/docs/${id}/flags`, {
      source: 'user',
      modelTag: 'reader',
      flags: [
        {
          text: anchor.text,
          start: anchor.start,
          end: anchor.end,
          userNote,
        },
      ],
    })
    const created = out?.flags?.[0] ?? null
    if (created) {
      // Optimistic insert; SSE flag-added event will follow and refresh.
      flags.value = [...flags.value, created]
    }
    return created
  }

  async function removeUserFlag(flagId: string): Promise<void> {
    // Brush flags are just user concerns; treat removal as "skip" (no source
    // change, marks the flag as no longer needing attention). The flag stays
    // in storage as part of the session log so the reflection v2 layer can
    // mine it later, but it drops out of the live "reader concerns" count.
    await postResponse(flagId, 'skip')
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
    if (nowTimer) {
      clearInterval(nowTimer)
      nowTimer = null
    }
  }

  bootstrap()

  return {
    id,
    loading,
    error,
    expired,
    doc,
    flags,
    suggestions,
    responses,
    score,
    agentHints,
    paragraphs,
    density,
    agentActivity,
    agentTasks,
    agentNotes,
    agentTaskCounts,
    agentLastSeenAgo,
    nowMs: nowTick,
    candidateByFlag,
    candidatesByFlag,
    pendingResponseByFlag,
    panelCounts,
    readerConcernCount,
    postResponse,
    cancelResponse,
    acceptFlag,
    discardFlag,
    skipFlag,
    keepFlag,
    postUserFlag,
    removeUserFlag,
    putAgentHints,
    disconnect,
  }
}
