/**
 * All bubbles use rounded-rectangle shape — pill is retired.
 * Kept for backward compat: always returns 'ce-bubble--rect'.
 */
export function bubbleShapeClass(_text) {
  return 'ce-bubble--rect';
}

/**
 * Returns true when an assistant bubble contains an "Error:" prefix,
 * meaning it should be rendered in error state.
 */
export function isAssistantErrorBubble(bubble) {
  if (!bubble || bubble.role !== 'assistant') return false;
  const text = typeof bubble.text === 'string' ? bubble.text : String(bubble.text ?? '');
  return text.trim().startsWith('Error:');
}
