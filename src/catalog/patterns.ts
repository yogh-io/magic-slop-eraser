import type { PatternMeta } from '../types'

export const patterns: PatternMeta[] = [
  // ---- LEXICAL ----
  {
    id: 'tier1-lexicon',
    category: 'lexical',
    name: 'Tier 1 lexicon',
    shortName: 'Tier 1',
    severity: 'primary',
    mechanical: true,
    blurb:
      'The canonical AI vocabulary. Almost no human writer reaches for these; LLMs love them.',
    essay: `These words are dead. They got used up. "Delve" used to mean a careful working-through; now it appears almost exclusively in sentences whose function is to perform thoughtfulness. "Tapestry" lost its threads sometime around 2018. "Navigate" was eaten by management consultants and never came back. "Leverage" tried to escape and got captured by finance, where it still has a valid technical use; everywhere else it is filler.

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
    id: 'tier2-lexicon',
    category: 'lexical',
    name: 'Tier 2 lexicon',
    shortName: 'Tier 2',
    severity: 'medium',
    mechanical: true,
    blurb:
      'Defensible in context, suspect in clusters. Two or more per 1000 words is a reliable cluster signal.',
    essay: `Each of these words is fine on its own. "Robust" can describe a real bridge. "Nuanced" can describe an actual position. "Multifaceted" was almost a compliment once.

The trouble is that the model does not pick one - it picks all of them, in clusters, the way a teenager learning to dress reaches for whatever looks expensive. A piece in which "robust," "nuanced," and "intricate" all show up before paragraph three is a piece in which the vocabulary is doing the work the argument was supposed to do. The reader registers the gesture. They do not register the argument. There was no argument; there was only the silhouette of one, draped in adjectives.`,
    whyItsSlop:
      'Each of these words has legitimate uses, but the model reaches for the same set so reflexively that clusters of three or four in a single piece are diagnostic on their own.',
    fix: 'Pick the one most load-bearing instance and let it stand. Replace the rest with concrete description. If "robust framework" means anything specific, name what makes it robust; if it does not, drop the adjective.',
    examples: [
      {
        sloppy:
          'A nuanced and multifaceted analysis of the intricate landscape.',
        better: 'A close look at what is actually going on.',
      },
      {
        sloppy:
          'The robust framework underscores the profound and remarkable journey ahead.',
        better: 'The framework can absorb three known kinds of failure.',
      },
    ],
  },
  {
    id: 'throat-clearing',
    category: 'lexical',
    name: 'Throat-clearing openers',
    severity: 'high',
    mechanical: true,
    blurb:
      'Sentence-opening phrases that announce "I am about to say something" instead of just saying it.',
    essay: `"It's important to note" is the writer asking themselves for permission before saying the thing. Permission is then granted, weakly, and the thing follows in the diminished form that survives the asking.

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
    mechanical: true,
    blurb: 'Phrases that announce the end and add nothing.',
    essay: `"In conclusion" is the writer raising a hand to be excused. "All in all" is the writer who did not earn the conclusion drafting a small ceremony in lieu of one.

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
    id: 'hedge-cluster',
    category: 'lexical',
    name: 'Hedge clusters',
    severity: 'medium',
    mechanical: true,
    blurb:
      'Three or more hedges (generally, typically, often, somewhat, perhaps, possibly...) in a single sentence.',
    essay: `One hedge is honesty about the limits of a claim. Three hedges in one sentence is a writer who has averaged across all possible claims and produced the shape of a claim with the conviction of a weather forecast read by a dying man.

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
    mechanical: true,
    blurb: 'When everything is fascinating, nothing is.',
    essay: `When everything is fascinating, nothing is. The model has been trained that "fascinating" pairs with "development" and "remarkable" pairs with "shift," and so it pairs them, on autopilot, in the absence of any actual fascination on its part - it is, after all, a function.

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
    mechanical: true,
    blurb: 'Phrases that simulate insight without delivering it.',
    essay: `"Raises important questions" is what a sentence says when it has decided not to ask one. "Has profound implications" is what a sentence says about itself when it has nothing implied.

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
    ],
  },

  // ---- STRUCTURAL ----
  {
    id: 'absent-actor',
    category: 'structural',
    name: 'Absent-actor construct',
    shortName: 'Absent actor',
    severity: 'primary',
    mechanical: false,
    blurb:
      'Load-bearing claims that turn on what no one is doing, has done, can do, or will say. PRIMARY TARGET.',
    essay: `The writer closes a paragraph by gesturing at a thing nobody is doing. "The deal no mediator can broker." "The framework no administration has built." "A war whose aims have never been declared."

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
        better: 'The deal has to close inside Iran, not across a table.',
      },
      {
        sloppy: 'No investigation announced, no one relieved, no review board convened.',
        better: 'The Pentagon has absorbed the losses and moved on.',
      },
      {
        sloppy: 'A campaign whose aims have never been written down.',
        better: 'The aims were set in Jerusalem in February and have not been revised since.',
      },
    ],
    skipRule:
      'Enumerated-against-template absences are legitimate ("Eagle Claw produced the Holloway Commission. This operation: no investigation, no one relieved, no review board") - the rhetorical weight comes from the gap against a known expected sequence, and each clause is independently testable. Specific factual absences about named instruments ("no snap-back mechanism in the current agreement") are also legitimate.',
  },
  {
    id: 'allusive-construct',
    category: 'structural',
    name: 'Allusive construct',
    severity: 'primary',
    mechanical: false,
    blurb:
      'The shape is "[unspecific] [relates to] [unspecific]." Both ends abstract or back-referring; the verb does the work. PRIMARY TARGET.',
    essay: `The sentence that announces "I am the kicker" by being indirect about its own claim. Both ends abstract; a verb in the middle doing all the work. "The cheque is written on the appearance of dominance the underlying reality no longer supports."

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
        better: 'Two carrier groups in the Pacific cost more than the deterrent they buy.',
      },
      {
        sloppy: 'The substrate gives out, and the appearance follows it.',
        better: 'Dollar invoicing is dropping in the Gulf, and the dollar follows.',
      },
    ],
    skipRule:
      'Survives only if the body literally and consistently uses the same vocabulary as a structural through-line, AND both ends point at specific recently-named referents. Both conditions must hold. Almost never do.',
  },
  {
    id: 'antithesis',
    category: 'structural',
    name: '"Not X - it\'s Y" antithesis',
    shortName: 'Antithesis',
    severity: 'primary',
    mechanical: true,
    blurb:
      'The most reflexive structural shape after the tricolon. Also called the mirror construct.',
    essay: `"Not X - Y" is the model's favourite stunt because it mechanically produces the shape of stake-raising. The first half sets up something the second half will exceed - even when the first half is a strawman the model invented for the purpose of being exceeded.

The result reads like an argument because the rhythm of the line resembles the rhythm of an argument. It is not an argument. The shape is good enough to fool the model into producing it and good enough to fool a tired reader into clapping. The writer's tell, when caught at this, is the look of someone who realises the audience laughed at their joke for the wrong reason.`,
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
      'Legitimate when the X position is a real, named position the piece is rebutting and the antithesis lands the rebuttal. "The Pentagon called this a tactical setback. It was a strategic defeat." That is contrast doing argumentative work.',
  },
  {
    id: 'tricolon',
    category: 'structural',
    name: 'Tricolon reflex',
    severity: 'high',
    mechanical: false,
    blurb:
      'Three-item lists everywhere, especially escalating ones ("not just X, but Y, and even Z").',
    essay: `Three-item lists are real. Caesar, Lincoln, every great speech. "I came, I saw, I conquered" works because the three things actually happened, in that order, each adding a beat.

The slop tricolon is when the writer needed two things and the model gave three, padding with whatever sounded vaguely parallel. The third item is usually the most suspect - a near-synonym dragged in because three felt right. The model prefers three the way a child counting things prefers to land on round numbers. The reader, four tricolons in, has stopped reading the items.`,
    whyItsSlop:
      'Humans use tricolons (Caesar, Lincoln, every great speech). The slop version is reflexive: the model picked three because three feels rhythmic, not because there are three things. The clue is that the items are often near-synonyms or arbitrary points on a continuum.',
    fix: 'If the three items are genuinely distinct and structurally parallel, keep. If two are near-synonyms, cut to two or one. If the items are arbitrary, restructure as prose.',
    examples: [
      {
        sloppy: 'The platform empowers users, streamlines workflows, and transforms experiences.',
        better: 'The platform cuts the time to file a claim from forty minutes to four.',
      },
      {
        sloppy: 'Not just a tool, but a system, and indeed a movement.',
        better: 'A system. Not yet a movement.',
      },
    ],
  },
  {
    id: 'staccato',
    category: 'structural',
    name: 'Staccato slop',
    severity: 'high',
    mechanical: false,
    blurb:
      'Two or more consecutive short sentences (under ~8 words) creating false gravity.',
    essay: `"It started small. It grew. It became unstoppable." Each sentence pretends to add weight. None of them does. The trick is rhythm - three quick beats simulate the cadence of a building argument, and the reader, scanning, registers that something serious has just been said.

Strip the line breaks and the content collapses into a single sentence about something growing, which we already knew growing things tend to do. The model loves staccato because the loss function rewards punchiness; punchiness is producible by chopping; chopping is cheap. A run of fragments after a long sentence is fine - that is a deliberate punch. A run of fragments after another run of fragments is the model doing aerobics.`,
    whyItsSlop:
      'The rhythm simulates gravity. A reader feels they are being walked through something profound. Strip the rhythm and the content is usually thin. Agents consistently fail to catch it.',
    fix: 'Combine into one sentence with conjunctions or a semicolon. Vary the lengths. One short sentence after a long one is fine - that is a deliberate punch. Two or three in a row is a tell.',
    examples: [
      {
        sloppy: 'It started small. It grew. It became unstoppable.',
        better:
          'What started as a protest in two universities had spread to twelve cities by the end of the month.',
      },
      {
        sloppy: 'The deal collapsed. Markets reacted. Trust eroded.',
        better: 'When the deal collapsed in March, three indices dropped within an hour and the embassy stopped returning calls.',
      },
    ],
  },
  {
    id: 'em-dash-density',
    category: 'structural',
    name: 'Em-dash sandwich',
    severity: 'medium',
    mechanical: true,
    blurb: 'Em-dashes used to insert meta-commentary mid-sentence.',
    essay: `Em-dashes used right are knives. The slop variety is more like an uncle's kitchen drawer - full of dashes, none of them sharp, deployed mostly to insert little meta-clauses the writer has not quite committed to grammatically.

"The result - and this is the crucial part - was unexpected" is the writer handing themselves a place to comment on their own sentence mid-sentence, because the sentence on its own was not doing it for them. Density is the tell. One em-dash per page can be devastating. Six is the writer hedging the same hedge twice.`,
    whyItsSlop:
      'Real em-dash use is for sharp interruption or amplification. Slop em-dash use is cushioning - giving the model a place to insert hedging meta-commentary without committing to a grammatical structure. Density above one per 200 words is a yellow flag.',
    fix: 'Delete the inserted clause if it is meta-commentary. If the inserted clause is real content, restructure into two sentences or a parenthetical. Reserve em-dashes for sharp interruptions.',
    examples: [
      {
        sloppy: 'The result - and this is the crucial part - was unexpected.',
        better: 'The crucial part was that the result was unexpected.',
      },
      {
        sloppy: 'The deal - which is to say, the absence of one - shaped everything.',
        better: 'The absence of a deal shaped everything.',
      },
    ],
  },
  {
    id: 'anaphoric-cascade',
    category: 'structural',
    name: 'Anaphoric cascade',
    severity: 'high',
    mechanical: false,
    blurb:
      'Three or more consecutive sentences or paragraphs sharing the same grammatical opening.',
    essay: `"It empowers users. It streamlines workflows. It transforms experiences." The shape is parallelism. The substance is filler.

Genuine anaphora works because the grammatical repetition collides with semantic acceleration - each clause says something more or sharper than the one before. Slop anaphora is the same opening, three times, with three near-identical claims behind it. The reader hears a metronome and assumes there is music. The writer who reaches for this reflexively is, on some level, just looking for a rhythm to fill until the actual idea arrives. The idea does not always arrive.`,
    whyItsSlop:
      'Parallel structure to the point of metronome reads as confident; is actually filler. "It empowers users. It streamlines workflows. It transforms experiences."',
    fix: 'Vary sentence openings. Keep at most one repetition. If the parallelism is doing real argumentative work, break it after two and recap differently the third time.',
    examples: [
      {
        sloppy: 'It empowers users. It streamlines workflows. It transforms experiences.',
        better: 'It cuts a forty-minute task to four.',
      },
      {
        sloppy: 'And so the alliance held. And so the deal closed. And so the war ended.',
        better: 'The alliance held - barely. The deal closed by accident. The war ended for unrelated reasons.',
      },
    ],
  },
  {
    id: 'frame-stacking',
    category: 'structural',
    name: 'Frame stacking',
    severity: 'high',
    mechanical: false,
    blurb:
      'Same evaluative template applied to multiple subjects in sequence (US: ... / Iran: ... / Israel: ...).',
    essay: `"The US faces a dilemma. China faces a dilemma. Russia faces a dilemma." Per-actor analysis by template-fill. Each entry feels uniform because each entry was generated by the same prompt to itself.

The form announces "I have considered every relevant party" while delivering the impression that all parties are doing the same thing - feeling the same kind of pressure, weighing the same kind of cost. Real geopolitics is uneven. Some actors are about to be irrelevant. Some are about to be invaded. Some are quietly winning. The slop version flattens all of that in service of a lens that fits no one in particular and looks comprehensive in the way a row of identical filing cabinets looks comprehensive.`,
    whyItsSlop:
      'The model is producing per-actor analysis by template-filling. Each entry feels uniform because each entry was generated by the same prompt to itself.',
    fix: 'Vary the analytical move per actor. Some actors face dilemmas; others face certainty; others face irrelevance. The lens should fit the actor, not the other way around.',
    examples: [
      {
        sloppy:
          'For the US, the calculus is restraint. For Iran, the calculus is escalation. For Israel, the calculus is survival.',
        better:
          'The US is stalling for domestic reasons. Iran has nothing to lose by escalating. Israel is no longer running a calculus; it is running a campaign.',
      },
      {
        sloppy: 'Washington faces a dilemma. Beijing faces a dilemma. Moscow faces a dilemma.',
        better: '',
      },
    ],
  },
  {
    id: 'bidirectional-summary',
    category: 'structural',
    name: 'Bidirectional summary',
    severity: 'medium',
    mechanical: false,
    blurb:
      '"While X has its merits, it also has drawbacks." Symmetrically balanced because the model is averaging perspectives.',
    essay: `"While X has its merits, it also has drawbacks." A shrug delivered by a lawyer. Both sides get a clause; neither gets a verdict.

The model is, by training, allergic to commitment - any side it picks could be the side the user wanted to lose, and the cheapest way to avoid that is to pick neither. The writer who imitates this voice is doing it for safety too, but the safety is less visible to them: it looks, from the inside, like fairness. From outside, the form announces "I will not be the one who decides." The reader has come for someone who will.`,
    whyItsSlop:
      'Performative balance. Both-sides-ism dressed as analysis. The model has been trained to never leave a take un-cushioned.',
    fix: 'Commit to a position. If both sides genuinely have merit, name what is at stake in choosing - do not just list both sides and call it analysis.',
    examples: [
      {
        sloppy:
          'While the policy has produced gains in some areas, it has also created challenges in others.',
        better: 'The policy worked in housing and failed in healthcare.',
      },
      {
        sloppy:
          'On one hand, the deal stabilises the region. On the other hand, it concentrates risk.',
        better: 'The deal trades short-term stability for long-term concentration risk. That is probably the right trade for now.',
      },
    ],
  },
  {
    id: 'colon-pivot',
    category: 'structural',
    name: 'Colon-as-pivot',
    severity: 'low',
    mechanical: false,
    blurb:
      '"The answer is clear: more research is needed." The colon promises a payoff that turns out to be a platitude.',
    essay: `The colon promises that what follows is the payoff. The slop colon-pivot is the writer banking the promise then producing a platitude. "The answer is clear: more research is needed." "The implication is profound: nothing will be the same."

The first half builds a tiny stage. The second half walks onto the stage and bows without performing. The model loves this because the form is reliably present in the prose it was trained on - confident punctuation, declarative payoff - even when the payoff itself is a vague gesture toward payoffs that have actually occurred elsewhere in the canon.`,
    whyItsSlop:
      'LLMs love a colon followed by a punchy declaration. The colon promises that what follows is the payoff; usually what follows is a platitude or an empty gravitas line.',
    fix: 'Check what follows the colon. If it is substantive and specific, keep. If it is vague gravitas or restated thesis, cut everything after the colon and restructure.',
    examples: [
      {
        sloppy: 'The answer is clear: more research is needed.',
        better: 'We do not know yet. The next data drop is in October.',
      },
      {
        sloppy: 'The lesson is unmistakable: institutions matter.',
        better: 'The lesson is that the EPA was the only thing keeping rivers cleanable.',
      },
    ],
  },
  {
    id: 'orphan-punchline',
    category: 'structural',
    name: 'Orphan punchline',
    severity: 'high',
    mechanical: false,
    blurb:
      'Short declaratives standing alone for dramatic weight rather than structural necessity.',
    essay: `Short declarative sentence on its own line, conveying weight via whitespace.

Like that.

Sometimes earned. Often borrowed. The model produces these on cue when prose feels saggy, because vertical space is the cheapest possible way to make a line look heavy. The reader who has read enough of these starts to feel the borrowed weight as a small irritation - a sentence asking to be admired without doing the work that admiration is the response to.`,
    whyItsSlop:
      'The model is signalling importance through whitespace. Sometimes the line is genuinely punchy; often it is a banal claim borrowing weight from formatting.',
    fix: 'If the line has earned the weight, keep. If the weight is borrowed from the line break, fold the line back into the previous paragraph.',
    examples: [
      {
        sloppy: 'And nobody noticed.',
        better: '',
      },
      {
        sloppy: 'The deal was already dead.',
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
    mechanical: false,
    blurb:
      'Statements emphatic in tone but vague in claim. Sounds like an argument; commits to nothing.',
    essay: `What a sentence sounds like when it wants to be both right and unaccountable. "This represents a significant development that could reshape how we think about the field."

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
    ],
  },
  {
    id: 'false-precision',
    category: 'argumentative',
    name: 'False-precision authority',
    severity: 'high',
    mechanical: true,
    blurb:
      'Authority claims without sources. The model cannot cite and will not admit it.',
    essay: `"Studies have shown." Which studies? "Experts agree." Which experts? "Research indicates." Whose research?

The form invokes authority the writer cannot actually produce, betting that the reader will not ask. The model is especially prone because the model knows it cannot cite - it does not have working URLs to gesture at - and the closest move available is to imply citation by sound. A sentence beginning "studies have shown" is, statistically, a sentence that has never been followed by a study. If a study had been there, the study would be in the line.`,
    whyItsSlop:
      '"Studies have shown..." (which studies?), "Experts agree..." (which experts?), "It is widely accepted that..." The appeal manufactures authority that does not exist.',
    fix: 'Name the source, or drop the appeal to authority. If the claim can stand on its own merits, let it. If it cannot, the source matters - find it.',
    examples: [
      {
        sloppy: 'Studies have shown that this approach yields better outcomes.',
        better: 'A 2023 paper by the Karolinska group found a 12 percent improvement on the same metric.',
      },
      {
        sloppy: 'Experts agree that the framework is fundamentally sound.',
        better: 'Three of the four economists who reviewed the framework called it sound; the fourth called it premature.',
      },
      {
        sloppy: 'It is widely accepted that the policy was a mistake.',
        better: 'Both the OECD and the Treasury have since called the policy a mistake.',
      },
    ],
  },
  {
    id: 'pivot-to-balance',
    category: 'argumentative',
    name: 'Pivot to balance',
    severity: 'medium',
    mechanical: false,
    blurb:
      'Any spicy claim immediately followed by "However, it\'s important to consider..." that defangs it.',
    essay: `The model has been trained that any spicy claim should be followed by "however, it is important to consider..." and so the cushioning that defangs them gets added religiously.

The cushion is not balance - it is the absence of nerve. Real qualification sharpens; it tells you which version of the claim survives and what would falsify the rest. Slop qualification softens, indiscriminately, until the original claim has been embalmed and laid out for visitation. By the time the next paragraph begins, the writer has said two things that mostly cancel and gestured at having considered both.`,
    whyItsSlop:
      'The model has been trained never to leave a take un-cushioned. The cushion is the slop.',
    fix: 'Delete the cushion. If the claim genuinely needs qualification, the qualification should sharpen, not soften.',
    examples: [
      {
        sloppy:
          'The deal was a strategic disaster - though, of course, there were also genuine benefits to consider.',
        better: 'The deal was a strategic disaster. The benefits were procedural and have already been absorbed.',
      },
      {
        sloppy:
          'The decision was reckless. However, it is important to consider the constraints the administration faced.',
        better: 'The decision was reckless under the constraints, not despite them.',
      },
    ],
  },
  {
    id: 'restating-question',
    category: 'argumentative',
    name: 'Restating the question',
    severity: 'medium',
    mechanical: false,
    blurb: 'Spending a paragraph re-articulating what was asked.',
    essay: `"That is a great question. The question of whether X is one that..." The model buying time. The chatbot equivalent of a politician saying "I am glad you asked."

Real conversation answers; this performs the receipt of the question first, as if the question itself needed a small monument before being processed. In prose it survives as paragraph-long restatements of the thesis at the start of a section that was supposed to argue for it. The reader did not need their question reflected back. They needed an answer.`,
    whyItsSlop:
      '"That\'s a great question. The question of whether X is one that..." The model is buying time and signalling effort. Neither is helpful.',
    fix: 'Answer.',
    examples: [
      {
        sloppy:
          'The question of whether the policy succeeded is itself a complex one, requiring us to define our terms carefully.',
        better: 'It did not succeed.',
      },
      {
        sloppy: 'When we ask whether AI will transform medicine, we are really asking a much deeper question.',
        better: 'AI is already transforming radiology and is two years away from primary care.',
      },
    ],
  },
  {
    id: 'synthesis-of-nothing',
    category: 'argumentative',
    name: 'Synthesis of nothing',
    severity: 'high',
    mechanical: false,
    blurb:
      'Closing sentence that synthesises nothing. "Ultimately the relationship is complex and reflects broader dynamics."',
    essay: `"Ultimately, the relationship between X and Y is complex and reflects broader dynamics in the field." Appears in every LLM essay. Contains zero information. The model's default exit when it has nothing to add - the prose equivalent of a smooth jazz outro that signals the end of the segment without saying what the segment was about.

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
    id: 'recap-paragraph',
    category: 'argumentative',
    name: 'Recap paragraph',
    severity: 'high',
    mechanical: false,
    blurb: 'Closing paragraph that restates the essay just read.',
    essay: `Born of the school assignment in which "tell them what you told them" was a real instruction. Born again in the LLM whose loss function rewarded summarisation.

The reader has just read the piece. They do not need a summary. The summary, when it appears, signals to the reader that the writer did not trust them to remember and did not have anything else to say. A real closer advances the argument one step further than the body did - lands a thought that depended on the body but is not in it. A recap is the writer ending the lecture with another lecture about the lecture.`,
    whyItsSlop:
      'The model has been trained to summarise. The reader does not need a summary - they just read the piece.',
    fix: 'Delete the recap. If the piece needs a final paragraph, it should advance the argument one step further, not summarise what came before.',
    examples: [
      {
        sloppy:
          "We've explored three scenarios above: A, B, and C. Each has merits and drawbacks, and the future depends on which path is chosen.",
        better: 'Of the three, B is the only one where the alliance survives. That is what is on the table.',
      },
      {
        sloppy:
          'In summary, this piece has argued that the alliance is fragile, the deal is dead, and the timeline is short.',
        better: '',
      },
    ],
    skipRule:
      'Legitimate in pieces with explicit framing ("we have covered three scenarios; here is how to weigh them"). The slop version is reflexive.',
  },

  // ---- TONAL ----
  {
    id: 'performative-balance',
    category: 'tonal',
    name: 'Performative balance',
    severity: 'medium',
    mechanical: false,
    blurb:
      'Two sides presented as equally weighted because "both perspectives have merit" is a safer output than commitment.',
    essay: `Distinct from bidirectional summary because the issue is voice rather than structure. Performative balance is the both-sides register applied to a piece that did not structurally promise to give two sides equal weight - the writer simply talks like someone who would, no matter what they are talking about.

The result is the diplomatic non-answer dressed as judiciousness. The model defaults to it because every commitment is a risk and every risk has been punished by some training signal somewhere. The writer who imitates this voice has confused fair-mindedness with non-commitment. They are different things. One is a virtue. The other is the absence of one.`,
    whyItsSlop:
      'Distinct from the bidirectional summary structure - the performative version is about register (the both-sides voice) even when the structure is not visibly symmetric.',
    fix: 'Commit. If the piece is genuinely undecided, say so explicitly and explain what would tip it.',
    examples: [
      {
        sloppy: 'There are good-faith arguments on both sides of this debate.',
        better: 'The good-faith argument is on one side. The other side is mostly post-hoc.',
      },
      {
        sloppy: 'Reasonable people disagree about the wisdom of the policy.',
        better: 'The Treasury thinks the policy is wise. The Bundesbank does not. I am with the Bundesbank.',
      },
    ],
  },
  {
    id: 'performative-humility',
    category: 'tonal',
    name: 'Performative humility',
    severity: 'medium',
    mechanical: false,
    blurb:
      '"While I\'m not an expert..." followed by confident expert-style analysis.',
    essay: `"While I am not an expert..." followed by paragraph-long expert analysis. "There are many ways to think about this..." followed by exactly one.

The form is the writer wearing a small badge that says HUMBLE before delivering a confident claim, in case the claim turns out badly and someone needs to point at the badge. The model loves this because deference is rewarded and confidence is punished separately, and the cheapest way to satisfy both gradients is to deliver the confidence and the deference together, in that order, with the deference up front for plausible deniability.`,
    whyItsSlop:
      'The humility is theatre; the analysis it precedes is the actual stance. Drop the theatre.',
    fix: 'Drop the humility throat-clearer. If the piece is genuinely uncertain, the uncertainty should be in the substance, not in the preamble.',
    examples: [
      {
        sloppy: "Now, I'm not a Middle East expert, but it seems clear that the alliance is fraying.",
        better: 'The alliance is fraying.',
      },
      {
        sloppy: 'There are many ways to look at this question, and reasonable people will disagree, but I think the deal will fail.',
        better: 'The deal will fail.',
      },
    ],
  },
  {
    id: 'approval-seeking',
    category: 'tonal',
    name: 'Approval-seeking close',
    severity: 'medium',
    mechanical: true,
    blurb:
      '"I hope this helps!" / "Let me know if you\'d like to explore further."',
    essay: `"I hope this helps!" The chatbot's signature, surviving in prose as "if readers take one thing away..." or "the hope is that...".

The piece either helps or it does not. Asking the reader to confirm that it helped is the writer asking permission to have written the piece, retroactively. In essays it shows up as a wistful little final line in which the writer expresses a wish about how the reader will receive what they have just read. The literary equivalent of waving at someone as they leave the room and asking, softly, whether the visit was alright.`,
    whyItsSlop:
      'Survives in prose as "If readers take one thing away..." or "The hope is that..." The piece either helps or it does not. Asking the reader to confirm is for chatbots.',
    fix: 'Delete.',
    examples: [
      {
        sloppy: 'I hope this helps clarify the situation.',
        better: '',
      },
      {
        sloppy: 'If readers take one thing away from this piece, it should be that the alliance is brittle.',
        better: 'The alliance is brittle.',
      },
      {
        sloppy: 'Hopefully this gives you a useful framework for thinking about the issue.',
        better: '',
      },
    ],
  },
  {
    id: 'editorial-we',
    category: 'tonal',
    name: 'Editorial we / one',
    severity: 'low',
    mechanical: false,
    blurb:
      'Reflexive "we" or "one" when the actual subject is the model or the writer.',
    essay: `"We can see that..." "One might wonder..." The we is fictional; the one is hypothetical; both are stand-ins for the writer who did not want to commit to a subject.

In the LLM the we and the one are doing real work - the model has no actual we to refer to and no first-person standpoint to assert from, and so it conjures a chorus instead. In prose it survives as the writer borrowing the model's habit, signing the sentence with a pronoun that names no one. Sometimes that is correct. Often it is a hedge.`,
    whyItsSlop:
      '"One might wonder...", "We can see that...", "We must remember..." The pronoun is doing the work of pretending there is a subject.',
    fix: 'Name the subject. If "we" means the analytical project, say so. If "we" means the reader, address them. If "we" means no one in particular, the sentence is filler.',
    examples: [
      {
        sloppy: 'One might wonder whether the timing was deliberate.',
        better: 'It looks deliberately timed.',
      },
      {
        sloppy: 'We can see, from this distance, that the project was always doomed.',
        better: 'The project was always doomed.',
      },
    ],
  },

  // ---- FORMAT ----
  {
    id: 'bullets-where-prose',
    category: 'format',
    name: 'Bullets where prose would serve',
    severity: 'medium',
    mechanical: false,
    blurb:
      'Two-point bullet lists for content that is genuinely a paragraph. Bolding the first three words of every bullet.',
    essay: `The bullet list is the model's favourite shape because it converts paragraphs of thought into tidy little items the reader can scan past without doing the work of integrating.

Genuine list content - parallel items, scannable reference material - benefits from bullets. Most prose does not. Two-bullet "lists" are the worst offenders: a writer who needed to write a paragraph and decided, instead, to write a paragraph in two pieces with bullets in front of them. Bolding the first three words of each bullet is the same writer adding sequins. The reader's eye sliding down a bullet list is doing less work than reading prose - which means the writer did less work too, and the reader can feel it.`,
    whyItsSlop:
      'The reader\'s eye sliding down a bullet list is doing less work than reading prose - which means the writer did less work too.',
    fix: 'Convert to prose unless the content is genuinely list-like (parallel items, scannable reference material).',
    examples: [
      {
        sloppy: '**Key points:**\n- Implementation will be phased.\n- Stakeholders will be consulted.',
        better: 'The rollout is phased and the stakeholders will be consulted before each phase.',
      },
      {
        sloppy:
          'Three things to remember:\n- **First**, the deal matters.\n- **Second**, timing matters.\n- **Third**, follow-through matters.',
        better: 'The deal matters, the timing matters, and follow-through matters most of all.',
      },
    ],
  },
  {
    id: 'arbitrary-numbered-list',
    category: 'format',
    name: 'Arbitrary numbered list',
    severity: 'low',
    mechanical: false,
    blurb:
      '"Here are 5 reasons..." when 4 or 7 would have been just as natural.',
    essay: `"Here are 5 reasons..." when 4 or 7 would have been just as natural. The model picked 5 because round.

The number is doing no informational work; it is there because the model has been trained that listicles begin with a small round number, and so when asked for an analytical observation it returns one in the form of a small round number's worth of bullets. The reader, having been promised five things, expects five distinct things. Three are usually the same thing said three different ways.`,
    whyItsSlop:
      'The model picked 5 because round. The number is doing no informational work.',
    fix: 'Unless the count is meaningful, drop the number and convert to prose.',
    examples: [
      {
        sloppy: '5 reasons the deal will fail (and one reason it might not).',
        better: 'The deal will fail for two reasons. The third, fourth, and fifth in any "five reasons" list are the same as the second.',
      },
      {
        sloppy: 'Here are the 7 most important takeaways from the announcement.',
        better: 'Two things matter in the announcement, and they are easy to miss.',
      },
    ],
  },
  {
    id: 'header-inflation',
    category: 'format',
    name: 'Header inflation',
    severity: 'low',
    mechanical: true,
    blurb:
      '## Section for a two-paragraph block. ### Subsection for one paragraph.',
    essay: `## Section. ### Subsection. #### Sub-subsection. The piece becomes an interface for navigating itself rather than a piece.

Every header is the writer announcing a new movement. If the movement is two paragraphs long, the announcement is louder than the movement. The model defaults to header inflation because it has been rewarded for producing structured output - structure is the cheapest possible way to look organised - and so it returns hierarchical scaffolding even when the underlying content is one continuous thought. A real essay has occasional headers when the structure shifts. A slop essay is mostly headers.`,
    whyItsSlop:
      'The piece becomes a navigation interface rather than an essay. A header should signal a real shift.',
    fix: 'Collapse subsections that do not earn their headers.',
    examples: [
      {
        sloppy: 'A 600-word piece with eight ## sections, three of them a single paragraph long.',
        better: 'Two real headers, where the structure actually turns. Everything else as prose.',
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
