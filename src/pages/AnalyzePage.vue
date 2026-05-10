<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOgHead } from '../composables/useOgHead'
import { addRecent } from '../state/recents'

useOgHead(() => ({
  title: 'slopmop',
  description:
    'Paste prose, get a session URL. Hand it to your agent (Claude Code, Codex, opencode) - they steer it through the deslop loop, you direct fixes from the browser.',
  path: '/',
  ogType: 'website',
}))

const router = useRouter()

const title = ref('')
const source = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

const canSubmit = computed(() => source.value.trim().length > 20 && !submitting.value)

const SAMPLE = `# The shape of the deal

It's important to note that the regulatory landscape continues to evolve in profound and remarkable ways. We must navigate this complex tapestry of considerations carefully, as we delve into the nuanced and multifaceted dynamics that shape modern policy.

The framework isn't just a set of rules - it's a paradigm shift. Studies have shown that experts agree these changes will have profound implications for how we think about governance.

It started small. It grew. It became unstoppable.

The challenge raises important questions about the future of the alliance. Generally, this is somewhat typical, and arguably the response will perhaps be relatively measured.

In conclusion, the situation reflects broader dynamics at play. I hope this helps clarify the issues.
`

function loadSample(): void {
  source.value = SAMPLE
  if (!title.value) title.value = 'Sample slop article'
}

function deriveTitle(s: string): string {
  const m = /^#\s+(.+)$/m.exec(s)
  if (m) return m[1].trim().slice(0, 120)
  const firstLine = s.split('\n').find((l) => l.trim().length > 0)
  if (firstLine) return firstLine.trim().slice(0, 80)
  return 'Untitled'
}

async function createSession(): Promise<void> {
  if (!canSubmit.value) return
  submitting.value = true
  errorMsg.value = null
  try {
    const body = {
      source: source.value,
      title: title.value.trim() || deriveTitle(source.value),
    }
    const r = await fetch('/docs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      throw new Error(`${r.status}: ${await r.text()}`)
    }
    const created = (await r.json()) as { id: string }
    addRecent(created.id, body.title)
    await router.push({ path: `/d/${created.id}` })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <article class="create">
    <header class="hd">
      <p class="kicker">start a session</p>
      <h1>Paste an article. Get a steering URL.</h1>
      <p class="lede">
        Drop prose in below. We mint a private session and hand back a URL. Open it
        yourself, or hand it to an agent (Claude Code primarily) - it walks the catalogue
        against your prose, posts flags, drafts candidates from your directives. You
        sweep, redirect, accept. The document is the source of truth.
      </p>
    </header>

    <aside class="skill-notice">
      <div class="skill-notice-text">
        <strong>First time?</strong> Your agent needs the slopmop skill installed
        before it can drive a session. Have your Claude Code fetch it - one prompt
        does it.
      </div>
      <RouterLink to="/skill" class="skill-cta">
        One prompt gets you started <span aria-hidden="true">&rarr;</span>
      </RouterLink>
    </aside>

    <form class="form" @submit.prevent="createSession">
      <label class="field">
        <span class="lbl">Title</span>
        <input
          v-model="title"
          type="text"
          placeholder="optional - we'll derive one from the first heading"
          :disabled="submitting"
        />
      </label>

      <label class="field">
        <span class="lbl">Source markdown</span>
        <textarea
          v-model="source"
          spellcheck="false"
          rows="18"
          :placeholder="'# Title\n\nPaste the article you want to deslop.'"
          :disabled="submitting"
        />
      </label>

      <div v-if="errorMsg" class="err">error: {{ errorMsg }}</div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!canSubmit">
          {{ submitting ? 'creating session…' : 'Create session' }}
        </button>
        <button type="button" class="quiet" @click="loadSample" :disabled="submitting">
          load a sample
        </button>
      </div>
    </form>

    <aside class="rationale">
      <h2>How sessions work</h2>
      <p>
        Each session is its own URL. Anyone with the URL can drive the session -
        that's intentional, it's how an agent latches on.
      </p>
      <p>
        Sessions are independent: you can run as many as you want, each with its own
        document, its own queue, its own agent. Nothing leaks between them.
      </p>
      <p>
        Sessions disappear after <strong>72 hours of inactivity</strong> - any
        flag, directive, or accept resets the clock. Don't bookmark a URL and
        come back next week expecting the doc to still be there. Save what you
        want to keep.
      </p>
    </aside>
  </article>
</template>

<style scoped>
.create {
  max-width: 78ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}

.hd { margin-bottom: 2rem; }
.kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0 0 0.4rem;
}
.hd h1 {
  font-family: var(--font-display);
  font-size: 2.4rem;
  margin: 0 0 0.7rem;
  letter-spacing: var(--heading-tracking, normal);
  line-height: 1.15;
}
.lede {
  font-size: 1.05rem;
  color: var(--text);
  margin: 0;
}

.skill-notice {
  margin: 1.6rem 0 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border-radius: 4px;
  font-size: 0.92rem;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.skill-notice-text { flex: 1 1 22ch; min-width: 0; }
.skill-notice strong {
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}
.skill-cta {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.5rem 0.9rem;
  font-family: var(--font-ui);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--bg);
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 4px;
  text-decoration: none;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease;
}
.skill-cta:hover {
  background: color-mix(in srgb, var(--accent) 80%, var(--text));
  border-color: color-mix(in srgb, var(--accent) 80%, var(--text));
}

.form {
  display: grid;
  gap: 1.2rem;
  margin: 2rem 0 2.5rem;
}
.field {
  display: grid;
  gap: 0.4rem;
}
.lbl {
  font-family: var(--font-display);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.field input,
.field textarea {
  font-family: var(--font-ui);
  font-size: 0.96rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--rule);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  width: 100%;
  resize: vertical;
}
.field textarea {
  font-family: var(--font-mono);
  font-size: 0.92rem;
  line-height: 1.5;
  min-height: 22rem;
  background: var(--code-bg);
}
.field input:focus,
.field textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--text) 30%, transparent);
  outline-offset: -1px;
}

.err {
  color: #b8472d;
  font-size: 0.9rem;
  font-family: var(--font-mono);
}

.actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}
.actions button {
  font-family: var(--font-ui);
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
}
.actions button:disabled { opacity: 0.4; cursor: not-allowed; }
.actions button:not(:disabled):hover { border-color: var(--text); }
.actions button.primary {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
  font-weight: 600;
}
.actions button.primary:not(:disabled):hover {
  background: color-mix(in srgb, var(--text) 80%, var(--bg));
}
.actions button.quiet { color: var(--muted); }
.actions .spacer { flex: 1; }
.actions .alt {
  font-size: 0.85rem;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 1px dotted var(--rule);
}
.actions .alt:hover {
  color: var(--text);
  border-bottom-color: var(--text);
}

.rationale {
  border-top: 1px solid var(--rule);
  padding-top: 1.5rem;
  font-size: 0.93rem;
  color: var(--text);
}
.rationale h2 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin: 0 0 0.6rem;
}
.rationale p { margin: 0 0 0.7rem; }
.rationale code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
  font-size: 0.88em;
}
</style>
