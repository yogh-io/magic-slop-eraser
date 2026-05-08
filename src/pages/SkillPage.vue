<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import skillSrc from '../../.claude/skills/eraser/SKILL.md?raw'
import { useOgHead } from '../composables/useOgHead'
import { ORIGIN } from '../composables/useOgHead'

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })
const html = computed(() => md.render(skillSrc))

const skillUrl = `${ORIGIN}/slopmop.md`
const installPrompt = `Install the eraser skill from ${skillUrl} - fetch it, save it to .claude/skills/eraser/SKILL.md in this repo (or ~/.claude/skills/eraser/SKILL.md to install globally), and confirm it's available.`

const copied = ref<'url' | 'prompt' | 'content' | null>(null)
function copy(kind: 'url' | 'prompt' | 'content', text: string): void {
  if (typeof navigator === 'undefined') return
  navigator.clipboard?.writeText(text).then(() => {
    copied.value = kind
    setTimeout(() => {
      if (copied.value === kind) copied.value = null
    }, 2000)
  })
}

useOgHead(() => ({
  title: 'The eraser skill',
  description:
    'Walk a markdown document through the deslop loop, one flag at a time. Install in Claude Code (or any agentic coding tool) and point it at a Magic Slop Eraser document URL.',
  path: '/skill',
  ogType: 'article',
}))
</script>

<template>
  <article class="skill">
    <header class="hd">
      <p class="kicker">skill · agent</p>
      <h1>The eraser skill</h1>
      <p class="lede">
        A workshop-shaped loop for fixing AI-slop in prose. The author defines shape,
        the agent drafts, the author re-directs until the sentence lands. Install it
        in Claude Code (or any agent that reads SKILL.md descriptors) and point it at
        a document URL.
      </p>
    </header>

    <section class="install">
      <h2>Install</h2>

      <div class="path">
        <h3>1. Tell your agent to fetch and install it</h3>
        <p>Paste this into a Claude Code session - the agent will fetch the skill and save it locally:</p>
        <div class="snippet">
          <pre>{{ installPrompt }}</pre>
          <button type="button" class="copy" @click="copy('prompt', installPrompt)">
            {{ copied === 'prompt' ? 'copied' : 'copy' }}
          </button>
        </div>
      </div>

      <div class="path">
        <h3>2. Or curl it directly</h3>
        <p>For agents that don't fetch URLs themselves, or scripted installs:</p>
        <div class="snippet">
          <pre>curl -o ~/.claude/skills/eraser/SKILL.md --create-dirs {{ skillUrl }}</pre>
          <button type="button" class="copy" @click="copy('url', `curl -o ~/.claude/skills/eraser/SKILL.md --create-dirs ${skillUrl}`)">
            {{ copied === 'url' ? 'copied' : 'copy' }}
          </button>
        </div>
      </div>

      <div class="path">
        <h3>3. Or copy the source below</h3>
        <p>
          Save it as <code>SKILL.md</code> inside your agent's skills directory
          (Claude Code: <code>.claude/skills/eraser/SKILL.md</code> per project, or
          <code>~/.claude/skills/eraser/SKILL.md</code> globally).
        </p>
        <button type="button" class="copy big" @click="copy('content', skillSrc)">
          {{ copied === 'content' ? 'copied' : 'copy SKILL.md to clipboard' }}
        </button>
      </div>
    </section>

    <section class="source">
      <h2>SKILL.md</h2>
      <article class="markdown" v-html="html" />
    </section>
  </article>
</template>

<style scoped>
.skill {
  max-width: 78ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}

.hd { margin-bottom: 2.5rem; }
.kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0 0 0.4rem;
}
h1 {
  font-family: var(--font-display);
  font-size: 2.4rem;
  margin: 0 0 0.6rem;
  letter-spacing: var(--heading-tracking, normal);
}
.lede {
  font-size: 1.05rem;
  color: var(--text);
  margin: 0;
}

.install h2,
.source h2 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  margin: 2.2rem 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.install .path {
  border-left: 3px solid var(--rule);
  padding: 0.4rem 0 0.6rem 1rem;
  margin-bottom: 1.6rem;
}
.install h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  margin: 0 0 0.3rem;
  color: var(--text);
}
.install p { margin: 0.2rem 0 0.6rem; }

.snippet {
  position: relative;
  background: var(--code-bg);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 0.8rem 1rem;
  margin: 0.4rem 0;
}
.snippet pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  padding-right: 5rem;
}
.copy {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-family: var(--font-ui);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.copy:hover { background: var(--text); color: var(--bg); }
.copy.big {
  position: static;
  margin-top: 0.4rem;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
}

.source {
  margin-top: 2.5rem;
  border-top: 1px solid var(--rule);
  padding-top: 1.5rem;
}
.markdown :deep(h1) { font-size: 1.6rem; margin: 1.6rem 0 0.6rem; font-family: var(--font-display); }
.markdown :deep(h2) {
  font-size: 1.05rem;
  margin: 1.6rem 0 0.5rem;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.markdown :deep(h3) { font-size: 1rem; margin: 1.2rem 0 0.4rem; font-family: var(--font-display); }
.markdown :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.86em;
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
}
.markdown :deep(pre) {
  background: var(--code-bg);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 0.8rem 1rem;
  overflow-x: auto;
}
.markdown :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85rem;
}
.markdown :deep(table) {
  border-collapse: collapse;
  margin: 1rem 0;
}
.markdown :deep(table th),
.markdown :deep(table td) {
  border: 1px solid var(--rule);
  padding: 0.4rem 0.7rem;
  text-align: left;
  font-size: 0.92rem;
}
.markdown :deep(table th) {
  background: var(--code-bg);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
  color: var(--muted);
}
.markdown :deep(a) {
  color: var(--text);
  border-bottom: 1px dotted var(--rule);
  text-decoration: none;
}
.markdown :deep(a:hover) { border-bottom-color: var(--text); }

code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
}
</style>
