/**
 * The visible area, and how to get more of it.
 *
 * A browser's URL bar is not part of the page, but it covers it. The layout
 * viewport that `position: fixed; inset: 0` sizes against runs the full height
 * of the screen, while the *visual* viewport — what the player can actually
 * see — is whatever the browser chrome leaves over. That gap is why the
 * question sat under the URL bar.
 *
 * Two things happen here. The visual viewport is published as CSS variables so
 * the flight and the screens around it lay out against real estate that is
 * genuinely on screen, and real fullscreen is asked for where the browser has
 * it — which removes the chrome entirely rather than working around it.
 *
 * No Svelte import: this is plain DOM, callable from the engine or a component.
 */

/** Height of the area actually visible, in CSS px. */
export const APP_HEIGHT_VAR = '--app-h';
/** How far the visible area is pushed down inside the layout viewport. */
export const APP_TOP_VAR = '--app-top';
/**
 * Top inset to keep text clear of the notch *and* of browser chrome, as a
 * plain px length so the canvas can read it as a number. In fullscreen or
 * standalone it collapses to the safe-area inset alone.
 */
export const APP_INSET_VAR = '--app-inset';

/**
 * `env(safe-area-inset-top)` resolved to px. There is no way to read an env()
 * from script, so a hidden probe is sized by it and measured.
 */
function measureSafeTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);' +
    'visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

/** The visible height right now, whatever the chrome is doing. */
export function visibleHeight(): number {
  return Math.round(visualViewport?.height ?? innerHeight);
}

/** The visible width right now. */
export function visibleWidth(): number {
  return Math.round(visualViewport?.width ?? innerWidth);
}

/** True while the page has the screen to itself — fullscreen or installed. */
export function isImmersive(): boolean {
  return (
    document.fullscreenElement !== null ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches
  );
}

function publish(): void {
  const root = document.documentElement;
  const h = visibleHeight();
  const top = Math.round(visualViewport?.offsetTop ?? 0);

  // What the chrome is eating off the top. Safari insets fixed elements below
  // its own bar, Chrome does not, so this is a floor rather than a measurement:
  // it is 0 whenever the page already owns the whole screen.
  const chrome = isImmersive() ? 0 : Math.max(0, Math.round(innerHeight - h));

  root.style.setProperty(APP_HEIGHT_VAR, `${h}px`);
  root.style.setProperty(APP_TOP_VAR, `${top}px`);
  root.style.setProperty(APP_INSET_VAR, `${Math.round(measureSafeTop() + Math.min(chrome, 24))}px`);
}

/**
 * Keep the variables in step with the chrome. Returns a teardown.
 * Safe to call more than once; the last caller wins and each teardown is
 * independent.
 */
export function trackViewport(): () => void {
  publish();
  const vv = visualViewport;
  vv?.addEventListener('resize', publish);
  vv?.addEventListener('scroll', publish);
  addEventListener('resize', publish);
  addEventListener('orientationchange', publish);
  document.addEventListener('fullscreenchange', publish);
  return () => {
    vv?.removeEventListener('resize', publish);
    vv?.removeEventListener('scroll', publish);
    removeEventListener('resize', publish);
    removeEventListener('orientationchange', publish);
    document.removeEventListener('fullscreenchange', publish);
  };
}

type FullscreenCapable = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

/**
 * Whether this browser will give the page the whole screen.
 *
 * False on iPhone: iOS Safari exposes `webkitRequestFullscreen` on video
 * elements only, never on the document, so there is no way to dismiss the URL
 * bar from script. Installing to the home screen is the iOS answer, which is
 * one more reason `InstallHint` is not optional polish.
 */
export function canGoFullscreen(): boolean {
  const el = document.documentElement as FullscreenCapable;
  return typeof (el.requestFullscreen ?? el.webkitRequestFullscreen) === 'function';
}

/**
 * Ask for the whole screen. Must be called inside a user gesture — browsers
 * reject it anywhere else, which is why this hangs off the Begin button rather
 * than off startup. Failure is fine and silent: the layout already copes with
 * chrome being there.
 */
export async function goFullscreen(): Promise<void> {
  if (document.fullscreenElement) return;
  const el = document.documentElement as FullscreenCapable;
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!req) return;
  try {
    await req.call(el, { navigationUI: 'hide' });
  } catch {
    // Denied, or the browser only allows it from a different gesture. Either
    // way the flight is playable with the bar showing.
    return;
  }
  // Portrait is a product constraint (single thumb), and the lock is only
  // permitted once fullscreen is held. Unsupported on desktop and on iOS, and
  // absent from the DOM lib types, hence the cast.
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: string) => Promise<void>;
  };
  try {
    await orientation?.lock?.('portrait');
  } catch {
    /* not available; the manifest already asks for portrait when installed */
  }
}
