<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  /** The captured selection from ArticleView. `start === -1` means the text
   *  appears multiple times in the source and can't be unambiguously placed -
   *  the user needs to widen the selection. */
  selection: { start: number; end: number; text: string } | null
  /** Viewport-coords rect of the selection. Used to anchor the composer near
   *  the highlighted span so the user reads "this complaint refers to *this*
   *  passage". Falls back to a centered overlay if absent. */
  anchorRect: DOMRect | null
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { note: string }): void
  (e: 'cancel'): void
}>()

const note = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const ambiguous = computed(() => !!props.selection && props.selection.start === -1)
const submittable = computed(
  () => !!props.selection && !ambiguous.value && note.value.trim().length > 0,
)

watch(
  () => props.open,
  (v) => {
    if (v) {
      note.value = ''
      // Focus the textarea on the next tick so the user can start typing
      // immediately. The selection caret is gone by the time the composer
      // mounts, so we don't fight the browser for input focus.
      nextTick(() => textareaRef.value?.focus())
    }
  },
)

// Pin the composer near the selection. The anchor rect is in viewport
// coordinates from getBoundingClientRect; we anchor the composer's left edge
// just to the right of the selection's right edge when there's room, and
// clamp to the viewport otherwise.
const COMPOSER_WIDTH = 360
const COMPOSER_GAP = 12
const positionStyle = computed<Record<string, string>>(() => {
  const rect = props.anchorRect
  if (!rect) {
    return { left: '50vw', top: '40vh', transform: 'translate(-50%, -50%)' }
  }
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  // Default placement: right of the selection, vertically aligned.
  let left = rect.right + COMPOSER_GAP
  let top = rect.top - 4
  if (left + COMPOSER_WIDTH > vw - 12) {
    // No room to the right - fall back to just below the selection, clamped
    // into the viewport horizontally.
    left = Math.max(12, Math.min(vw - COMPOSER_WIDTH - 12, rect.left))
    top = rect.bottom + COMPOSER_GAP
  }
  // Vertical clamp so the composer is never cut off at the top or bottom.
  top = Math.max(12, Math.min(vh - 220, top))
  return { left: `${left}px`, top: `${top}px`, transform: 'none' }
})

function submit(): void {
  if (!submittable.value) return
  emit('submit', { note: note.value.trim() })
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
    return
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && selection" class="brush-composer-layer" @click.self="emit('cancel')">
      <div
        class="brush-composer"
        :style="positionStyle"
        @click.stop
        @keydown="onKeydown"
      >
        <header>
          <span class="title">flag this passage</span>
          <button type="button" class="close" @click="emit('cancel')" aria-label="cancel">×</button>
        </header>

        <p class="excerpt" :class="{ ambiguous }">
          "{{ selection.text.slice(0, 220) }}{{ selection.text.length > 220 ? '…' : '' }}"
        </p>

        <p v-if="ambiguous" class="hint warn">
          That selection appears more than once in the article. Widen it so we can pin the flag to the right passage.
        </p>

        <textarea
          ref="textareaRef"
          v-model="note"
          rows="3"
          placeholder="what doesn't work? a sentence or two is plenty."
          :disabled="ambiguous"
        />

        <footer>
          <span class="kbd-hint muted">⌘↵ to submit</span>
          <button type="button" class="quiet" @click="emit('cancel')">cancel</button>
          <button type="button" class="primary" :disabled="!submittable" @click="submit">flag it</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.brush-composer-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: auto;
  background: transparent;
}
.brush-composer {
  position: fixed;
  width: 360px;
  max-width: calc(100vw - 24px);
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 0.85rem 0.95rem 0.7rem;
  box-shadow: 0 14px 48px rgba(0, 0, 0, 0.28);
  font-family: var(--font-ui);
}
.brush-composer header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}
.title {
  font-size: 0.78em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.close {
  margin-left: auto;
  background: transparent;
  border: 0;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 1.4em;
  line-height: 1;
  padding: 0 0.3rem;
}
.close:hover { color: var(--text); }
.excerpt {
  font-style: italic;
  color: var(--text);
  border-left: 3px solid var(--rule);
  padding: 0.3rem 0.7rem;
  margin: 0.1rem 0 0.6rem;
  font-size: 0.92em;
}
.excerpt.ambiguous { color: var(--muted); }
.hint {
  font-size: 0.85em;
  padding: 0.5rem 0.6rem;
  border-radius: 4px;
  margin: 0 0 0.6rem;
}
.hint.warn {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--rule));
}
textarea {
  width: 100%;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  padding: 0.5rem 0.6rem;
  resize: vertical;
  min-height: 4.5rem;
}
textarea:disabled { opacity: 0.5; cursor: not-allowed; }
footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.55rem;
}
.kbd-hint { font-size: 0.78em; }
.muted { color: var(--muted); }
.spacer { flex: 1; }
footer .quiet { margin-left: auto; }
button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.35rem 0.85rem;
  font: inherit;
  cursor: pointer;
}
button.quiet { color: var(--muted); }
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}
button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
