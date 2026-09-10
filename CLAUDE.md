# Logline — working context for Claude Code

Read `docs/DESIGN.md` first — full design history, rejected ideas,
and why. Don't re-propose rejected ideas.

## Non-negotiables

- Mobile-only. Single-thumb portrait. No desktop layout.
- Grading phase is never scored. Nothing a player earns may depend
  on which answer they pick — not credits, not items, not anything
  added later. Credits are paid per gate **met** and per day streak,
  and the award function is deliberately never given the answers.
- A question can be left open by flying over the gate, and doing so
  pays exactly what answering pays. Charge for a skip and the
  cheapest way to be paid becomes answering something on the day the
  honest reply was "I would rather not say".
- Upgrades are appearance only. Nothing is scored, so nothing may
  buy an advantage.
- Grid answer options use even counts (4, not 3 or 5). No neutral
  middle.
- Edge answers: visually distinctive, never worth more than middle.
  Same yield at every position.
- A gate never shows what colour a cell holds before it has been
  flown through. A colour you can see coming is a colour you can
  steer for, which bends the answer underneath.
- No encoding anywhere may say one end of a scale is the better end.
  Never red-to-green. The journal's scale ramp is one hue rising in
  lightness, and both ends are always labelled in the question's own
  words — see "The ramp, and why it is not red-to-green".
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

A question can be flown over: the craft can be steered above the top
edge of a gate, and a gate met that way is recorded as left open
rather than answered. `Answer` carries its `gate` index so a sparse
record still lines up against the eight questions, and `FlightResult`
carries `gates` — what the flight is paid for. The first flight runs
a short tutorial (`teach` on `FlightView`), ending in a scripted beat
where the world stops for four seconds, the view closes in, and an
arrow is drawn over a gate.

The grading phase runs as an installable web app in `src/`. It began
as a faithful port of the prototype and the steering constants in
`src/lib/game/flight.ts` are still the prototype's, unchanged. On top
of that: hold-to-fly (the thumb is the throttle), the aimed cell lit
on the next gate, gates as walls of light that are punched through
rather than passed, the trail drawn behind the craft, a rear-view
mirror, a 3D craft with hinged wings (`src/lib/game/craft.ts`, shared
with the workshop's previews). Also built: the journal, export/import,
offline, and home-screen install.

The journal is a **calendar**, not a list: one weekday grid per
question, a month at a time, each day painted by where that day's
first flight sat on that question's scale (`src/lib/progress/scale.ts`,
`Calendar.svelte`). A day flown over is an outlined empty cell; a day
not flown is a quiet date. Tapping a day opens it in place with its
piece and delete.

Gates give up **colours**, not materials — materials are gone
entirely. Each cell holds one of thirty-two named colours, all solved
to L* 85 / C* 21.5 so none is prettier to land in and the ink reads
the same over every one. A gate shows nothing on approach; going
through it turns the frame, the shards and the cell taken that
colour, and pops its name where the material name used to.

After each flight the record becomes a piece: the line drawn flat on
paper over one band per question, laid in the order the gates were
met and painted in the colour each gave up — a question flown over
leaves its band bare. Bands run across the mark's long axis. The ink
is weighted by how fast the craft was moved, with a ring wherever the
thumb came off. There is no 3D view of the flight any more.
`docs/DESIGN.md` has a section on all of it — read "The rule this has
to keep" before changing anything there, because a straight flight
and a wandering one must stay two kinds of good picture, never a
better and a worse one. `LinePoint` carries a clock and
`ENTRY_VERSION` is 3.

The collection pipeline is closed. Gates pay credits, the streak
raises the per-gate rate, the first flight of a local day is the one
that pays, and credits buy appearance-only upgrades (hull, frames,
sky) in the workshop. The collection screen shows the streak, the
balance, and a per-question trend over the last fortnight. Rules live
in `src/lib/progress/`, persistence in
`src/lib/storage/profile.ts`.

`prototypes/grading-phase.html` stays as the feel reference. It is
frozen — fix the port, not the prototype, and don't let the two drift
without saying so. Every place the port deliberately differs is
listed in `docs/DESIGN.md` under "Divergences from the prototype";
add to that list when you add another.

Track phase is still unbuilt and still undesigned. The village is
parked — `docs/DESIGN.md` keeps it under "Parked: the village"
because its symmetric-yield reasoning still applies. Don't build it
back without asking.

## Stack

Vite + TypeScript, Svelte for the screens outside the flight, static
deploy to GitHub Pages. Decided in `docs/adr/0001-web-stack.md` —
read it before proposing a change, it lists what was rejected and why.

Two rules that come out of it:

- **The flight engine imports nothing from Svelte.** `src/lib/game/`
  is plain classes taking a canvas and callbacks — the flight and the
  artwork alike. Keep it that way; it's what makes a later native or
  engine move cheap.
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
