import { useEffect } from 'react';
import { useIcons } from '../../hooks/useIcons.js';

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
  shape = 'round',
  reply = null,
}) {
  const { SendIcon } = useIcons();
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
    shape === 'rect' ? 'ce-composer--rect' : '',
    reply ? 'ce-composer--has-reply' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const replyClickable = reply && typeof reply.onClick === 'function';

  return (
    <div className={composerClass}>
      {reply && (
        <div
          className="ce-composer-reply"
          style={reply.accent ? { '--ce-reply-accent': reply.accent } : undefined}
        >
          <button
            type="button"
            className="ce-composer-reply-main"
            data-clickable={replyClickable ? '1' : undefined}
            onClick={replyClickable ? reply.onClick : undefined}
            title={reply.title ?? (replyClickable ? 'Open' : undefined)}
          >
            <span className="ce-composer-reply-bar" />
            <span className="ce-composer-reply-text">
              {reply.label && <span className="ce-composer-reply-label">{reply.label}</span>}
              <span className="ce-composer-reply-quote">{reply.text}</span>
            </span>
          </button>
          {reply.clearable !== false && (
            <button
              type="button"
              className="ce-composer-reply-x"
              onClick={reply.onClear}
              title="Remove context"
              aria-label="Remove context"
            >
              ✕
            </button>
          )}
        </div>
      )}
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
