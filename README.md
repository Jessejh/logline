# Logline

A line drawn through the day.

Mobile-only game that turns daily reflection into flight. Answer
questions by steering through them — the line behind you is the
record, the line ahead is where you're pointing. Each gate you go
through gives up a colour, and the day's line is drawn over the
colours you collected.

Design history and decisions: [`docs/DESIGN.md`](docs/DESIGN.md).
Picking this up in Claude Code: read [`CLAUDE.md`](CLAUDE.md) first.

## Status

The grading phase runs as an installable web app. Track phase and
village phase are designed on paper, not built.

What works today:

- The eight-question flight, ported from the prototype with its
  steering constants unchanged. Hold to fly, lift to think.
- The logged line and projected line, the lit cell you are on course
  for, a rear-view mirror, and the summary where the logged line
  becomes the journal entry.
- The piece drawn after each flight, and again from the journal: the
  line on paper over a band of colour per question.
- A journal of past flights, stored on the device, with JSON export
  and import.
- Offline use and home-screen install.

## Running it

```sh
npm install
npm run dev -- --host    # then open the network URL on your phone
```

`--host` matters: the app is meant to be flown with a thumb, and the
dev server has to be reachable from the phone on your network. On a
desktop browser you get a screen telling you to do exactly that,
with a "continue anyway" escape hatch for development.

```sh
npm run check     # svelte-check, the typecheck CI runs
npm run build     # check, then production build into dist/
npm run preview   # serve dist/ locally
npm run icons     # re-render app icons (only when the mark changes)
```

## Deploying

Pushes to `main` build and publish to GitHub Pages via
`.github/workflows/deploy.yml`. The production base path is
`/logline/`, set in `vite.config.ts` — change it there if the repo is
renamed or moved to a custom domain.

**One-time setup:** in the repository's Settings → Pages, set Source
to "GitHub Actions". Until that is done the workflow will fail at the
deploy step.

The front page carries the build minute as `mm.dd.hh.mm`, in the
viewer's own timezone. Distribution is a URL behind a service worker,
so that stamp is how you tell on the phone whether the deploy you just
pushed is the one you are looking at.

## Stack

Vite + TypeScript, Svelte for the screens outside the flight, no
backend. Reasoning and rejected alternatives:
[`docs/adr/0001-web-stack.md`](docs/adr/0001-web-stack.md).

The flight engine is deliberately framework-free — `src/lib/game/`
imports nothing from Svelte, so it can move to another shell, or into
a native wrapper, unchanged.

## Repo layout

```
docs/          design decisions, rejected ideas, open questions
docs/adr/      decision records
prototypes/    throwaway reference builds — not production code
scripts/       one-off build tooling (icon rendering)
src/lib/game/  the flight: engine, questions, palette, miniature, artwork
src/lib/storage/  on-device records, export/import
src/components/   the screens outside the flight
```

## Storage and privacy

Records never leave the device. They live in IndexedDB, with a
localStorage fallback for browsers that refuse it.

This has a sharp edge worth knowing: iOS evicts site data for pages
the user has not added to the home screen, so the app asks to be
installed and ships export/import from day one. The journal screen
says the same thing to the player, in plainer words.
