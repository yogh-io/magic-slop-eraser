<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useOgHead } from '../composables/useOgHead'
import {
  loadRecents,
  removeRecent,
  clearRecents,
  type RecentEntry,
} from '../state/recents'

useOgHead(() => ({
  title: 'Recent sessions',
  description:
    'The slopmop sessions you have opened on this browser. Stored locally - no account, no sync. Sessions disappear from the server after 72 hours of inactivity.',
  path: '/recents',
  ogType: 'website',
}))

type LoadState = 'loading' | 'ok' | 'expired' | 'error'

interface Metrics {
  state: LoadState
  serverTitle?: string
  score?: number
  scoreRationale?: string
  byRung?: { 1: number; 2: number; 3: number }
  totalFlags?: number
  agentLastSeenAt?: string
  updatedAt?: string
  errorMsg?: string
}

const entries = ref<RecentEntry[]>([])
const metrics = reactive<Record<string, Metrics>>({})
const nowMs = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null

interface FetchedDoc {
  doc: { id: string; title: string; updatedAt: string }
  counts: { 1: number; 2: number; 3: number }
  score?: { value: number; rationale: string }
  agentActivity?: { lastSeenAt?: string }
}

async function fetchOne(id: string): Promise<void> {
  metrics[id] = { state: 'loading' }
  try {
    const r = await fetch(`/docs/${id}`)
    if (r.status === 404) {
      metrics[id] = { state: 'expired' }
      return
    }
    if (!r.ok) {
      metrics[id] = { state: 'error', errorMsg: `${r.status}` }
      return
    }
    const data = (await r.json()) as FetchedDoc
    const total = data.counts[1] + data.counts[2] + data.counts[3]
    metrics[id] = {
      state: 'ok',
      serverTitle: data.doc.title,
      score: data.score?.value,
      scoreRationale: data.score?.rationale,
      byRung: data.counts,
      totalFlags: total,
      agentLastSeenAt: data.agentActivity?.lastSeenAt,
      updatedAt: data.doc.updatedAt,
    }
  } catch (e) {
    metrics[id] = {
      state: 'error',
      errorMsg: e instanceof Error ? e.message : String(e),
    }
  }
}

function refresh(): void {
  entries.value = loadRecents()
  for (const e of entries.value) fetchOne(e.id)
}

function onRemove(id: string): void {
  removeRecent(id)
  delete metrics[id]
  entries.value = loadRecents()
}

function onClearExpired(): void {
  for (const e of entries.value) {
    if (metrics[e.id]?.state === 'expired') {
      removeRecent(e.id)
      delete metrics[e.id]
    }
  }
  entries.value = loadRecents()
}

function onClearAll(): void {
  if (entries.value.length === 0) return
  const ok = window.confirm(
    `Forget all ${entries.value.length} recent session${entries.value.length === 1 ? '' : 's'}? The sessions stay on the server (until they expire); only your local list is cleared.`,
  )
  if (!ok) return
  clearRecents()
  for (const id of Object.keys(metrics)) delete metrics[id]
  entries.value = []
}

function formatAgo(iso: string | undefined, now: number): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'never'
  const ms = Math.max(0, now - then)
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const expiredCount = computed(
  () => entries.value.filter((e) => metrics[e.id]?.state === 'expired').length,
)

onMounted(() => {
  refresh()
  nowTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 30000)
})

onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>

