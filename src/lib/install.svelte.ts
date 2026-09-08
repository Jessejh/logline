/**
 * Home-screen install state.
 *
 * This matters more than it looks: an installed PWA is exempt from Safari's
 * eviction of unused site data, so installing is what makes the journal
 * durable on iOS. Chrome hands us a prompt; Safari does not, so iOS gets
 * instructions instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

export const install = $state({
  /** Already running from the home screen. */
  standalone: false,
  /** Chrome-style install prompt is available. */
  promptable: false,
  /** iOS Safari, where the user has to use the Share sheet themselves. */
  ios: false,
  dismissed: false
});

const DISMISS_KEY = 'logline:install-dismissed';

export function initInstall(): void {
  const ua = navigator.userAgent;
  install.ios = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  install.standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  try {
    install.dismissed = localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    install.dismissed = false;
  }

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    install.promptable = true;
  });

  addEventListener('appinstalled', () => {
    install.promptable = false;
    install.standalone = true;
  });
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  install.promptable = false;
}

export function dismissInstall(): void {
  install.dismissed = true;
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* nothing to remember it with; the hint returns next visit */
  }
}
