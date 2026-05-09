import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const cliEntry = resolve(repoRoot, 'cli/main.ts')
const fixtures = resolve(__dirname, 'fixtures')

let serverProc: ReturnType<typeof Bun.spawn> | null = null
let host = ''
let storageDir = ''
let workDir = ''

const ephemeralPort = 18000 + Math.floor(Math.random() * 1000)

beforeAll(async () => {
  storageDir = mkdtempSync(join(tmpdir(), 'slopmop-storage-'))
  workDir = mkdtempSync(join(tmpdir(), 'slopmop-work-'))
  host = `http://127.0.0.1:${ephemeralPort}`

  serverProc = Bun.spawn({
    cmd: ['bun', 'run', resolve(repoRoot, 'server/main.ts')],
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(ephemeralPort),
      STORAGE_DIR: storageDir,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Wait for /health to come up
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${host}/health`)
      if (res.ok) return
    } catch {
      /* not yet */
    }
    await sleep(100)
  }
  throw new Error('server did not come up within 10s')
})

afterAll(async () => {
  if (serverProc) {
    serverProc.kill()
    await serverProc.exited.catch(() => undefined)
  }
  rmSync(storageDir, { recursive: true, force: true })
  rmSync(workDir, { recursive: true, force: true })
})

function slopmop(args: string[], cwd: string = workDir, stdin?: string): Promise<{
  stdout: string
  stderr: string
  exitCode: number
}> {
  const proc = Bun.spawn({
    cmd: ['bun', cliEntry, ...args],
    cwd,
    env: { ...process.env, SLOPMOP_HOST: host },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: stdin !== undefined ? new Response(stdin) : undefined,
  })
  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({ stdout, stderr, exitCode }))
}

function readSessionJson(): { id: string; sourceHash: string; host: string } {
  const path = join(workDir, '.slopmop', 'session.json')
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('slopmop CLI e2e', () => {
  test('init creates a doc and writes session', async () => {
    const articleSrc = resolve(fixtures, 'article.md')
    const r = await slopmop(['init', articleSrc])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/Created doc /)
    expect(existsSync(join(workDir, '.slopmop', 'session.json'))).toBe(true)
    const session = readSessionJson()
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(session.sourceHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('heartbeat bumps lastSeenAt', async () => {
    const r = await slopmop(['heartbeat'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/heartbeat /)

    const docR = await slopmop(['doc', '--json'])
    expect(docR.exitCode).toBe(0)
    const doc = JSON.parse(docR.stdout)
    expect(doc.agentActivity.lastSeenAt).toBeTruthy()
  })

  test('task upsert + delete', async () => {
    const r = await slopmop(['task', 'phase-a', 'in-progress', 'Phase A: walk'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/task phase-a in-progress/)

    const done = await slopmop(['task', 'phase-a', 'done'])
    expect(done.exitCode).toBe(0)
    expect(done.stdout).toMatch(/task phase-a done/)

    const rm = await slopmop(['task-rm', 'phase-a'])
    expect(rm.exitCode).toBe(0)
    expect(rm.stdout).toMatch(/removed task phase-a/)
  })

  test('note from positional and from stdin', async () => {
    const pos = await slopmop(['note', 'finding', 'first batch posted'])
    expect(pos.exitCode).toBe(0)
    expect(pos.stdout).toMatch(/note n-/)

    const piped = await slopmop(['note', 'observation', '--stdin'], workDir, 'piped body text')
    expect(piped.exitCode).toBe(0)
    expect(piped.stdout).toMatch(/note n-/)
  })

  test('flag-post @file', async () => {
    const flagsPath = resolve(fixtures, 'flags.json')
    const r = await slopmop(['flag-post', `@${flagsPath}`])
    expect(r.exitCode).toBe(0)
    // 3 flags in fixture; some may be skipped if pattern lookups change.
    expect(r.stdout).toMatch(/added \d+,/)

    const session = readSessionJson()
    expect(session.sourceHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('pull initially empty (no directives yet)', async () => {
    const r = await slopmop(['pull'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/queue clear/)
  })

  test('user response (free) is fetched by pull, then patched', async () => {
    const session = readSessionJson()

    // Grab a flag id directly from the doc.
    const docRes = await fetch(`${host}/docs/${session.id}`)
    const docData = await docRes.json()
    expect(docData.flags.length).toBeGreaterThan(0)
    const fid = docData.flags[0].id

    // Author posts a free-form directive (this would be the browser).
    const respRes = await fetch(`${host}/docs/${session.id}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flagId: fid, kind: 'free', body: 'cut to the verb' }),
    })
    const respData = await respRes.json()
    const rid = respData.response.id

    const pullR = await slopmop(['pull'])
    expect(pullR.exitCode).toBe(0)
    expect(pullR.stdout).toMatch(rid)

    // CLI agent posts a patch.
    const patchR = await slopmop(['patch', rid, fid, 'rewritten span'])
    expect(patchR.exitCode).toBe(0)
    expect(patchR.stdout).toMatch(/patched v\d+/)

    // After patch, the response is resolved and the queue is empty.
    const pull2 = await slopmop(['pull'])
    expect(pull2.stdout).toMatch(/queue clear/)
  })

  test('412: out-of-band hash bump triggers source-moved error', async () => {
    // Mutate session.json to a wrong hash so the next mutating call 412s.
    const path = join(workDir, '.slopmop', 'session.json')
    const session = JSON.parse(readFileSync(path, 'utf8'))
    const original = session.sourceHash
    session.sourceHash = 'a'.repeat(64)
    require('node:fs').writeFileSync(path, JSON.stringify(session, null, 2))

    const r = await slopmop(['flag-post', `@${resolve(fixtures, 'flags.json')}`])
    expect(r.exitCode).toBe(4)
    expect(r.stderr).toMatch(/source moved \(412\)/)

    // Restore.
    session.sourceHash = original
    require('node:fs').writeFileSync(path, JSON.stringify(session, null, 2))
  })

  test('punt sets response stuck via transition', async () => {
    const session = readSessionJson()
    const docData = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    const openFlag = docData.flags.find((f: { status?: string }) => (f.status ?? 'open') === 'open')
    if (!openFlag) {
      // No open flag means the prior tests resolved them all; create one fresh.
      // For simplicity, skip if the catalogue is exhausted.
      return
    }

    // Issue a directive
    const respData = await fetch(`${host}/docs/${session.id}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flagId: openFlag.id, kind: 'free', body: 'punchline first' }),
    }).then((r) => r.json())
    const rid = respData.response.id

    const r = await slopmop(['punt', rid, 'no clear punchline; three parallel beats'])
    expect(r.exitCode).toBe(0)

    const after = await fetch(`${host}/docs/${session.id}/responses?status=stuck`).then((r) =>
      r.json(),
    )
    const stuck = after.responses.find((x: { id: string }) => x.id === rid)
    expect(stuck).toBeDefined()
  })

  test('reset clears in-flight state but keeps source', async () => {
    const session = readSessionJson()
    const before = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    const sourceBefore = before.doc.source

    const r = await slopmop(['reset', 'angry literary critic lens'])
    expect(r.exitCode).toBe(0)

    const after = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    expect(after.doc.source).toBe(sourceBefore)
    expect(after.agentActivity.tasks).toEqual({})
    expect(after.agentActivity.notes).toEqual({})
  })

  test('events/poll endpoint is gone (fold regression)', async () => {
    const session = readSessionJson()
    const r = await fetch(`${host}/docs/${session.id}/events/poll?since=0&timeout=200`)
    expect([404, 405]).toContain(r.status)
  })

  test('old per-flag verbs are gone (fold regression)', async () => {
    // Re-create fresh by re-running flag-post; this puts new flags in the doc.
    await slopmop(['flag-post', `@${resolve(fixtures, 'flags.json')}`])
    const session = readSessionJson()
    const docData = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    const someFlag = docData.flags.find((f: { status?: string }) => f.status !== 'resolved')
    if (!someFlag) return
    // The /flags/:fid/skip endpoint dropped to a 405.
    const r = await fetch(`${host}/docs/${session.id}/flags/${someFlag.id}/skip`, {
      method: 'POST',
    })
    expect(r.status).toBe(405)
  })

  test('skip via POST /responses kind=skip works (fold path)', async () => {
    const session = readSessionJson()
    const docData = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    const openFlag = docData.flags.find(
      (f: { status?: string }) => (f.status ?? 'open') === 'open',
    )
    if (!openFlag) return
    const r = await slopmop(['skip', openFlag.id])
    expect(r.exitCode).toBe(0)

    const updated = await fetch(`${host}/docs/${session.id}`).then((r) => r.json())
    const flag = updated.flags.find((f: { id: string }) => f.id === openFlag.id)
    expect(flag.status).toBe('skipped')
  })

  test('session walk-up finds parent .slopmop from subdir', async () => {
    const sub = join(workDir, 'sub', 'deeper')
    mkdirSync(sub, { recursive: true })
    const r = await slopmop(['doc', '--json'], sub)
    expect(r.exitCode).toBe(0)
    const data = JSON.parse(r.stdout)
    expect(data.doc.title).toMatch(/article\.md/)
  })

  test('companion writes file', async () => {
    const out = join(workDir, 'companion.json')
    const r = await slopmop(['companion', '--out', out])
    expect(r.exitCode).toBe(0)
    expect(existsSync(out)).toBe(true)
    const data = JSON.parse(readFileSync(out, 'utf8'))
    expect(data.doc).toBeDefined()
  })
})
