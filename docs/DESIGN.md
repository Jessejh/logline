# Logline — design notes

A mobile-only game that gamifies daily reflection through flight.
"Logline" — a line logged through the day.

## Core visual identity

Two lines define the entire experience:

1. **The logged line** (behind you) — a permanent trail of everywhere
   you've been during this flight. From the cockpit it leaves the tail
   and drops away beneath you; in the rear-view mirror it converges
   toward a vanishing point. This is the record. At the end of a
   session, a miniature of this line *is* the journal entry — a drawn
   shape of your day — and the whole line can be turned in 3D.

2. **The projected line** (ahead of you) — a dashed, fading line
   showing where you'll go if you keep your current heading, ending
   in a reticle on the cell of the next gate you are on course for.
   It updates constantly as you move. This is intention, direction,
   plan — the todo-list half of the app expressed as physics. The
   moment you change course, the projection shifts with you.

The relationship between these two lines is the whole product: where
you came from and where you're pointing.

## The craft

The craft is deliberately spatially ambiguous — a diamond/faceted shape
that could be dropping down through depth or gliding horizontally. No
horizon, no ground plane, no sky: it's space. Stars stream past. This
removes the "flight sim" expectation and makes the movement feel
contemplative rather than vehicular.

The craft responds to thumb input through roll (banking on x-velocity),
pitch (on y-velocity) and a little yaw, applied to a tiny 3D mesh: a
diamond body, a fin, and two wings hinged at the root that flex with
lift, roll rate and power. Seen from above and behind. A center spine
line on the body sells the depth.

The thumb is also the throttle. The craft flies forward only while
the thumb is down; lift it and everything holds still, so there is
always time to read a question before answering it. Once the last
gate is passed the craft glides out on its own.

## The loop, top to bottom

1. **Grading phase** (built — see `src/`, and the frozen feel
   reference at `/prototypes/grading-phase.html`)
   First-person flight through question-gates. Single thumb drag.
   8 questions: meta/orienting first, then per-domain (sleep, energy,
   connection, attention, body, stillness).

   Gates are 1D (4-wide strip) or 2D (4×4 matrix, thumb x/y both
   answer). **No neutral middle** — even-numbered columns.

   **Edges are not worth more.** Every cell yields exactly one item.
   Edge cells differ in flavor/rarity-of-name/visual distinctiveness —
   never quantity. This is load-bearing: if edges paid more, players
   would learn to answer for points, and the journal data rots.

   Each gate passed drops one named material, shown in a popup.

   The logged line draws behind you as you fly. The projected line
   points ahead and lights the cell it will land in. A rear-view
   mirror at the top of the screen shows the line and the passed
   gates receding, each with its chosen cell lit. At session end, the
   shape of the logged line is the visual signature of this day's
   entry, first shown as a 3D piece — the line threaded through the
   eight frames — that can be turned with a thumb.

2. **Track phase** (not built yet)
   Answers assemble into a procedural track. Precision-flying phase.
   Items/karma collected through flying skill, not answer content.
   - Max one track per day.
   - Stored tracks cap at ~7, then auto-merge into a week-flight.
   - Player can skip track and just keep the journal/logline.

3. **Collection and workshop** (built)
   Where the gathered material goes, and what showing up buys.
   See "The collection pipeline" below. Every item in the workshop
   is pictured by the flight's own renderers — the hull mesh, a gate
   with its wall lit, the sky's wash and stars — rather than by a
   swatch or a drawn illustration. A shop is a promise about how the
   flight will look, and the only way to keep that promise honest as
   the flight changes is for both to run the same code.

The village phase that used to sit at position 3 is parked — see
"Parked: the village".

## App structure beyond the game loop

The app has two faces for the user, expressed through the line metaphor:

- **Logline** (the journal/reflection) — the logged line from each
  day, stored, browsable. Each day's entry is the visual shape of
  the line plus the answer breakdown plus gathered materials.
  
- **Projected line** (the todo/plan) — future-facing. In aviation
  terms, this is the flight plan / preflight checklist. Tasks,
  intentions, things to do. In the game, the projected line is
  always visible and always updating — your plans shift as you move.

