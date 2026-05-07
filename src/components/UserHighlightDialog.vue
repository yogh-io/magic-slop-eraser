<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { categories } from '../catalog/categories'
import { patterns } from '../catalog/patterns'
import type { CategoryId } from '../types'

const props = defineProps<{
  open: boolean
  selectionText: string
  resolvable: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { patternId: string; category: CategoryId; note: string }): void
  (e: 'cancel'): void
}>()

const category = ref<CategoryId>('structural')
const patternId = ref<string>('')
const note = ref<string>('')

const patternsForCategory = computed(() =>
  patterns.filter((p) => p.category === category.value),
)

watch(
  () => props.open,
  (v) => {
    if (v) {
      category.value = 'structural'
      patternId.value = patternsForCategory.value[0]?.id ?? ''
      note.value = ''
    }
  },
)

watch(category, () => {
  patternId.value = patternsForCategory.value[0]?.id ?? ''
})

function submit(): void {
  if (!patternId.value) return
  emit('submit', { patternId: patternId.value, category: category.value, note: note.value.trim() })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('cancel')">
    <div class="dialog">
      <header>
        <h3>Flag this passage as slop</h3>
        <button class="close" @click="emit('cancel')">close</button>
      </header>
      <div v-if="!resolvable" class="warn">
        The selected text appears more than once or could not be located in the source. Try a longer, more unique selection.
      </div>
      <p class="excerpt">"{{ selectionText.slice(0, 220) }}{{ selectionText.length > 220 ? '…' : '' }}"</p>

      <label>
        Category
        <select v-model="category">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <label>
        Pattern
        <select v-model="patternId">
          <option v-for="p in patternsForCategory" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>

      <label>
        Why is this slop?
        <textarea v-model="note" rows="4" placeholder="Explain in one or two sentences. The note is saved locally and exported with the companion document." />
      </label>

      <footer>
        <button @click="emit('cancel')">Cancel</button>
        <button class="primary" :disabled="!resolvable || !patternId" @click="submit">Save flag</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: grid;
  place-items: center;
  z-index: 50;
}
.dialog {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 1.5rem;
  width: min(540px, 92vw);
  font-family: var(--font-ui);
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.dialog header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.6rem; }
.dialog h3 { margin: 0; font-family: var(--font-display); }
.close { margin-left: auto; background: transparent; border: 0; color: var(--muted); cursor: pointer; font: inherit; }
.warn {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--rule));
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  font-size: 0.86em;
  margin-bottom: 0.6rem;
}
.excerpt {
  font-style: italic;
  color: var(--muted);
  border-left: 3px solid var(--rule);
  padding: 0.3rem 0.8rem;
  margin: 0.25rem 0 1rem;
}
label { display: block; margin-bottom: 0.8rem; font-size: 0.88em; color: var(--muted); }
select, textarea, input {
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}
textarea { resize: vertical; }
footer { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }
button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.45rem 0.95rem;
  font: inherit;
  cursor: pointer;
}
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
