<script lang="ts">
  import Artwork from './components/Artwork.svelte';
  import DesktopGate from './components/DesktopGate.svelte';
  import FlightView from './components/FlightView.svelte';
  import Intro from './components/Intro.svelte';
  import Journal from './components/Journal.svelte';
  import Summary from './components/Summary.svelte';
  import type { FlightResult } from './lib/game/types';
  import { listEntries, makeEntry, saveEntry, type Entry } from './lib/storage/entries';
  import { goFullscreen } from './lib/viewport';

  type View = 'intro' | 'flight' | 'artwork' | 'summary' | 'journal';

  let view = $state<View>('intro');
  let entry = $state<Entry | null>(null);
  /** Where the artwork hands back to: the summary after a flight, or the journal. */
  let artworkReturn = $state<'summary' | 'journal'>('summary');
  let saveError = $state<string | null>(null);
  let entryCount = $state(0);

  // Mobile-only is a product constraint, not a preference. Anything wide with a
  // mouse gets told to open this on a phone, with an escape hatch for testing.
  const WIDE = '(min-width: 760px) and (pointer: fine)';
  let wide = $state(false);
  let bypassGate = $state(false);

  $effect(() => {
    const mq = matchMedia(WIDE);
    const sync = () => (wide = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  $effect(() => {
    void refreshCount();
  });

  async function refreshCount() {
    entryCount = (await listEntries()).length;
  }

  async function onFlightComplete(result: FlightResult) {
    const record = makeEntry(result);
    saveError = null;
    try {
      await saveEntry(record);
      await refreshCount();
    } catch {
      saveError = 'This entry could not be saved on this device. It is still shown below.';
    }
    entry = record;
    artworkReturn = 'summary';
    view = 'artwork';
  }

  /**
   * Entering the flight is the one moment there is a user gesture to spend on
   * fullscreen, which is the only way to be rid of the URL bar in a browser.
   * It quietly does nothing on iPhone, where no such API exists — installing
   * to the home screen is the answer there.
   */
  function startFlight() {
    void goFullscreen();
    view = 'flight';
  }

  function showArtwork(record: Entry, from: 'summary' | 'journal') {
    entry = record;
    artworkReturn = from;
    view = 'artwork';
  }
</script>

{#if wide && !bypassGate}
  <DesktopGate onContinue={() => (bypassGate = true)} />
{:else if view === 'intro'}
  <Intro
    entryCount={entryCount}
    onBegin={startFlight}
    onJournal={() => (view = 'journal')}
  />
{:else if view === 'flight'}
  <FlightView onComplete={onFlightComplete} />
{:else if view === 'artwork' && entry}
  <Artwork
    entry={entry}
    continueLabel={artworkReturn === 'summary' ? 'Continue' : 'Back'}
    onContinue={() => (view = artworkReturn)}
  />
{:else if view === 'summary' && entry}
  <Summary
    entry={entry}
    saveError={saveError}
    onAgain={startFlight}
    onArtwork={() => entry && showArtwork(entry, 'summary')}
    onJournal={() => (view = 'journal')}
  />
{:else if view === 'journal'}
  <Journal
    onBack={() => (view = 'intro')}
    onChanged={refreshCount}
    onView={(record) => showArtwork(record, 'journal')}
  />
{/if}
