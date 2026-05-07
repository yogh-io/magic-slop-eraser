import type { PatternMeta } from '../types'

export const patterns: PatternMeta[] = [
  // ---- LEXICAL ----
  {
    id: 'tier1-lexicon',
    category: 'lexical',
    name: 'Tier 1 lexicon',
    shortName: 'Tier 1',
    severity: 'high',
    scope: 'word',
    mechanical: true,
    rung: 1,
    blurb:
      'The canonical AI vocabulary. Almost no human writer reaches for these; LLMs love them.',
    essay: `These dead words delve into the rich tapestry of LLM output, embarking on the same journey every time, because they were rewarded for sounding literary without committing to a specific image. "Delve" used to mean a careful working-through; now it appears almost exclusively in sentences whose function is to perform thoughtfulness. "Tapestry" lost its threads sometime around 2018. "Navigate" was eaten by management consultants and never came back. "Leverage" tried to escape and got captured by finance, where it still has a valid technical use; everywhere else it is filler.

The model reaches for them not because they describe anything but because they were reliably present in the prose it was trained on. If one is in your draft, the sentence wasn't written by you - something else wrote it on your behalf while you were thinking about something else. That's not an accusation, it happens to anyone with enough exposure to corporate writing. The fix is to find the concrete thing the dead word was standing in for, and put that there instead.`,
    whyItsSlop:
      'These words are tells in the strongest sense. A single instance is suspect; two in a piece reads as machine output. They survive in model writing because they are rewarded by the loss function - they sound vaguely literary without committing to a specific image.',
    fix: 'Substitute a concrete verb or noun, or cut. "Delve into the data" becomes "read the data" or "look at the numbers." "The regulatory landscape" becomes "the regulations" or whatever specific thing the metaphor is standing in for.',
    examples: [
      {
        sloppy: 'Let us delve deeper into this fascinating realm of innovation.',
        better: 'Let us look at the actual systems being built.',
      },
      {
        sloppy: 'We must navigate the complexities of the modern landscape.',
        better: 'We have to handle the policy carefully.',
      },
      {
        sloppy: 'Our approach harnesses AI to foster sustainable growth.',
        better: 'We use AI to forecast demand and adjust orders.',
      },
      {
        sloppy: 'A robust framework that leverages a multifaceted ecosystem.',
        better: 'A framework that handles three known failure modes.',
      },
    ],
    skipRule:
      '"Delve" is fine in a sentence about excavation. "Landscape" is fine when it means actual landscape. The flag is metaphorical use in abstract domains.',
  },
  {
    id: 'throat-clearing',
    category: 'lexical',
    name: 'Throat-clearing openers',
    severity: 'high',
    scope: 'phrase',
    mechanical: true,
    rung: 1,
    blurb:
      'Sentence-opening phrases that announce "I am about to say something" instead of just saying it.',
    essay: `It is important to note that, crucially, this is the writer asking themselves for permission before saying the thing. Permission is then granted, weakly, and the thing follows in the diminished form that survives the asking.

A real writer does not say "importantly." The word "importantly" is the writer admitting they could not make the substance feel important on its own merits. One throat-clearer in a piece is fine - everyone clears their throat once, especially before the first sentence. Three is the same person blinking before three different sentences they were not sure about. The reader hears the blinking.`,
    whyItsSlop:
      'Real writers begin sentences with the substance. The throat-clearer is empty calories - it primes the reader for an insight that the substance itself usually fails to deliver. One in a piece is forgivable; three is the same model, every time.',
    fix: 'Delete the opener; keep the sentence. If the substance cannot stand without the throat-clearer, the substance is the problem.',
    examples: [
      {
        sloppy:
          "It's important to note that the policy was reversed within a month.",
        better: 'The policy was reversed within a month.',
      },
      {
        sloppy: 'Crucially, the funding never arrived.',
        better: 'The funding never arrived.',
      },
      {
        sloppy: 'Importantly, this represents a significant development.',
        better: 'It is the first time the agency has done this since 1998.',
      },
    ],
    skipRule:
      '"Of course" is legitimate in dialogue or as a deliberate concessive. One per piece is fine. The flag is the cluster.',
  },
  {
    id: 'closers',
    category: 'lexical',
    name: 'Closer phrases',
    severity: 'high',
    scope: 'phrase',
    mechanical: true,
    rung: 1,
    blurb: 'Phrases that announce the end and add nothing.',
    essay: `In conclusion, ultimately, all in all, this is the writer raising a hand to be excused before saying the line that was supposed to land on its own. "All in all" is the writer who did not earn the conclusion drafting a small ceremony in lieu of one.

A kicker is the moment a piece's argument lands and the line lands with it. The reader knows because the line is a kicker. If a sentence has to begin with "ultimately" to be the kicker, it is performing kicker-ness the way a kid in a school play performs old age. There are exceptions. They are rare. Yours probably is not one.`,
    whyItsSlop:
      'A real kicker lands by being a kicker. If a sentence needs "in conclusion" to signal that it is the closing line, it has not earned the position. The model uses these because it has been trained to summarise - the reader does not need a summary.',
    fix: 'Delete. The kicker should land on its own. If it cannot, write a kicker that does.',
    examples: [
      {
        sloppy:
          'In conclusion, the policy reflects the broader dynamics at play.',
        better: 'The policy is mostly drift dressed as decision.',
      },
      {
        sloppy: 'All in all, the deal was a missed opportunity.',
        better: 'The deal was a missed opportunity.',
      },
      {
        sloppy: 'Ultimately, the situation will continue to develop.',
        better: '',
      },
    ],
  },
  {
    id: 'suffocation',
    category: 'lexical',
    name: 'Suffocation',
    severity: 'primary',
    scope: 'sentence',
    mechanical: true,
    rung: 1,
    blurb:
      'Three or more hedges (generally, typically, often, somewhat, perhaps, possibly...) stacked into a single sentence until the claim cannot breathe.',
    essay: `Generally, this tends to be somewhat more common in cases that, perhaps, arguably resemble the writer averaging across every possible claim until the shape of a claim emerges with none of its weight. One hedge is honesty about the limits. Three hedges in one sentence is a writer producing the conviction of a weather forecast read by a dying man.

The model does this because the gradient that produced it punishes wrongness more than it punishes mush. Mush is safe. Mush plus more mush is even safer. By the third hedge the writer has reached the position from which no possible reader could disagree, because no possible reader could tell what they had said. The position is calm. It is also empty.`,
    whyItsSlop:
      'One hedge is fine. Three within thirty tokens means the model is averaging across possibilities and hedging each one rather than committing to a claim.',
    fix: 'Pick the one hedge that is actually load-bearing and cut the rest. If the claim genuinely needs three hedges, the claim is too vague to make - sharpen it or cut it.',
    examples: [
      {
        sloppy:
          'This generally tends to be somewhat more common in cases that are arguably similar.',
        better: 'It happens more often in similar cases.',
      },
      {
        sloppy:
          'Perhaps we might fairly say that the response is, broadly speaking, relatively measured.',
        better: 'The response is measured.',
      },
    ],
  },
  {
    id: 'enthusiasm-inflation',
    category: 'lexical',
    name: 'Enthusiasm inflation',
    severity: 'medium',
    scope: 'word',
    mechanical: true,
    rung: 1,
    blurb: 'When everything is fascinating, nothing is.',
    essay: `A fascinating pattern with profound implications - remarkable in scope, striking in frequency, compelling enough that the model has to rate its own observations to get them across to a reader who would otherwise not be impressed. The model has been trained that "fascinating" pairs with "development" and "remarkable" pairs with "shift," and so it pairs them, on autopilot, in the absence of any actual fascination on its part - it is, after all, a function.

The reader's enthusiasm budget runs out around the second "remarkable." After that, every adjective is the writer telling the reader what to feel, which is the writer admitting they have not produced the feeling on the page. Real writing trusts the reader to find what is striking. Sloppy writing labels it. The labels are louder than the thing being labelled.`,
    whyItsSlop:
      'The cluster of fascinating, remarkable, profound, striking, compelling, intriguing is the model rating its own observations. The reader is meant to do the rating; the writer names the fact.',
    fix: 'Cut the adjective, or replace it with the specific thing that is supposed to be remarkable. "A remarkable shift" becomes "the third reversal in six months."',
    examples: [
      {
        sloppy: 'A remarkable shift, with profound implications and striking parallels to the past.',
        better: 'The third reversal in six months. It mirrors the 1993 collapse almost step for step.',
      },
      {
        sloppy: 'This fascinating development raises compelling questions.',
        better: 'It is the first time the agency has missed a deadline this badly.',
      },
    ],
  },
  {
    id: 'vague-gravitas',
    category: 'lexical',
    name: 'Vague gravitas',
    severity: 'high',
    scope: 'phrase',
    mechanical: true,
    rung: 1,
    blurb: 'Phrases that simulate insight without delivering it.',
    essay: `This pattern raises important questions about how prose simulates insight without delivering any, with profound implications for the reader who keeps waiting for the implications to arrive. "Has profound implications" is what a sentence says about itself when it has nothing implied.

The trick of the form is that it gestures at meaning without committing any. The reader, scanning, registers "this is significant" without registering what is significant about it - and the writer, having gestured, can move on without producing the answer. The literary equivalent of a politician saying "we need to have a conversation" about a thing they will never speak of again.`,
    whyItsSlop:
      '"Raises important questions," "has profound implications," "speaks to deeper truths." Each phrase promises an insight the next clause never delivers. The model has been trained to gesture at depth; gesturing is cheaper than reaching.',
    fix: 'Name the question, the implication, the truth. If you cannot, the line is empty calories - cut.',
    examples: [
      {
        sloppy:
          'The decision raises important questions about the future of the alliance.',
        better: 'It is unclear whether Germany will keep paying for it.',
      },
      {
        sloppy: 'This trend speaks to deeper truths about institutional decay.',
        better: 'The agency has lost three of its four senior auditors since January.',
      },
      {
        sloppy: 'The pattern cannot fail to repeat because the coalition falls the day the project ends.',
        better: 'The CEO\'s job depends on the project continuing. He is not going to end it.',
      },
    ],
  },

  // ---- STRUCTURAL ----
  {
    id: 'absent-actor',
    category: 'structural',
    name: 'Absent-actor construct',
    shortName: 'Absent actor',
    severity: 'primary',
    scope: 'sentence',
    mechanical: false,
    rung: 2,
    blurb:
      'Load-bearing claims that turn on what no one is doing, has done, can do, or will say.',
    essay: `The kicker no agent catches, no editor quite flags, and no detector ever knows how to name - the move depends on a population the line itself has refused to enumerate. "The deal no mediator can broker." "The framework no administration has built." "The plan whose authors have never put their names to it."

It feels devastating because it sounds like the writer has gone past the available evidence to a conclusion so universal that no mere person could carry it. In fact the writer has named no mediators, listed no administrations, declined to specify any aims. The line is loadbearing on a population the line itself has refused to enumerate. Works as mood. Collapses if you ask, gently, "which mediators?" The reader who knows the trick reads the line the way a mechanic listens to a misfire.`,
    whyItsSlop:
      'The move works by universal negation over an unnamed population: "the deal no mediator can broker," "a strategy nobody will name," "the framework no administration has built." The author\'s exasperation at a conspicuous absence gets smuggled in as the claim itself - the reader cannot test "no mediator" against anything because the line names no mediators. Especially reflexive as a closing or kicker device.',
    fix: 'Reframe affirmatively. State what IS, not what is not. The hard question: what positive claim is this absence-line trying to make? Make that claim directly. Swapping "no one" for "no President" is the same shape with a label - that does not count as a fix.',
    subShapes: [
      'Impossibility-via-negation: "X that no Y can Z"',
      'Silent-room reveal: "the conclusion no administration will say out loud"',
      'Vacuum framing: "the architecture no one is developing"',
      'Cascading-absence list (reflexive): "No X, no Y, no Z" as mood music',
      'Never-variant: "a goal no administration has stated"',
    ],
    examples: [
      {
        sloppy: 'It is the deal no mediator can broker.',
        better: 'The deal has to close inside the company, not across a table.',
      },
      {
        sloppy: 'No investigation announced, no one relieved, no review board convened.',
        better: 'The agency has absorbed the losses and moved on.',
      },
      {
        sloppy: 'A campaign whose aims have never been written down.',
        better: 'The aims were set at the leadership offsite in February and have not been revised since.',
      },
      {
        sloppy: 'There is no central authority distinct from the network it claims to manage.',
        better: 'The board answers to its members; it has no override.',
      },
    ],
    skipRule:
      'Enumerated-against-template absences are legitimate ("The 2008 collapse produced the Dodd-Frank reforms. This crisis: no commission, no resignations, no new rules") - the rhetorical weight comes from the gap against a known expected sequence, and each clause is independently testable. Specific factual absences about named instruments ("no claw-back clause in the current contract") are also legitimate.',
  },
  {
    id: 'allusive-construct',
    category: 'structural',
    name: 'Allusive construct',
    severity: 'primary',
    scope: 'sentence',
    mechanical: false,
    rung: 2,
    blurb:
      'The shape is "[unspecific] [relates to] [unspecific]." Both ends abstract or back-referring; the verb does the work.',
    essay: `The line that means itself only by means of the line before it - reading it cold, it dissolves into the prose it was leaning on for warmth. "The cheque is written on the appearance of dominance the underlying reality no longer supports."

Read it twice and you cannot tell who wrote it. It does not mean nothing - but it means whatever the previous paragraph just meant, in slightly different drag. A reader still holding the prior paragraph in working memory feels the warmth and reads the sentence as deep. Pull it out and read it cold and it reads like a fortune cookie that lost its ticker. The cleverness is borrowed, then collected as if earned.`,
    whyItsSlop:
      'A reader inside the piece feels the gravity because their working memory carries the referents. A reader cold cannot parse it. The line announces "I am the kicker" by being indirect about its own claim.',
    fix: 'Restate directly. What is the simple, specific claim the sentence is alluding to? State it. "The cheque is written on the appearance of dominance the underlying reality no longer supports" becomes "Washington is paying more than the position is worth." Shorter and less satisfying to write; that is the point.',
    subShapes: [
      'Metaphor on the verb side: "The bill arrives at..."',
      'Back-reference on the object side: "...the position the spending itself is hollowing out"',
      'Both at once: the canonical form',
    ],
    examples: [
      {
        sloppy: 'The cheque is written on the appearance of dominance the underlying reality no longer supports.',
        better: 'Washington is paying more than the position is worth.',
      },
      {
        sloppy: 'The bill arrives at the position the spending itself is hollowing out.',
        better: 'The marketing budget eats more than the brand recognition it produces.',
      },
      {
        sloppy: 'The substrate gives out, and the appearance follows it.',
        better: 'Active users are dropping in core markets, and revenue follows.',
      },
      {
        sloppy: 'The arrangement does not collapse, and each cycle produces a fresh round of commitments.',
        better: 'The contract auto-renews every quarter, with new commitments stacking each time.',
      },
    ],
    skipRule:
      'Survives only if the body literally and consistently uses the same vocabulary as a structural through-line, AND both ends point at specific recently-named referents. Both conditions must hold. Almost never do.',
  },
  {
    id: 'antithesis',
    category: 'structural',
    name: 'Mirror construct',
    shortName: 'Mirror',
    severity: 'primary',
    scope: 'sentence',
    mechanical: true,
    rung: 1,
    blurb:
      '"Not X - it\'s Y." The shape isn\'t making an argument; it\'s borrowing the cadence of one. The most reflexive structural move in LLM output.',
    essay: `What looks like an argument is actually a stunt. The model is not making a case - it is performing the rhythm of one, pairing a setup with a stake-raise so the line *sounds* like a position before any position has been built. The first half exists to be exceeded by the second; the second half exists because the first half is there to be exceeded. The shape feeds itself.

This isn't subtle craft - it's a reflex. The cadence is unmistakable: a beat, a pivot, a louder beat. That cadence is good enough to fool the model into producing it and good enough to fool a tired reader into clapping. The writer's tell, when caught at this, isn't embarrassment about the line - it's the look of someone who realises the audience laughed for the wrong reason.`,
    whyItsSlop:
      'The model uses it to manufacture stakes. The shape says "I am about to elevate this from mundane to profound" without doing the work that elevates it. When the X side is a strawman, the move is even cheaper.',
    fix: 'Drop the X side. State Y directly. "It\'s not just a chatbot - it\'s a paradigm shift" becomes "It\'s a paradigm shift" (which now has to defend itself, as it should).',
    subShapes: [
      '"Not X - Y."',
      '"It\'s not just X - it\'s Y."',
      '"X isn\'t about Y. It\'s about Z."',
      '"The question isn\'t whether X. It\'s how X."',
      '"What looks like X is actually Y."',
    ],
    examples: [
      {
        sloppy: "It's not just a chatbot - it's a paradigm shift.",
        better: 'It is a paradigm shift.',
      },
      {
        sloppy: "This isn't merely a setback. It's a reckoning.",
        better: 'It is a reckoning.',
      },
      {
        sloppy: "The question isn't whether AI will reshape the field. The question is when.",
        better: 'AI will reshape the field within five years.',
      },
    ],
    skipRule:
      'Legitimate when the X position is a real, named position the piece is rebutting and the antithesis lands the rebuttal. "Management called this a quarterly miss. It was a strategic defeat." That is contrast doing argumentative work.',
  },
  {
    id: 'frame-stacking',
    category: 'structural',
    name: 'Frame stacking',
    severity: 'high',
    scope: 'piece',
    mechanical: false,
    rung: 3,
    blurb:
      'Same evaluative template applied to multiple subjects in sequence (Engineering: ... / Sales: ... / Marketing: ...).',
    essay: `Lexical patterns fit a template. Structural patterns fit a template. Argumentative patterns fit a template. The form is per-actor analysis by template-fill: each entry feels uniform because each entry was generated by the same prompt to itself.

The form announces "I have considered every relevant party" while delivering the impression that all parties are doing the same thing - feeling the same kind of pressure, weighing the same kind of cost. Real geopolitics is uneven. Some actors are about to be irrelevant. Some are about to be invaded. Some are quietly winning. The slop version flattens all of that in service of a lens that fits no one in particular and looks comprehensive in the way a row of identical filing cabinets looks comprehensive.`,
    whyItsSlop:
      'The model is producing per-actor analysis by template-filling. Each entry feels uniform because each entry was generated by the same prompt to itself.',
    fix: 'Vary the analytical move per actor. Some actors face dilemmas; others face certainty; others face irrelevance. The lens should fit the actor, not the other way around.',
    examples: [
      {
        sloppy:
          'For Engineering, the priority is reliability. For Sales, the priority is volume. For Marketing, the priority is reach.',
        better:
          'Engineering is buried in tech debt and cannot ship. Sales has hit quota and is coasting. Marketing is reorganising for the third time this year.',
      },
      {
        sloppy: 'The CFO faces a dilemma. The COO faces a dilemma. The CTO faces a dilemma.',
        better: '',
      },
    ],
  },

  // ---- ARGUMENTATIVE ----
  {
    id: 'hedged-confidence',
    category: 'argumentative',
    name: 'Hedged confidence',
    severity: 'high',
    scope: 'sentence',
    mechanical: false,
    rung: 2,
    blurb:
      'Statements emphatic in tone but vague in claim. Sounds like an argument; commits to nothing.',
    essay: `This pattern marks a meaningful shift in how readers might engage with the prose model output - which is to say, it sounds like a position while delivering nothing the next paragraph could actually contradict. Read it twice.

Read it twice. There is no claim. There is the shape of a claim, the register of a claim, the gravitas of one. The writer has delivered nothing falsifiable while having delivered something that scans as analysis. The model produces these on autopilot because the gradient rewarded confident-feeling sentences and punished wrong sentences, and the cheapest way to be confident without risking wrongness is to make sure there is nothing inside the confidence to be wrong about.`,
    whyItsSlop:
      '"This represents a significant development that could reshape how we think about the field." Reads like a claim. Is not one.',
    fix: 'Identify the specific claim. What exactly will reshape what? If the model cannot say, the line is empty. Replace with a concrete claim or cut.',
    examples: [
      {
        sloppy: 'This marks a significant development that could fundamentally reshape the conversation.',
        better: 'It is the first time the EU has voted unanimously on a sanctions package since 2022.',
      },
      {
        sloppy: 'It represents a meaningful shift in how analysts are thinking about the question.',
        better: 'Three of the five major banks now expect a recession by Q3.',
      },
      {
        sloppy: 'The strategy does not have to win in any single round; it grinds through enough years.',
        better: 'The strategy bets on outlasting the opposition\'s funding cycle. The funding cycle has eight months left.',
      },
      {
        sloppy: 'The framework is working as intended.',
        better: 'The framework was designed to delay enforcement, and is succeeding on that metric.',
      },
    ],
  },
  {
    id: 'synthesis-of-nothing',
    category: 'argumentative',
    name: 'Synthesis of nothing',
    severity: 'high',
    scope: 'sentence',
    mechanical: false,
    rung: 2,
    blurb:
      'Closing sentence that synthesises nothing. "Ultimately the relationship is complex and reflects broader dynamics."',
    essay: `In the end, what this pattern means for prose is, in many ways, the question itself - which is the form: a closing line that gestures at synthesis while delivering none, the model's default exit when it has nothing to add. The prose equivalent of a smooth jazz outro that signals the end of the segment without saying what the segment was about.

Cut the line and the piece loses nothing because the line carried nothing. The model produces them not because it has reached a synthesis but because it has been trained that essays end this way, and so its essays end this way - like rivers that go through the formality of reaching the sea even when they are run dry.`,
    whyItsSlop:
      'Appears in every LLM essay. Contains zero information. The model\'s default exit when it has nothing to add.',
    fix: 'Delete. If the section needs a closer, write one with content.',
    examples: [
      {
        sloppy:
          'Ultimately, the relationship between economics and politics is complex and reflects broader dynamics.',
        better: '',
      },
      {
        sloppy: 'In the end, the question is one that admits no easy answers.',
        better: 'The answer is no, with one footnote in the third quarter.',
      },
    ],
  },

  {
    id: 'performative-balance',
    category: 'argumentative',
    name: 'Performative balance',
    severity: 'high',
    scope: 'paragraph',
    mechanical: false,
    rung: 2,
    blurb:
      'Symmetrical balance - at the sentence, paragraph, or whole-piece scale - used as a cushion against committing to a position.',
    essay: `On one hand the form looks balanced; on the other hand, balance was never the point - both sides collect a clause, neither collects a verdict, and the writer leaves with the appearance of fairness without paying the cost of judgement. A shrug delivered by a lawyer.

The pattern shows up at three scales. As a sentence: "while the policy has merits, it also has drawbacks." As a paragraph: a spicy claim followed immediately by "however, it is important to consider..." that defangs it. And as a register that shapes the whole piece: "there are good-faith arguments on both sides," "reasonable people disagree," the diplomatic non-answer dressed as judiciousness. Same move, different scope.

The model is, by training, allergic to commitment - any side it picks could be the side the user wanted to lose, and the cheapest way to avoid that is to pick neither. The writer who imitates this voice is doing it for safety too, but the safety is less visible to them: it looks, from the inside, like fairness. From outside, the form announces "I will not be the one who decides." The reader has come for someone who will.`,
    whyItsSlop:
      'Both-sides-ism dressed as analysis. The writer cushions every take so completely that no take survives the cushioning. Real qualification sharpens; performative balance softens, indiscriminately, until the original claim has been embalmed.',
    fix: 'Commit. If both sides genuinely have merit, name what is at stake in the choice rather than just listing both sides and calling it analysis. If a take needs qualification, qualify it specifically (named exception, named cost), not generically.',
    subShapes: [
      'Sentence: "While X has merits, it also has drawbacks."',
      'Paragraph: spicy claim immediately followed by "however, it\'s important to consider..."',
      'Register: a whole piece in the both-sides voice ("good-faith arguments on both sides", "reasonable people disagree")',
    ],
    examples: [
      {
        sloppy:
          'While the policy has produced gains in some areas, it has also created challenges in others.',
        better: 'The policy worked in housing and failed in healthcare.',
      },
      {
        sloppy:
          'The decision was reckless. However, it is important to consider the constraints the administration faced.',
        better: 'The decision was reckless under the constraints, not despite them.',
      },
      {
        sloppy: 'There are good-faith arguments on both sides of this debate.',
        better: 'The good-faith argument is on one side. The other side is mostly post-hoc.',
      },
    ],
  },

  // ---- RUNG 3: ANALYTICAL FRAMEWORKS ----
  {
    id: 'lens-fits-everything',
    category: 'argumentative',
    name: 'Lens-fits-everything',
    severity: 'high',
    scope: 'piece',
    mechanical: false,
    rung: 3,
    blurb:
      'Pick a famous analytical lens (game theory, principal-agent, Overton window) and force the subject through it whether or not it fits.',
    essay: `From a game-theoretic perspective, this pattern reaches for one canonical lens and then bends every observation to fit it. Game theory works on competition with defined payoffs. Principal-agent works on delegated authority with misaligned incentives. The Overton window works on what is sayable, not what is true. The slop move is to grab whichever lens sounds high-status for the topic and then narrate the topic from inside it - regardless of whether the topic actually has payoffs, principals, or a discourse layer worth modelling.

The model loves named lenses for the same reason a freshman essay loves the word "essentially": they instantly produce structure without requiring the writer to find one. The reader gets a piece that reads like analysis but does the analysis on a different topic - the one the lens was built for. Real analytical frameworks earn their place when the subject's mechanics happen to fit their shape. They get borrowed when the writer needs the look of analysis without committing to the work of finding which lens the situation actually wants.`,
    whyItsSlop:
      'The lens is doing the analytical work the writer should have done. The conclusions end up being about competition / delegation / discourse, rather than about the subject.',
    fix: 'Drop the lens. Describe what is actually happening. If a lens applies, derive its applicability from the substance, not the substance from the lens.',
    examples: [
      {
        sloppy:
          'Through the lens of game theory, the regulator faces a coordination problem: cooperate and lose autonomy, defect and lose legitimacy.',
        better:
          'The regulator has two staff lawyers and a deadline in three weeks. The framing of the problem is downstream of those facts.',
      },
      {
        sloppy:
          'The Overton window has shifted, making positions that were once unthinkable suddenly mainstream.',
        better:
          'Three named senators changed their public position last year - two of them after a primary challenger. That is the entire shift.',
      },
    ],
  },
]

export function getPattern(id: string): PatternMeta | undefined {
  return patterns.find((p) => p.id === id)
}

export function patternsByCategory(category: string): PatternMeta[] {
  return patterns.filter((p) => p.category === category)
}
