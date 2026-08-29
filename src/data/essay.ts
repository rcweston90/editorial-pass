// The manuscript itself, as structure React can render: sections, paragraphs,
// and the passages the pass touched. Prose is the original's, unaltered.
// src/lib/example.ts folds this back into a DocumentModel.

import { em, strong } from './pass'
import type { CorpusSection, Inline } from '../types'

export const HEAD = {
  title: "The Most Finished One",
  byline: [em("By Charlie Weston · August 24, 2026")] as Inline[],
  epigraph: "the wait was the curriculum",
}

export const ESSAY: CorpusSection[] = [
  {
    id: "lede",
    nodes: [
      { kind: 'p', content: ["You generate twenty options and pick the one that looks most finished."] },
      { kind: 'rewritten', changeId: "hedge", orig: ["That's the job now. Not everywhere, not for everyone — but if you've done it this month, you already know which sentence in this essay is about you."], edit: ["That's the job now. If you've done it this month, you already know which sentence in this essay is about you."] },
      { kind: 'p', content: ["I'm not going to call that lazy. It isn't. It's the only rational move available when you have twenty artifacts in front of you, no way to tell them apart, and standup in forty minutes."] },
      { kind: 'p', className: "kicker", content: [strong("The behavior is fine. The instrument you're reading with is broken, and nobody sent a notice.")] },
    ],
  },
  {
    id: "instrument",
    heading: ["The instrument"],
    nodes: [
      { kind: 'p', content: ["For most of human history you could tell how far a thing had traveled by how long it took to arrive."] },
      { kind: 'p', content: ["A book took years to write. A letter took a week to deliver. News from another continent took a month and three sets of hands. You knew how far away a thing was because you could feel how much work it had done to reach you — latency was information, and your body read it for free."] },
      {
        kind: 'change-block',
        changeId: "instrument",
        type: "compressed",
        altered: null,
        blocks: [
          { tag: "p", content: ["Nobody taught you that. There was no class. Delay showed up pre-loaded with meaning, and you spent it without noticing, the way you spend depth perception."] },
          { tag: "p", content: ["We have been attacking that delay since we could walk. Land bridges. Boats. Trading colonies pinned to the edge of the known map. Distance was the hill that taunted and rewarded and punished us in turn, and every century we took another bite out of it."] },
          { tag: "p", content: ["Distance did double duty the whole time. It told you what a thing would cost to reach. It also told you what a thing had cost to reach you."] },
        ],
      },
      { kind: 'p', content: ["Then we deleted it. Now everything arrives at the same speed, through the same rectangle, with the same buzz against your leg."] },
    ],
  },
  {
    id: "wouldnt",
    heading: ["I wouldn't go back"],
    nodes: [
      {
        kind: 'change-block',
        changeId: "mail",
        type: "cut",
        altered: null,
        blocks: [
          { tag: "p", content: ["The cheap version of this essay is a man missing the mail. Let me kill that now."] },
        ],
      },
      { kind: 'p', content: ["The speed is real. I would not go back, and neither would you."] },
      { kind: 'p', content: ["And it runs deeper than convenience, which is the part the people arguing about AI keep getting wrong. Early in my career, an interaction design problem meant sitting down and manually concepting ten different ways the thing could work. By hand. That was days."] },
      { kind: 'p', content: ["Now it's sometimes a conversation. I can get ten structures on screen, push real data through them, and watch where they break — live, in an afternoon. I usually throw the output away. That isn't the point. The point is that I got to ", em("look"), " at ten structures instead of imagining them."] },
      { kind: 'p', content: ["That capability is immeasurable. I'm not giving it back."] },
      { kind: 'p', className: "kicker", content: [strong("Which is exactly why the rest of this is a problem.")] },
    ],
  },
  {
    id: "half",
    heading: ["Only one half collapsed"],
    nodes: [
      { kind: 'p', content: ["Two things used to take time. Making the artifact took time. Arriving at the structure took time."] },
      { kind: 'p', content: ["Only one of them collapsed."] },
      { kind: 'p', content: ["Getting from a brief to a first credible option I'd actually show someone used to take me about three days. Now it takes twenty minutes. Call it two hundred times faster."] },
      { kind: 'p', content: ["Run the same arithmetic on the other half of the job. How long does it take to work out how data moves through a system — where state lives, what the real edges are, what happens when a person, or now an agent, enters at the wrong step with the wrong context?"] },
      { kind: 'p', content: ["Same as it ever was. Weeks. Zero times faster."] },
      { kind: 'p', content: ["Because most design problems are not surface problems. They are interaction design and information architecture wearing a surface. And a test can tell you that a thing is wrong. A test has never once handed anyone a structure."] },
      { kind: 'p', content: ["Structure isn't a verdict you wait for. It's an arrival you have to earn, and arriving takes what it takes."] },
      { kind: 'p', content: ["So the two halves of the job came apart. One went to twenty minutes. One stayed at weeks. And every artifact you look at now is produced by the fast half and judged as though it represented both."] },
    ],
  },
  {
    id: "hired",
    wholeCut: {
      changeId: "hired",
      heading: ["Why design got hired in the first place"],
      blocks: [
        { tag: "p", content: ["Nobody woke up one morning and decided product teams needed design."] },
        { tag: "p", content: ["Design got hired because there was a gap. Somebody had a thing in their head — or didn't, which was more often the case — and a canvas in front of them, and the distance between those two never got crossed. That failed often enough, in enough companies, that it turned into a role."] },
        { tag: "p", content: [strong("Design is the profession of that interval."), " It exists because of a distance. Its entire claim is that somebody should be paid to cross it on purpose."] },
        { tag: "p", content: ["So when the interval collapses, design has a problem engineering doesn't. Not an existential one. A structural one."] },
      ],
    },
    nodes: [],
  },
  {
    id: "catch",
    heading: ["The thing that used to catch it"],
    nodes: [
      { kind: 'p', content: ["If the real check runs at weeks, something faster had to stand in for it."] },
      { kind: 'p', content: ["Something did. It was a room. Crit, or one senior person with the standing to look at your work and say no on a Tuesday afternoon. That was the cheap local approximation of the expensive real answer, and it ran in an hour instead of a quarter."] },
      { kind: 'p', content: ["It was never a formal system. That's the part people miss. ", strong("It was a byproduct of headcount."), " You had crit because there were enough designers in the building that a room happened."] },
      { kind: 'p', content: ["Then teams got smaller. Then small enough that the room stopped happening — and on most startup teams it never happened at all, because there was never anybody there to hold it. Designers of one. Siloes of one."] },
      { kind: 'p', content: ["Here's the loop. AI is a large part of ", em("why"), " the two-person team is viable now. The tool made the small team possible. The small team has no room. The room was the only fast check on the tool's output."] },
      { kind: 'p', content: ["It dissolved its own guardrail. Not maliciously. Structurally."] },
    ],
  },
  {
    id: "finished",
    heading: ["Why you reach for the finished one"],
    nodes: [
      { kind: 'p', content: ["Now put it together, because your reflex makes complete sense once you do."] },
      { kind: 'p', content: ["Finish used to be expensive. Getting something to look resolved — real states, real copy, real spacing, real data — cost hours you had to steal from somewhere else. Which meant polish was a ", em("reliable proxy for thought."), " If it looked considered, somebody had considered it, because nobody could afford to polish a thing they hadn't thought about."] },
      { kind: 'p', content: ["Polish is free now. Shitting out something that looks finished is worth nothing and costs nothing, and those are the same fact."] },
      { kind: 'p', content: ["The proxy is dead. The reflex that reads it is not. Your instrument is still calibrated for a world where finish cost something, and it's now aimed at twenty artifacts that all cost the same nothing."] },
      { kind: 'p', content: ["The thickest menu is never the best restaurant. You know that about restaurants. You haven't learned it yet about screens."] },
      { kind: 'p', content: ["Twenty options. One structure between them, usually. Sometimes none. You're picking on the axis that got cheap, because the axis that didn't get cheap doesn't render."] },
      { kind: 'p', content: ["Judging a book by its cover is fine — if you've read a thousand books. That's the whole condition."] },
    ],
  },
  {
    id: "generation",
    heading: ["\"Every generation says this\""],
    nodes: [
      { kind: 'p', content: ["I know. Darkroom photographers said it about digital. Typesetters said it about desktop publishing. Print designers said it about Figma. Every one of them was wrong, and every one of them sounded like the last three paragraphs."] },
      { kind: 'p', content: ["So here's the difference, and it's the only thing this essay rests on."] },
      { kind: 'p', content: ["Those frictions were ", strong("mechanical"), ". The darkroom never taught anyone composition. Kerning by hand never taught anyone typography. Waiting for film to develop taught you patience and nothing else. Delete that overhead and you lose overhead — which is why those complaints aged into jokes."] },
      { kind: 'p', content: ["What got removed this time isn't overhead."] },
      { kind: 'p', content: ["Drawing ten interaction concepts by hand was not the tax on the thinking. ", strong("The drawing was the thinking."), " You found out what you thought about a flow by being made to commit it ten separate times, and eight of them were bad, and finding out ", em("why"), " they were bad in your own hand is where the judgment came from."] },
      { kind: 'p', content: ["You don't learn to cook by eating."] },
      { kind: 'rewritten', changeId: "taste", orig: ["AI moved designers from generating to selecting. Selection installs nothing. You can scroll past ten thousand options and arrive with exactly the taste you walked in with."], edit: ["AI moved designers from generating to selecting. You can scroll past ten thousand options and arrive with exactly the taste you walked in with. Art direction comes after the bad ones, not instead of them."] },
    ],
  },
  {
    id: "latency",
    heading: ["Latency was the curriculum"],
    nodes: [
      { kind: 'p', content: ["That's the whole thing."] },
      { kind: 'p', content: ["The delay wasn't only a signal you read off the world. ", strong("It was the curriculum."), " The slow years are where good-better-best got installed — the manual concepting, the room saying no, the six-month verdict finally coming back and confirming you'd been wrong the entire time in a way you would never forget."] },
      { kind: 'p', content: ["That's how I got an eye. Not because I suffered, and not because I'm better. Because I made ten, over and over, for years, when there was no other way to do it."] },
      { kind: 'p', content: ["And the tools I use now only work ", em("because"), " that already happened. They give me range. They have never once given me the judgment to pick from it. Nothing in the product does that. Nothing on the roadmap will."] },
      { kind: 'p', content: ["Someone starting today gets the range on day one and has to find the judgment somewhere else."] },
      { kind: 'p', content: ["I'm not going to tell you they can't. That's the flattering version — the one where I earned something unrepeatable and get to be quietly sad about it in public."] },
      { kind: 'p', className: "kicker", content: [strong("It's just much harder to get now, and nothing is going to make you go get it.")] },
      { kind: 'p', content: ["The path is still there. Generate before you select. Draw the bad ones. Sit in the interval when nothing is forcing you to. Find one person who will tell you no."] },
      { kind: 'p', content: ["But nothing in your environment will put you on that path. Nothing will tell you you're not on it. There's no red test, no failed build, no error at all. The work will ship, and it will look great, and it will feel incredible the entire time you are not building the thing that would have told you whether any of it was good."] },
      { kind: 'p', content: ["The wait was the tuition, and nobody's billing you."] },
      { kind: 'p', content: ["Go on. Pick the most finished one."] },
    ],
  },
]
