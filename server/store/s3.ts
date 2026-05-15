import { S3Client } from 'bun'
import type { DocState } from '../types'
import type { DocStore } from './index'
import { normaliseDocState } from './migrate'

/**
 * Stateless persistence against any S3-compatible object store: DigitalOcean
 * Spaces, Cloudflare R2, Backblaze B2, AWS S3.
 *
 * Layout: one JSON blob per doc at `<prefix>/<docId>.json`. The blob holds the
 * entire DocState (source, flags, suggestions, responses, comments, history,
 * agent activity, events). Every mutation re-PUTs the whole blob, which both
 * resets the object's last-modified timestamp (so the bucket lifecycle rule
 * sees the doc as "active") and avoids any append-style coordination that
 * object stores don't support.
 *
 * Session expiry is owned by the bucket's lifecycle policy, not this code:
 * configure the bucket to delete objects untouched for the desired window
 * (slopmop's default is 72 hours of inactivity).
 *
 * The doc UUID is the capability - this store does not enumerate, list, or
 * track which docs exist anywhere outside the bucket itself.
 *
 * Required env: `S3_BUCKET`. Recommended: `S3_ENDPOINT` (any S3-compatible
 * host), `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Optional:
 * `S3_PREFIX` (default "docs").
 */
export class S3Store implements DocStore {
  private client: S3Client
  private prefix: string

  constructor() {
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw new Error('S3_BUCKET is required for S3Store')
    this.client = new S3Client({
      bucket,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    })
    this.prefix = (process.env.S3_PREFIX ?? 'docs').replace(/\/+$/, '')
  }

  private key(docId: string): string {
    return `${this.prefix}/${docId}.json`
  }

  async exists(docId: string): Promise<boolean> {
    return this.client.exists(this.key(docId))
  }

  async readState(docId: string): Promise<DocState | null> {
    const file = this.client.file(this.key(docId))
    try {
      const text = await file.text()
      return normaliseDocState(JSON.parse(text) as DocState)
    } catch (err: unknown) {
      // Bun's S3 file throws on 404 / NoSuchKey; treat that as "doesn't exist".
      if (isNotFound(err)) return null
      throw err
    }
  }

  async writeState(docId: string, state: DocState): Promise<void> {
    await this.client.write(this.key(docId), JSON.stringify(state), {
      type: 'application/json',
    })
  }

  async deleteDoc(docId: string): Promise<void> {
    try {
      await this.client.delete(this.key(docId))
    } catch (err: unknown) {
      if (isNotFound(err)) return
      throw err
    }
  }
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; status?: number; statusCode?: number; name?: string }
  if (e.status === 404 || e.statusCode === 404) return true
  if (e.code === 'NoSuchKey' || e.code === 'NotFound') return true
  if (e.name === 'NoSuchKey' || e.name === 'NotFound') return true
  return false
}