These aren't separate screens bolted together; they're the same two
lines that exist during flight, just viewed from outside the cockpit.

## The collection pipeline

Every gate drops exactly one named material, and always has. What
was missing was anywhere for it to go: materials were visible only
inside the entry that produced them, so eight a day accumulated
into nothing you could look at. Three pieces close that.

**Credits come from gates.** A completed flight pays
`gates × rate`, where the rate rises with the streak — three per
gate on day one, climbing by one per consecutive day to a cap of
eight. Eight gates a flight makes a day worth 24 to 64.

The rule that matters is what the award *cannot* see. It is handed
a gate count, never the answers, so it is impossible for one
opening to pay more than another. This is not a stylistic
preference: it is the only reason the journal stays honest, and it
is enforced in `lib/progress/credits.ts`, which has no access to a
cell index at all. The old track phase was to be the source of
points; with it unbuilt, "showing up" is the source instead, which
suits daily tracking better than precision would have.

**One paying flight a day.** The first flight of a local day pays;
later ones are recorded in full but earn nothing. Flying twice is
never blocked — some days want a second look — it just cannot be
farmed. The streak reads off the journal rather than a counter, so
importing a backup restores the streak it actually earned.

**Credits buy appearance only.** Hulls, gate frames and skies, one
equipped per category, stacking. Nothing is scored, so there is no
performance for an upgrade to improve; an upgrade that made a gate
easier to hit would be inventing a difficulty the grading phase
does not have. This carries the village's rule forward: unlocks and
atmosphere, never advantage.

**Reading the accumulation.** The collection screen shows the
streak, the balance, a per-question trend across the last fortnight,
and a running tally of every material gathered. The trends plot the
column index as it is — no day is ranked, nothing is called good.
It is a shape to notice, not a score to beat.

The balance lives in its own store rather than being recomputed
from the journal, so deleting an entry does not confiscate what it
earned. Pruning the journal has to stay safe.

## The piece

The record drawn flat, with the depth thrown away. Two layers, two
meanings: **the ground is what you answered, the line is how you
moved.**

The 3D object threads the line through eight frames, which reads the
*answers* well but needs turning before "did I wander today" is
visible at all. Dropping z makes that the first thing you see — a
short mark, or a tangle. The object is still there behind a toggle;
it is the better reading of the answers, and the flat piece is the
better reading of the flying.

### The rule this has to keep

**Neither end of any scale is the better one.** A flight taken in one
straight breath and a flight that wandered everywhere have to be two
kinds of good picture. The moment calm looks like failure, the app has
begun scoring the grading phase, and someone who wants a nicer picture
will fly for it — which bends the answers underneath. So movement does
not add beauty here, it changes school: sparse and formal, or dense
and layered, and both are finished.

The first build got this wrong and is worth recording. Drawn at a
fixed scale with the blooms placed where the craft was, a flight that
held its line came out as a ten-pixel dash in a brown smudge — all
eight blooms stacked on one spot and mixed to mud. That reads as
*nothing happened*, not as restraint. Two fixes:

- **The mark always fills its frame.** The record's own bounds are
  fitted to the plate, capped at 7× so a motionless flight is not
  blown up into a portrait of its own noise. A straight flight
  arrives as one large confident stroke. How far the craft actually
  ranged is still legible — it is carried by the *shape* of the mark
  and by the ground, which is where it belongs, rather than by the
  mark being too small to see.
- **The blooms compose when there is nothing to follow.** Placement
  slides from the flown position toward a formal ring as movement
  falls away. Where there is a shape, follow it; where there is none,
  compose. Restraint comes out ordered rather than empty.

The same discipline covers the palette: four hues, one per column,
picked at about equal lightness and chroma so no cell is a prettier
cell to land in.

### What drives what

- **Hue** — the column taken at each gate. Eight blooms, multiplied
  into the paper like pigment rather than laid on it as chalk, and
  clipped to the plate so the result reads as something printed.
- **Chroma and paper tone** — how much of the flight was spent
  hovering. A day that kept stopping warms the paper and brings the
  colour up; one taken in a single breath stays cool and graphic.
  The floor is high: never stopping is a different temper, not a
  washed-out version of the same one.
