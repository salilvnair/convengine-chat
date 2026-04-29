/* ── Internal helpers ─────────────────────────────────────────────────────── */

function safeParseJson(value) {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findFieldDeep(obj, field, depth = 0) {
  if (!obj || depth > 6 || typeof obj !== 'object') return '';
  if (typeof obj[field] === 'string' && obj[field].trim()) return obj[field].trim();
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findFieldDeep(value, field, depth + 1);
      if (found) return found;
    }
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      const parsed = safeParseJson(value);
      if (parsed && typeof parsed === 'object') {
        const found = findFieldDeep(parsed, field, depth + 1);
        if (found) return found;
      }
    }
  }
  return '';
}

/* ── Public API ───────────────────────────────────────────────────────────── */

/**
 * Converts any payload value to a displayable string.
 * Handles primitives, objects, and null/undefined gracefully.
 */
export function stringifyPayload(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Extracts `intent` and `state` fields from anywhere in the response tree.
 * Used to display engine status in the UI.
 */
export function extractEngineStatus(response) {
  return {
    intent: findFieldDeep(response, 'intent'),
    state: findFieldDeep(response, 'state'),
  };
}
