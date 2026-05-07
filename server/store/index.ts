import type { ResolutionEvent } from '../../src/types'
import type { DocState } from '../types'
import { DiskStore } from './disk'

export interface DocStore {
  exists(docId: string): Promise<boolean>
  readState(docId: string): Promise<DocState | null>
  writeState(docId: string, state: DocState): Promise<void>
  appendEvent(docId: string, event: ResolutionEvent): Promise<void>
  readEventsSince(docId: string, cursor: number): Promise<ResolutionEvent[]>
  deleteDoc(docId: string): Promise<void>
}

export function createStore(): DocStore {
  const dir = process.env.STORAGE_DIR ?? './data'
  return new DiskStore(dir)
}
