/**
 * Detects whether the app is running inside a "regular web page" context where
 * the browser chrome (address bar / URL bar, tab strip) eats part of the screen.
 *
 * The key insight: `window.innerHeight` reports the *visual* viewport (the area
 * actually visible below the address bar), while older/alternative APIs report
 * the full layout window. When those numbers disagree by more than a few pixels,
 * the address bar is taking up space and must be subtracted from our layout
 * height so nothing gets clipped or pushed under it.
 *
 * In standalone/app mode (installed PWA, Electron, etc.) there is no address
 * bar, so innerHeight already equals the real available height.
 */

// If measured heights disagree by more than this many px, we assume an
// address bar / browser UI is overlapping the layout viewport.
const CHROME_THRESHOLD_PX = 8;

export interface BrowserChromeInfo {
  /** True when browser UI (address bar/tabs) overlaps the layout viewport. */
  hasAddressBar: boolean;
  /** Estimated vertical space consumed by browser chrome, in CSS pixels. */
  chromeHeightPx: number;
}

/**
 * Measure how much vertical space the browser chrome occupies.
 * Returns 0 when running fullscreen / standalone / app-like.
 */
export function measureBrowserChrome(): BrowserChromeInfo {
  // Visual viewport = what's actually on screen right now.
  const visualHeight = window.visualViewport?.height ?? window.innerHeight;

  // Layout viewport candidates that include hidden browser UI in some browsers.
  const outer = window.outerHeight || 0;
  const docClient = document.documentElement.clientHeight || 0;

  // Prefer comparing against whichever API best represents the *full* window.
  // On iOS Safari & Android Chrome, outerHeight includes the address bar but
  // innerHeight does not — their difference is exactly the chrome height.
  let chromeHeightPx = 0;

  if (outer > 0) {
    const diff = outer - visualHeight;
    if (diff > CHROME_THRESHOLD_PX) chromeHeightPx = diff;
  }

  // Fallback for browsers where outerHeight === innerHeight (desktop):
  // compare document client height vs visual viewport.
  if (chromeHeightPx === 0 && docClient > 0) {
    const diff = docClient - visualHeight;
    if (diff > CHROME_THRESHOLD_PX) chromeHeightPx = diff;
  }

  return {
    hasAddressBar: chromeHeightPx > CHROME_THRESHOLD_PX,
    chromeHeightPx,
  };
}

/**
 * Subscribe to browser-chrome changes (address bar show/hide on scroll, window
 * resize, orientation change). Calls back with the latest measurement.
 * Returns an unsubscribe function.
 */
export function onBrowserChromeChange(
  callback: (info: BrowserChromeInfo) => void
): () => void {
  const emit = () => callback(measureBrowserChrome());

  window.addEventListener('resize', emit);
  window.addEventListener('orientationchange', emit);
  window.visualViewport?.addEventListener('resize', emit);
  window.visualViewport?.addEventListener('scroll', emit);

  emit();

  return () => {
    window.removeEventListener('resize', emit);
    window.removeEventListener('orientationchange', emit);
    window.visualViewport?.removeEventListener('resize', emit);
    window.visualViewport?.removeEventListener('scroll', emit);
  };
}
