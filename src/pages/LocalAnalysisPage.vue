<script setup lang="ts">
import { ref } from 'vue'
import { useDocStore } from '../state/doc'
import ArticleView from '../components/ArticleView.vue'
import FlagsPanel from '../components/FlagsPanel.vue'
import UserHighlightDialog from '../components/UserHighlightDialog.vue'
import LockedNotice from '../components/LockedNotice.vue'
import { isUnlocked } from '../state/guard'
import { useOgHead } from '../composables/useOgHead'
import type { CategoryId } from '../types'

useOgHead(() => ({
  title: 'Local scratchpad',
  description:
    'Paste a markdown article and run the Rung 1 mechanical detectors against it client-side. No session, no agent, nothing leaves the browser. The full agent loop lives at the doc URLs.',
  path: '/local',
  ogType: 'website',
}))

const unlocked = isUnlocked()

const store = useDocStore()
const showEditor = ref(false)
const editBuffer = ref('')

const selection = ref<{ start: number; end: number; text: string } | null>(null)
const dialogOpen = ref(false)

function openEditor(): void {
  editBuffer.value = store.source
  showEditor.value = true
}
function saveEditor(): void {
  store.setSource(editBuffer.value)
  showEditor.value = false
}
function loadSample(): void {
  editBuffer.value = SAMPLE
  showEditor.value = true
}

function handleSelection(s: { start: number; end: number; text: string } | null): void {
  selection.value = s
}

function flagSelection(): void {
  if (!selection.value) return
  dialogOpen.value = true
}

function handleSubmit(payload: { patternId: string; category: CategoryId; note: string }): void {
  if (!selection.value || selection.value.start < 0) return
  store.addUserFlag({
    patternId: payload.patternId,
    category: payload.category,
    start: selection.value.start,
    end: selection.value.end,
    note: payload.note,
  })
  dialogOpen.value = false
  selection.value = null
  window.getSelection()?.removeAllRanges()
}

function exportCompanion(): void {
  const data = store.exportCompanion()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `companion-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const SAMPLE = `# The shape of the deal

It's important to note that the regulatory landscape continues to evolve in profound and remarkable ways. We must navigate this complex tapestry of considerations carefully, as we delve into the nuanced and multifaceted dynamics that shape modern policy.

The framework isn't just a set of rules - it's a paradigm shift. Studies have shown that experts agree these changes will have profound implications for how we think about governance.

It started small. It grew. It became unstoppable.

The challenge raises important questions about the future of the alliance. Generally, this is somewhat typical, and arguably the response will perhaps be relatively measured.

In conclusion, the situation reflects broader dynamics at play. I hope this helps clarify the issues.
`
</script>

<template>
  <LockedNotice v-if="!unlocked" what="The analyse view" />
  <div v-else class="analyze">
    <div class="layout">
      <main class="article-pane">
        <div class="toolbar">
          <button @click="openEditor">{{ store.source.trim() ? 'Edit source' : 'Paste markdown' }}</button>
          <button @click="loadSample">Load sample</button>
          <div class="spacer" />
          <button v-if="selection && selection.start >= 0" class="primary" @click="flagSelection">
            Flag selection
          </button>
          <button @click="exportCompanion">Export companion</button>
        </div>

        <div v-if="!store.source.trim()" class="placeholder">
          <p>
            A scratchpad for the Rung 1 detector. Paste a markdown article and the mechanical
            patterns light up against the rendered prose, one underline per match. The full agent
            loop - flags walked one at a time, suggestions, resolution history - lives at the
            document URLs and is wired up as the API stabilises.
          </p>
          <button class="primary" @click="loadSample">Load a sample slop article</button>
        </div>

        <ArticleView
          v-else
          :source="store.source"
          :flags="store.visibleFlags"
          :selected-flag-id="store.selectedFlagId"
          @flag-click="store.selectFlag($event)"
          @selection-change="handleSelection"
        />
      </main>

      <FlagsPanel
        :flags="store.visibleFlags"
        :selected-flag-id="store.selectedFlagId"
        :active-categories="store.filter.categories"
        @select="store.selectFlag($event)"
        @toggle-category="store.toggleCategoryFilter($event)"
        @remove-user-flag="store.removeUserFlag($event)"
      />
    </div>

    <div v-if="showEditor" class="editor-modal" @click.self="showEditor = false">
      <div class="editor">
        <header>
          <h3>Source markdown</h3>
          <button class="close" @click="showEditor = false">close</button>
        </header>
        <textarea v-model="editBuffer" spellcheck="false" />
        <footer>
          <span class="muted">Pasted text never leaves your browser. Stored in localStorage on this device.</span>
          <button @click="showEditor = false">Cancel</button>
          <button class="primary" @click="saveEditor">Analyse</button>
        </footer>
      </div>
    </div>

    <UserHighlightDialog
      :open="dialogOpen"
      :selection-text="selection?.text ?? ''"
      :resolvable="!!selection && selection.start >= 0"
      @submit="handleSubmit"
      @cancel="dialogOpen = false"
    />
  </div>
</template>

<style scoped>
.analyze { height: 100%; }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  height: calc(100vh - var(--header-height));
}
.article-pane {
  overflow-y: auto;
  padding: 2rem 2.5rem 5rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: -0.5rem auto 1.5rem;
  max-width: 68ch;
  font-size: 0.9rem;
}
.toolbar button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  font: inherit;
  cursor: pointer;
}
.toolbar button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.toolbar .spacer { flex: 1; }
.muted { color: var(--muted); }

.placeholder {
  max-width: 68ch;
  margin: 4rem auto;
  text-align: center;
  color: var(--muted);
}
.placeholder button { margin-top: 1rem; }

.editor-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: grid;
  place-items: stretch center;
  padding: 4rem 2rem;
  z-index: 40;
}
.editor {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 8px;
  width: min(900px, 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.editor header { display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--rule); }
.editor h3 { margin: 0; font-family: var(--font-display); }
.editor .close { margin-left: auto; background: transparent; border: 0; color: var(--muted); cursor: pointer; font: inherit; }
.editor textarea {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.92rem;
  line-height: 1.5;
  border: 0;
  padding: 1rem;
  background: var(--code-bg);
  color: var(--text);
  resize: none;
}
.editor textarea:focus { outline: 0; }
.editor footer {
  display: flex; gap: 0.5rem; align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--rule);
}
.editor footer .muted { flex: 1; font-size: 0.86em; }
.editor footer button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.45rem 0.95rem;
  font: inherit;
  cursor: pointer;
}
.editor footer button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }

@media (max-width: 920px) {
  .layout { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
}
</style>
