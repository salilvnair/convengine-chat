/* eslint-disable react-refresh/only-export-components */
import { builtInRendererProviders } from '../providers/index.js';
import { DefaultRenderer } from '../providers/DefaultRenderer.jsx';

// Re-export so consumers can import DefaultRenderer from the registry
export { DefaultRenderer };

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function tryParseJsonObject(rawText) {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function deriveEffectiveType(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return typeof payload.type === 'string' ? payload.type.trim() : '';
}

function sortByPriority(renderers) {
  return [...renderers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

/**
 * Resolves the correct renderer for a raw assistant response string.
 *
 * Resolution order:
 * 1. Consumer-supplied `extraProviders` (highest priority overrides)
 * 2. Built-in providers (FaqAnswer, etc.)
 * 3. DefaultRenderer — always matches as the last fallback
 *
 * Each provider must expose:
 *   - `key: string`           — unique identifier
 *   - `priority: number`      — higher wins
 *   - `match(ctx): boolean`   — ctx = { rawText, payload, effectiveType }
 *   - `Component: React.FC`   — receives `{ payload }`
 *
 * @param {string} rawText
 * @param {Array}  extraProviders  Consumer-registered renderer providers
 * @returns {{ key: string, Component: React.FC, payload: object|null }}
 */
export function resolveAssistantRenderer(rawText, extraProviders = []) {
  const payload = tryParseJsonObject(rawText);
  const effectiveType = deriveEffectiveType(payload);
  const context = { rawText, payload, effectiveType };

  const allProviders = sortByPriority([...extraProviders, ...builtInRendererProviders]);

  for (const renderer of allProviders) {
    if (typeof renderer.match === 'function' && renderer.match(context)) {
      return {
        key: renderer.key ?? 'custom',
        Component: renderer.Component,
        payload,
        hideBubble: renderer.hideBubble === true,
      };
    }
  }

  // Always falls through to the default
  return {
    key: 'default',
    Component: DefaultRenderer,
    payload: { rawText },
  };
}
