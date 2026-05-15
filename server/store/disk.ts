import { mkdir, readFile, writeFile, rename, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocState } from '../types'
import type { DocStore } from './index'
import { normaliseDocState } from './migrate'

/**
 * One JSON blob per doc at `<root>/docs/<id>/state.json`. Events live inside
 * the blob, so every mutation rewrites the whole file - kept atomic with a
 * tmp+rename pattern. Suits local development; in production prefer S3Store.
 */
export class DiskStore implements DocStore {
  constructor(private root: string) {}

  private docDir(docId: string): string {
    return join(this.root, 'docs', docId)
  }

  private statePath(docId: string): string {
    return join(this.docDir(docId), 'state.json')
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
      return normaliseDocState(JSON.parse(raw) as DocState)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async writeState(docId: string, state: DocState): Promise<void> {
    await mkdir(this.docDir(docId), { recursive: true })
    const tmp = this.statePath(docId) + '.tmp'
    await writeFile(tmp, JSON.stringify(state), 'utf8')
    await rename(tmp, this.statePath(docId))
  }

  async deleteDoc(docId: string): Promise<void> {
    await rm(this.docDir(docId), { recursive: true, force: true })
  }
}