- **Ink weight** — sideways speed. Slow is a wide soft deposit, fast
  a drier trace. The range is deliberately narrow: speed is
  normalised inside each flight, so a busy day reads as fast
  everywhere, and letting that thin the whole mark would make the
  liveliest days the faintest pictures.
- **Colour along the line** — speed again. A quick pull drags the
  mark apart into a coloured fringe, the way it separates pigment.
  It rides the speed of the hand, never the answer taken.
- **Density** — nothing computes it. Points are laid down at equal
  intervals of *forward* travel, so holding the craft still sideways
  piles many of them on one spot; drawing every segment at low alpha
  lets the mark go dark exactly where the flight settled. Runs of
  similar speed are stroked as one path, because segment-by-segment
  strokes bead at every joint into a string of pearls.
- **Pauses** — a ring where the thumb came off, sized by how long.

### The clock

`LinePoint` carries `t`, seconds since the flight began, and
`ENTRY_VERSION` is 2. The record only grows while the craft moves, so
a pause writes no point at all — which meant a long hesitation and no
hesitation produced identical records. With a clock on each point a
pause is a large gap in `t` across a tiny gap in `z`.

Two things fall out of it worth knowing. `t` accumulates the frame
delta the flight already clamps, so a stalled tab cannot fake a
pause. And what is measured is time actually *stopped*, not
thumb-off wall clock — the throttle coasts down over about a second,
during which the craft is still moving and still logging. The honest
reading, and shorter than the raw gap.

`compressLine` keeps every point either side of a pause regardless of
its stride. Thinning is blind to the clock, so a plain every-Nth pass
would drop one side of a gap and take the pause with it — and pauses
are the sparsest thing in the record.

Flight statistics (`lib/game/stats.ts`) are computed on the
full-resolution line inside `makeEntry` and stored on the entry,
because compression flattens exactly the small corrections they
measure. Entries written before version 2 have neither clock nor
stats; `statsFor` recomputes what it can from the stored line and
those pieces simply have no pause rings.

## Parked: the village

Not cancelled, not being built. Kept here because the reasoning is
load-bearing elsewhere.

- **Answers unlock, never remove.** No decay.
- Every answer deposits domain resources (sleep, connection,
  energy, focus, stillness). Low-scale → **raw** materials
  (rough stone, unfired clay). High-scale → **refined** (polished
  timber, glass). Different buildings need different mixes, so
  good weeks and hard weeks each build things the other can't.
- Village suggests buildings in its own voice, not as advice.
- Buildings have in-flight mechanical effects (Lighthouse extends
  gate preview, Kiln stabilizes glide, etc.).
- Mood shows as **atmosphere** — fog, long shadows, lit windows
  on low stretches; light returns when things lift. Arguably
  prettier, not broken.

The symmetric-mix idea in the second bullet is the thing worth
keeping: it is how the village would have made a hard week and a
good week equally productive. Credits reach the same end by a
blunter route — paying per gate, so the question never arises. If
anything ever spends *specific* materials rather than credits, that
bullet is the design to return to, because recipes that want one
material more than another are exactly how answer-farming starts.

Note also that the buildings' in-flight effects would break the
current rule that upgrades are cosmetic. Un-parking the village
means reopening that, not assuming it.

## Resource-farming risk

If raw materials feel scarcer or more interesting, players start
answering dishonestly. Yields must stay symmetric. Check in soft
launch: watch answer-distribution drift over a user's first month.

## Rejected ideas

- **Village decay from bad answers** — punishes honesty when it
  matters most. Replaced with atmosphere-only.
- **Higher points for edges** — teaches score-optimized answers,
  corrupts data. Replaced with flavor-not-value edges.