<template>
  <article class="recents">
    <header class="hd">
      <p class="kicker">recents</p>
      <h1>Sessions you have opened on this browser</h1>
      <p class="lede">
        Stored locally - no account, no sync. The server has no notion of "your"
        sessions; this list is the only way back into one once the URL leaves
        your tab. Sessions vanish after <strong>72 hours of inactivity</strong>
        on the server side.
      </p>
    </header>

    <div v-if="entries.length === 0" class="empty">
      <p>No recent sessions on this browser.</p>
      <p>
        <RouterLink to="/" class="cta">Paste an article</RouterLink> to start one.
      </p>
    </div>

    <ul v-else class="list">
      <li
        v-for="e in entries"
        :key="e.id"
        class="row"
        :class="{ expired: metrics[e.id]?.state === 'expired' }"
      >
        <div class="row-main">
          <RouterLink
            :to="`/d/${e.id}`"
            class="row-title"
            :class="{ disabled: metrics[e.id]?.state === 'expired' }"
          >
            {{ metrics[e.id]?.serverTitle ?? e.title }}
          </RouterLink>
          <div class="row-meta">
            <span class="docid" :title="e.id">{{ e.id.slice(0, 8) }}</span>
            <span class="dot">·</span>
            <span class="visited">visited {{ formatAgo(e.lastVisitAt, nowMs) }}</span>
          </div>
        </div>

        <div class="row-metrics">
          <template v-if="metrics[e.id]?.state === 'loading'">
            <span class="badge muted">loading…</span>
          </template>

          <template v-else-if="metrics[e.id]?.state === 'expired'">
            <span class="badge expired-badge">expired</span>
          </template>

          <template v-else-if="metrics[e.id]?.state === 'error'">
            <span class="badge err" :title="metrics[e.id]?.errorMsg">error</span>
          </template>

          <template v-else>
            <span
              v-if="typeof metrics[e.id]?.score === 'number'"
              class="badge score"
              :title="metrics[e.id]?.scoreRationale"
            >
              {{ metrics[e.id]?.score?.toFixed(1) }}
            </span>
            <span class="badge flags" :title="`R1 ${metrics[e.id]?.byRung?.[1] ?? 0} / R2 ${metrics[e.id]?.byRung?.[2] ?? 0} / R3 ${metrics[e.id]?.byRung?.[3] ?? 0}`">
              {{ metrics[e.id]?.totalFlags ?? 0 }} flag{{ (metrics[e.id]?.totalFlags ?? 0) === 1 ? '' : 's' }}
            </span>
            <span
              v-if="metrics[e.id]?.agentLastSeenAt"
              class="badge agent"
              :title="`agent last seen ${metrics[e.id]?.agentLastSeenAt}`"
            >
              agent {{ formatAgo(metrics[e.id]?.agentLastSeenAt, nowMs) }}
            </span>
            <span v-else class="badge agent muted">no agent yet</span>
          </template>
        </div>

        <button class="remove" type="button" @click="onRemove(e.id)" title="Forget this session locally">
          forget
        </button>
      </li>
    </ul>

    <div v-if="entries.length > 0" class="actions">
      <button
        v-if="expiredCount > 0"
        type="button"
        class="quiet"
        @click="onClearExpired"
      >
        Forget {{ expiredCount }} expired
      </button>
      <button type="button" class="quiet" @click="onClearAll">
        Forget all
      </button>
    </div>
  </article>
</template>

<style scoped>
.recents {
  max-width: 72ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
}
.hd { margin-bottom: 2rem; }
.kicker {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0 0 0.4rem;
}
h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  margin: 0 0 0.6rem;
  letter-spacing: var(--heading-tracking, normal);
}
.lede { color: var(--muted); line-height: 1.55; margin: 0; }
.lede strong { color: var(--text); font-weight: 600; }

.empty {
  border: 1px dashed var(--rule);
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--muted);
  border-radius: 4px;
}
.empty p { margin: 0 0 0.6rem; }
.empty .cta {
  color: var(--text);
  border-bottom: 1px dotted var(--rule);
  text-decoration: none;
}
.empty .cta:hover { border-bottom-color: var(--text); }

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: var(--card-bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
}
.row.expired { opacity: 0.55; }

.row-main { min-width: 0; }
.row-title {
  display: block;
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid transparent;
  padding-bottom: 1px;
  width: fit-content;
  max-width: 100%;
}
.row-title:hover { border-bottom-color: var(--accent); }
.row-title.disabled { pointer-events: none; color: var(--muted); }

.row-meta {
  margin-top: 0.25rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-family: var(--font-ui);
  font-size: 0.78rem;
  color: var(--muted);
}
.docid { font-family: var(--font-mono); }
.dot { opacity: 0.5; }

.row-metrics {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.badge {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  padding: 0.18rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 999px;
  color: var(--text);
  background: var(--bg);
  white-space: nowrap;
}
.badge.muted { color: var(--muted); }
.badge.score { font-family: var(--font-mono); font-weight: 600; }
.badge.flags { color: var(--muted); }
.badge.agent { color: var(--muted); }
.badge.expired-badge { color: var(--muted); border-style: dashed; }
.badge.err { color: var(--accent); border-color: var(--accent); }

.remove {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  color: var(--muted);
  background: transparent;
  border: 1px solid transparent;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  cursor: pointer;
}
.remove:hover {
  color: var(--text);
  border-color: var(--rule);
}

.actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
}
.actions .quiet {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--rule);
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
.actions .quiet:hover {
  color: var(--text);
  border-color: var(--text);
}
</style>
