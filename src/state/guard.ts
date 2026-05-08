const SESSION_KEY = 'slopmop.work'

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.localhost')
}

export function isUnlocked(): boolean {
  if (isLocalhost()) return true
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function bootstrapGuard(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (url.searchParams.has('work')) {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* ignore */
    }
    // strip ?work from the URL so links don't carry it forward visibly
    url.searchParams.delete('work')
    const cleaned = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash
    window.history.replaceState({}, '', cleaned)
  }
}
