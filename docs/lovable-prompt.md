# Taking Logline to Lovable

What to paste, in what order, and what to refuse to let it do.

## Read this first

Lovable builds **React + Vite + Tailwind + shadcn/ui**, and it reaches
for **Supabase** the moment anything looks like data. This app is
**Svelte**, and its whole storage promise is that answers never leave
the phone. So the move is not "open the repo in Lovable" — it is:

- **The flight engine goes across unchanged.** `src/lib/game/` is
  plain TypeScript classes over a `<canvas>` and a handful of
  callbacks. It imports nothing from Svelte, which was decided in
  `docs/adr/0001-web-stack.md` precisely so this kind of move would be
  cheap. `Flight`, `craft.ts`, `artwork.ts`, `piece.ts`, `hues.ts`,
  `palette.ts`, `preview.ts` are copy-paste jobs. A React component
  that owns a ref, news up `Flight` in an effect and calls
  `destroy()` on cleanup is the entire integration.
- **The screens get rebuilt.** Home, journal, collection, workshop,
  summary. That is where Lovable is fast and where iterating on look
  is actually pleasant.
- **The storage layer goes across unchanged too,** and Lovable must be
  told not to replace it. `src/lib/storage/` is IndexedDB behind an
  interface. See the hard rules below.

One expectation to set: **Lovable will not improve the canvas
graphics for you.** It is a UI builder; the flight is 1,700 lines of
hand-written 2D projection. What it buys is a faster loop on
everything *around* the flight, and a codebase in the stack most
AI tooling is best at. Graphics work on the flight itself stays
hand-written — in Lovable, in Claude Code, or wherever — which is
fine, because it is already isolated behind one folder.

## Step 1 — the project knowledge

Paste this into **Project Settings → Knowledge** before the first
prompt. Lovable re-reads it on every generation; anything only said in
chat gets forgotten and then quietly violated.

```
PRODUCT: Logline — a mobile game that turns a daily check-in into a
flight. You fly through eight question-gates; the line you leave
behind IS the journal entry for that day.

HARD RULES. Breaking any of these breaks the product, not just the
style guide. Do not "improve" past them.

1. MOBILE ONLY. Single-thumb portrait. Never generate a desktop
   layout, a sidebar, a top nav bar, or a responsive breakpoint above
   640px. Desktop shows a "open this on your phone" card and nothing
   else.
2. NOTHING IS SCORED. There are no points, no ranks, no "great job",
   no streak bonus that depends on WHICH answer was given. Credits are
   paid per gate met and per day of streak, and the award function is
   deliberately never passed the answers. Never add a leaderboard,
   an XP bar, a grade, a percentage, or a "you improved" message.
3. A QUESTION CAN BE LEFT UNANSWERED by flying over the gate, and
   doing that pays exactly what answering pays. Never charge for a
   skip, never hide a skipped question from the summary, never nudge
   the player to go back and answer it.
4. UPGRADES ARE APPEARANCE ONLY. Hulls, gate frames, skies, papers.
   Nothing bought may make a gate easier to hit or pay more.
5. ANSWER OPTIONS COME IN EVEN COUNTS (4, never 3 or 5). No neutral
   middle option. Edge options are visually distinctive but never
   worth more, and drop the same number of items as middle ones.
6. NO THERAPY, TREATMENT, DIAGNOSIS OR MENTAL-HEALTH-CONDITION
   LANGUAGE anywhere — UI copy, code comments, variable names, store
   text. This is a regulatory line (EU MDR), not a preference. Say
   "reflection", "journal", "self-awareness", "noticing". Never
   "therapy", "symptoms", "assessment", "score", "wellness score",
   "mood tracking for anxiety", or similar.
7. ON-DEVICE STORAGE ONLY. Do NOT add Supabase. Do NOT add auth, a
   login screen, accounts, cloud sync, or a backend of any kind. All
   journal data lives in IndexedDB behind src/lib/storage/. If you
   think a feature needs a server, say so and stop — do not scaffold
   one.
8. DO NOT TOUCH src/lib/game/. That folder is the flight engine:
   framework-free TypeScript over a canvas. It must never import
   React, a hook, a context, or a UI library. React talks to it only
   by newing up the class with a canvas element and callbacks.
9. NO PLANNER / TODO SCREEN. The design calls for one eventually and
   it is deliberately not designed yet. Do not invent one.

VISUAL LANGUAGE:
Deep space, no horizon and no ground — the craft could be falling or
gliding and that ambiguity is the point. Never add a ground plane, a
sky gradient with an up, or a horizon line. Palette: near-black void
(#050810), teal and ice (#2d6b7a, #a8d5d8), a warm lamp accent
(#e8b87a), muted violet (#7b6b9a). Type is large — read at arm's
length, one-handed. Generous tap targets. Motion is calm: nothing
bounces, nothing celebrates.
```

