import type { DocStore } from '../store'
import type { DocState } from '../types'
import type {
  AgentNote,
  AgentNoteKind,
  AgentTask,
  AgentTaskStatus,
  ResolutionEvent,
} from '../../src/types'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'

function nowIso(): string {
  return new Date().toISOString()
}

function bumpCursor(state: DocState): number {
  state.doc.version += 1
  state.doc.updatedAt = nowIso()
  return state.doc.version
}

function ensureActivity(state: DocState): void {
  if (!state.agentActivity) {
    state.agentActivity = { tasks: {}, notes: {} }
  }
  if (!state.agentActivity.tasks) state.agentActivity.tasks = {}
  if (!state.agentActivity.notes) state.agentActivity.notes = {}
}

const VALID_NOTE_KINDS: AgentNoteKind[] = ['observation', 'finding', 'progress', 'concern']
const VALID_TASK_STATUSES: AgentTaskStatus[] = ['open', 'in-progress', 'done']

/**
 * Agent-activity endpoints. Three sub-verbs under /docs/:id/agent:
 *   - heartbeat: drafter ping; bumps lastSeenAt and emits 'agent-heartbeat'.
 *     Carries no payload. Used by the skill at session start as a "pipeline
 *     works" signal so the UI can show the agent is alive even before any
 *     flags or notes have been posted.
 *   - notes:     POST a free-form heads-up the writer should see (e.g. "the
 *     piece is unusually committal - most slop categories don't bite").
 *   - tasks:     upsert by `key`. Drafter declares its current task list with
 *     status (open / in-progress / done); the UI renders the live shape.
 *
 * Every call also bumps lastSeenAt - any agent activity counts as a sighting.
 */
export async function handleAgent(
  req: Request,
  store: DocStore,
  docId: string,
  segs: string[],
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()
  ensureActivity(state)

  const verb = segs[0] ?? null

  if (verb === 'heartbeat' && req.method === 'POST') {
    const ts = nowIso()
    state.agentActivity.lastSeenAt = ts
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'agent-heartbeat',
      payload: { lastSeenAt: ts },
      ts,
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true, lastSeenAt: ts })
  }

  if (verb === 'notes' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      body?: string
      kind?: string
    } | null
    if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
      return fail(400, 'note body required')
    }
    const kind: AgentNoteKind = VALID_NOTE_KINDS.includes(body.kind as AgentNoteKind)
      ? (body.kind as AgentNoteKind)
      : 'observation'
    const ts = nowIso()
    const note: AgentNote = {
      id: `n-${crypto.randomUUID().slice(0, 8)}`,
      body: body.body.trim(),
      kind,
      createdAt: ts,
    }
    state.agentActivity.notes[note.id] = note
    state.agentActivity.lastSeenAt = ts
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'agent-note-added',
      payload: { noteId: note.id, kind, body: note.body },
      ts,
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ note })
  }

  if (verb === 'tasks' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as {
      key?: string
      title?: string
      detail?: string
      status?: string
    } | null
    if (!body || typeof body.key !== 'string' || body.key.trim().length === 0) {
      return fail(400, 'task key required')
    }
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return fail(400, 'task title required')
    }
    const status: AgentTaskStatus = VALID_TASK_STATUSES.includes(
      body.status as AgentTaskStatus,
    )
      ? (body.status as AgentTaskStatus)
      : 'in-progress'
    const ts = nowIso()
    const existing = state.agentActivity.tasks[body.key]
    const task: AgentTask = {
      key: body.key,
      title: body.title.trim(),
      detail: typeof body.detail === 'string' ? body.detail.trim() : undefined,
      status,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    }
    state.agentActivity.tasks[task.key] = task
    state.agentActivity.lastSeenAt = ts
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'agent-task-upserted',
      payload: {
        key: task.key,
        title: task.title,
        status: task.status,
        previousStatus: existing?.status,
      },
      ts,
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ task })
  }

  return fail(405, 'method not allowed')
}
