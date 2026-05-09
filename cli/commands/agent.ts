import { Client, exitOnHttpError } from '../client'
import { readSession, resolveHost, resolveId, type Session } from '../session'
import { flagBool, flagString, type Args } from '../args'
import { resolveBody } from '../io'

function nowIso(): string {
  return new Date().toISOString()
}

async function withClient(args: Args): Promise<Client> {
  const session = readSession()
  const host = resolveHost(flagString(args, 'host'), session)
  const id = resolveId(flagString(args, 'id'), session)
  if (!id) {
    throw new Error('no slopmop session. run `slopmop init` or `slopmop attach` first.')
  }
  const effective: Session = session ?? { id, host, sourceHash: '', createdAt: nowIso() }
  effective.host = host
  effective.id = id
  return new Client(effective, process.cwd())
}

export async function cmdHeartbeat(args: Args): Promise<void> {
  const c = await withClient(args)
  const data = await c
    .request<{ ok: boolean; lastSeenAt: string }>({
      method: 'POST',
      path: `/docs/${c.session.id}/agent/heartbeat`,
    })
    .catch(exitOnHttpError)
  process.stdout.write(`heartbeat ${data.lastSeenAt}\n`)
}

export async function cmdNote(args: Args): Promise<void> {
  const kind = args.positional[0]
  if (!kind) {
    throw new Error('usage: slopmop note <observation|finding|progress|concern> <body|@file|->')
  }
  const body = (await resolveBody(args.positional, flagBool(args, 'stdin'), 1)).trim()
  if (!body) throw new Error('note body is empty; pass text, @file, or --stdin')

  const c = await withClient(args)
  const data = await c
    .request<{ note: { id: string; createdAt: string } }>({
      method: 'POST',
      path: `/docs/${c.session.id}/agent/notes`,
      body: { body, kind },
    })
    .catch(exitOnHttpError)
  process.stdout.write(`note ${data.note.id} (${kind}) at ${data.note.createdAt}\n`)
}

export async function cmdTask(args: Args): Promise<void> {
  const [key, status, ...titleParts] = args.positional
  if (!key || !status) {
    throw new Error('usage: slopmop task <key> <open|in-progress|done> [title...] [--detail D]')
  }
  const c = await withClient(args)
  const detail = flagString(args, 'detail')
  const title = titleParts.join(' ').trim() || undefined

  // Server upserts by key. If we don't know the title (status-only update on a
  // pre-existing task), pull the task list first to keep the server's title.
  let resolvedTitle = title
  if (!resolvedTitle) {
    const doc = await c
      .request<{ agentActivity?: { tasks: Record<string, { title: string }> } }>({
        method: 'GET',
        path: `/docs/${c.session.id}`,
      })
      .catch(exitOnHttpError)
    resolvedTitle = doc.agentActivity?.tasks?.[key]?.title
  }
  if (!resolvedTitle) {
    throw new Error(
      `task '${key}' has no title and is not in the existing task list. pass a title argument.`,
    )
  }

  const body: Record<string, unknown> = { key, title: resolvedTitle, status }
  if (detail) body.detail = detail

  const data = await c
    .request<{ task: { key: string; title: string; status: string } }>({
      method: 'POST',
      path: `/docs/${c.session.id}/agent/tasks`,
      body,
    })
    .catch(exitOnHttpError)
  process.stdout.write(`task ${data.task.key} ${data.task.status}: ${data.task.title}\n`)
}

export async function cmdTaskRm(args: Args): Promise<void> {
  const key = args.positional[0]
  if (!key) throw new Error('usage: slopmop task-rm <key>')
  const c = await withClient(args)
  const data = await c
    .request<{ ok: boolean; removed: { key: string; title: string } }>({
      method: 'DELETE',
      path: `/docs/${c.session.id}/agent/tasks/${encodeURIComponent(key)}`,
    })
    .catch(exitOnHttpError)
  process.stdout.write(`removed task ${data.removed.key}: ${data.removed.title}\n`)
}
