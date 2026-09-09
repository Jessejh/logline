/**
 * Which build is running, as `mm.dd.hh.mm` — the minute it was built.
 *
 * Distribution here is a URL and a service worker, not a store listing, so
 * there is otherwise no way to tell a fresh deploy from a cached one on the
 * phone in your hand. A build minute answers that at a glance; a semantic
 * version would not, because nothing bumps it.
 *
 * Rendered in the viewer's own timezone, so "was this built just now?" is
 * readable against their clock rather than the build server's.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function buildVersion(at: Date = new Date(__BUILD_TIME__)): string {
  if (Number.isNaN(at.getTime())) return '—';
  return [at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes()].map(pad).join('.');
}
