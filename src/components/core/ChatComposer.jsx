import { useEffect } from 'react';
import { SendIcon } from '../../icons/Icons.jsx';

/**
 * Textarea + send button composition.
 * Auto-grows vertically up to a max-height of ~168 px.
 *
 * @param {{ centered?: boolean }} props
 */
export function ChatComposer({
  inputRef,
  input,
  isTyping,
  isMultiLine,
  onInputChange,
  onKeyDown,
  onSend,
  placeholder = 'Ask ConvEngine…',
  centered = false,
  fullscreen = false,
}) {
  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;
    if (!input.trim()) {
      el.style.height = '';
      return;
    }
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input, inputRef]);

  const composerClass = [
    'ce-composer',
    centered    ? 'ce-composer--centered'    : '',
    isMultiLine ? 'ce-composer--multiline'   : '',
    fullscreen  ? 'ce-composer--fullscreen'  : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={composerClass}>
      <textarea
        ref={inputRef}
        className="ce-composer-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={isTyping}
        rows={1}
        aria-label="Message input"
        aria-multiline="true"
      />
      <button
        type="button"
        className="ce-composer-send"
        onClick={onSend}
        disabled={isTyping || !input.trim()}
        title="Send message"
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </div>
  );
}
