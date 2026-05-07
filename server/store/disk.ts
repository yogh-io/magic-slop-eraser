import { mkdir, readFile, writeFile, rename, rm, appendFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResolutionEvent } from '../../src/types'
import type { DocState } from '../types'
import type { DocStore } from './index'

export class DiskStore implements DocStore {
  constructor(private root: string) {}

  private docDir(docId: string): string {
    return join(this.root, 'docs', docId)
  }

  private statePath(docId: string): string {
    return join(this.docDir(docId), 'state.json')
  }

  private eventsPath(docId: string): string {
    return join(this.docDir(docId), 'events.ndjson')
  }

  async exists(docId: string): Promise<boolean> {
    try {
      await access(this.statePath(docId))
      return true
    } catch {
      return false
    }
  }

  async readState(docId: string): Promise<DocState | null> {
    try {
      const raw = await readFile(this.statePath(docId), 'utf8')
      return JSON.parse(raw) as DocState
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async writeState(docId: string, state: DocState): Promise<void> {
    await mkdir(this.docDir(docId), { recursive: true })
    const tmp = this.statePath(docId) + '.tmp'
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
    await rename(tmp, this.statePath(docId))
  }

  async appendEvent(docId: string, event: ResolutionEvent): Promise<void> {
    await mkdir(this.docDir(docId), { recursive: true })
    await appendFile(this.eventsPath(docId), JSON.stringify(event) + '\n', 'utf8')
  }

  async readEventsSince(docId: string, cursor: number): Promise<ResolutionEvent[]> {
    try {
      const raw = await readFile(this.eventsPath(docId), 'utf8')
      const out: ResolutionEvent[] = []
      for (const line of raw.split('\n')) {
        if (!line) continue
        const e = JSON.parse(line) as ResolutionEvent
        if (e.cursor > cursor) out.push(e)
      }
      return out
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  async deleteDoc(docId: string): Promise<void> {
    await rm(this.docDir(docId), { recursive: true, force: true })
  }
}
