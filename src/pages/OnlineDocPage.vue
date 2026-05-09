<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createOnlineSession, type OnlineSession } from '../state/online'
import LockedNotice from '../components/LockedNotice.vue'
import ArticleView from '../components/ArticleView.vue'
import { isUnlocked } from '../state/guard'
import type { DocResponse, Flag, Suggestion } from '../types'

const unlocked = isUnlocked()
const route = useRoute()
const fatalError = ref<string | null>(null)
const selectedFlagId = ref<string | null>(null)
const peekFlagId = ref<string | null>(null)
const directiveInput = ref<Record<string, string>>({})
const letMeTryInput = ref<Record<string, string>>({})
const letMeTryOpen = ref<Record<string, boolean>>({})

const SHORTCUTS = [
  'more committal',
  'drop the qualifier',
  'punchline first',
  'their voice not yours',
  'cut to the verb',
]

const docId = String(route.params.id ?? '')

let session: OnlineSession | null = null
if (unlocked) {
  if (!docId) fatalError.value = 'no document id'
  else session = createOnlineSession(docId)
}

const loading = session?.loading ?? ref(false)
const errorRef = session?.error ?? ref<string | null>(null)
const doc = session?.doc ?? ref(null)
const flags = session?.flags ?? ref<Flag[]>([])
const responses = session?.responses ?? ref<DocResponse[]>([])
const score = session?.score ?? ref(null)
const paragraphs = session?.paragraphs ?? ref([])
const density = session?.density ?? ref({})
const scoreValue = computed(() => score.value?.value ?? null)
const scoreOpen = ref(false)
function toggleScore(): void { scoreOpen.value = !scoreOpen.value }
function barWidth(weighted: number): string {
  const max = score.value?.topContributors[0]?.weighted ?? 1
  const pct = max > 0 ? Math.min(100, (weighted / max) * 100) : 0
  return `${pct}%`
}
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

/**
 * Two-phase workflow: in 'shape' pass we surface only Rung 3 (structural)
 * flags, so the writer doesn't polish prose that's about to be cut. Once
 * R3 settles, the toggle (or the auto-fallback) flips to 'prose' and
 * Rung 1 + Rung 2 become visible. The user can override at any time.
 */
const userPhase = ref<'shape' | 'prose' | null>(null)

function isLive(flag: Flag): boolean {
  const s = flag.status ?? 'open'
  return s === 'open' || s === 'awaiting-accept'
}

const r3LiveCount = computed(
  () => flags.value.filter((f) => (f.rung ?? 1) === 3 && isLive(f)).length,
)
const lowerLiveCount = computed(
  () => flags.value.filter((f) => (f.rung ?? 1) !== 3 && isLive(f)).length,
)

const phase = computed<'shape' | 'prose'>(() => {
  if (userPhase.value) return userPhase.value
  return r3LiveCount.value > 0 ? 'shape' : 'prose'
})

function isInPhase(rung: number | undefined): boolean {
  const r = rung ?? 1
  return phase.value === 'shape' ? r === 3 : r !== 3
}

function setPhase(p: 'shape' | 'prose'): void {
  userPhase.value = p
}

const visibleFlags = computed(() =>
  orderedFlags.value.filter((v) => v.state !== 'closed' && isInPhase(v.flag.rung)),
)

/** Flags passed to ArticleView; out-of-phase marks are suppressed entirely. */
const articleFlags = computed(() => flags.value.filter((f) => isInPhase(f.rung)))

const inlineCandidates = computed(() => {
  const m = new Map<string, string>()
  for (const v of visibleFlags.value) {
    if (v.state === 'awaiting' && v.candidate) m.set(v.flag.id, v.candidate.post)
  }
  return m
})

function rungLabel(r: number | undefined): string {
  if (r === 1) return 'R1'
  if (r === 2) return 'R2'
  if (r === 3) return 'R3'
  return 'R?'
}

function rungName(r: number | undefined): string {
  if (r === 1) return 'lexical'
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
  letMeTryOpen.value[flagId] = false
}

