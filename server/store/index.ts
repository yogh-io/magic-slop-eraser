import type { DocState } from '../types'
import { DiskStore } from './disk'
import { S3Store } from './s3'

export interface DocStore {
  exists(docId: string): Promise<boolean>
  readState(docId: string): Promise<DocState | null>
  writeState(docId: string, state: DocState): Promise<void>
  deleteDoc(docId: string): Promise<void>
}

/**
 * Pick a backend by env. If `S3_BUCKET` is set we use S3 (any S3-compatible
 * store: DigitalOcean Spaces, Cloudflare R2, Backblaze B2, AWS). Else we fall
 * back to the on-disk store at `STORAGE_DIR`. The two backends share an
 * identical surface so route handlers don't care which is in play.
 */
export function createStore(): DocStore {
  if (process.env.S3_BUCKET) return new S3Store()
  const dir = process.env.STORAGE_DIR ?? './data'
  return new DiskStore(dir)
}
