# Logline — design notes

A mobile-only game that gamifies daily reflection through flight.
"Logline" — a line logged through the day.

## Core visual identity

Two lines define the entire experience:

1. **The logged line** (behind you) — a permanent trail of everywhere
   you've been during this flight. It shrinks into perspective behind
   the craft, converging toward a vanishing point. This is the record.
   At the end of a session, a miniature of this line *is* the journal
   entry — a drawn shape of your day.

2. **The projected line** (ahead of you) — a dashed, fading line
   showing where you'll go if you keep your current heading. It
   updates constantly as you move. This is intention, direction,
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

The craft responds to thumb input through roll (banking on x-velocity)
and pitch (stretching on y-velocity), which creates the 3D read
without needing actual 3D rendering. A center spine line on the body
sells the depth.

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
   points ahead. At session end, the shape of the logged line is the
   visual signature of this day's entry.

2. **Track phase** (not built yet)
   Answers assemble into a procedural track. Precision-flying phase.
   Items/karma collected through flying skill, not answer content.
   - Max one track per day.
   - Stored tracks cap at ~7, then auto-merge into a week-flight.
   - Player can skip track and just keep the journal/logline.

3. **Village phase** (not built yet)
   Persistent home base. Core rules:
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

Around it: a journal of past flights held on the device, JSON export
and import, offline use, and home-screen install.

`prototypes/grading-phase.html` is the original self-contained
HTML/JS build. It is kept frozen as the feel reference; the port
carries its physics constants unchanged. Treat those constants as
starting tuning, not final — but change them in `src/`, not in the
prototype.

The logged line is stored normalised into the gate frame rather than
in screen pixels, so a record draws the same on any phone and a
rotation mid-flight can't warp the trail.

## Open questions

- Does the 2D matrix read as answering or just steering?
- Gate speed (~4s) tuned for calm — may bore repeat players.
- Track-phase generation rules undesigned.
- Village building list, recipes, and in-flight effects undesigned.
- How exactly does the projected line translate into todo/planning
  in the non-flight UI? The metaphor is clear; the UX is not
  designed yet.
