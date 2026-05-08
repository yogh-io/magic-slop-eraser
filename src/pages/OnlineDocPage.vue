<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createOnlineSession, type OnlineSession } from '../state/online'
import LockedNotice from '../components/LockedNotice.vue'
import ArticleView from '../components/ArticleView.vue'
import { isUnlocked } from '../state/guard'
import type { DocResponse, Flag, Suggestion } from '../types'

const unlocked = isUnlocked()
const route = useRoute()
const tokenError = ref<string | null>(null)
const selectedFlagId = ref<string | null>(null)
const peekFlagId = ref<string | null>(null)
const directiveInput = ref<Record<string, string>>({})
const letMeTryInput = ref<Record<string, string>>({})

const SHORTCUTS = [
  'more committal',
  'drop the qualifier',
  'punchline first',
  'their voice not yours',
  'cut to the verb',
]

function tokenFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(h)
  return params.get('t')
}

const docId = String(route.params.id ?? '')
const tokenStr = tokenFromHash()

let session: OnlineSession | null = null
if (unlocked) {
  if (!docId) tokenError.value = 'no document id'
  else if (!tokenStr) tokenError.value = 'no token in URL fragment (expected #t=...)'
  else session = createOnlineSession(docId, tokenStr)
}

// Bind the session's refs at top level so the template auto-unwraps them.
// When the session can't be created (gated, missing token, etc.) we use empty
// stand-ins so the template still binds.
const loading = session?.loading ?? ref(false)
const errorRef = session?.error ?? ref<string | null>(null)
const doc = session?.doc ?? ref(null)
const flags = session?.flags ?? ref<Flag[]>([])
const responses = session?.responses ?? ref<DocResponse[]>([])
const score = session?.score ?? ref(0)
const candidateByFlag = session?.candidateByFlag ?? computed(() => ({}) as Record<string, Suggestion | undefined>)
const pendingResponseByFlag = session?.pendingResponseByFlag ?? computed(() => ({}) as Record<string, DocResponse | undefined>)
const panelCounts = session?.panelCounts ?? computed(() => ({ open: 0, pending: 0, awaiting: 0, stuck: 0, closed: 0 }))

onBeforeUnmount(() => session?.disconnect())

type FlagState = 'open' | 'pending' | 'awaiting' | 'stuck' | 'closed'

interface FlagView {
  flag: Flag
  state: FlagState
  candidate: Suggestion | null
  pendingResponse: DocResponse | null
  stuckResponse: DocResponse | null
}

const orderedFlags = computed<FlagView[]>(() => {
  const out: FlagView[] = []
  for (const flag of [...flags.value].sort((a, b) => a.anchor.start - b.anchor.start)) {
    const status = flag.status ?? 'open'
    const candidate = candidateByFlag.value[flag.id] ?? null
    const pending = pendingResponseByFlag.value[flag.id] ?? null
    const stuck =
      responses.value.find((r) => r.flagId === flag.id && r.status === 'stuck') ?? null
    let state: FlagState
    if (status === 'awaiting-accept') state = 'awaiting'
    else if (status === 'open') {
      if (pending) state = 'pending'
      else if (stuck) state = 'stuck'
      else state = 'open'
    } else state = 'closed'
    out.push({ flag, state, candidate, pendingResponse: pending, stuckResponse: stuck })
  }
  return out
})

const visibleFlags = computed(() => orderedFlags.value.filter((v) => v.state !== 'closed'))

function rungLabel(r: number | undefined): string {
  if (r === 1) return 'R1'
  if (r === 2) return 'R2'
  if (r === 3) return 'R3'
  return 'R?'
}

function rungName(r: number | undefined): string {
  if (r === 1) return 'mechanical'
  if (r === 2) return 'passage'
  if (r === 3) return 'presentation'
  return 'unknown'
}

async function submitShortcut(flagId: string, shortcut: string): Promise<void> {
  if (!session) return
  await session.postResponse(flagId, 'shortcut', shortcut)
  directiveInput.value[flagId] = ''
}

async function submitFreeDirective(flagId: string): Promise<void> {
  if (!session) return
  const body = (directiveInput.value[flagId] ?? '').trim()
  if (!body) return
  await session.postResponse(flagId, 'free', body)
  directiveInput.value[flagId] = ''
}

async function submitLetMeTry(flagId: string): Promise<void> {
  if (!session) return
  const text = letMeTryInput.value[flagId] ?? ''
  if (!text) return
  await session.postResponse(flagId, 'let-me-try', text)
  letMeTryInput.value[flagId] = ''
}

async function accept(flagId: string): Promise<void> {
  await session?.acceptFlag(flagId)
}

async function discard(flagId: string): Promise<void> {
  await session?.discardFlag(flagId)
}

