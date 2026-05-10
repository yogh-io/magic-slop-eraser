/**
 * Locally-remembered list of doc sessions the user has interacted with on
 * this browser. Sessions live on the server keyed by UUID and the URL is the
 * capability, so the only way back into one is to remember the id. We keep a
 * ring buffer in localStorage (no auth, no sync, no cross-device) - the
 * /recents page renders from it and pulls live metrics per id.
 */

const STORAGE_KEY = 'slopmop:recents'
const MAX_ENTRIES = 30

export interface RecentEntry {
  id: string
  title: string
  addedAt: string
  lastVisitAt: string
}

function safeParse(raw: string | null): RecentEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(
      (e): e is RecentEntry =>
        e &&
        typeof e.id === 'string' &&
        typeof e.title === 'string' &&
        typeof e.addedAt === 'string' &&
        typeof e.lastVisitAt === 'string',
    )
  } catch {
    return []
  }
}

function read(): RecentEntry[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse(localStorage.getItem(STORAGE_KEY))
}

function write(entries: RecentEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* quota or disabled storage; surface no error - this is best-effort. */
  }
}

/** Newest-visit-first list; safe to call on every render. */
export function loadRecents(): RecentEntry[] {
  const entries = read()
  entries.sort((a, b) => (a.lastVisitAt < b.lastVisitAt ? 1 : -1))
  return entries
}

/**
 * Record a visit. If the id is already in the list, bumps `lastVisitAt` and
 * refreshes the title (server-derived titles can change). Caps the list at
 * MAX_ENTRIES, evicting oldest visits.
 */
export function addRecent(id: string, title: string): void {
  if (!id) return
  const now = new Date().toISOString()
  const entries = read()
  const existing = entries.find((e) => e.id === id)
  if (existing) {
    existing.lastVisitAt = now
    if (title) existing.title = title
  } else {
    entries.push({
      id,
      title: title || 'Untitled',
      addedAt: now,
      lastVisitAt: now,
    })
  }
  entries.sort((a, b) => (a.lastVisitAt < b.lastVisitAt ? 1 : -1))
  while (entries.length > MAX_ENTRIES) entries.pop()
  write(entries)
}

export function removeRecent(id: string): void {
  const entries = read().filter((e) => e.id !== id)
  write(entries)
}

export function clearRecents(): void {
  write([])
}
