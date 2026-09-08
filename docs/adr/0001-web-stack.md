# 0001 — Web first, Vite + TypeScript + Svelte

Status: accepted, 2026-09-08.
Supersedes the "Stack: not chosen yet" note in `CLAUDE.md`.

## Context

`CLAUDE.md` left the stack open and named three candidates: Godot exporting
to iOS/Android, React Native with a canvas, or native. The immediate need
turned out to be narrower than any of them — the app has to be openable from
a website on a phone, so it can be flown, shown and tested without a store
listing or a build on someone's device.

The grading phase is about six hundred lines of Canvas 2D with hand-rolled
perspective projection. No assets, no physics engine, no sprite batching.
The weight is all in the parts that do not exist yet: the journal, the
planner, and the village.

## Decision

A static site built with Vite and TypeScript, deployed to GitHub Pages, with
Svelte owning only the screens outside the flight.

- **The flight is framework-free.** `src/lib/game/flight.ts` is a plain class
  that takes a canvas and two callbacks. It knows nothing about Svelte, and a
  later move to another shell — or to a native wrapper — takes it unchanged.
- **Svelte owns the veils.** Intro, summary, journal. These are ordinary UI
  and deserve ordinary UI tooling; Svelte adds a few kilobytes and no runtime
  the game loop has to route around.
- **PWA, not just a page.** Manifest, service worker, offline precache. On
  iOS, an installed home-screen app is exempt from Safari's eviction of
  unused site data — which is the difference between a journal that keeps
  its history and one that quietly loses it. Installing is a durability
  feature here, not a nicety.
- **No backend.** Records live in IndexedDB with a localStorage fallback,
  behind `src/lib/storage/`. The on-device-default constraint is met by
  there being nowhere to send anything. Opt-in sync, if it ever happens,
  slots in as another driver behind the same interface.

## Alternatives considered

**PixiJS or Phaser.** Buys sprite batching and scene management that the
line-based flight has no use for, and a scene model that would fight the
DOM journal. Still open as an additive choice for the village screen alone,
if that screen turns out to need it.

**Godot 4 → HTML5.** Twenty to thirty megabytes of wasm before the first
frame, historically rough on mobile Safari, and painful for text-heavy
screens like the journal. Reasonable if the product later becomes
store-first; wrong for "open this link on your phone."

**React Native / Expo.** Native-shaped costs to ship a website. Only earns
its keep once store distribution is the actual plan.

**Next.js with a backend.** Directly against the on-device-storage
constraint, and adds hosting cost for nothing the product needs today.

## Consequences

- Distribution is a URL. No store review, no install friction, no revenue
  share — and no store surface either.
- **Haptics are Android-only.** iOS Safari has no vibration API at all, so
  the pulse on gate capture is silently absent on iPhone. This is a real
  loss against native and has no web workaround.
- Storage is the user's browser, so export/import ships from day one rather
  than as a later feature.
- Nothing here forecloses native. The engine is portable; if Godot or a
  native build wins later, this stays as the web front door.