async function accept(flagId: string): Promise<void> {
  await session?.acceptFlag(flagId)
  if (selectedFlagId.value === flagId) selectedFlagId.value = null
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

function startPeek(flagId: string, e: PointerEvent): void {
  const target = e.currentTarget as HTMLElement | null
  if (target?.setPointerCapture) {
    try { target.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  peekFlagId.value = flagId
}

function endPeek(): void {
  peekFlagId.value = null
}

function selectFlag(id: string): void {
  selectedFlagId.value = id
}

function onFlagClick(id: string): void {
  selectedFlagId.value = id
  // Scroll its annotation into view too.
  nextTick(() => {
    const el = annotationRefs.value.get(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

// --- annotation positioning (review-comment-style alignment) ----------------

const articleViewRef = ref<InstanceType<typeof ArticleView> | null>(null)
const annotationRefs = ref<Map<string, HTMLElement>>(new Map())
const finalTops = ref<Map<string, number>>(new Map())
const gutterMinHeight = ref(0)

function setAnnotationRef(id: string, el: Element | null): void {
  if (el instanceof HTMLElement) annotationRefs.value.set(id, el)
  else annotationRefs.value.delete(id)
}

const ANNOTATION_GAP = 10

async function recomputeLayout(): Promise<void> {
  await nextTick()
  if (!articleViewRef.value) return
  const positions = articleViewRef.value.getMarkPositions()
  const ordered = visibleFlags.value
    .map((v) => ({ id: v.flag.id, rawTop: positions.get(v.flag.id) }))
    .filter((o): o is { id: string; rawTop: number } => o.rawTop !== undefined)
    .sort((a, b) => a.rawTop - b.rawTop)

  const next = new Map<string, number>()
  let cursor = 0
  for (const o of ordered) {
    const el = annotationRefs.value.get(o.id)
    const h = el?.offsetHeight ?? 120
    const top = Math.max(o.rawTop, cursor)
    next.set(o.id, top)
    cursor = top + h + ANNOTATION_GAP
  }
  finalTops.value = next
  gutterMinHeight.value = cursor
}

function onLayoutReady(): void {
  recomputeLayout()
  // Re-measure once more after a frame, in case heights changed because the
  // candidate text rendered with a different length.
  nextTick(() => recomputeLayout())
}

watch(visibleFlags, () => {
  // When flag list changes (resolved, added), positions change.
  nextTick(() => recomputeLayout())
})

let resizeRaf = 0
function onResize(): void {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => recomputeLayout())
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
})

// --- share banner -----------------------------------------------------------

const SHARE_DISMISS_KEY = 'mse.share.dismissed'

const shareDismissed = ref<Record<string, boolean>>({})
if (typeof window !== 'undefined') {
  try {
    shareDismissed.value = JSON.parse(localStorage.getItem(SHARE_DISMISS_KEY) ?? '{}')
  } catch {
    /* ignore */
  }
}

const shareUrl = computed(() => {
  if (typeof window === 'undefined' || !docId) return ''
  return `${window.location.origin}/d/${docId}`
})

const agentPrompt = computed(() => {
  if (!shareUrl.value) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `Open the slopmop session at ${shareUrl.value} and drive its deslop loop. If the slopmop skill isn't installed, fetch ${origin}/slopmop.md and save it to .claude/skills/slopmop/SKILL.md. Then pull pending responses, draft candidates, post resolutions; punt anything you can't address.`
})

const shareVisible = computed(() => {
  if (!docId) return false
  return !shareDismissed.value[docId]
})

const copyState = ref<'url' | 'prompt' | null>(null)
function copyText(kind: 'url' | 'prompt', text: string): void {
  if (typeof navigator === 'undefined') return
  navigator.clipboard?.writeText(text).then(() => {
    copyState.value = kind
    setTimeout(() => {
      if (copyState.value === kind) copyState.value = null
    }, 1800)
  })
}

function dismissShare(): void {
  if (!docId) return
  shareDismissed.value = { ...shareDismissed.value, [docId]: true }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SHARE_DISMISS_KEY, JSON.stringify(shareDismissed.value))
    } catch {
      /* ignore */
    }
  }
}
</script>

<template>
  <LockedNotice v-if="!unlocked" what="The document viewer" />
  <div v-else class="layout">
    <div v-if="fatalError" class="err">
      <h1>Cannot open document</h1>
      <p>{{ fatalError }}</p>
    </div>

    <template v-else-if="session">
      <section v-if="shareVisible && shareUrl" class="share">
        <div class="share-row">
          <span class="share-lbl">session URL</span>
          <code class="share-val">{{ shareUrl }}</code>
          <button type="button" class="share-copy" @click="copyText('url', shareUrl)">
            {{ copyState === 'url' ? 'copied' : 'copy' }}
          </button>
        </div>
        <div class="share-row">
          <span class="share-lbl">for your agent</span>
          <code class="share-val truncate">{{ agentPrompt }}</code>
          <button type="button" class="share-copy" @click="copyText('prompt', agentPrompt)">
            {{ copyState === 'prompt' ? 'copied' : 'copy' }}
          </button>
        </div>
        <button type="button" class="share-dismiss" @click="dismissShare" title="dismiss for this session">×</button>
      </section>

      <header class="topbar">
        <div class="title-block">
          <p class="kicker">slopmop session</p>
          <h1>{{ doc?.title ?? 'Loading…' }}</h1>
          <div v-if="doc" class="phase-toggle" role="radiogroup" aria-label="pass">
            <button
              type="button"
              role="radio"
              :aria-checked="phase === 'shape'"
              :class="['phase-btn', { active: phase === 'shape' }]"
              :disabled="r3LiveCount === 0 && phase !== 'shape'"
              @click="setPhase('shape')"
              title="Surface only Rung 3 (structural) flags. Settle the shape before polishing prose."
            >
              <span class="phase-name">shape pass</span>
              <span class="phase-count">{{ r3LiveCount }}</span>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="phase === 'prose'"
              :class="['phase-btn', { active: phase === 'prose' }]"
              @click="setPhase('prose')"
              title="Surface Rung 1 and Rung 2 (prose-level) flags. Lexical and passage-level polish."
            >
              <span class="phase-name">prose pass</span>
              <span class="phase-count">{{ lowerLiveCount }}</span>
            </button>
            <span
              v-if="phase === 'shape' && lowerLiveCount > 0"
              class="phase-hint"
              :title="`${lowerLiveCount} prose-level flags hidden - settle the shape first`"
            >shape first</span>
          </div>
        </div>
        <div v-if="doc" class="counts">
          <button
            type="button"
            class="score"
            :class="{ 'is-open': scoreOpen, 'is-blank': scoreValue === null }"
            @click="toggleScore"
            :title="score?.rationale ?? 'no analysis yet'"
          >
            <span class="score-num">{{ scoreValue !== null ? scoreValue : '-' }}</span>
            <span class="score-lbl">score</span>
            <span class="score-rungs" v-if="score">
              <span v-if="score.byRung[1].count > 0" class="r r-1">R1·{{ score.byRung[1].count }}</span>
              <span v-if="score.byRung[2].count > 0" class="r r-2">R2·{{ score.byRung[2].count }}</span>
              <span v-if="score.byRung[3].count > 0" class="r r-3">R3·{{ score.byRung[3].count }}</span>
            </span>
          </button>
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

      <section v-if="doc && scoreOpen" class="score-panel">
        <div class="score-panel-head">
          <h2>Score breakdown</h2>
          <button type="button" class="close" @click="toggleScore" aria-label="close">×</button>
        </div>
        <p class="score-rationale" v-if="score">{{ score.rationale }}</p>
        <div v-if="score" class="rung-grid">
          <div v-for="r in [1, 2, 3] as const" :key="r" :class="['rung-cell', `rung-${r}`]">
            <span class="rung-name">{{ rungName(r) }}</span>
            <span class="rung-count"><b>{{ score.byRung[r].count }}</b> flags</span>
            <span class="rung-weighted muted">weight {{ score.byRung[r].weighted.toFixed(2) }}</span>
          </div>
        </div>
        <h3 v-if="score && score.topContributors.length > 0">By pattern</h3>
        <ol v-if="score" class="contributors">
          <li v-for="c in score.topContributors" :key="c.patternId">
            <router-link :to="`/patterns/${c.patternId}`" class="pat-name">{{ c.patternId }}</router-link>
            <span class="pat-count">{{ c.count }} ×</span>
            <span class="pat-weight muted">{{ c.weighted.toFixed(2) }}</span>
            <span class="pat-bar" :style="{ width: barWidth(c.weighted) }" />
          </li>
        </ol>
        <p class="score-note muted">
          Weights come from the drafter at flag-detection time, informed by the voice memo.
          Score is the aggregate. Resolved flags drop out; the score updates as you sweep.
        </p>
      </section>

      <p v-if="loading" class="loading">connecting…</p>
      <p v-if="errorRef" class="err">error: {{ errorRef }}</p>

      <main v-if="doc" class="canvas">
        <section class="doc">
          <ArticleView
            ref="articleViewRef"
            :source="doc.source"
            :flags="articleFlags"
            :selected-flag-id="selectedFlagId"
            :candidates="inlineCandidates"
            :peek-flag-id="peekFlagId"
            :paragraphs="paragraphs"
            :density="density"
            @flag-click="onFlagClick"
            @layout-ready="onLayoutReady"
          />
        </section>

        <aside class="gutter" :style="{ minHeight: gutterMinHeight + 'px' }">
          <p v-if="visibleFlags.length === 0" class="empty">
            No open flags. The document is clean (or the agent hasn't run detectors yet).
          </p>

          <article
            v-for="v in visibleFlags"
            :key="v.flag.id"
            :ref="(el) => setAnnotationRef(v.flag.id, el as Element | null)"
            class="annot"
            :data-flag-id="v.flag.id"
            :data-state="v.state"
            :data-rung="v.flag.rung ?? 1"
            :class="{ selected: selectedFlagId === v.flag.id }"
            :style="{ top: (finalTops.get(v.flag.id) ?? 0) + 'px' }"
            @click="selectFlag(v.flag.id)"
          >
            <header class="ann-head">
              <span :class="['rung-pill', `rung-${v.flag.rung ?? 1}`]" :title="rungName(v.flag.rung)">
                {{ rungLabel(v.flag.rung) }}
              </span>
              <span class="pattern" :title="v.flag.patternId">{{ v.flag.patternId }}</span>
              <span :class="['state-badge', `state-${v.state}`]">{{ v.state }}</span>
            </header>

            <p v-if="v.flag.rationale" class="rationale">{{ v.flag.rationale }}</p>

            <!-- AWAITING-ACCEPT: candidate-aware row -->
            <div v-if="v.state === 'awaiting' && v.candidate" class="awaiting-row">
              <button
                type="button"
                class="primary"
                @click.stop="accept(v.flag.id)"
              >accept</button>
              <button
                type="button"
                class="peek"
                @pointerdown.stop="startPeek(v.flag.id, $event)"
                @pointerup.stop="endPeek()"
                @pointercancel.stop="endPeek()"
              >hold to see original</button>
              <button type="button" class="quiet" @click.stop="discard(v.flag.id)">discard</button>
              <span v-if="v.candidate.modelTag" class="model-tag">via {{ v.candidate.modelTag }}</span>
            </div>

            <!-- PENDING -->
            <div v-else-if="v.state === 'pending' && v.pendingResponse" class="pending-row">
              <span class="thinking"><span class="spinner" /> agent thinking…</span>
              <span class="directive">
                <span class="kind">{{ v.pendingResponse.kind }}</span>
                <span v-if="v.pendingResponse.body">"{{ v.pendingResponse.body }}"</span>
              </span>
              <button type="button" class="quiet small" @click.stop="cancelPending(v.pendingResponse.id)">cancel</button>
            </div>

            <!-- STUCK -->
            <p v-else-if="v.state === 'stuck' && v.stuckResponse" class="stuck-row">
              <span class="lbl">agent stuck</span>
              <span v-if="v.stuckResponse.stuckReason" class="reason">- {{ v.stuckResponse.stuckReason }}</span>
            </p>

            <!-- Universal directive UI: chips + free input + skip/keep/let-me-try -->
            <div class="directive-ui" @click.stop>
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
                  :placeholder="v.state === 'awaiting' ? 'nudge…' : 'custom directive…'"
                />
                <button type="submit" :disabled="!directiveInput[v.flag.id]?.trim()">send</button>
              </form>
              <div class="meta-row">
                <button
                  type="button"
                  class="link"
                  @click="letMeTryOpen[v.flag.id] = !letMeTryOpen[v.flag.id]"
                >{{ letMeTryOpen[v.flag.id] ? 'cancel' : 'let me try…' }}</button>
                <span class="spacer" />
                <button type="button" class="link" @click="skip(v.flag.id)">skip</button>
                <button type="button" class="link" @click="keep(v.flag.id)">keep deliberate</button>
              </div>
              <form
                v-if="letMeTryOpen[v.flag.id]"
                class="free let-me-try"
                @submit.prevent="submitLetMeTry(v.flag.id)"
              >
                <input
                  v-model="letMeTryInput[v.flag.id]"
                  type="text"
                  placeholder="paste your replacement"
                />
                <button type="submit" :disabled="!letMeTryInput[v.flag.id]">apply</button>
              </form>
            </div>
          </article>
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

.share {
  position: relative;
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem 2.2rem 0.7rem 0.9rem;
  margin: 0 0 1rem;
  background: var(--code-bg);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-size: 0.85rem;
}
.share-row {
  display: grid;
  grid-template-columns: 6.5rem 1fr auto;
  gap: 0.7rem;
  align-items: center;
}
.share-lbl {
  font-family: var(--font-display);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.share-val {
  font-family: var(--font-mono);
  font-size: 0.84rem;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.25rem 0.55rem;
  overflow-x: auto;
  white-space: nowrap;
  min-width: 0;
}
.share-val.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.share-copy {
  font-family: var(--font-ui);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--rule);
  background: var(--bg);
  color: var(--text);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  cursor: pointer;
  white-space: nowrap;
}
.share-copy:hover { background: var(--text); color: var(--bg); border-color: var(--text); }
.share-dismiss {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  background: transparent;
  border: 0;
  color: var(--muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.1rem 0.35rem;
}
.share-dismiss:hover { color: var(--text); }

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

.phase-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.phase-btn {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-family: var(--font-ui);
  font-size: 0.8rem;
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
}
.phase-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.phase-btn:not(:disabled):hover { color: var(--text); border-color: var(--text); }
.phase-btn.active {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
  font-weight: 600;
}
.phase-btn .phase-count {
  font-family: var(--font-mono);
  font-size: 0.78em;
  opacity: 0.85;
}
.phase-btn.active .phase-count { opacity: 0.85; }
.phase-hint {
  font-size: 0.74rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left: 0.2rem;
  font-style: italic;
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
.counts .pending b { color: #b88f3e; }
.counts .awaiting b { color: #2f8f6a; }
.counts .stuck b { color: #b8472d; }

.counts .score {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  font-family: inherit;
  font-size: inherit;
  color: var(--text);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.counts .score:hover { border-color: var(--text); background: color-mix(in srgb, var(--text) 6%, transparent); }
.counts .score.is-open { background: var(--text); color: var(--bg); border-color: var(--text); }
.counts .score.is-open .muted, .counts .score.is-open .score-lbl { color: inherit; opacity: 0.7; }
.counts .score.is-blank .score-num { color: var(--muted); }
.counts .score-num { font-family: var(--font-display); font-weight: 700; font-size: 1.1em; line-height: 1; }
.counts .score-lbl { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.7em; color: var(--muted); }
.counts .score-rungs { display: inline-flex; gap: 0.3rem; margin-left: 0.2rem; }
.counts .score-rungs .r {
  font-size: 0.72em;
  padding: 0.05em 0.35em;
  border-radius: 3px;
  background: color-mix(in srgb, var(--rule) 60%, transparent);
  color: var(--text);
}
.counts .score-rungs .r-1 { color: var(--cat-lexical, var(--accent)); }
.counts .score-rungs .r-2 { color: var(--cat-structural, var(--accent)); }
.counts .score-rungs .r-3 { color: var(--cat-argumentative, var(--accent)); }

.score-panel {
  margin: 1rem 0 1.2rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
}
.score-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.score-panel h2 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
  color: var(--muted);
}
.score-panel .close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 0.3rem;
}
.score-panel .close:hover { color: var(--text); }
.score-rationale {
  font-style: italic;
  color: var(--text);
  margin: 0 0 1rem;
}
.rung-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
  margin: 0.4rem 0 1rem;
}
.rung-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
}
.rung-cell.rung-1 { border-left: 3px solid var(--cat-lexical, var(--accent)); }
.rung-cell.rung-2 { border-left: 3px solid var(--cat-structural, var(--accent)); }
.rung-cell.rung-3 { border-left: 3px solid var(--cat-argumentative, var(--accent)); }
.rung-name {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.rung-count { font-family: var(--font-display); font-size: 1.05rem; }
.rung-count b { font-weight: 700; }
.rung-weighted { font-size: 0.8rem; }
.score-panel h3 {
  font-family: var(--font-display);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0.8rem 0 0.4rem;
  color: var(--muted);
}
.contributors {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.contributors li {
  display: grid;
  grid-template-columns: minmax(10ch, 1fr) auto auto;
  gap: 0.6rem;
  align-items: center;
  position: relative;
  padding: 0.25rem 0.5rem;
  font-size: 0.88rem;
}
.pat-name {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dotted var(--rule);
  z-index: 1;
}
.pat-name:hover { border-bottom-color: var(--text); }
.pat-count { font-family: var(--font-mono); font-size: 0.85em; color: var(--muted); z-index: 1; }
.pat-weight { font-family: var(--font-mono); font-size: 0.85em; z-index: 1; }
.pat-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-radius: 3px;
  z-index: 0;
  pointer-events: none;
}
.score-note { margin: 0.8rem 0 0; font-size: 0.8rem; }

.loading, .empty { color: var(--muted); }
.err { color: #b8472d; }

/* The canvas: article on the left, annotation gutter on the right.        */
/* Both flow with page scroll. Annotations are absolutely positioned       */
/* within .gutter, aligned to the y-offset of their flag mark in the doc.  */
.canvas {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24rem;
  gap: 1.6rem;
  align-items: start;
}
.doc {
  min-width: 0;
}
.gutter {
  position: relative;
  min-height: 200px;
}
.empty {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 2rem 1rem;
  font-size: 0.9rem;
}

/* An annotation is a self-contained card; it holds excerpt/rationale,     */
/* state-specific affordances, and the universal directive UI.             */
.annot {
  position: absolute;
  left: 0;
  right: 0;
  border: 1px solid var(--rule);
  border-left-width: 3px;
  border-radius: 6px;
  padding: 0.65rem 0.8rem 0.75rem;
  background: var(--bg);
  font-size: 0.86rem;
  line-height: 1.45;
  cursor: pointer;
  transition: top 180ms ease, box-shadow 120ms ease, border-color 120ms ease;
}
.annot[data-rung="1"] { border-left-color: #2f8f6a; }
.annot[data-rung="2"] { border-left-color: #b88f3e; }
.annot[data-rung="3"] { border-left-color: #b8472d; }
.annot[data-state="awaiting"] {
  box-shadow: 0 0 0 2px color-mix(in srgb, #2f8f6a 20%, transparent);
}
.annot[data-state="stuck"] {
  box-shadow: 0 0 0 2px color-mix(in srgb, #b8472d 18%, transparent);
}
.annot[data-state="pending"] { opacity: 0.92; }
.annot.selected {
  border-color: var(--text);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--text) 18%, transparent);
}

.ann-head {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
}
.rung-pill {
  font-family: var(--font-display);
  font-size: 0.7rem;
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
  font-size: 0.78rem;
  color: var(--muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.state-badge {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--rule);
  color: var(--muted);
}
.state-pending { color: #b88f3e; border-color: color-mix(in srgb, #b88f3e 50%, var(--rule)); }
.state-awaiting { color: #2f8f6a; border-color: color-mix(in srgb, #2f8f6a 50%, var(--rule)); }
.state-stuck { color: #b8472d; border-color: color-mix(in srgb, #b8472d 50%, var(--rule)); }

.rationale {
  font-size: 0.83rem;
  color: var(--muted);
  margin: 0 0 0.55rem;
  line-height: 1.4;
}

/* State rows: replace the WAS/NOW diff with a single accept-row, since   */
/* the candidate is now visible inline in the article itself.             */
.awaiting-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.55rem;
}
.awaiting-row .model-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--muted);
  margin-left: auto;
}

.pending-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
}
.pending-row .thinking {
  color: #b88f3e;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
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
@keyframes spin { to { transform: rotate(360deg); } }
.pending-row .directive {
  color: var(--muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pending-row .kind {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
  margin-right: 0.3rem;
  text-transform: lowercase;
}

.stuck-row {
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
  color: var(--text);
}
.stuck-row .lbl {
  font-family: var(--font-display);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #b8472d;
  margin-right: 0.3rem;
}
.stuck-row .reason { color: var(--muted); }

/* Universal directive UI: same composition for every state.              */
.directive-ui {
  display: grid;
  gap: 0.35rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.chip {
  font-family: var(--font-ui);
  font-size: 0.74rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  padding: 0.18rem 0.5rem;
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
}
.free input {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 0.83rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  min-width: 0;
}
.free button {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  padding: 0.28rem 0.65rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
}
.free button:disabled { opacity: 0.4; cursor: not-allowed; }
.free button:not(:disabled):hover { border-color: var(--text); }
.let-me-try { margin-top: 0.1rem; }

.meta-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  font-size: 0.78rem;
}
.meta-row .spacer { flex: 1; }
.meta-row .link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 1px dotted transparent;
}
.meta-row .link:hover { color: var(--text); border-bottom-color: var(--rule); }

/* The accept / hold-to-see-original / discard cluster. */
.awaiting-row button {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  padding: 0.32rem 0.7rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
}
.awaiting-row button.primary {
  background: #2f8f6a;
  color: #fff;
  border-color: #2f8f6a;
  font-weight: 600;
}
.awaiting-row button.primary:hover { background: #1f7058; border-color: #1f7058; }
.awaiting-row button.peek {
  background: var(--code-bg);
  user-select: none;
  touch-action: none;
}
.awaiting-row button.peek:active {
  background: color-mix(in srgb, #b8472d 18%, var(--code-bg));
}
.awaiting-row button.quiet { color: var(--muted); }
.awaiting-row button:not(:disabled):hover { border-color: var(--text); }

.pending-row button.small {
  font-family: var(--font-ui);
  font-size: 0.74rem;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--muted);
  border-radius: 4px;
  cursor: pointer;
}
.pending-row button.small:hover { color: var(--text); border-color: var(--text); }

@media (max-width: 960px) {
  .canvas {
    grid-template-columns: 1fr;
  }
  .gutter {
    min-height: 0 !important;
  }
  .annot {
    position: relative;
    top: auto !important;
    margin-bottom: 0.7rem;
  }
}
</style>