## Step 2 — the first build prompt

```
Build the shell of a mobile-only PWA called Logline, in React +
TypeScript + Vite + Tailwind. Portrait, single-thumb, no desktop
layout. Follow the project knowledge exactly.

Screens, as a single-page app with no router visible to the user:

1. INTRO — near-black, a single line of copy, one large "Begin" button
   low on the screen where a thumb rests. Requests fullscreen on tap.
2. FLIGHT — a full-bleed <canvas> and nothing else but two pieces of
   text: the current question near the top and a one-line hint near
   the bottom. I will drop the engine into this myself; for now stub
   it as a class with start()/destroy() and onQuestion/onComplete
   callbacks.
3. SUMMARY — the eight questions with what was answered, one per row.
   Questions left open show in italics and say "left open", with no
   suggestion that was the wrong move.
4. JOURNAL — past flights, newest first, each a small drawn line and a
   date. Tapping one opens that day.
5. COLLECTION — a day streak, a credit balance, a per-question trend
   over the last fortnight, and a tally of materials gathered. The
   trends plot the answer index as-is: no day is ranked, nothing is
   labelled good or bad.
6. WORKSHOP — appearance-only upgrades in four categories (hull,
   frames, sky, paper), one equipped per category, each priced in
   credits and pictured by a small <canvas> the engine draws into.

Navigation is a bottom row of three large icons — fly, journal,
collection — reachable with one thumb.

Storage: IndexedDB only, behind a src/lib/storage/ module with a
narrow interface (listEntries, saveEntry, deleteEntry, exportAll,
importAll, loadProfile, saveProfile). No component touches IndexedDB
directly. No Supabase, no auth, no network.

Also set up: vite-plugin-pwa for offline and home-screen install, a
JSON export and import screen, and a visible install hint on iOS —
iOS evicts site data for pages that aren't installed to the home
screen, so export and install are load-bearing, not polish.

Handle the visual viewport properly: a mobile URL bar covers a
position:fixed inset:0 layout. Publish window.visualViewport height,
offsetTop and safe-area inset as CSS variables and lay everything out
against those, not against 100vh.
```

## Step 3 — dropping the engine in

```
I'm adding a framework-free canvas engine. Create
src/lib/game/ and treat it as off-limits to refactoring: it must never
import React or anything from the UI. Wire it up like this and nothing
more:

const ref = useRef<HTMLCanvasElement>(null);
useEffect(() => {
  const flight = new Flight(ref.current!, {
    onQuestion: setQuestion,
    onComplete: (result) => { save(result); goToSummary(result); },
    onHold: setHolding,
    onTip: setTip
  }, { teach: isFirstFlight });
  flight.start();
  return () => flight.destroy();
}, []);

The canvas sizes itself from the visual viewport and handles its own
pointer events — do not add touch handlers, do not add a resize
observer, do not wrap it in a gesture library.
```

Then paste in the files from this repo unchanged: `flight.ts`,
`craft.ts`, `palette.ts`, `hues.ts`, `questions.ts`, `types.ts`,
`stats.ts`, `artwork.ts`, `piece.ts`, `pieceStyle.ts`, `miniature.ts`,
`preview.ts`, and `viewport.ts`.

