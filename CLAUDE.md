# Logline — working context for Claude Code

Read `docs/DESIGN.md` first — full design history, rejected ideas,
and why. Don't re-propose rejected ideas.

## Non-negotiables

- Mobile-only. Single-thumb portrait. No desktop layout.
- Grading phase is never scored. Points come only from track-phase
  flying precision — never from which answer a player picks.
- Grid answer options use even counts (4, not 3 or 5). No neutral
  middle.
- Edge answers: visually distinctive, never worth more than middle.
  Same item drop rate and count at every position.
- No village decay. Answers only unlock or add atmosphere.
- No therapy/treatment/diagnosis language anywhere — code comments,
  commit messages, UI strings, store copy. Use "reflection,"
  "journal," "self-awareness."
- On-device storage default for journal/answer data.

## Core visual concept

Two lines define the product:
- **Logged line** (behind the craft) — permanent trail, the record.
  Converges toward vanishing point. At session end, its shape IS the
  journal entry.
- **Projected line** (ahead of the craft) — dashed, updating, shows
  trajectory from current velocity. This becomes the todo/planning
  metaphor outside the flight.

The craft is deliberately spatially ambiguous — no horizon, no ground.
Stars only. Could be falling or gliding. 3D feel comes from roll
(x-velocity) and pitch (y-velocity) deforming a diamond shape.

## Current state

The grading phase runs as an installable web app in `src/`. It is a
faithful port of the prototype: the physics constants in
`src/lib/game/flight.ts` are the prototype's, unchanged. Also built:
the journal (past flights, on-device), export/import, offline, and
home-screen install.

`prototypes/grading-phase.html` stays as the feel reference. It is
frozen — fix the port, not the prototype, and don't let the two drift
without saying so.

Track phase and village phase are still unbuilt and still undesigned.

## Stack

Vite + TypeScript, Svelte for the screens outside the flight, static
deploy to GitHub Pages. Decided in `docs/adr/0001-web-stack.md` —
read it before proposing a change, it lists what was rejected and why.

Two rules that come out of it:

- **The flight engine imports nothing from Svelte.** `src/lib/game/`
  is a plain class taking a canvas and callbacks. Keep it that way;
  it's what makes a later native or engine move cheap.
- **Storage stays behind `src/lib/storage/`.** No component touches
  IndexedDB directly. Opt-in sync, if it ever exists, is another
  driver behind that interface — not a rewrite.

## Don't silently resolve

Track-phase generation and village mechanics are intentionally
undesigned. Propose options and ask — don't invent full systems.

The same applies to the planner. `docs/DESIGN.md` says the projected
line becomes the todo/planning half of the app, and that the metaphor
is clear but the UX is not designed. It is deliberately not built —
there is no planner screen. Don't invent one.

## Platform facts worth remembering

- iOS Safari has no vibration API. `navigator.vibrate` is a no-op on
  iPhone, so haptics are Android-only on the web.
- iOS evicts site data for pages not installed to the home screen.
  This is why install prompting and JSON export exist, and why they
  are not optional polish.
