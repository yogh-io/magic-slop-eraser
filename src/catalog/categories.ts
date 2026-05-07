import type { CategoryMeta } from '../types'

export const categories: CategoryMeta[] = [
  {
    id: 'lexical',
    name: 'Lexical tics',
    tagline: 'The vocabulary the model reaches for and you would not.',
    blurb:
      'Specific words and phrases that LLMs love and human writers rarely touch. Easy to catch mechanically; the fix is usually substitution or a clean cut. The hall-of-fame words (delve, tapestry, navigate, realm, embark) are the most reliable single-token tells in the entire catalogue.',
    essay: `Some words are dead. They got used up. The lexical tics are the words and phrases that survive in LLM output not because they describe anything but because they were reliably present in the prose the model trained on - corporate decks, HR town-hall slide-text, NGO mission statements, the middle paragraphs of Atlantic essays. None of those genres prize being read. They prize sounding like they were written by a person who would be safe to give an award to.

The fix is the easiest in the catalogue: notice them, pick the concrete thing they were standing in for, replace. The reason most writers do not is that one or two of these words always feel innocent in isolation. They are. The accumulation is not. Once you have seen "delve into the rich tapestry" three times in a week, you can no longer un-see it.`,
    toneColor: '#d97757',
  },
  {
    id: 'structural',
    name: 'Structural tics',
    tagline: 'Sentence and paragraph shapes the model defaults to.',
    blurb:
      'These are not surface tics - they are the very form of the prose itself. The mirror construct. The absent-actor closer. The staccato run. Templates are reached for. Default shapes emerge. The patterns the writer is least equipped to see in their own work.',
    essay: `Structural tics are sentence and paragraph shapes the model reaches for when nobody is steering. They are the most damning category because no individual word is the giveaway - the giveaway is the form itself. The mirror construct, the absent-actor closer, the staccato run, the frame-stacked per-actor section that reads like a wire-service briefing trying not to take a side.

These are the patterns the writer is least equipped to see in their own work, because the templates feel from the inside like the writer's voice. They are not. They are the residue of training data, lightly laundered. The bad news is that this category requires judgment, not regex. The good news is that once you have seen one of them, you cannot unsee them, and your future drafts will be quieter for it.`,
    toneColor: '#7a55b8',
  },
  {
    id: 'argumentative',
    name: 'Argumentative tics',
    tagline: 'Reflexive moves that simulate argument without committing to one.',
    blurb:
      'Studies have shown that some experts believe these patterns may, in certain contexts, raise important questions worth exploring. The implications, in the final analysis, are profound. Whether or not this is the hardest category to catch mechanically remains, perhaps, an open question that merits further conversation.',
    essay: `The argumentative tics are how prose pretends to argue without arguing. Hedged confidence, the cushion-after-every-spice, the synthesis-of-nothing closer, "studies have shown" with no studies attached, "experts agree" with the experts kept off-page where they cannot be checked.

The model produces these because every move that takes a position is a risk, and the gradient that produced the model rewarded risk-aversion above almost everything else. The training corpus is full of NPR-host hedges, op-ed preambles that take eight paragraphs to say what could have been said in one, and the careful registers of writers whose paycheque depended on never being wrong in a way that anyone could pin on them. Reading enough of it gives you the strange feeling of having been told something while having received nothing. This is the hardest category to fix because the gestures of analysis - "this raises important questions," "the implications are profound," "we need to have a conversation" - look like analysis from a distance. From close up they are usually empty calories. The cure is the same as the cure for empty calories. Less of them, and a habit of noticing.`,
    toneColor: '#3a86c4',
  },
  {
    id: 'tonal',
    name: 'Tonal tics',
    tagline: 'Reflexive moves of register, not of wording.',
    blurb:
      'There are valid points on both sides here, and reasonable writers may disagree. We do not pretend to have all the answers - far from it. But if this category helps even one reader notice the voice the model defaults to, it will all have been worth it.',
    essay: `Tonal slop is what voice sounds like when no one in particular has chosen the voice. Performative balance, performative humility, the approval-seeking close - the register of the HR memo, the brand-bio, the corporate statement issued the morning after the incident.

The category overlaps the others because tone is rarely separable from word choice or structure - but it is its own thing when the issue is register rather than device. The model defaults to a voice that gives offence to no one and commitment from no one, in roughly equal measure: a voice optimised for surviving a compliance review, not for being read. The writer who picks up this register has, often without noticing, picked up the model's professional invisibility along with it. The voice that came back from the prompt was no one's. That is the problem.`,
    toneColor: '#2f8f6a',
  },
  {
    id: 'format',
    name: 'Format tics',
    tagline: 'Visual habits the model defaults to.',
    blurb:
      'FORMAT TICS - KEY TAKEAWAYS: bullets where prose would serve; header inflation; section-stacking. BOTTOM LINE: easiest category to fix. ACTION ITEMS: notice; cut; tighten. A strong AI tell when it stacks.',
    essay: `Format is the most superficial category and the easiest to fix. It is also the most visible. A page heavy with bullets, headers, bolding, and tables that are not really tables produces, before the reader has read a word, the impression that the writer was trying to look organised more than they were trying to think. The shape on the page is the shape of a consulting deliverable, an all-hands deck, a strategy two-pager - documents whose job is to survive being skimmed by someone who was never going to read them.

Sometimes that impression is wrong. Often it is not. The model defaults to format-as-substitute because format is cheap, scannable, and pattern-matches to "professional document." Real essays accumulate. Slop essays sectionalise. The difference, on the page, is enormous - and it is the first thing a hostile reader notices about a piece of LLM prose, before they have even started reading the words.`,
    toneColor: '#b88f3e',
  },
]

export function getCategory(id: string): CategoryMeta | undefined {
  return categories.find((c) => c.id === id)
}
