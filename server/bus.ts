import type { ResolutionEvent } from '../src/types'

type Listener = (event: ResolutionEvent) => void

class EventBus {
  private listeners = new Map<string, Set<Listener>>()

  subscribe(docId: string, listener: Listener): () => void {
    let set = this.listeners.get(docId)
    if (!set) {
      set = new Set()
      this.listeners.set(docId, set)
    }
    set.add(listener)
    return () => {
      const cur = this.listeners.get(docId)
      if (!cur) return
      cur.delete(listener)
      if (cur.size === 0) this.listeners.delete(docId)
    }
  }

  publish(docId: string, event: ResolutionEvent): void {
    const set = this.listeners.get(docId)
    if (!set) return
    for (const l of set) l(event)
  }
}

export const bus = new EventBus()
