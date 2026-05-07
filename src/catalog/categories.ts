import type { CategoryMeta } from '../types'

/**
 * The slop catalogue's category list. Single source of truth: adding or
 * removing a category here propagates through the catalogue UI, the flag
 * highlighting, and the CSS variables (the per-theme `--cat-<id>` tokens
 * are written to :root by state/theme.ts on theme change).
 *
 * No CSS file or component should hard-code per-category data; reach into
 * this list instead.
 */
export const categories: CategoryMeta[] = [
  {
    id: 'lexical',
    name: 'Lexical tics',
    tagline: 'The vocabulary the model reaches for and you would not.',
    blurb:
      'Specific words and phrases that LLMs love and human writers rarely touch. Easy to catch mechanically; the fix is usually substitution or a clean cut. The hall-of-fame words (delve, tapestry, navigate, realm, embark) are the most reliable single-token tells in the entire catalogue.',
    essay: `Some words are dead. They got used up. The lexical tics are the words and phrases that survive in LLM output not because they describe anything but because they were reliably present in the prose the model trained on - corporate decks, HR town-hall slide-text, NGO mission statements, the middle paragraphs of Atlantic essays. None of those genres prize being read. They prize sounding like they were written by a person who would be safe to give an award to.

The fix is the easiest in the catalogue: notice them, pick the concrete thing they were standing in for, replace. The reason most writers do not is that one or two of these words always feel innocent in isolation. They are. The accumulation is not. Once you have seen "delve into the rich tapestry" three times in a week, you can no longer un-see it.`,
    glyph: '◆',
    themeColors: {
      normal: '#d97757',
      magic: '#ff7eb6',
      scholar: '#8a1a1a',
    },
  },
  {
    id: 'structural',
    name: 'Structural tics',
    tagline: 'Sentence and paragraph shapes the model defaults to.',
    blurb:
      'These are not surface tics - they are the very form of the prose itself. The mirror construct. The absent-actor closer. Templates are reached for. Default shapes emerge. The patterns the writer is least equipped to see in their own work.',
    essay: `Structural tics are sentence and paragraph shapes the model reaches for when nobody is steering. They are the most damning category because no individual word is the giveaway - the giveaway is the form itself. The mirror construct, the absent-actor closer, the frame-stacked per-actor section that reads like a wire-service briefing trying not to take a side.

These are the patterns the writer is least equipped to see in their own work, because the templates feel from the inside like the writer's voice. They are not. They are the residue of training data, lightly laundered. The bad news is that this category requires judgment, not regex. The good news is that once you have seen one of them, you cannot unsee them, and your future drafts will be quieter for it.`,
    glyph: '▦',
    themeColors: {
      normal: '#7a55b8',
      magic: '#b878d4',
      scholar: '#2e2a72',
    },
  },
  {
    id: 'argumentative',
    name: 'Argumentative tics',
    tagline: 'Reflexive moves that simulate argument without committing to one.',
    blurb:
      'Reads like a take. Is not one. Hedged confidence, performative balance, the synthesis-of-nothing closer, the line that arrives with the cadence of a verdict and the substance of a shrug.',
    essay: `The argumentative tics are how prose pretends to argue without arguing. Hedged confidence, both-sides-as-cushion, the synthesis-of-nothing closer, the lens that fits everything. The cadence of a verdict; the substance of a shrug.

The model produces these because every move that takes a position is a risk, and the gradient that produced the model rewarded risk-aversion above almost everything else. The training corpus is full of NPR-host hedges, op-ed preambles that take eight paragraphs to say what could have been said in one, and the careful registers of writers whose paycheque depended on never being wrong in a way that anyone could pin on them. Reading enough of it gives you the strange feeling of having been told something while having received nothing. The cure is the same as the cure for empty calories: less of them, and a habit of noticing.`,
    glyph: '▲',
    themeColors: {
      normal: '#3a86c4',
      magic: '#6cc7e8',
      scholar: '#1f5d52',
    },
  },
]

export function getCategory(id: string): CategoryMeta | undefined {
  return categories.find((c) => c.id === id)
}
