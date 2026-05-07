import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Flag } from '../types'
import { runDetectors, scoreFromFlags } from '../detectors'
import { extractSkipZones, approximateProseWordCount } from '../detectors/skipZones'
import { makeAnchor } from '../anchoring/textAnchor'

const SAMPLE = `# The shape of the deal

It's important to note that the regulatory landscape continues to evolve in profound and remarkable ways. We must navigate this complex tapestry of considerations carefully, as we delve into the nuanced and multifaceted dynamics that shape modern policy.

The framework isn't just a set of rules - it's a paradigm shift. Studies have shown that experts agree these changes will have profound implications for how we think about governance.

It started small. It grew. It became unstoppable.

The challenge raises important questions about the future of the alliance. Generally, this is somewhat typical, and arguably the response will perhaps be relatively measured.

In conclusion, the situation reflects broader dynamics at play. I hope this helps clarify the issues.
`

const STORAGE_KEY = 'mse.doc.v1'

interface PersistedDoc {
  source: string
  userFlags: Flag[]
}

export const useDocStore = defineStore('doc', () => {
  const initial = loadPersisted()
  const source = ref<string>(initial?.source ?? SAMPLE)
  const userFlags = ref<Flag[]>(initial?.userFlags ?? [])
  const selectedFlagId = ref<string | null>(null)
  const filter = ref<{
    categories: Set<string>
    minSeverity: number
  }>({ categories: new Set(), minSeverity: 0 })

  const mechanicalFlags = computed<Flag[]>(() => runDetectors(source.value))

  const allFlags = computed<Flag[]>(() => {
    const all = [...mechanicalFlags.value, ...userFlags.value]
    return all.sort((a, b) => a.anchor.start - b.anchor.start)
  })

  const visibleFlags = computed<Flag[]>(() => {
    const cats = filter.value.categories
    return allFlags.value.filter((f) => {
      if (cats.size > 0 && !cats.has(f.category)) return false
      if (f.severity < filter.value.minSeverity) return false
      return true
    })
  })

  const wordCount = computed<number>(() => {
    const zones = extractSkipZones(source.value)
    return approximateProseWordCount(source.value, zones)
  })

  const score = computed(() => scoreFromFlags(allFlags.value, wordCount.value))

  function setSource(next: string): void {
    source.value = next
    persist()
  }

  function selectFlag(id: string | null): void {
    selectedFlagId.value = id
  }

  function addUserFlag(input: {
    patternId: string
    category: Flag['category']
    start: number
    end: number
    note: string
  }): Flag {
    const anchor = makeAnchor(source.value, input.start, input.end)
    const flag: Flag = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      patternId: input.patternId,
      category: input.category,
      source: 'user',
      anchor,
      rationale: input.note,
      excerpt: anchor.text,
      severity: 0.7,
      userNote: input.note,
      createdAt: new Date().toISOString(),
    }
    userFlags.value.push(flag)
    persist()
    return flag
  }

  function removeUserFlag(id: string): void {
    userFlags.value = userFlags.value.filter((f) => f.id !== id)
    persist()
  }

  function toggleCategoryFilter(cat: string): void {
    const next = new Set(filter.value.categories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    filter.value = { ...filter.value, categories: next }
  }

  function clearFilters(): void {
    filter.value = { categories: new Set(), minSeverity: 0 }
  }

  function persist(): void {
    const data: PersistedDoc = { source: source.value, userFlags: userFlags.value }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function exportCompanion(): string {
    return JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        score: score.value,
        wordCount: wordCount.value,
        flags: allFlags.value,
      },
      null,
      2,
    )
  }

  return {
    source,
    userFlags,
    selectedFlagId,
    filter,
    mechanicalFlags,
    allFlags,
    visibleFlags,
    wordCount,
    score,
    setSource,
    selectFlag,
    addUserFlag,
    removeUserFlag,
    toggleCategoryFilter,
    clearFilters,
    exportCompanion,
  }
})

function loadPersisted(): PersistedDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedDoc
    return parsed
  } catch {
    return null
  }
}
