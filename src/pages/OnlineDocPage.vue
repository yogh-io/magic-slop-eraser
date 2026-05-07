<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createOnlineSession, type OnlineSession } from '../state/online'
import LockedNotice from '../components/LockedNotice.vue'
import { isUnlocked } from '../state/guard'
import type { Flag } from '../types'

const unlocked = isUnlocked()
const route = useRoute()
const session = ref<OnlineSession | null>(null)
const tokenError = ref<string | null>(null)

function tokenFromHash(): string | null {
  const h = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(h)
  return params.get('t')
}

function start(): void {
  if (!unlocked) return
  const id = String(route.params.id ?? '')
  const token = tokenFromHash()
  if (!id) {
    tokenError.value = 'no document id'
    return
  }
  if (!token) {
    tokenError.value = 'no token in URL fragment (expected #t=...)'
    return
  }
  session.value = createOnlineSession(id, token)
}

watch(() => route.params.id, start, { immediate: true })

onBeforeUnmount(() => session.value?.disconnect())

function rungLabel(r: number | undefined): string {
  if (r === 1) return 'R1 mechanical'
  if (r === 2) return 'R2 passage'
  if (r === 3) return 'R3 presentation'
  return 'R?'
}

function flagLine(source: string, flag: Flag): { before: string; mark: string; after: string } {
  const start = flag.anchor.start
  const end = flag.anchor.end
  const ctxBefore = source.slice(Math.max(0, start - 80), start)
  const mark = source.slice(start, end)
  const ctxAfter = source.slice(end, Math.min(source.length, end + 80))
  return { before: ctxBefore, mark, after: ctxAfter }
}
</script>

<template>
  <LockedNotice v-if="!unlocked" what="The document viewer" />
  <article v-else class="prose">
    <div v-if="tokenError" class="err">
      <h1>Cannot open document</h1>
      <p>{{ tokenError }}</p>
    </div>

    <template v-else-if="session">
      <header class="hd">
        <p class="kicker">eraser session</p>
        <h1>{{ session.doc?.title ?? 'Loading…' }}</h1>
        <p v-if="session.doc" class="meta">
          score {{ session.score }} · {{ session.openFlags.length }} open flag<span v-if="session.openFlags.length !== 1">s</span> · v{{ session.doc.version }}
        </p>
      </header>

      <p v-if="session.loading" class="loading">connecting…</p>
      <p v-if="session.error" class="err">error: {{ session.error }}</p>

      <ul v-if="session.doc && session.openFlags.length > 0" class="flags">
        <li v-for="flag in session.openFlags" :key="flag.id" class="flag" :data-rung="flag.rung ?? 1">
          <header class="flag-head">
            <span :class="['rung', `rung-${flag.rung ?? 1}`]">{{ rungLabel(flag.rung) }}</span>
            <span class="pattern">{{ flag.patternId }}</span>
          </header>
          <p class="excerpt">
            <span class="dim">…{{ flagLine(session.doc.source, flag).before }}</span><mark>{{ flagLine(session.doc.source, flag).mark }}</mark><span class="dim">{{ flagLine(session.doc.source, flag).after }}…</span>
          </p>
          <p class="rationale">{{ flag.rationale }}</p>
          <div class="actions">
            <button @click="session.resolve(flag.id, '')">cut it</button>
            <button @click="session.skip(flag.id)">skip</button>
            <button @click="session.keepDeliberate(flag.id)">keep deliberate</button>
          </div>
        </li>
      </ul>

      <p v-else-if="session.doc" class="empty">no open flags. if the agent runs detectors, they will appear here.</p>
    </template>
  </article>
</template>

<style scoped>
.prose {
  max-width: 78ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.55;
}
.kicker { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.7rem; color: var(--muted); margin: 0; }
.hd h1 { font-family: var(--font-display); font-size: 2rem; margin: 0.2rem 0 0.4rem; }
.meta { color: var(--muted); margin: 0 0 1.5rem; font-size: 0.9rem; }
.loading, .empty { color: var(--muted); }
.err { color: #b8472d; }

.flags { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
.flag { border-left: 3px solid var(--rule); padding: 0.6rem 0 0.6rem 1rem; }
.flag[data-rung="1"] { border-left-color: #2f8f6a; }
.flag[data-rung="2"] { border-left-color: #b88f3e; }
.flag[data-rung="3"] { border-left-color: #b8472d; }
.flag-head { display: flex; gap: 0.6rem; align-items: baseline; margin-bottom: 0.3rem; }
.rung { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.1rem 0.45rem; border-radius: 3px; color: #fff; }
.rung-1 { background: #2f8f6a; }
.rung-2 { background: #b88f3e; }
.rung-3 { background: #b8472d; }
.pattern { font-family: var(--font-mono, monospace); font-size: 0.85rem; color: var(--muted); }
.excerpt { font-family: var(--font-prose); margin: 0.2rem 0; line-height: 1.5; }
.excerpt mark { background: color-mix(in srgb, var(--accent) 25%, transparent); padding: 0 0.1em; }
.dim { color: var(--muted); }
.rationale { font-size: 0.88rem; color: var(--muted); margin: 0.3rem 0 0.6rem; }
.actions { display: flex; gap: 0.5rem; }
.actions button {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 3px;
  cursor: pointer;
}
.actions button:hover { border-color: var(--text); }
</style>