- **5-wide (odd) scale** — removed neutral middle with even counts.
- **"Nightflight" as name** — undersold the product, sounded like
  a flight sim. "Logline" captures both the drawn line and the
  screenwriting meaning (a one-sentence summary of a story — which
  is what each day's flight becomes).

## Constraints

- **Mobile only.** Single-thumb portrait. No desktop.
- **No therapy/treatment/diagnosis language** — EU MDR risk. Use
  "reflection," "journal," "self-awareness."
- **On-device storage default** for all answer/journal data. Sync
  as explicit opt-in. Marketing line: "your answers never leave
  your phone."
- Based in Finland. Business Finland, Neogames Finland, University
  of Helsinki collaboration are potential funding/validation angles.

## What exists right now

The grading phase, as an installable web app — Vite, TypeScript and
Svelte, deployed to GitHub Pages, no backend. See
`docs/adr/0001-web-stack.md` for why that stack.

Canvas rendering with perspective projection (not real 3D). The
logged line (permanent trail converging to a vanishing point), the
projected line (dashed trajectory from current velocity), the
3D-ambiguous craft with roll/pitch, starfield, 8 questions across 1D
and 2D gates, item pickups, and the summary where the logged line
becomes the entry.

Around it: a journal of past flights held on the device, the
collection screen and workshop described above, JSON export and
import (which carries the credit balance and bought skins too),
offline use, and home-screen install.

`prototypes/grading-phase.html` is the original self-contained
HTML/JS build. It is kept frozen as the feel reference; the port
carries its steering constants unchanged. Treat those constants as
starting tuning, not final — but change them in `src/`, not in the
prototype.

### Divergences from the prototype

The port has moved past the prototype in these ways. Each is a
deliberate change, not drift:

- **Hold to fly.** The prototype flew forward on its own, which left
  hardly any time to think. Now forward motion needs the thumb down;
  lifting it pauses the flight. The record only grows while moving,
  so a pause leaves no mark. After the last gate the craft glides out
  by itself so the flight always completes.
- **The aim is shown.** The steering is simulated ahead to the next
  gate, the cell it lands in is lit (same colour at every position —
  it says "here", never "better"), the 1D label under it brightens,
  and 2D gates name the aimed cell. The projected line follows that
  simulated path and ends in a reticle on the gate.
- **The trail is behind the craft.** The prototype's logged line
  converged to the same vanishing point as the gates, so it read as
  going ahead. It now sweeps down and off the bottom of the screen
  from a camera above and behind the craft.
- **A rear-view mirror.** Hangs from the top edge, mirrored
  left-to-right. Shows the whole trail converging to its vanishing
  point and the passed gates receding with their chosen cell lit.
- **A winged craft.** A small 3D mesh replaces the flat diamond.
  Wings are stiff hinges driven by lift, roll rate and throttle, with
  a hard-edged flame at the tail while there is power on. The soft
  plume it used to trail read as a smear of light under the craft
  rather than as thrust, and at the size the craft is drawn now it
  covered the gate behind it.
- **Gates are walls, not openings.** Filaments of light strung across
  the whole frame, so passing a gate is going *through* something.
  The wall is identical in every cell — it is the one part of a gate
  that must never suggest one answer is worth more than another.
  Closing on it, the spot the current heading will touch lights up;
  crossing it punches a hole, and the wall dissolves rather than
  being cut, throwing shards and a shockwave off the puncture.

  Where the crossing counts is load-bearing. `proj` puts a gate at
  scale 1 when it reaches the camera instead of blowing it up, so at
  distance 0 the wall is still a frame drawn on the screen ahead of
  you — answering there fired the punch while the wall was plainly
  still in front of the craft. The answer is taken at the depth where
  the gate's projected width reaches the screen width, which is what
  the eye reads as going through, and the wall holds full strength
  until then rather than fading on approach. The aim reticle predicts
  the craft's position at that same depth, so the cell it lights is
  the cell that gets recorded.
  Answering is the moment the flight makes the most noise about,
  which is the right place for it: it is the only moment that
  records anything.
- **The artwork.** After the flight, before the summary, the record
  becomes a piece — flat by default, with the turnable 3D object one
  tap away. See "The piece" below. Reachable again from the summary
  and from any journal entry.
- **The camera follows the craft.** The prototype bolted the view to
  the middle of the gate frame: the craft slid across a world that
  never moved, which reads as a cursor over a picture rather than
  something flying through it. The camera now takes two thirds of the
  craft's position and lags behind it, so the gates, stars and trail
  shift with you and a swerve throws the craft off-centre before the
  view gathers it back in. Two thirds rather than all of it, because
  a locked camera swings the whole gate off the side of a phone at
  full deflection — and reading the options you are choosing between
  is the point of that screen.
- **Steering is relative, not absolute.** The prototype set the
  craft's target straight to the touch point, so putting a thumb down
  anywhere but on the craft threw it across the screen — press near
  the top edge and it warped up there. Now a touch anchors: pressing
  changes nothing, and the craft turns only as far as the thumb
  travels from where it went down, at a gain of 1.35 so a comfortable
  arc still covers the whole grid. Overshoot past an edge is folded
  back into the anchor, so the craft picks the thumb up again the
  moment it turns around. This also drops the prototype's `LIFT`
  offset, which only existed to keep the craft out from under the
  thumb it was pinned to.
- **A much larger craft.** Drawn at 3.4×. The prototype's size reads
  as a speck at arm's length, and a speck wastes the animation that
  is already there — each wing is a sprung hinge driven by lift, roll
  rate and throttle, the body banks and pitches off velocity, and it
  bobs while hovering. At the old size all of that was a few pixels
  of flicker; the point of the number is being able to watch it. The
  ceiling is the label row along the bottom of a gate, not the gate
  itself — the answer is read off the lit cell, the reticle and that
  row, so a craft wide enough to cross two cells costs nothing until
  it starts covering the words.
  About two cells wide at a full-size gate, which is wide, but the
  answer is read off the lit cell and the reticle rather than the
  silhouette. The exhaust plume is deliberately *not* scaled in step:
  proportional growth turned it into a warm smear across the gate
  behind, and the shape of the craft is the thing worth looking at.
- **Type sized for arm's length.** The question, the hint, the cell
  labels and the screens outside the flight all went up several
  points. 1D cell labels take the larger size only as far as the cell
  can hold it — measured per gate, so a distant gate shrinks them
  rather than letting the row collide.

### Owning the screen

A browser's URL bar is not part of the page but it covers it, and
`position: fixed; inset: 0` sizes to the layout viewport, which
ignores it — so the question and the mirror sat underneath it.
`src/lib/viewport.ts` publishes the *visual* viewport as CSS variables
(`--app-h`, `--app-top`, `--app-inset`) that the canvases and the
screens lay out against, and asks for real fullscreen on the Begin tap,
which is the one user gesture available to spend on it.

Fullscreen is Android-only in practice, alongside the vibration API:
iOS Safari exposes `webkitRequestFullscreen` on video elements only,
never on the document, so there is no way to dismiss the bar from
script on an iPhone. Installing to the home screen remains the iOS
answer, which is one more reason the install hint and JSON export are
not optional polish.

The logged line is stored normalised into the gate frame rather than
in screen pixels, so a record draws the same on any phone and a
rotation mid-flight can't warp the trail.

## Open questions

- Does the 2D matrix read as answering or just steering?
- Gate speed (~4s of flying per gate) tuned for calm — may bore
  repeat players. Hold-to-fly makes the pace the player's, which may
  be enough; watch whether people just hold the whole way through.
- Track-phase generation rules undesigned.
- Village is parked, not designed — see "Parked: the village".
- How exactly does the projected line translate into todo/planning
  in the non-flight UI? The metaphor is clear; the UX is not
  designed yet.
- **Does a different vehicle break the core visual concept?** A
  submarine has been raised, and it is a bigger change than a
  reskin. The whole spatial read depends on there being no horizon
  and no ground — "could be falling or gliding" is the point.
  Underwater supplies a surface above and a seabed below, which is
  exactly the up and down the design removes. Worth doing only with
  an answer to what replaces the ambiguity, so a vehicle is
  deliberately not in the workshop yet. The skin system would carry
  one the moment that is settled.
- Are the upgrade prices right? 24–64 credits a day against a 60–260
  catalogue is a guess, made before anyone has lived a week of it.
- The trends plot the day's *first* flight, matching the flight that
  pays. If someone routinely flies twice, the second is invisible on
  the chart — is that the right reading of the day?
