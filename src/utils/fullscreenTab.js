/**
 * "Open fullscreen in a new tab" — lets a consumer pop the chat out of a small
 * panel into a full browser tab for breathing room. Two ways to configure it:
 *   config.fullscreenTabUrl        — a URL the widget opens in a new tab
 *   config.onOpenFullscreenTab()   — a callback the consumer handles itself
 * The callback wins when both are set.
 */
export function hasFullscreenTab(config) {
  return !!(config && (config.fullscreenTabUrl || typeof config.onOpenFullscreenTab === 'function'));
}

export function openFullscreenTab(config) {
  if (!config) return false;
  if (typeof config.onOpenFullscreenTab === 'function') {
    config.onOpenFullscreenTab();
    return true;
  }
  if (config.fullscreenTabUrl) {
    window.open(config.fullscreenTabUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