## Step 4 — the graphics work, one prompt at a time

These are the four that are already done in this repo, written as
prompts so you can carry them forward or push them further. Ask for
**one at a time** — a prompt that asks for four visual changes at once
comes back as four half-changes.

**Flight feel**

```
The steering model lives in steerStep() in src/lib/game/flight.ts and
is the only copy of it — updateAim() calls the same function, so the
aim reticle can never promise a cell the physics would not reach.
Keep that property.

It is two springs on fixed 1/180s sub-steps: roll is the quick axis
(stiffer, lightly damped, rocks once as it settles), pitch is the
heavy one (softer, nearly critically damped, arrives without a
bounce). Attitude leans partly off the steering error rather than off
velocity alone, so the craft banks on the frame the thumb asks for a
turn instead of a frame or two later.

Tune it further without breaking those: never integrate at the frame
rate, never let the aim use different constants, never let the craft
reach a cell the sim says it cannot.
```

**The aim beam**

```
The projected line is a beam, drawn as one continuous path in three
passes — a wide soft sheath, a thin bright core, and a train of short
dashes travelling along it toward the gate — composited with
'lighter'. The sight on the end of it tightens and turns as the gate
closes and throws a ring when the aim changes cell.

Two rules. The beam draws BEFORE the craft and the sight AFTER it: a
beam has to leave from under the hull, and the sight has to stay
readable when the aim point is nearly on top of the craft. And the
sight is the same colour wherever it lands — it says "here", never
"better". Never make one cell's reticle prettier than another's.
```

**The air**

```
Speed cues only, carrying no meaning. Stars draw as the short line
between where they are and where they were a moment ago, so opening
the throttle stretches the whole sky. Each of the four wingtips sheds
a thin vortex, thrown to the outside of a turn, spent within a second.

Keep both thin. The exhaust was already cut back once for smearing
light across the gate behind it. Skip both entirely under
prefers-reduced-motion.
```

**The craft**

```
The hull is a folded paper biplane: a creased dart of a body, two long
wings braced apart by cabane and interplane struts, a fin and a
tailplane. Every surface is a flat facet with a crease and a hard
edge — folded, never moulded. Nothing curved.

Both wings are sprung hinges driven by lift, roll rate and throttle;
the upper is braced and travels about seven tenths of the lower, so
the pair shears as the craft rolls. That shear is the point of the
second wing: one wing said very little about which way it was banking
until the bank was large.

Export CRAFT_SPAN and CRAFT_LENGTH and fit every preview from those,
never a hardcoded size. The workshop's thumbnails run this same
function — a shop is a promise about how the flight will look, and
running the same code is the only way to keep it honest.
```

## Step 5 — what to keep refusing

Lovable will offer these unprompted. All of them are wrong here:

- **"Add Supabase so users can sync across devices."** No. On-device
  is the marketing line and the privacy promise.
- **"Add a score / streak multiplier / achievement."** No. Anything a
  player earns that depends on *which* answer they gave teaches
  answering for points and rots the journal.
- **"Make the rare answers drop rarer materials."** Same failure, one
  step further along. Yields stay symmetric: one item per cell,
  every cell.
- **"Add a desktop layout."** No. There is one.
- **"Charge a small credit cost for skipping a question."** Absolutely
  not — see hard rule 3. The cheapest way to be paid must never be
  answering on a day the honest reply was "I'd rather not say".
- **"Add a planner / todo screen for the projected line."** Not yet
  designed. Deliberately absent.
- **"Refactor the canvas code into React components."** That folder is
  framework-free on purpose, so a later native or engine move stays
  cheap.

## What not to move

`prototypes/grading-phase.html` stays here and stays frozen. It is the
original feel reference. Every place the app deliberately differs from
it is listed in `docs/DESIGN.md` under "Divergences from the
prototype"; if a change in Lovable adds another, add it to that list
too, or the two quietly drift and neither is the reference any more.