async function skip(flagId: string): Promise<void> {
  await session?.skipFlag(flagId)
}

async function keep(flagId: string): Promise<void> {
  await session?.keepFlag(flagId)
}

async function cancelPending(rid: string): Promise<void> {
  await session?.cancelResponse(rid)
}

function startPeek(flagId: string): void {
  peekFlagId.value = flagId
}

function endPeek(): void {
  peekFlagId.value = null
}

function flagClicked(id: string): void {
  selectedFlagId.value = id
  // scroll the panel item into view
  const el = document.querySelector(`[data-panel-flag="${id}"]`)
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>

<template>
  <LockedNotice v-if="!unlocked" what="The document viewer" />
  <div v-else class="layout">
    <div v-if="tokenError" class="err">
      <h1>Cannot open document</h1>
      <p>{{ tokenError }}</p>
    </div>

    <template v-else-if="session">
      <header class="topbar">
        <div class="title-block">
          <p class="kicker">eraser session</p>
          <h1>{{ doc?.title ?? 'Loading…' }}</h1>
        </div>
        <div v-if="doc" class="counts">
          <span class="score">score {{ score }}</span>
          <span class="dot" />
          <span title="open"><b>{{ panelCounts.open }}</b> open</span>
          <span class="dot" />
          <span title="pending agent" class="pending"><b>{{ panelCounts.pending }}</b> pending</span>
          <span class="dot" />
          <span title="awaiting your accept" class="awaiting"><b>{{ panelCounts.awaiting }}</b> awaiting</span>
          <span v-if="panelCounts.stuck > 0" class="dot" />
          <span v-if="panelCounts.stuck > 0" title="agent gave up" class="stuck"><b>{{ panelCounts.stuck }}</b> stuck</span>
          <span class="dot" />
          <span class="muted">v{{ doc.version }}</span>
        </div>
      </header>

      <p v-if="loading" class="loading">connecting…</p>
      <p v-if="errorRef" class="err">error: {{ errorRef }}</p>

      <main v-if="doc" class="grid">
        <section class="doc">
          <ArticleView
            :source="doc.source"
            :flags="flags"
            :selected-flag-id="selectedFlagId"
            @flag-click="flagClicked"
          />
        </section>

        <aside class="panel">
          <p v-if="visibleFlags.length === 0" class="empty">
            No open flags. The document is clean (or the agent hasn't run detectors yet).
          </p>

          <ul class="flags">
            <li
              v-for="v in visibleFlags"
              :key="v.flag.id"
              class="flag"
              :data-panel-flag="v.flag.id"
              :data-rung="v.flag.rung ?? 1"
              :data-state="v.state"
              :class="{ peeking: peekFlagId === v.flag.id }"
            >
              <header class="flag-head" @click="selectedFlagId = v.flag.id">
                <span :class="['rung-pill', `rung-${v.flag.rung ?? 1}`]" :title="rungName(v.flag.rung)">{{ rungLabel(v.flag.rung) }}</span>
                <span class="pattern">{{ v.flag.patternId }}</span>
                <span :class="['state-badge', `state-${v.state}`]">{{ v.state }}</span>
              </header>

              <p class="excerpt">
                <mark>{{ v.flag.excerpt }}</mark>
              </p>
              <p v-if="v.flag.rationale" class="rationale">{{ v.flag.rationale }}</p>

              <!-- OPEN: needs a directive -->
              <div v-if="v.state === 'open'" class="actions">
                <div class="chips">
                  <button
                    v-for="s in SHORTCUTS"
                    :key="s"
                    type="button"
                    class="chip"
                    @click="submitShortcut(v.flag.id, s)"
                  >{{ s }}</button>
                </div>
                <form class="free" @submit.prevent="submitFreeDirective(v.flag.id)">
                  <input
                    v-model="directiveInput[v.flag.id]"
                    type="text"
                    placeholder="custom directive…"
                  />
                  <button type="submit" :disabled="!directiveInput[v.flag.id]?.trim()">send</button>
                </form>
                <details class="let-me-try">
                  <summary>let me try…</summary>
                  <form @submit.prevent="submitLetMeTry(v.flag.id)">
                    <input
                      v-model="letMeTryInput[v.flag.id]"
                      type="text"
                      placeholder="paste your replacement"
                    />
                    <button type="submit" :disabled="!letMeTryInput[v.flag.id]">apply</button>
                  </form>
                </details>
                <div class="row">
                  <button type="button" class="quiet" @click="skip(v.flag.id)">skip</button>
                  <button type="button" class="quiet" @click="keep(v.flag.id)">keep deliberate</button>
                </div>
              </div>

              <!-- PENDING: agent thinking -->
              <div v-else-if="v.state === 'pending' && v.pendingResponse" class="pending-block">
                <p class="thinking">
                  <span class="spinner" />
                  agent thinking…
                </p>
                <p class="directive">
                  <span class="kind">{{ v.pendingResponse.kind }}</span>
                  <span v-if="v.pendingResponse.body">"{{ v.pendingResponse.body }}"</span>
                </p>
                <button type="button" class="quiet small" @click="cancelPending(v.pendingResponse.id)">cancel</button>
              </div>

              <!-- AWAITING-ACCEPT: candidate ready -->
              <div v-else-if="v.state === 'awaiting' && v.candidate" class="awaiting-block">
                <div class="diff">
                  <p class="diff-row">
                    <span class="lbl">was</span>
                    <span class="pre">{{ v.candidate.pre }}</span>
                  </p>
                  <p class="diff-row">
                    <span class="lbl">now</span>
                    <span class="post">{{ v.candidate.post }}</span>
                  </p>
                </div>
                <p v-if="v.candidate.modelTag" class="model-tag">via {{ v.candidate.modelTag }}</p>
                <div class="row">
                  <button type="button" class="primary" @click="accept(v.flag.id)">accept</button>
                  <button
                    type="button"
                    class="peek"
                    @mousedown="startPeek(v.flag.id)"
                    @mouseup="endPeek()"
                    @mouseleave="endPeek()"
                    @touchstart.prevent="startPeek(v.flag.id)"
                    @touchend="endPeek()"
                  >hold to compare</button>
                  <button type="button" class="quiet" @click="discard(v.flag.id)">discard</button>
                </div>
                <details class="redirect">
                  <summary>re-direct</summary>
                  <div class="chips">
                    <button
                      v-for="s in SHORTCUTS"
                      :key="s"
                      type="button"
                      class="chip"
                      @click="submitShortcut(v.flag.id, s)"
                    >{{ s }}</button>
                  </div>
                  <form class="free" @submit.prevent="submitFreeDirective(v.flag.id)">
                    <input
                      v-model="directiveInput[v.flag.id]"
                      type="text"
                      placeholder="nudge…"
                    />
                    <button type="submit" :disabled="!directiveInput[v.flag.id]?.trim()">send</button>
                  </form>
                </details>
              </div>

              <!-- STUCK: agent gave up -->
              <div v-else-if="v.state === 'stuck' && v.stuckResponse" class="stuck-block">
                <p class="stuck-msg">
                  <span class="lbl">agent stuck</span>
                  <span v-if="v.stuckResponse.stuckReason">- {{ v.stuckResponse.stuckReason }}</span>
                </p>
                <div class="chips">
                  <button
                    v-for="s in SHORTCUTS"
                    :key="s"
                    type="button"
                    class="chip"
                    @click="submitShortcut(v.flag.id, s)"
                  >{{ s }}</button>
                </div>
                <form class="free" @submit.prevent="submitFreeDirective(v.flag.id)">
                  <input
                    v-model="directiveInput[v.flag.id]"
                    type="text"
                    placeholder="try a different angle…"
                  />
                  <button type="submit" :disabled="!directiveInput[v.flag.id]?.trim()">send</button>
                </form>
                <div class="row">
                  <button type="button" class="quiet" @click="skip(v.flag.id)">skip</button>
                  <button type="button" class="quiet" @click="keep(v.flag.id)">keep deliberate</button>
                </div>
              </div>
            </li>
          </ul>
        </aside>
      </main>
    </template>
  </div>
</template>

<style scoped>
.layout {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.4rem 1.6rem 4rem;
  color: var(--text);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1.2rem;
  margin-bottom: 1.2rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--rule);
}
.title-block .kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.74rem;
  color: var(--muted);
  margin: 0 0 0.25rem;
}
.title-block h1 {
  font-family: var(--font-display);
  font-size: 1.6rem;
  margin: 0;
  letter-spacing: var(--heading-tracking, normal);
}
.counts {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--text);
}
.counts b { font-weight: 600; }
.counts .dot {
  width: 3px;
  height: 3px;
  background: var(--rule);
  border-radius: 50%;
  display: inline-block;
}
.counts .muted { color: var(--muted); }
.counts .score { font-weight: 600; }
.counts .pending b { color: #b88f3e; }
.counts .awaiting b { color: #2f8f6a; }
.counts .stuck b { color: #b8472d; }

.loading, .empty { color: var(--muted); }
.err { color: #b8472d; }

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26rem;
  gap: 1.6rem;
  align-items: start;
}

.doc {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 7rem);
  overflow-y: auto;
  padding-right: 0.5rem;
}

.panel {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 7rem);
  overflow-y: auto;
}

.flags { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.7rem; }

.flag {
  border: 1px solid var(--rule);
  border-left-width: 3px;
  border-radius: 6px;
  padding: 0.7rem 0.9rem 0.8rem;
  background: var(--bg);
}
.flag[data-rung="1"] { border-left-color: #2f8f6a; }
.flag[data-rung="2"] { border-left-color: #b88f3e; }
.flag[data-rung="3"] { border-left-color: #b8472d; }
.flag[data-state="awaiting"] { box-shadow: 0 0 0 2px color-mix(in srgb, #2f8f6a 25%, transparent); }
.flag[data-state="stuck"] { box-shadow: 0 0 0 2px color-mix(in srgb, #b8472d 20%, transparent); }
.flag[data-state="pending"] { opacity: 0.85; }
.flag.peeking .post { display: none; }
.flag.peeking .pre { font-weight: 600; color: var(--text); background: color-mix(in srgb, #b8472d 15%, transparent); }

.flag-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
  cursor: pointer;
}
.rung-pill {
  font-family: var(--font-display);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  color: #fff;
  font-weight: 700;
}
.rung-1 { background: #2f8f6a; }
.rung-2 { background: #b88f3e; }
.rung-3 { background: #b8472d; }
.pattern {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--muted);
  flex: 1;
}
.state-badge {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--rule);
  color: var(--muted);
}
.state-open { color: var(--muted); }
.state-pending { color: #b88f3e; border-color: color-mix(in srgb, #b88f3e 50%, var(--rule)); }
.state-awaiting { color: #2f8f6a; border-color: color-mix(in srgb, #2f8f6a 50%, var(--rule)); }
.state-stuck { color: #b8472d; border-color: color-mix(in srgb, #b8472d 50%, var(--rule)); }

.excerpt {
  font-family: var(--font-prose);
  margin: 0.2rem 0;
  font-size: 0.93rem;
  line-height: 1.45;
}
.excerpt mark {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  padding: 0 0.15em;
}
.rationale {
  font-size: 0.84rem;
  color: var(--muted);
  margin: 0 0 0.5rem;
  line-height: 1.4;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.4rem 0;
}
.chip {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
}
.chip:hover {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}

.free {
  display: flex;
  gap: 0.3rem;
  margin: 0.4rem 0;
}
.free input {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 0.86rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  min-width: 0;
}
.free button {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
}
.free button:disabled { opacity: 0.4; cursor: not-allowed; }
.free button:not(:disabled):hover { border-color: var(--text); }

.let-me-try, .redirect {
  font-size: 0.85rem;
  margin: 0.5rem 0 0;
}
.let-me-try summary, .redirect summary {
  cursor: pointer;
  color: var(--muted);
  user-select: none;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.let-me-try summary:hover, .redirect summary:hover { color: var(--text); }

.row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
.row button {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  padding: 0.32rem 0.75rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
}
.row button.quiet { color: var(--muted); }
.row button.quiet.small { padding: 0.15rem 0.5rem; font-size: 0.75rem; }
.row button.primary {
  background: #2f8f6a;
  color: #fff;
  border-color: #2f8f6a;
  font-weight: 600;
}
.row button.peek {
  background: var(--code-bg);
  user-select: none;
}
.row button:not(:disabled):hover { border-color: var(--text); }
.row button.primary:hover { background: #1f7058; border-color: #1f7058; }

.pending-block {
  display: grid;
  gap: 0.4rem;
}
.thinking {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #b88f3e;
  font-size: 0.86rem;
}
.spinner {
  width: 0.8rem;
  height: 0.8rem;
  border: 2px solid color-mix(in srgb, #b88f3e 30%, transparent);
  border-top-color: #b88f3e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.directive {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
}
.directive .kind {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
  margin-right: 0.3rem;
  text-transform: lowercase;
}

.awaiting-block { display: grid; gap: 0.4rem; }
.diff {
  display: grid;
  gap: 0.2rem;
  padding: 0.45rem 0.6rem;
  background: var(--code-bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
}
.diff-row {
  margin: 0;
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 0.4rem;
  align-items: baseline;
  font-family: var(--font-prose);
  font-size: 0.92rem;
  line-height: 1.4;
}
.diff-row .lbl {
  font-family: var(--font-display);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.diff-row .pre { color: var(--muted); text-decoration: line-through; }
.diff-row .post { color: var(--text); font-weight: 500; }
.model-tag {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted);
  font-family: var(--font-mono);
}

.stuck-block { display: grid; gap: 0.4rem; }
.stuck-msg {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text);
}
.stuck-msg .lbl {
  font-family: var(--font-display);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #b8472d;
  margin-right: 0.3rem;
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .doc, .panel {
    position: static;
    max-height: none;
  }
}
</style>
